# Prototype verification

Verified on Windows with Node.js 24.14, Next.js 16.3.6, and headless Microsoft Edge through Playwright. The build uses the versions recorded in `package-lock.json`.

| Check | Result |
| --- | --- |
| TypeScript strict check | Passed |
| Production compilation | Passed |
| Scoring and deadline unit tests | 3 passed |
| Keyboard candidate flow | Passed: demo sign-in, setup, start, native radio answers, navigation, mark, review, modal confirmation, results |
| Persistence and failure recovery | Passed: forced save failure, pending answer restored after reload, retry acknowledged by server |
| Administrator workflow | Passed: create question, publish exam, assign candidate, inspect submitted scores |
| Authorization and integrity | Passed: candidate denied admin APIs, cross-candidate attempts denied, answer keys absent from candidate payloads, invalid options rejected |
| Exam lifecycle | Passed: original question snapshots retained after editing, submitted answers immutable, repeat submission stable, expired writes rejected |
| Automatic timeout | Passed: open browser moves to a scored result when the server-derived deadline expires |
| Mobile and large text | Passed: 390-pixel viewport, 200% text, high contrast, preferences retained after refresh; dashboard and exam reflow without page overflow |
| Modal focus | Passed: Escape closes submission confirmation and restores focus to its trigger |
| Automated accessibility | No WCAG-tagged axe violations in the tested login, dashboard, instructions, exam, review, confirmation, results, admin editor/results, and high-contrast views |
| Browser runtime errors | None during the tested complete candidate flow |

Eight browser/integration test cases passed together in the SIH 4.0 production-build verification run. Testing identified and corrected a localhost-origin mismatch and a large-text mobile layout overflow.

Not yet verified: NVDA, VoiceOver, real-user assistive technology testing, speech playback quality across installed voices, production authentication, PostgreSQL/RLS, multi-server concurrency, or hosted deployment. Automated checks do not prove WCAG conformance.

Test data is kept outside the delivered demo database. The default demo begins with the seeded users, eight questions, and three assessments.


## SIH 4.0 regression results

The updated production build passed all eight Playwright cases in one run, plus all three scoring/deadline unit tests. New checks verify that familiarization creates no attempt; approved extra time cannot be overridden by the client; question order and deadlines survive later exam edits; answer-change counters do not inflate on identical retries; access feedback preserves scores and enforces ownership; administrators receive feedback; and insights reflow at 200% text with high contrast. Axe found no violations for the tested WCAG tags on the new Access Lab and insights views.

Manual NVDA and braille-display testing remain pending. No tool compatibility certification or production anti-cheating guarantee is implied.

## OptiExam refresh — 27 September 2026

Production build and all 3 scoring/deadline unit tests passed. All 8 browser/integration cases passed against a fresh SQLite database using the production build and Edge. The suite covers keyboard completion, autosave recovery, administration, ownership, deadline submission, access lab, accommodations, feedback, mobile 200% text, high contrast, and axe checks. Visually inspected the refreshed dashboard. Confirmed the existing local database returns Aarav Sharma after the name migration. Manual NVDA testing remains outstanding.

The repository includes a Linux Chromium GitHub Actions workflow; that hosted workflow has not run yet.

## Landing, local accounts and profile

Production build and 3 unit tests passed. The 8 existing browser regressions passed after the new entry flow. Two additional tests passed for account creation, login failures, profile persistence, role isolation, duplicate email rejection, and public forms at 200% text/high contrast. Axe checks cover landing, signup and profile. An inline account link was underlined after automated testing identified reliance on colour. Manual NVDA/user testing remains outstanding.
