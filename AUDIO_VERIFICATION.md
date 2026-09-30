# Audio module verification — 30 September 2026

## Automated checks

- Python: 12 passing tests for API scopes, consent, three-sample enrollment, cosine threshold, encrypted storage, JWT claims, expiry/replay protection, deletion, upload rejection, temporary-file cleanup and verified resumable checkpoints. Inference is injected in API tests; these are not biometric accuracy tests.
- React: 7 passing component tests for recording consent/count, microphone cleanup, failed transcription, review before answer insertion, MathML/table semantics and escapable keyboard containment.
- Next-to-FastAPI: 1 passing HTTP integration suite against disposable databases, covering session/identity boundaries, demo enrollment rejection, origins, upload validation and bounded question-time writes.
- Existing scoring engine: 3 passing tests.
- Production build/TypeScript and JSX accessibility lint pass.

## Manual browser and runtime checks

- New Audio practice route opens through keyboard navigation in the local preview. Native MathML and table headers are present; draft persistence and speech controls were exercised in the browser. No browser console errors were observed during those checks.
- ffmpeg 7.1 decodes the public SpeechBrain `spk1_snt1.wav` fixture into 16 kHz mono audio. Real ECAPA inference produces a normalized 192-dimensional embedding.
- Whisper tiny completed its resumed download and passed the official SHA256 check. Both models loaded on CPU. The combined production AudioEngine transcribed a doubled 5.74-second public fixture as “The child almost hurt the small dog” twice and returned a 192-dimensional speaker embedding in 21.73 seconds, including cold model loading.
- No private user recording or biometric enrollment was used for verification.
- The running FastAPI `/api/transcribe` endpoint returned HTTP 200 with the public fixture transcript and `requires_review: true`, using a scoped service JWT and real Whisper inference.

## Scope and remaining validation

Dictation is available in the untimed subjective-answer practice lab. Existing scored exams remain multiple-choice. Timing records are approximate, client-reported and never change scores. Exam focus controls are optional browser controls; they cannot lock an operating system and do not establish misconduct.

Manual NVDA/JAWS testing with candidates, multilingual recognition testing, biometric threshold calibration, replay/synthetic-speech resistance and production security review remain necessary. Automated lint and tests do not certify WCAG conformance or voice-authentication reliability. Voice sign-in retains a password alternative.
