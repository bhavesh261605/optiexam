# OptiExam audio and accessibility modules

## Local setup (Python 3.11 or 3.12 and Node 24)

From the repository root:

```powershell
python backend/setup.py --models
.venv/Scripts/python.exe -m pip install -r backend/requirements-test.txt
.venv/Scripts/python.exe -m backend.download_models
.venv/Scripts/python.exe -m backend.run
```

In a second terminal:

```powershell
npm ci
npm run build
npm run start -- --port 3001
```

On Linux/macOS use `.venv/bin/python`. The setup script generates separate JWT and template-encryption keys in ignored `.env.voice` and shares only the server JWT key with Next through ignored `.env.local`. Preserve existing settings; if keys were configured independently, ensure VOICE_JWT_SECRET matches in both processes. Never use NEXT_PUBLIC for either secret. Restart Next after configuring secrets.

The ML installation downloads CPU PyTorch and several hundred MB of model dependencies/weights. ffmpeg is supplied by `imageio-ffmpeg` on supported systems; `FFMPEG_PATH` can point to an administrator-installed executable instead. Without a supported bundled binary, install ffmpeg with the host package manager (for example `apt install ffmpeg` or `brew install ffmpeg`). Raw recordings are decoded by ffmpeg into 16 kHz mono float samples before inference. Whisper accepts the in-memory waveform. No user audio is uploaded to a cloud inference provider.

Interrupted Whisper downloads are resumed by `backend.download_models` and checked against the official SHA256 before activation. Run that command again if the connection fails. The API requires a completed checkpoint and will return an unavailable response instead of downloading a model during a candidate's request.

## Use

- Profile & account → Set up voice sign-in: use a personal account (shared demo accounts cannot enroll), consent, request a challenge, record three phrases (3–45 seconds each), and submit the third recording. The user identity comes from the existing signed-in session, never the submitted form.
- Log in → Use voice sign-in: enter the account email or the voice account ID shown in Profile, consent, and record the fresh phrase. Matching exchanges a 60-second backend JWT for an HttpOnly Next session. The JWT is not kept in browser storage.
- Audio practice in the sidebar opens an untimed subjective-answer lab. Dictation is reviewed in a separate editable textarea before explicit addition to the draft. Drafts remain in this browser and are not graded.
- Timed exams offer optional fullscreen, escapable Tab containment and question-copy protection. Answer fields retain paste support. Focus events are local to the current mounted exam; they do not affect scoring or assert cheating.
- Learning insights includes semantic assessment and question tables. New attempts collect approximate focused question time; older attempts show Not recorded. Timing may lose data on disconnect or final submission and is not a ranking signal.

## Service contract

The Python service binds to loopback, does not enable CORS and requires short-lived application JWTs (`iss=optiexam-web`, `aud=optiexam-audio`, HS256, scope-specific). Use `/api/voice/*` through Next from the browser. Never expose the Python port directly without authentication, TLS, request size/rate limits and operational monitoring.

| Python endpoint | Input | Authorization |
| --- | --- | --- |
| POST /api/auth/challenge | JSON purpose enroll/login | Same scope |
| POST /api/auth/enroll | Multipart challenge_id, consent=true, files × 3 | enroll, signed-in candidate |
| DELETE /api/auth/enroll | None | enroll, signed-in candidate |
| POST /api/auth/login | Multipart challenge_id, file | login, claimed identity resolved by Next |
| POST /api/transcribe | Multipart file | transcribe, signed-in candidate |

Each upload is limited to 8 MB, decoded duration to 60 seconds; client recording stops at 45 seconds. Next bounds combined uploads to 25 MB. Challenges are account/purpose bound, expire after five minutes and are consumed even when an inference attempt fails. Request a fresh challenge to retry. SQLite stores encrypted normalized template means, not audio. Temporary inference files are removed in `finally` on success and failure. Single-worker concurrency rejects overlapping inference instead of queueing heavy jobs.

Set `WHISPER_MODEL=tiny` (default) or `base`; `VOICE_MATCH_THRESHOLD=0.85` implements the requested decision threshold. The Language / भाषा selector saves English or Hindi for the account (guest preferences stay in the browser). Hindi uses authored interface/sample-content translations, `hi-IN` read-aloud, and Whisper's `language=hi, task=transcribe` so dictation remains in Devanagari. English-language test options and content without an authored Hindi version retain their original text. Candidate answers are never translated or rewritten when changing the interface language.

Voice challenges accept `language=en|hi`, defaulting to English. The server binds inference language to the stored challenge's script, and compares normalized Unicode letters and vowel marks, retaining account binding, expiration and one-use checks. Dictation accepts multipart `language=en|hi|auto`; auto preserves older clients. Hindi recognition and voice matching still need representative-speaker validation.

Read-aloud uses device/browser voices. A missing Hindi voice produces a Hindi explanation instead of silently selecting an English voice. Install/enable a Hindi speaking voice in the operating system or use a browser that provides one. No cloud TTS provider receives exam content. The Codex in-app browser on this machine reported no Hindi voice during verification; Hindi transcription does not require a TTS voice.

## Verification

```powershell
.venv/Scripts/python.exe -m pytest backend/tests -q
npm run test:components
npm run lint:a11y
npm run typecheck
npm test
npm run build
```

For the real Next-to-FastAPI HTTP bridge suite, start both services with disposable `AURA_DB_PATH` and `VOICE_DB_PATH`, start Next on port 3100, then run `node --test tests/voice-bridge.test.mjs`. The GitHub audio-api job provisions these isolated paths automatically. This suite verifies session scopes, personal-account enrollment, upload validation, cross-origin rejection and bounded question-timing writes.

Endpoint tests use isolated temporary databases, generated test-only keys and an explicitly injected deterministic inference adapter. They test actual HTTP validation, enrollment aggregation, cosine threshold, JWT claims, mismatch, phrase replay, account binding, expiry, deletion, encrypted storage, file rejection and temporary-file cleanup. Production exposes no fake-inference flag. Component tests mock microphone/network APIs to verify review-before-insertion, three-recording enrollment, cleanup, failure handling, MathML/table structure and escapable containment. These tests do not establish biometric accuracy or human screen-reader usability.

## Deployment limits

This is an integrated development implementation, not a certified production identity system. A fixed cosine threshold is model/domain dependent. A fresh phrase reduces simple recorded replay but cannot reliably detect synthetic or cloned speech. Keep password recovery; require an independently verified second factor for high-stakes deployment. Calibrate false-accept/false-reject rates with consenting, representative speakers and microphones, evaluate spoof resistance, define retention/deletion and key rotation, and have security/accessibility reviews before production. Do not use voice matching to grade candidates or infer disability.

Current templates are encrypted with Fernet; protect the key separately from database backups. Key loss requires re-enrollment. Native MathML preserves the equation tree and has a text explanation; browser/AT combinations need hands-on checks. Tables expose captions and row/column headers. No blanket WCAG conformance is asserted from lint or tests.

Official implementation references: [Whisper](https://github.com/openai/whisper), [SpeechBrain ECAPA model](https://huggingface.co/speechbrain/spkrec-ecapa-voxceleb), [PyJWT validation](https://pyjwt.readthedocs.io/en/latest/api.html).
