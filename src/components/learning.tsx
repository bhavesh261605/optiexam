"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Compass,
  Keyboard,
  Volume2,
  ShieldCheck,
  Flag,
  ChartNoAxesCombined,
  BookOpen,
  Target,
} from "lucide-react";
import type { Preferences, Result, Attempt } from "@/lib/types";
import {
  api,
  PageHeading,
  Loading,
  ErrorNotice,
  Empty,
  Modal,
  speak,
} from "./shared";

export function Journey({
  prefs,
  onSettings,
}: {
  prefs: Preferences;
  onSettings: () => void;
}) {
  return (
    <>
      <nav className="journey" aria-label="Your examination journey">
        {[
          ["01", "Prepare", "Check your setup", "/access-lab", Compass],
          ["02", "Practice", "Build familiarity", "/practice", BookOpen],
          ["03", "Take an exam", "Put learning to work", "/exams", ShieldCheck],
          [
            "04",
            "Reflect",
            "Find your next focus",
            "/analytics",
            ChartNoAxesCombined,
          ],
        ].map(([n, title, caption, url, Icon]) => {
          const I = Icon as typeof Compass;
          return (
            <Link href={url as string} key={n as string}>
              <span className="journey-number">{n as string}</span>
              <I size={21} />
              <span>
                <strong>{title as string}</strong>
                <small>{caption as string}</small>
              </span>
              <ArrowRight size={16} />
            </Link>
          );
        })}
      </nav>
      <div className="support-ribbon">
        <AccessibilitySummary prefs={prefs} />
        <button className="text-button" onClick={onSettings}>
          Personalize workspace <ArrowRight size={17} />
        </button>
      </div>
    </>
  );
}
function AccessibilitySummary({ prefs }: { prefs: Preferences }) {
  return (
    <div className="support-summary">
      <Keyboard size={20} />
      <span>
        <strong>Your access preferences</strong>
        <small>
          {prefs.scale}% text ·{" "}
          {prefs.contrast ? "High contrast" : "Standard contrast"} ·{" "}
          {prefs.tts ? "Read-aloud available" : "Browser read-aloud off"}
        </small>
      </span>
      <span className="pill">
        {prefs.orientationCompleted
          ? "FAMILIARIZATION COMPLETE"
          : "SET UP FOR YOU"}
      </span>
    </div>
  );
}
export function IntegrityNote({ shuffle = false }: { shuffle?: boolean }) {
  return (
    <section className="integrity-note">
      <ShieldCheck size={23} />
      <div>
        <h2>Fair assessment. Full access.</h2>
        <p>
          Answers are scored on the server and locked after submission.{" "}
          {shuffle
            ? "Question order is randomized when your attempt starts. "
            : ""}
          Screen readers, braille displays, magnification, and keyboard
          navigation remain available. Switching focus is not scored as
          misconduct.
        </p>
        <span>
          Integrity controls protect the attempt; they do not certify an exam as
          cheat-proof.
        </span>
      </div>
    </section>
  );
}
export function NvdaGuide() {
  return (
    <details className="nvda-guide">
      <summary>Using NVDA or another screen reader</summary>
      <p>
        Use your usual screen reader. OptiExam does not detect or verify assistive
        software. Turn off browser read-aloud and optional letter shortcuts in
        preferences if they compete with your screen reader.
      </p>
      <dl>
        <div>
          <dt>H / Shift + H</dt>
          <dd>Next / previous heading in NVDA browse mode</dd>
        </div>
        <div>
          <dt>NVDA + F7</dt>
          <dd>Open the elements list</dd>
        </div>
        <div>
          <dt>NVDA + Space</dt>
          <dd>Switch browse and focus modes</dd>
        </div>
        <div>
          <dt>Tab / Shift + Tab</dt>
          <dd>
            Move between controls; arrows select radio answers in focus mode
          </dd>
        </div>
      </dl>
      <p>
        The NVDA key is Insert or Caps Lock, depending on your setup.{" "}
        <a
          href="https://accessibility.huit.harvard.edu/nvda"
          target="_blank"
          rel="noreferrer"
        >
          Harvard’s NVDA testing guide (new tab)
        </a>{" "}
        ·{" "}
        <a
          href="https://www.nvaccess.org/download/"
          target="_blank"
          rel="noreferrer"
        >
          NV Access (new tab)
        </a>
      </p>
    </details>
  );
}

