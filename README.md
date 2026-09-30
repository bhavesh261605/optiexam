# OptiExam accessible examination prototype

A working local prototype based on the seven supplied PRD, architecture, design, accessibility, database, task, and MVP scope references. Candidates can complete an exam using a keyboard, recover saved answers, and read their results. Administrators can create questions, build exams, assign candidates, and inspect submissions.

## Team repository and hosting status

Source: https://github.com/bhavesh261605/optiexam. Open https://github.dev/bhavesh261605/optiexam to edit in the browser, or clone the repository and create a feature branch. Collaborators need an invitation with write access to push directly; other contributors can fork and submit a pull request. Never commit `.env.local`, databases, recordings, or model downloads.

The current app requires a persistent Node.js server and SQLite volume. It is **not yet compatible with Vercel serverless storage**. Before a working Vercel deployment, migrate `src/lib/server/store.ts` to a hosted database (including asynchronous callers and transactions) or host the application backend on a persistent server. Do not point SQLite at `/tmp`: accounts and examination results would be temporary and inconsistent across instances.

The optional Python voice authentication/transcription service needs a separate host with persistent encrypted storage and model files. Configure its HTTPS `VOICE_SERVICE_URL` and matching `VOICE_JWT_SECRET`. Sarvam page reading uses the Next server directly and needs only the server-side `SARVAM_API_KEY`. Copy `.env.example` to `.env.local` and fill local values; set production values in hosting environment settings. See `backend/README.md` and `SARVAM_VERIFICATION.md`.

Recent features include English/Hindi interface text, Sarvam page reading, opt-in voice navigation, light/dark themes, and the candidate analytics/action dashboard. Browser speech recognition requires microphone permission and a supported recognition service; network availability can affect it. Keyboard controls remain available.

## Local setup

Requires Node.js 24 or later. This version uses the built-in `node:sqlite` module.

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:3000. On the supplied machine, dependencies are already installed. You can also double-click **Start OptiExam.cmd**.

For an optimized local server:

```powershell
npm run build
npm start
```

The server binds to `127.0.0.1` by default. Start at the landing page. Create a candidate account with your name, email and a password (12–128 characters), or log in to an existing account. Accounts are stored in the local SQLite database. The sample candidate workspace and expandable administrator demo remain available below the landing-page introduction.

## Try the candidate journey

1. Choose **Candidate workspace** for Aarav Sharma.
2. Explore the candidate dashboard and save accessibility preferences from the toolbar.
3. Open **General Aptitude Assessment** and read the instructions.
4. Start the exam, select answers, mark questions, and navigate with buttons or the keyboard.
5. Wait for **All changes saved** and refresh to confirm recovery.
6. Open **Review & submit**, check unanswered questions, and confirm submission.
7. Read the score, counts, and topic performance table.

Use Tab and Shift+Tab between controls; use the arrow keys within answer groups. N, P, R, and M shortcuts are optional and off by default. Read-aloud controls include read, pause, resume, and stop. Voice availability depends on the browser and installed speech voices.

## Try the administrator journey

1. Sign out, then choose **Administrator workspace** for Ananya Rao.
2. Open **Question bank** and create or edit a four-option MCQ.
3. Add a text alternative when the question refers to data or a diagram.
4. Open **Exams & assignments**, create an exam, select and reorder questions, and assign Aarav Sharma.
5. Publish the exam and sign back in as the candidate to take it.
6. Return as administrator to inspect **Candidate results** and **Audit log**.

Each candidate has one attempt per assessment in this prototype, including practice sets. Create another exam for a fresh attempt. Editing question-bank content does not alter questions already snapshotted into an attempt.

## Implemented

- Next.js App Router, TypeScript, React, Lucide icons, Radix dialogs, and Zod validation.
- Responsive candidate and administrator workspaces with the supplied blue/white design tokens.
- User-specific high contrast, text scaling from 100% to 200%, reduced motion, speech rate, and shortcut preferences.
- Eight seeded MCQs, one assigned assessment, one practice set, and one mock test.
- Persistent server-side SQLite state, opaque HttpOnly demo sessions, and API role/ownership checks.
- Server-generated start/deadline timestamps, deadline enforcement, repeat-safe submission, and server-side scoring.
- Candidate-safe question payloads that exclude answer keys.
- Serialized answer saves, persistent status, automatic retries, a local recovery queue, and a leave-page warning while saves are pending.
- Native radio inputs, meaningful status announcements, question focus management, modal focus restoration, and accessible result tables.
- Question editing, exam configuration, ordering, assignment, results, and audit history.

## Storage and reliability

The app creates `data/aura.sqlite` on first run and seeds demo users and exams. This file persists across restarts. `AURA_DB_PATH` can select a separate database, as demonstrated in `.env.example`. Do not commit real candidate data or session databases.

Server-confirmed answers are authoritative. Unsaved browser answers are retried while the deadline remains valid. If the deadline passes during an outage, only answers received by the server in time count. The open browser submits at expiration; when the page is closed, the server finalizes an expired attempt the next time it is read or written. There is no background job worker in this prototype.

