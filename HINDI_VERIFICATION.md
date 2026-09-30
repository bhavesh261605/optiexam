# Hindi support — 30 September 2026

- Saved English/Hindi selector in learning navigation; also available in accessibility preferences during exams. Native select keyboard behaviour and a bilingual accessible name.
- Authored Hindi catalogues cover navigation, accounts, preferences, exam controls, sample quantitative/reasoning content, practice, tables and learning insights. Content without a Hindi version retains its source text. English-language test answer options remain English to preserve the assessment.
- Language context updates rendered text, accessible names and document language without modifying answer values, question IDs, scores or option values.
- Hindi dictation sets Whisper to transcription in Hindi; voice enrollment/login can request Hindi challenge phrases with Unicode-safe comparison.
- Read-aloud chooses hi-IN/hi voices and reports a missing voice in Hindi. This machine's in-app browser has no Hindi speaking voice installed; actual Hindi playback was therefore not audible here. No private candidate recording was collected. Hindi recognition accuracy and live screen-reader pronunciation have not been certified.

Validation: 14 Python tests, 11 React component tests, 3 scoring-engine tests, production build/TypeScript and accessibility lint passed. Browser keyboard selection changed the dashboard to Hindi and persisted after reload. Hindi audio practice rendered translated labels, table headers and equation explanations. The missing-voice message was verified in the browser. The HTTP bridge suite includes new language assertions; its additional isolated server launch was rejected by automatic approval, so those new HTTP assertions were not run in this turn.