export function AccessLab({
  prefs,
  onSaved,
}: {
  prefs: Preferences;
  onSaved: (p: Preferences) => void;
}) {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [marked, setMarked] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step) heading.current?.focus();
  }, [step]);
  async function finish() {
    setBusy(true);
    try {
      const next = await api<Preferences>("preferences", "PUT", {
        ...prefs,
        orientationCompleted: true,
      });
      onSaved(next);
      setConfirm(false);
      setComplete(true);
      setMessage("Familiarization complete. No exam attempt was created.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ACCESS LAB · UNTIMED"
        title="Get comfortable before it counts."
      >
        Try the same controls you’ll use in an exam. No timer, score, or attempt
        limit.
      </PageHeading>
      <div className="lab-layout">
        <section className="panel lab-surface">
          <div className="section-heading">
            <span className="pill">
              {complete ? "COMPLETE" : `STEP ${step + 1} OF 3`}
            </span>
            <span className="muted-text">Practice space</span>
          </div>
          {complete ? (
            <>
              <span className="lab-complete">
                <Check size={35} />
              </span>
              <h2 ref={heading} tabIndex={-1}>
                You’ve explored the exam controls.
              </h2>
              <p>
                Your familiarization is saved. You can return here as often as
                you like; this is not an assistive-technology certification.
              </p>
              <div className="actions">
                <button
                  className="button secondary"
                  onClick={() => {
                    setComplete(false);
                    setStep(0);
                    setAnswer(null);
                    setMarked(false);
                  }}
                >
                  Try again
                </button>
                <Link className="button" href="/exams">
                  Find an examination <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : step === 0 ? (
            <>
              <h2 ref={heading} tabIndex={-1}>
                1. Find and select an answer
              </h2>
              <p>
                Press Tab to reach the answer group, then use arrow keys to
                change the option. Select any option to continue.
              </p>
              <fieldset className="answer-options">
                <legend>Which control moves to the next question?</legend>
                {[
                  "The Next question button",
                  "The text-size control",
                  "The Stop reading button",
                ].map((text, i) => (
                  <label
                    className={`answer-option ${answer === i ? "selected" : ""}`}
                    key={text}
                  >
                    <input
                      type="radio"
                      name="lab-answer"
                      checked={answer === i}
                      onChange={() => {
                        setAnswer(i);
                        setMessage(`Option ${i + 1} selected.`);
                      }}
                    />
                    {text}
                  </label>
                ))}
              </fieldset>
              {prefs.tts && (
                <button
                  className="text-button"
                  onClick={() => {
                    try {
                      speak(
                        "Which control moves to the next question? Option one: The Next question button. Option two: The text-size control. Option three: The Stop reading button.",
                        prefs.rate,
                      );
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  <Volume2 size={18} />
                  Read sample question
                </button>
              )}
              <div className="actions">
                <button
                  className="button"
                  disabled={answer === null}
                  onClick={() => setStep(1)}
                >
                  Next question <ArrowRight size={18} />
                </button>
              </div>
            </>
          ) : step === 1 ? (
            <>
              <h2 ref={heading} tabIndex={-1}>
                2. Mark a question for review
              </h2>
              <p>
                In an exam you can flag a question, move on, and come back. Your
                answer stays saved when you mark it.
              </p>
              <button
                className={`button ${marked ? "marked" : "secondary"}`}
                aria-pressed={marked}
                onClick={() => {
                  setMarked(!marked);
                  setMessage(
                    marked
                      ? "Review mark removed."
                      : "Question marked for review.",
                  );
                }}
              >
                <Flag size={18} />
                {marked ? "Marked for review" : "Mark for review"}
              </button>
              <div className="actions">
                <button className="button secondary" onClick={() => setStep(0)}>
                  Previous
                </button>
                <button
                  className="button"
                  disabled={!marked}
                  onClick={() => setStep(2)}
                >
                  Review practice <ArrowRight size={18} />
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 ref={heading} tabIndex={-1}>
                3. Review and confirm
              </h2>
              <p>
                You selected option {(answer ?? 0) + 1} and marked the sample
                for review. Try opening the dialog, pressing Escape to return,
                then confirming when ready.
              </p>
              <div className="actions">
                <button className="button secondary" onClick={() => setStep(1)}>
                  Previous
                </button>
                <button className="button" onClick={() => setConfirm(true)}>
                  Finish familiarization <Check size={18} />
                </button>
              </div>
            </>
          )}
          <p role="status" className="lab-status">
            {message}
          </p>
        </section>
        <aside className="lab-notes">
          <h2>Bring your own way of navigating.</h2>
          <p>
            Use a screen reader, magnification, or just your keyboard. No
            special extension is required for these controls.
          </p>
          <ul>
            <li>Visible focus follows your keyboard.</li>
            <li>Answer choices use native radio controls.</li>
            <li>Feedback stays available as text.</li>
            <li>Audio is optional and under your control.</li>
          </ul>
          <NvdaGuide />
        </aside>
      </div>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title="Finish this practice?"
        description="This saves your familiarization status only. It does not submit a real exam."
      >
        <div className="actions">
          <button
            className="button secondary"
            onClick={() => setConfirm(false)}
          >
            Keep practicing
          </button>
          <button className="button" disabled={busy} onClick={finish}>
            {busy ? "Saving…" : "Confirm practice completion"}
          </button>
        </div>
      </Modal>
    </>
  );
}

function elapsed(a: Attempt) {
  return Math.max(
    0,
    Math.round(
      (Math.min(a.submittedAt || a.deadline, a.deadline) - a.startedAt) / 60000,
    ),
  );
}
export function AttemptInsights({ result: r }: { result: Result }) {
  const reviewed = r.reviewHistory?.length || 0;
  const resolved = (r.reviewHistory || []).filter(
    (id) => !r.answers[id]?.review,
  ).length;
  return (
    <section className="panel section">
      <div className="section-heading">
        <h2>Your assessment experience</h2>
        <span className="pill">CONTEXT, NOT A RANKING</span>
      </div>
      <div className="insight-grid">
        <div>
          <strong>
            {r.questions.length - r.unanswered}/{r.questions.length}
          </strong>
          <span>Questions answered</span>
        </div>
        <div>
          <strong>{elapsed(r)} min</strong>
          <span>
            Elapsed of {Math.round((r.deadline - r.startedAt) / 60000)} minutes
            allowed
          </span>
        </div>
        <div>
          <strong>{r.answerChanges ?? "—"}</strong>
          <span>
            Answer changes
            {r.answerChanges === undefined ? " · not recorded" : ""}
          </span>
        </div>
        <div>
          <strong>{r.reviewHistory ? `${resolved}/${reviewed}` : "—"}</strong>
          <span>
            Review flags cleared{!r.reviewHistory ? " · not recorded" : ""}
          </span>
        </div>
      </div>
      <p className="metric-context">
        {r.extraMinutes
          ? `${r.extraMinutes} minutes of approved extra time included. `
          : ""}
        Elapsed time includes time away from the page. Reading speed,
        assistive-tool use, and review choices do not change your score.
      </p>
      {r.supportContext && (
        <p className="metric-context">
          Preferences at start: {r.supportContext.scale}% text ·{" "}
          {r.supportContext.contrast ? "high" : "standard"} contrast ·
          read-aloud controls {r.supportContext.tts ? "enabled" : "disabled"}.
          These are settings, not detected tool usage.
        </p>
      )}
    </section>
  );
}
const barrierLabels: Record<string, string> = {
  navigation: "Finding or moving between controls",
  audio: "Read-aloud or screen-reader output",
  "question-content": "Question wording or accessible description",
  saving: "Saving or connection reliability",
  time: "Time allowance",
};
export function AccessFeedback({ result }: { result: Result }) {
  const [navigation, setNavigation] = useState(
    result.feedback?.navigation || "",
  );
  const [barriers, setBarriers] = useState<string[]>(
    result.feedback?.barriers || [],
  );
  const [status, setStatus] = useState(
    result.feedback ? "Feedback saved." : "",
  );
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`attempts/${result.id}/feedback`, "PUT", {
        navigation,
        barriers,
      });
      setStatus("Feedback saved. Your exam score is unchanged.");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel section feedback-panel">
      <h2>How accessible was this assessment?</h2>
      <p>
        Optional feedback is shared with your exam administrator to improve
        access. It never changes your score.
      </p>
      <form onSubmit={save}>
        <label className="field-label" htmlFor="independence">
          Could you navigate independently?
        </label>
        <select
          id="independence"
          required
          value={navigation}
          onChange={(e) => setNavigation(e.target.value)}
        >
          <option value="">Choose an experience</option>
          <option value="independent">I navigated independently</option>
          <option value="some-help">I needed some help</option>
          <option value="blocked">I encountered a blocking barrier</option>
        </select>
        <fieldset>
          <legend>What needs improvement? Select any that apply.</legend>
          <div className="feedback-options">
            {Object.entries(barrierLabels).map(([id, label]) => (
              <label className="inline" key={id}>
                <input
                  type="checkbox"
                  checked={barriers.includes(id)}
                  onChange={(e) =>
                    setBarriers(
                      e.target.checked
                        ? [...barriers, id]
                        : barriers.filter((b) => b !== id),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="button secondary" disabled={busy} type="submit">
          {busy ? "Saving…" : "Share access feedback"}
        </button>
        <p role="status" className="lab-status">
          {status}
        </p>
      </form>
    </section>
  );
}

export function AnalyticsPage() {
  const [results, setResults] = useState<Result[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<Result[]>("analytics")
      .then(setResults)
      .catch((e) => setError(e.message));
  }, []);
  if (!results) return error ? <ErrorNotice message={error} /> : <Loading />;
  const topics = new Map<string, { correct: number; total: number }>();
  for (const r of results)
    for (const t of r.topics) {
      const previous = topics.get(t.topic) || { correct: 0, total: 0 };
      topics.set(t.topic, {
        correct: previous.correct + t.correct,
        total: previous.total + t.total,
      });
    }
  const sorted = [...topics.entries()].sort(
    (a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total,
  );
  const total = results.reduce((n, r) => n + r.questions.length, 0);
  const answered = results.reduce(
    (n, r) => n + r.questions.length - r.unanswered,
    0,
  );
  const independent = results.filter(
    (r) => r.feedback?.navigation === "independent",
  ).length;
  const reports = results.filter((r) => r.feedback).length;
  return (
    <>
      <PageHeading
        eyebrow="LEARNING INSIGHTS"
        title="Progress that respects your pace."
      >
        Understand your subject performance and access experience in one place.
      </PageHeading>
      {!results.length ? (
        <>
          <Empty title="Your learning story starts with an assessment">
            Complete a practice set or examination to see subject insights and
            answer coverage. No scores or trends are invented.
          </Empty>
          <div className="actions">
            <Link className="button" href="/practice">
              Explore practice <ArrowRight size={18} />
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="stats-grid analytics-stats">
            <div className="stat">
              <div>
                <span>Completed assessments</span>
                <strong>{results.length}</strong>
                <small>Your own learning history</small>
              </div>
              <BookOpen />
            </div>
            <div className="stat">
              <div>
                <span>Answer coverage</span>
                <strong>{Math.round((answered / total) * 100)}%</strong>
                <small>
                  {answered} of {total} questions answered
                </small>
              </div>
              <Target />
            </div>
            <div className="stat">
              <div>
                <span>Independent navigation</span>
                <strong>{reports ? `${independent}/${reports}` : "—"}</strong>
                <small>
                  {reports
                    ? "Based on optional self-reports"
                    : "Share optional access feedback"}
                </small>
              </div>
              <Compass />
            </div>
          </div>
          <section className="focus-recommendation">
            <span className="tile-icon">
              <Target />
            </span>
            <div>
              <span className="eyebrow">SUGGESTED NEXT FOCUS</span>
              <h2>
                {sorted[0]?.[1].correct === sorted[0]?.[1].total
                  ? "Keep building on your progress"
                  : sorted[0]?.[0]}
              </h2>
              <p>
                {sorted[0]?.[1].correct} correct out of {sorted[0]?.[1].total}{" "}
                questions in {sorted[0]?.[0]}. This suggestion uses your
                recorded answers, not an ability or disability profile.
              </p>
            </div>
            <Link className="button" href="/practice">
              Explore practice <ArrowRight size={18} />
            </Link>
          </section>
          <section className="panel section">
            <h2>Subject performance, grounded in your answers</h2>
            <p>
              Question sets vary in size and difficulty. These descriptive
              totals are not standardized ability scores.
            </p>
            <div className="topic-insights">
              {sorted.map(([topic, t]) => (
                <div key={topic}>
                  <div>
                    <strong>{topic}</strong>
                    <span>
                      {t.correct}/{t.total} correct ·{" "}
                      {Math.round((t.correct / t.total) * 100)}%
                    </span>
                  </div>
                  <div className="topic-track" aria-hidden="true">
                    <span
                      style={{ width: `${(t.correct / t.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="panel section">
            <h2>Your assessment history</h2>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">
                  Individual assessment results and time allowances
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Assessment</th>
                    <th scope="col">Score</th>
                    <th scope="col">Answered</th>
                    <th scope="col">Time allowance</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">{r.title}</th>
                      <td>
                        {r.score}/{r.maxScore}
                      </td>
                      <td>
                        {r.questions.length - r.unanswered}/{r.questions.length}
                      </td>
                      <td>
                        {Math.round((r.deadline - r.startedAt) / 60000)} minutes
                        {r.extraMinutes ? ` (+${r.extraMinutes} approved)` : ""}
                      </td>
                      <td>
                        <Link
                          href={`/results/${r.id}`}
                          aria-label={`View result for ${r.title}`}
                        >
                          View result
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <div className="analytics-principle">
        <ShieldCheck size={22} />
        <p>
          <strong>Access metrics support learning.</strong> There are no speed
          rankings, disability scores, or cheating flags based on assistive
          technology. Independence is self-reported, never inferred from clicks
          or timing.
        </p>
      </div>
    </>
  );
}

