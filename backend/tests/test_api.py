import json
import time
from contextlib import closing

import jwt
import numpy as np
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from backend.audio import AudioEngine, AudioError, cosine
from backend.main import Settings, create_app


class FakeInference:
    """Deterministic adapter only injected by tests; production has no bypass flag."""
    def process(self, content, speaker=False, language=None):
        self.last_language = language
        payload = json.loads(content)
        return {"text": payload["text"], "embedding": np.array(payload.get("vector", [1., 0.])) if speaker else None}


@pytest.fixture
def service(tmp_path):
    config = Settings("test-only-secret-" * 4, Fernet.generate_key().decode(), str(tmp_path / "test.sqlite"))
    return TestClient(create_app(config, FakeInference())), config


def auth(config, scope="enroll", subject="candidate-a", **overrides):
    claims = {"sub": subject, "scope": scope, "iss": "optiexam-web", "aud": "optiexam-audio", "iat": int(time.time()), "exp": int(time.time()) + 60}
    claims.update(overrides)
    return {"Authorization": f"Bearer {jwt.encode(claims, config.secret, algorithm='HS256')}"}


def challenge(client, config, purpose="enroll", subject="candidate-a"):
    response = client.post("/api/auth/challenge", headers=auth(config, purpose, subject), json={"purpose": purpose})
    assert response.status_code == 200, response.text
    return response.json()


def audio(text, vector=None):
    return ("recording.webm", json.dumps({"text": text, "vector": vector or [1, 0]}).encode(), "audio/webm")


def enroll(client, config):
    data = challenge(client, config)
    response = client.post("/api/auth/enroll", headers=auth(config), data={"challenge_id": data["challenge_id"], "consent": "true"}, files=[("files", audio(phrase)) for phrase in data["phrases"]])
    assert response.status_code == 200, response.text
    return data


def test_enrollment_login_jwt_and_replay(service):
    client, config = service
    enroll(client, config)
    data = challenge(client, config, "login")
    arguments = dict(headers=auth(config, "login"), data={"challenge_id": data["challenge_id"]}, files={"file": audio(data["phrases"][0])})
    response = client.post("/api/auth/login", **arguments)
    assert response.status_code == 200
    claims = jwt.decode(response.json()["access_token"], config.secret, algorithms=["HS256"], audience="optiexam-web", issuer="optiexam-audio")
    assert claims["sub"] == "candidate-a" and claims["amr"] == ["voice"]
    assert claims["exp"] - claims["iat"] == 60
    assert client.post("/api/auth/login", **arguments).status_code == 401


@pytest.mark.parametrize("text,vector", [(None, [0, 1]), ("an old recorded sentence", [1, 0])])
def test_mismatch_or_wrong_phrase_rejected(service, text, vector):
    client, config = service
    enroll(client, config)
    data = challenge(client, config, "login")
    response = client.post("/api/auth/login", headers=auth(config, "login"), data={"challenge_id": data["challenge_id"]}, files={"file": audio(text or data["phrases"][0], vector)})
    assert response.status_code == 401


def test_requires_auth_scope_and_consent(service):
    client, config = service
    assert client.post("/api/auth/challenge", json={"purpose": "enroll"}).status_code == 401
    assert client.post("/api/auth/challenge", json={"purpose": "enroll"}, headers=auth(config, "login")).status_code == 403
    data = challenge(client, config)
    for consent, count in [("false", 3), ("true", 2)]:
        result = client.post("/api/auth/enroll", headers=auth(config), data={"challenge_id": data["challenge_id"], "consent": consent}, files=[("files", audio(phrase)) for phrase in data["phrases"][:count]])
        assert result.status_code == 422


def test_challenge_is_bound_to_account_and_expires(service):
    client, config = service
    data = challenge(client, config)
    response = client.post("/api/auth/enroll", headers=auth(config, subject="candidate-b"), data={"challenge_id": data["challenge_id"], "consent": "true"}, files=[("files", audio(phrase)) for phrase in data["phrases"]])
    assert response.status_code == 401
    import sqlite3
    with closing(sqlite3.connect(config.db_path)) as db, db:
        db.execute("UPDATE challenges SET expires=0")
    response = client.post("/api/auth/enroll", headers=auth(config), data={"challenge_id": data["challenge_id"], "consent": "true"}, files=[("files", audio(phrase)) for phrase in data["phrases"]])
    assert response.status_code == 401


