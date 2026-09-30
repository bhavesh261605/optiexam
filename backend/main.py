"""FastAPI voice identity and transcription service; bind to loopback behind Next.js."""
import hashlib
import asyncio
import json
import os
import re
import secrets
import sqlite3
import time
import unicodedata
from typing import Literal
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path

import jwt
import numpy as np
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from .audio import AudioEngine, AudioError, ModelUnavailable, normalize, cosine

MAX_BYTES = 8 * 1024 * 1024
MIMES = {"audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mp4"}
WORDS = ("river", "garden", "window", "silver", "planet", "morning", "orange", "music", "forest", "pencil", "yellow", "ocean", "purple", "summer", "basket", "little")
HINDI_WORDS = ("नदी", "बगीचा", "खिड़की", "चाँदी", "धरती", "सुबह", "संतरा", "संगीत", "जंगल", "किताब", "पीला", "सागर", "बादल", "गर्मी", "टोकरी", "कमल")


@dataclass
class Settings:
    secret: str
    template_key: str
    db_path: str = "data/voice.sqlite"
    threshold: float = 0.85

    @classmethod
    def environment(cls):
        return cls(os.getenv("VOICE_JWT_SECRET", ""), os.getenv("VOICE_TEMPLATE_KEY", ""),
                   os.getenv("VOICE_DB_PATH", "data/voice.sqlite"), float(os.getenv("VOICE_MATCH_THRESHOLD", "0.85")))


class ChallengeRequest(BaseModel):
    purpose: str
    language: Literal["en", "hi"] = "en"


