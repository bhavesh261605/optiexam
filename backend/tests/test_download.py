import hashlib
import io
import sys
from types import SimpleNamespace

import pytest
from backend.download_models import download_whisper


def test_checkpoint_resumes_and_checks_hash(tmp_path, monkeypatch):
    content = b"complete official checkpoint fixture"
    digest = hashlib.sha256(content).hexdigest()
    monkeypatch.setitem(sys.modules, "whisper", SimpleNamespace(_MODELS={"tiny": f"https://example.test/{digest}/tiny.pt"}))
    (tmp_path / "tiny.pt.partial").write_bytes(content[:8])
    def transfer(request, timeout):
        assert request.get_header("Range") == "bytes=8-"
        response = io.BytesIO(content[8:])
        response.status = 206
        response.headers = {"Content-Range": f"bytes 8-{len(content)-1}/{len(content)}"}
        return response
    monkeypatch.setattr("urllib.request.urlopen", transfer)
    download_whisper("tiny", tmp_path)
    assert (tmp_path / "tiny.pt").read_bytes() == content
    assert not (tmp_path / "tiny.pt.partial").exists()
    monkeypatch.setattr("urllib.request.urlopen", lambda *args, **kwargs: pytest.fail("Verified files must not redownload"))
    download_whisper("tiny", tmp_path)


def test_bad_checkpoint_never_becomes_loadable(tmp_path, monkeypatch):
    digest = hashlib.sha256(b"expected").hexdigest()
    monkeypatch.setitem(sys.modules, "whisper", SimpleNamespace(_MODELS={"tiny": f"https://example.test/{digest}/tiny.pt"}))
    def transfer(*args, **kwargs):
        response = io.BytesIO(b"truncated")
        response.status = 200
        response.headers = {}
        return response
    monkeypatch.setattr("urllib.request.urlopen", transfer)
    with pytest.raises(RuntimeError, match="incomplete"):
        download_whisper("tiny", tmp_path)
    assert not (tmp_path / "tiny.pt").exists()