def test_encrypted_template_delete_and_transcription(service):
    client, config = service
    enroll(client, config)
    import sqlite3
    with closing(sqlite3.connect(config.db_path)) as db:
        value = db.execute("SELECT vector FROM profiles").fetchone()[0]
    assert value.startswith(b"gAAAA") and b"[1.0" not in value
    response = client.post("/api/transcribe", headers=auth(config, "transcribe"), files={"file": audio("My answer is forty two.")})
    assert response.json() == {"text": "My answer is forty two.", "requires_review": True}
    assert client.delete("/api/auth/enroll", headers=auth(config)).json() == {"deleted": True}
    data = challenge(client, config, "login")
    assert client.post("/api/auth/login", headers=auth(config, "login"), data={"challenge_id": data["challenge_id"]}, files={"file": audio(data["phrases"][0])}).status_code == 401


def test_upload_validation_and_rate_limit(service):
    client, config = service
    for file, status in [(('x.txt', b'bad', 'text/plain'), 415), (('x.webm', b'', 'audio/webm'), 413), (('x.webm', b'x' * (8 * 1024 * 1024 + 1), 'audio/webm'), 413)]:
        assert client.post("/api/transcribe", headers=auth(config, "transcribe"), files={"file": file}).status_code == status
    for _ in range(20):
        challenge(client, config)
    assert client.post("/api/auth/challenge", headers=auth(config), json={"purpose": "enroll"}).status_code == 429


def test_invalid_jwt_and_missing_configuration(service, tmp_path):
    client, config = service
    for headers in [auth(config, exp=1), auth(config, aud="another-app"), {"Authorization": "Bearer invalid"}]:
        assert client.post("/api/auth/challenge", json={"purpose": "enroll"}, headers=headers).status_code == 401
    unconfigured = TestClient(create_app(Settings("", "", str(tmp_path / "empty.sqlite")), FakeInference()))
    assert unconfigured.post("/api/auth/challenge", json={"purpose": "enroll"}).status_code == 503


def test_temporary_audio_removed_on_decode_failure(tmp_path, monkeypatch):
    import tempfile
    monkeypatch.setattr(tempfile, "tempdir", str(tmp_path))
    engine = AudioEngine()
    def fail(_):
        raise AudioError("invalid audio")
    monkeypatch.setattr(engine, "_decode", fail)
    with pytest.raises(AudioError):
        engine.process(b"not audio")
    assert list(tmp_path.iterdir()) == []


def test_cosine_boundary_and_bad_vectors():
    assert cosine([1, 0], [0.85, np.sqrt(1 - 0.85 ** 2)]) >= .85
    assert cosine([1, 0], [0.84, np.sqrt(1 - 0.84 ** 2)]) < .85
    with pytest.raises(AudioError):
        cosine([0, 0], [1, 0])
    with pytest.raises(AudioError):
        cosine([float("nan"), 1], [1, 0])


def test_hindi_enrollment_login_and_language_validation(service):
    client, config = service
    def hindi_challenge(purpose):
        response = client.post("/api/auth/challenge", headers=auth(config, purpose), json={"purpose": purpose, "language": "hi"})
        assert response.status_code == 200
        assert response.json()["language"] == "hi"
        return response.json()
    data = hindi_challenge("enroll")
    assert all(any("\u0900" <= char <= "\u097f" for char in phrase) for phrase in data["phrases"])
    result = client.post("/api/auth/enroll", headers=auth(config), data={"challenge_id": data["challenge_id"], "consent": "true"}, files=[("files", audio(phrase + "।")) for phrase in data["phrases"]])
    assert result.status_code == 200
    assert client.app.state.engine.last_language == "hi"
    data = hindi_challenge("login")
    result = client.post("/api/auth/login", headers=auth(config, "login"), data={"challenge_id": data["challenge_id"]}, files={"file": audio(data["phrases"][0])})
    assert result.status_code == 200
    data = hindi_challenge("login")
    result = client.post("/api/auth/login", headers=auth(config, "login"), data={"challenge_id": data["challenge_id"]}, files={"file": audio("नकली गलत वाक्यांश")})
    assert result.status_code == 401
    assert client.post("/api/auth/challenge", headers=auth(config), json={"purpose": "enroll", "language": "invalid"}).status_code == 422


def test_hindi_dictation_stays_in_devanagari(service):
    client, config = service
    text = "जनवरी में चालीस पुस्तकें पढ़ीं।"
    result = client.post("/api/transcribe", headers=auth(config, "transcribe"), data={"language": "hi"}, files={"file": audio(text)})
    assert result.status_code == 200
    assert result.json() == {"text": text, "requires_review": True}
    assert client.app.state.engine.last_language == "hi"
    assert client.post("/api/transcribe", headers=auth(config, "transcribe"), data={"language": "invalid"}, files={"file": audio(text)}).status_code == 422