def create_app(settings=None, engine=None):
    config = settings or Settings.environment()
    app = FastAPI(title="OptiExam private audio service", docs_url=None, redoc_url=None)
    app.state.engine = engine or AudioEngine()
    inference_slot = asyncio.Semaphore(1)
    cipher = Fernet(config.template_key.encode()) if config.template_key else None
    configured = len(config.secret) >= 32 and cipher is not None
    if not 0 < config.threshold <= 1:
        raise ValueError("VOICE_MATCH_THRESHOLD must be greater than 0 and at most 1")
    Path(config.db_path).resolve().parent.mkdir(parents=True, exist_ok=True)

    def connect():
        connection = sqlite3.connect(config.db_path, timeout=10)
        connection.row_factory = sqlite3.Row
        return connection

    with closing(connect()) as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY, vector BLOB NOT NULL, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, purpose TEXT NOT NULL, phrases TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS limits(bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);
        """)

    def identity(authorization: str = Header(default="")):
        if not configured:
            raise HTTPException(503, "Configure VOICE_JWT_SECRET and VOICE_TEMPLATE_KEY on the server.")
        try:
            claims = jwt.decode(authorization.removeprefix("Bearer "), config.secret,
                                algorithms=["HS256"], audience="optiexam-audio", issuer="optiexam-web",
                                options={"require": ["exp", "iat", "sub", "scope"]})
            if not isinstance(claims["sub"], str) or not claims["sub"]:
                raise jwt.InvalidTokenError()
            return claims
        except jwt.InvalidTokenError as exc:
            raise HTTPException(401, "A valid application authorization is required.") from exc

    def require(claims, scope):
        if claims["scope"] != scope:
            raise HTTPException(403, "This authorization cannot perform that action.")

    def limit(subject, action, maximum):
        bucket = hashlib.sha256(f"{subject}:{action}".encode()).hexdigest()
        now = int(time.time())
        with closing(connect()) as db, db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM limits WHERE reset < ?", (now,))
            row = db.execute("SELECT count FROM limits WHERE bucket=?", (bucket,)).fetchone()
            if row and row["count"] >= maximum:
                raise HTTPException(429, "Too many attempts. Try again in 15 minutes or use password sign-in.")
            db.execute("INSERT INTO limits VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1", (bucket, now + 900))

    async def read(file):
        try:
            if (file.content_type or "").split(";")[0] not in MIMES:
                raise HTTPException(415, "Use a supported audio recording format.")
            content = await file.read(MAX_BYTES + 1)
            if not content or len(content) > MAX_BYTES:
                raise HTTPException(413, "Audio must be nonempty and smaller than 8 MB.")
            return content
        finally:
            await file.close()

    async def infer(content, speaker=False, language=None):
        try:
            await asyncio.wait_for(inference_slot.acquire(), timeout=0.1)
        except TimeoutError as exc:
            raise HTTPException(503, "Audio processing is busy. Please retry shortly.") from exc
        try:
            return await run_in_threadpool(app.state.engine.process, content, speaker, language)
        except AudioError as exc:
            raise HTTPException(422, str(exc)) from exc
        except ModelUnavailable as exc:
            raise HTTPException(503, str(exc)) from exc
        finally:
            inference_slot.release()

    def consume(challenge_id, claims, purpose):
        with closing(connect()) as db, db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM challenges WHERE id=? AND user_id=? AND purpose=?", (challenge_id, claims["sub"], purpose)).fetchone()
            if not row or row["expires"] < time.time():
                raise HTTPException(401, "Challenge expired or already used. Start a new recording.")
            db.execute("DELETE FROM challenges WHERE id=?", (challenge_id,))
            return json.loads(row["phrases"])

    def check_phrase(text, phrase):
        def tokens(value):
            value = unicodedata.normalize("NFC", value).casefold()
            return "".join(char if unicodedata.category(char)[0] in {"L", "M", "N"} else " " for char in value).split()
        if tokens(text) != tokens(phrase):
            raise HTTPException(401, "The spoken challenge did not match. Request a new challenge and try again.")

    @app.get("/health")
    def health():
        return {"configured": configured, "service": "optiexam-audio", "models_loaded": app.state.engine._whisper is not None if isinstance(app.state.engine, AudioEngine) else False}

    @app.post("/api/auth/challenge")
    def challenge(body: ChallengeRequest, claims=Depends(identity)):
        if body.purpose not in {"enroll", "login"}:
            raise HTTPException(422, "Choose enroll or login.")
        require(claims, body.purpose)
        limit(claims["sub"], "challenge", 20)
        words = HINDI_WORDS if body.language == "hi" else WORDS
        phrases = [" ".join(secrets.choice(words) for _ in range(6)) for _ in range(3 if body.purpose == "enroll" else 1)]
        challenge_id = secrets.token_urlsafe(32)
        with closing(connect()) as db, db:
            db.execute("DELETE FROM challenges WHERE expires < ?", (int(time.time()),))
            db.execute("INSERT INTO challenges VALUES(?,?,?,?,?)", (challenge_id, claims["sub"], body.purpose, json.dumps(phrases), int(time.time()) + 300))
        return {"challenge_id": challenge_id, "phrases": phrases, "expires_in": 300, "language": body.language}

    @app.post("/api/auth/enroll")
    async def enroll(challenge_id: str = Form(), consent: bool = Form(), files: list[UploadFile] = File(), claims=Depends(identity)):
        require(claims, "enroll")
        if not consent or len(files) != 3:
            raise HTTPException(422, "Explicit consent and exactly three audio samples are required.")
        limit(claims["sub"], "enroll", 5)
        phrases = consume(challenge_id, claims, "enroll")
        vectors = []
        for file, phrase in zip(files, phrases):
            result = await infer(await read(file), True, "hi" if any("\u0900" <= char <= "\u097f" for char in phrase) else "en")
            check_phrase(result["text"], phrase)
            vectors.append(normalize(result["embedding"]))
        if any(cosine(vectors[0], vector) < config.threshold for vector in vectors[1:]):
            raise HTTPException(422, "Samples are inconsistent. Record all three again in a quiet place.")
        vector = normalize(np.mean(vectors, axis=0))
        encoded = cipher.encrypt(json.dumps(vector.tolist()).encode())
        with closing(connect()) as db, db:
            db.execute("INSERT INTO profiles VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET vector=excluded.vector,created=excluded.created", (claims["sub"], encoded, int(time.time())))
        return {"enrolled": True, "user_id": claims["sub"]}

    @app.delete("/api/auth/enroll")
    def remove_profile(claims=Depends(identity)):
        require(claims, "enroll")
        with closing(connect()) as db, db:
            db.execute("DELETE FROM profiles WHERE user_id=?", (claims["sub"],))
            db.execute("DELETE FROM challenges WHERE user_id=?", (claims["sub"],))
        return {"deleted": True}

    @app.post("/api/auth/login")
    async def login(challenge_id: str = Form(), file: UploadFile = File(), claims=Depends(identity)):
        require(claims, "login")
        limit(claims["sub"], "login", 5)
        phrase = consume(challenge_id, claims, "login")[0]
        content = await read(file)
        with closing(connect()) as db:
            row = db.execute("SELECT vector FROM profiles WHERE user_id=?", (claims["sub"],)).fetchone()
        if not row:
            raise HTTPException(401, "Voice sign-in failed. Use password sign-in or enroll from your profile.")
        result = await infer(content, True, "hi" if any("\u0900" <= char <= "\u097f" for char in phrase) else "en")
        check_phrase(result["text"], phrase)
        try:
            vector = json.loads(cipher.decrypt(row["vector"]))
        except InvalidToken as exc:
            raise HTTPException(503, "Voice profile cannot be read. Use password sign-in.") from exc
        if cosine(result["embedding"], vector) < config.threshold:
            raise HTTPException(401, "Voice did not match. Use password sign-in or try a new challenge.")
        now = int(time.time())
        token = jwt.encode({"sub": claims["sub"], "iat": now, "exp": now + 60,
                            "iss": "optiexam-audio", "aud": "optiexam-web", "jti": secrets.token_urlsafe(32), "amr": ["voice"]}, config.secret, algorithm="HS256")
        return {"access_token": token, "token_type": "bearer", "expires_in": 60}

    @app.post("/api/transcribe")
    async def transcribe(file: UploadFile = File(), language: Literal["en", "hi", "auto"] = Form("auto"), claims=Depends(identity)):
        require(claims, "transcribe")
        limit(claims["sub"], "transcribe", 30)
        result = await infer(await read(file), language=None if language == "auto" else language)
        if not result["text"]:
            raise HTTPException(422, "No speech was recognized. Your existing answer has not changed.")
        return {"text": result["text"], "requires_review": True}

    return app


app = create_app()
