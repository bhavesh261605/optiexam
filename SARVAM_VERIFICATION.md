# Sarvam speech verification

- Provider: Sarvam text-to-speech, ritu, bulbul:v3.
- Server-only SARVAM_API_KEY lives in ignored .env.local. No provider key is returned to the browser.
- Authenticated POST /api/tts validates language/text, applies a per-user request cap, and relays only audio or sanitized errors.
- The supplied inputs payload was tested: Hindi and English both returned HTTP 200 with base64 WAV audio.
- Live upstream validation revealed a 500-character limit per inputs item. Page reading uses 450-character chunks, played sequentially.
- Stop aborts pending requests, pauses audio, revokes the blob URL, and ignores stale responses. Language/route changes also stop playback.
- Voice navigation confirmations use the same Sarvam player. Native browser SpeechRecognition remains the command recognizer.
- 30 component tests and the production build passed.