This is a single-server, local demo. Simultaneous editing of the same attempt in multiple tabs has no conflict-resolution UI.

## Validation

```powershell
npm run typecheck
npm test
npm run build
```

Browser tests use Playwright, axe, and Microsoft Edge by default. Override `AURA_BROWSER_PATH` for another Chromium executable. Use a **fresh, disposable QA database**, because the suite creates and submits assessments:

```powershell
# Terminal 1, from the project directory
$env:AURA_DB_PATH="$PWD/data/qa.sqlite"
npm run dev -- --port 3100

# Terminal 2, from the same directory
$env:AURA_TEST_DB="$PWD/data/qa.sqlite"
npx playwright test
```

The suite covers a keyboard-only candidate journey, save failure and recovery, reload persistence, dialog focus restoration, admin creation and assignment, API authorization, snapshot stability, deadline enforcement, duplicate submission, mobile reflow, enlarged text, and axe checks. For a repeated clean run, stop the QA server and select a new QA database filename in both terminals.

## Deliberate prototype boundaries

**This is not a production-ready or WCAG-certified MVP.** The following referenced requirements remain future work:

- Supabase Auth, PostgreSQL migrations, and Row Level Security. The local store and demo identity are real working substitutes for prototyping, not implementations of Supabase.
- Email verification, password recovery, production identity operations, administrative provisioning, and deployment-wide abuse protection. Local registration and password sign-in use salted scrypt hashes and a ten-attempt email limit per fifteen-minute window. Anyone with local demo access can select the administrator role by design. Demo login is disabled when `VERCEL` is set.
- Vercel deployment and hosted database configuration. A GitHub Actions workflow checks the source. Local SQLite must be replaced before deploying to ephemeral/serverless hosting.
- Manual NVDA testing on Windows and usability testing with assistive-technology users. Automated axe and keyboard checks do not establish full WCAG conformance.
- Accommodation request/approval workflows, scheduled breaks, and availability windows. Candidate-specific extra time is implemented.
- Image uploads, AI descriptions, and additional question types. English/Hindi UI and optional speech-to-text are implemented; broader language/content coverage remains future work.

The prototype uses custom semantic CSS and Radix dialogs rather than adding Tailwind, charts, or form libraries with no current functional need. Results include text and tables. The requested Next.js/TypeScript application and server-owned exam lifecycle are preserved.

## Code map

| Location                           | Responsibility                                                     |
| ---------------------------------- | ------------------------------------------------------------------ |
| `src/components/workspace.tsx`     | Login, navigation, candidate dashboard, instructions, results      |
| `src/components/exam.tsx`          | Questions, answer queue, timer, review, submission                 |
| `src/components/admin.tsx`         | Question editor, exam builder, assignment, audit/results           |
| `src/components/shared.tsx`        | API client, dialogs, settings, speech adapter                      |
| `src/lib/server/store.ts`          | Persistent data, sessions, ownership, transactions, exam lifecycle |
| `src/lib/engine.ts`                | Pure scoring and deadline rules                                    |
| `src/app/api/[[...path]]/route.ts` | Validated HTTP API and role authorization                          |
| `src/app/globals.css`              | Responsive design, high contrast, text reflow, focus states        |
| `tests/`                           | Unit, integration, browser, and accessibility checks               |

The input documents were treated as product references. Their checklists do not constitute completed features; the boundary list above records the actual implementation.


## OptiExam update

The current version adds an untimed Access Lab, a screen-reader preset, NVDA guidance, reading preferences before login, and a Learning Insights page. Administrators can configure candidate-specific extra minutes and randomize question order. These settings are applied when a new attempt starts. Existing attempts keep their original deadline and question order.

Results now show descriptive access context and optional self-reported barriers. Administrators can review the feedback alongside scores. No disability score, reading-speed ranking, surveillance, or assistive-tool misconduct detection is implemented.

See `RESEARCH-AND-CHANGES.md` for the Pearson, Perkins, Harvard, and NV Access sources and the limits of the comparison. The two new browser tests in `tests/e2e/sih.spec.ts` cover familiarization without creating attempts, accommodations, stable randomized order, analytics, and feedback ownership.

## Team development

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, branches, pull requests, collaborator access, and automated checks. Local databases and demo sessions are excluded from Git.

## Landing page and accounts

The public entry routes are `/`, `/login`, and `/signup`. Signed-in candidates reach their dashboard; `/profile` lets each user edit their own name and save reading/navigation preferences. Email is displayed read-only. New accounts are always candidates; administrators can assign exams to registered candidates. The untimed Access Lab and open practice tests are available immediately. Existing demo accounts and exam data remain intact.

Passwords support paste, browser autofill and an explicit show/hide control. Forms have persistent labels, native validation, and focused server-error summaries. High contrast and text-size controls are available before sign-in. Existing users retain saved preferences on login. Local registration is functional, but email ownership is not verified and password recovery is not implemented.
