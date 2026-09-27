# Working on OptiExam

## First run

Install Node.js 24, clone this repository, then run:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Each teammate has a separate local SQLite database, created on first run. Demo profiles are Aarav Sharma (candidate), Priya Verma (second candidate), and Ananya Rao (administrator). Source is shared through Git; attempts, sessions, and local preferences are not.

## Small changes and pull requests

```sh
git switch main
git pull --ff-only
git switch -c feature/your-change
# Make and verify your changes
git add <changed-files>
git commit -m "Describe the change"
git push -u origin feature/your-change
```

Open a pull request to main and ask a teammate to review it. Test keyboard navigation and high contrast whenever changing a screen. Keep built-in speech optional so it does not compete with a screen reader.

## Checks

Run `npm test` and `npm run build`. GitHub Actions also runs the browser regression suite on a fresh database using Chromium. Locally, browser tests use Edge on Windows and Playwright Chromium elsewhere (install with `npx playwright install chromium`). Override the browser with AURA_BROWSER_PATH if needed.

For browser tests, run the server on port 3100 with AURA_DB_PATH pointing to a new disposable database, and run `npx playwright test` with AURA_TEST_DB set to that same absolute path. Never point these tests at your working database. The suite changes exam records and deadlines.

## Repository owner setup

Create an empty private GitHub repository named optiexam, then connect it:

```sh
git remote add origin https://github.com/YOUR-ACCOUNT/optiexam.git
git push -u origin main
```

In GitHub repository Settings → Collaborators (or Collaborators and teams), invite each teammate by GitHub username. For an organisation repository, choose Write access. Personal repository collaborators can push after accepting the invitation. Invite only people who should modify the code. A repository link alone does not grant push access.

## Data and prototype limits

Do not commit .env files, databases, sessions, dependencies, or build outputs. Existing AURA_* environment names and data/aura.sqlite are retained for compatibility with earlier local versions. Public deployment requires real authentication and deployment hardening; demo role selection is intentionally local.
