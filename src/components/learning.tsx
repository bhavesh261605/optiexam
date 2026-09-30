"use client";
import { useLanguage } from "./language";
import Link from "next/link";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
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
  const { t } = useLanguage();
  return (
    <>
      <nav className="journey" aria-label={t("Your examination journey")}>
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
              <span className="journey-number">{t(n as string)}</span>
              <I size={21} />
              <span>
                <strong>{t(title as string)}</strong>
                <small>{t(caption as string)}</small>
              </span>
              <ArrowRight size={16} />
            </Link>
          );
        })}
      </nav>
      <div className="support-ribbon">
        <AccessibilitySummary prefs={prefs} />
        <button className="text-button" onClick={onSettings}>
          {t(" Personalize workspace ")}
          <ArrowRight size={17} />
        </button>
      </div>
    </>
  );
}
function AccessibilitySummary({ prefs }: { prefs: Preferences }) {
  const { t } = useLanguage();
  return (
    <div className="support-summary">
      <Keyboard size={20} />
      <span>
        <strong>{t("Your access preferences")}</strong>
        <small>
          {t(prefs.scale)}
          {t("% text ·")}
          {t(" ")}
          {t(prefs.contrast ? "High contrast" : "Standard contrast")} {t(" ·")}
          {t(" ")}
          {t(prefs.tts ? "Read-aloud available" : "Browser read-aloud off")}
        </small>
      </span>
      <span className="pill">
        {t(
          prefs.orientationCompleted
            ? "FAMILIARIZATION COMPLETE"
            : "SET UP FOR YOU",
        )}
      </span>
    </div>
  );
}
export function IntegrityNote({ shuffle = false }: { shuffle?: boolean }) {
  const { t } = useLanguage();
  return (
    <section className="integrity-note">
      <ShieldCheck size={23} />
      <div>
        <h2>{t("Fair assessment. Full access.")}</h2>
        <p>
          {t(" Answers are scored on the server and locked after submission.")}
          {t(" ")}
          {t(
            shuffle
              ? "Question order is randomized when your attempt starts. "
              : "",
          )}
          {t(
            " Screen readers, braille displays, magnification, and keyboard navigation remain available. Switching focus is not scored as misconduct. ",
          )}
        </p>
        <span>
          {t(
            " Integrity controls protect the attempt; they do not certify an exam as cheat-proof. ",
          )}
        </span>
      </div>
    </section>
  );
}
export function NvdaGuide() {
  const { t } = useLanguage();
  return (
    <details className="nvda-guide">
      <summary>{t("Using NVDA or another screen reader")}</summary>
      <p>
        {t(
          " Use your usual screen reader. OptiExam does not detect or verify assistive software. Turn off browser read-aloud and optional letter shortcuts in preferences if they compete with your screen reader. ",
        )}
      </p>
      <dl>
        <div>
          <dt>{t("H / Shift + H")}</dt>
          <dd>{t("Next / previous heading in NVDA browse mode")}</dd>
        </div>
        <div>
          <dt>{t("NVDA + F7")}</dt>
          <dd>{t("Open the elements list")}</dd>
        </div>
        <div>
          <dt>{t("NVDA + Space")}</dt>
          <dd>{t("Switch browse and focus modes")}</dd>
        </div>
        <div>
          <dt>{t("Tab / Shift + Tab")}</dt>
          <dd>
            {t(
              " Move between controls; arrows select radio answers in focus mode ",
            )}
          </dd>
        </div>
      </dl>
      <p>
        {t(" The NVDA key is Insert or Caps Lock, depending on your setup.")}
        {t(" ")}
        <a
          href="https://accessibility.huit.harvard.edu/nvda"
          target="_blank"
          rel="noreferrer"
        >
          {t(" Harvard’s NVDA testing guide (new tab) ")}
        </a>
        {t(" ")}
        {t(" ·")}
        {t(" ")}
        <a
          href="https://www.nvaccess.org/download/"
          target="_blank"
          rel="noreferrer"
        >
          {t(" NV Access (new tab) ")}
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
  const { t } = useLanguage();
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
        eyebrow={t("ACCESS LAB · UNTIMED")}
        title={t("Get comfortable before it counts.")}
      >
        {t(
          " Try the same controls you’ll use in an exam. No timer, score, or attempt limit. ",
        )}
      </PageHeading>
      <div className="lab-layout">
        <section className="panel lab-surface">
          <div className="section-heading">
            <span className="pill">
              {t(complete ? "COMPLETE" : `STEP ${step + 1} OF 3`)}
            </span>
            <span className="muted-text">{t("Practice space")}</span>
          </div>
          {complete ? (
            <>
              <span className="lab-complete">
                <Check size={35} />
              </span>
              <h2 ref={heading} tabIndex={-1}>
                {t(" You’ve explored the exam controls. ")}
              </h2>
              <p>
                {t(
                  " Your familiarization is saved. You can return here as often as you like; this is not an assistive-technology certification. ",
                )}
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
                  {t(" Try again ")}
                </button>
                <Link className="button" href="/exams">
                  {t(" Find an examination ")}
                  <ArrowRight size={18} />
                </Link>
              </div>
            </>
          ) : step === 0 ? (
            <>
              <h2 ref={heading} tabIndex={-1}>
                {t(" 1. Find and select an answer ")}
              </h2>
              <p>
                {t(
                  " Press Tab to reach the answer group, then use arrow keys to change the option. Select any option to continue. ",
                )}
              </p>
              <fieldset className="answer-options">
                <legend>
                  {t("Which control moves to the next question?")}
                </legend>
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
                    {t(text)}
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
                  {t(" Read sample question ")}
                </button>
              )}
              <div className="actions">
                <button
                  className="button"
                  disabled={answer === null}
                  onClick={() => setStep(1)}
                >
                  {t(" Next question ")}
                  <ArrowRight size={18} />
                </button>
              </div>
            </>
          ) : step === 1 ? (
            <>
              <h2 ref={heading} tabIndex={-1}>
                {t(" 2. Mark a question for review ")}
              </h2>
              <p>
                {t(
                  " In an exam you can flag a question, move on, and come back. Your answer stays saved when you mark it. ",
                )}
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
                {t(marked ? "Marked for review" : "Mark for review")}
              </button>
              <div className="actions">
                <button className="button secondary" onClick={() => setStep(0)}>
                  {t(" Previous ")}
                </button>
                <button
                  className="button"
                  disabled={!marked}
                  onClick={() => setStep(2)}
                >
                  {t(" Review practice ")}
                  <ArrowRight size={18} />
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 ref={heading} tabIndex={-1}>
                {t(" 3. Review and confirm ")}
              </h2>
              <p>
                {t(" You selected option ")}
                {t((answer ?? 0) + 1)}{" "}
                {t(
                  " and marked the sample for review. Try opening the dialog, pressing Escape to return, then confirming when ready. ",
                )}
              </p>
              <div className="actions">
                <button className="button secondary" onClick={() => setStep(1)}>
                  {t(" Previous ")}
                </button>
                <button className="button" onClick={() => setConfirm(true)}>
                  {t(" Finish familiarization ")}
                  <Check size={18} />
                </button>
              </div>
            </>
          )}
          <p role="status" className="lab-status">
            {t(message)}
          </p>
        </section>
        <aside className="lab-notes">
          <h2>{t("Bring your own way of navigating.")}</h2>
          <p>
            {t(
              " Use a screen reader, magnification, or just your keyboard. No special extension is required for these controls. ",
            )}
          </p>
          <ul>
            <li>{t("Visible focus follows your keyboard.")}</li>
            <li>{t("Answer choices use native radio controls.")}</li>
            <li>{t("Feedback stays available as text.")}</li>
            <li>{t("Audio is optional and under your control.")}</li>
          </ul>
          <NvdaGuide />
        </aside>
      </div>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title={t("Finish this practice?")}
        description={t(
          "This saves your familiarization status only. It does not submit a real exam.",
        )}
      >
        <div className="actions">
          <button
            className="button secondary"
            onClick={() => setConfirm(false)}
          >
            {t(" Keep practicing ")}
          </button>
          <button className="button" disabled={busy} onClick={finish}>
            {t(busy ? "Saving…" : "Confirm practice completion")}
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
  const { t } = useLanguage();
  const reviewed = r.reviewHistory?.length || 0;
  const resolved = (r.reviewHistory || []).filter(
    (id) => !r.answers[id]?.review,
  ).length;
  return (
    <section className="panel section">
      <div className="section-heading">
        <h2>{t("Your assessment experience")}</h2>
        <span className="pill">{t("CONTEXT, NOT A RANKING")}</span>
      </div>
      <div className="insight-grid">
        <div>
          <strong>
            {t(r.questions.length - r.unanswered)}
            {t("/")}
            {t(r.questions.length)}
          </strong>
          <span>{t("Questions answered")}</span>
        </div>
        <div>
          <strong>
            {t(elapsed(r))} {t(" min")}
          </strong>
          <span>
            {t(" Elapsed of ")}
            {t(Math.round((r.deadline - r.startedAt) / 60000))}{" "}
            {t(" minutes allowed ")}
          </span>
        </div>
        <div>
          <strong>{t(r.answerChanges ?? "—")}</strong>
          <span>
            {t(" Answer changes ")}
            {t(r.answerChanges === undefined ? " · not recorded" : "")}
          </span>
        </div>
        <div>
          <strong>
            {t(r.reviewHistory ? `${resolved}/${reviewed}` : "—")}
          </strong>
          <span>
            {t(" Review flags cleared")}
            {t(!r.reviewHistory ? " · not recorded" : "")}
          </span>
        </div>
      </div>
      <p className="metric-context">
        {t(
          r.extraMinutes
            ? `${r.extraMinutes} minutes of approved extra time included. `
            : "",
        )}
        {t(
          " Elapsed time includes time away from the page. Reading speed, assistive-tool use, and review choices do not change your score. ",
        )}
      </p>
      {r.supportContext && (
        <p className="metric-context">
          {t(" Preferences at start: ")}
          {t(r.supportContext.scale)}
          {t("% text ·")}
          {t(" ")}
          {t(r.supportContext.contrast ? "high" : "standard")}{" "}
          {t(" contrast · read-aloud controls ")}
          {t(r.supportContext.tts ? "enabled" : "disabled")}
          {t(". These are settings, not detected tool usage. ")}
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
  const { t } = useLanguage();
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
      <h2>{t("How accessible was this assessment?")}</h2>
      <p>
        {t(
          " Optional feedback is shared with your exam administrator to improve access. It never changes your score. ",
        )}
      </p>
      <form onSubmit={save}>
        <label className="field-label" htmlFor="independence">
          {t(" Could you navigate independently? ")}
        </label>
        <select
          id="independence"
          required
          value={navigation}
          onChange={(e) => setNavigation(e.target.value)}
        >
          <option value="">{t("Choose an experience")}</option>
          <option value="independent">{t("I navigated independently")}</option>
          <option value="some-help">{t("I needed some help")}</option>
          <option value="blocked">
            {t("I encountered a blocking barrier")}
          </option>
        </select>
        <fieldset>
          <legend>{t("What needs improvement? Select any that apply.")}</legend>
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
                {t(label)}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="button secondary" disabled={busy} type="submit">
          {t(busy ? "Saving…" : "Share access feedback")}
        </button>
        <p role="status" className="lab-status">
          {t(status)}
        </p>
      </form>
    </section>
  );
}

export function AnalyticsPage() {
  const { t } = useLanguage();
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
    for (const stats of r.topics) {
      const previous = topics.get(stats.topic) || { correct: 0, total: 0 };
      topics.set(stats.topic, {
        correct: previous.correct + stats.correct,
        total: previous.total + stats.total,
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
        eyebrow={t("LEARNING INSIGHTS")}
        title={t("Progress that respects your pace.")}
      >
        {t(
          " Understand your subject performance and access experience in one place. ",
        )}
      </PageHeading>
      <AnalyticsDashboard results={results} />
      {!results.length ? (
        <>
          <Empty title={t("Your learning story starts with an assessment")}>
            {t(
              " Complete a practice set or examination to see subject insights and answer coverage. No scores or trends are invented. ",
            )}
          </Empty>
          <div className="actions">
            <Link className="button" href="/practice">
              {t(" Explore practice ")}
              <ArrowRight size={18} />
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="stats-grid analytics-stats">
            <div className="stat">
              <div>
                <span>{t("Completed assessments")}</span>
                <strong>{t(results.length)}</strong>
                <small>{t("Your own learning history")}</small>
              </div>
              <BookOpen />
            </div>
            <div className="stat">
              <div>
                <span>{t("Answer coverage")}</span>
                <strong>
                  {t(Math.round((answered / total) * 100))}
                  {t("%")}
                </strong>
                <small>
                  {t(answered)} {t(" of ")}
                  {t(total)} {t(" questions answered ")}
                </small>
              </div>
              <Target />
            </div>
            <div className="stat">
              <div>
                <span>{t("Independent navigation")}</span>
                <strong>
                  {t(reports ? `${independent}/${reports}` : "—")}
                </strong>
                <small>
                  {t(
                    reports
                      ? "Based on optional self-reports"
                      : "Share optional access feedback",
                  )}
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
              <span className="eyebrow">{t("SUGGESTED NEXT FOCUS")}</span>
              <h2>
                {t(
                  sorted[0]?.[1].correct === sorted[0]?.[1].total
                    ? "Keep building on your progress"
                    : sorted[0]?.[0],
                )}
              </h2>
              <p>
                {t(sorted[0]?.[1].correct)} {t(" correct out of ")}
                {t(sorted[0]?.[1].total)}
                {t(" ")}
                {t(" questions in ")}
                {t(sorted[0]?.[0])}
                {t(
                  ". This suggestion uses your recorded answers, not an ability or disability profile. ",
                )}
              </p>
            </div>
            <Link className="button" href="/practice">
              {t(" Explore practice ")}
              <ArrowRight size={18} />
            </Link>
          </section>
          <section className="panel section">
            <h2>{t("Subject performance, grounded in your answers")}</h2>
            <p>
              {t(
                " Question sets vary in size and difficulty. These descriptive totals are not standardized ability scores. ",
              )}
            </p>
            <div className="topic-insights">
              {sorted.map(([topic, stats]) => (
                <div key={topic}>
                  <div>
                    <strong>{t(topic)}</strong>
                    <span>
                      {t(stats.correct)}
                      {t("/")}
                      {t(stats.total)} {t(" correct ·")}
                      {t(" ")}
                      {t(Math.round((stats.correct / stats.total) * 100))}
                      {t("% ")}
                    </span>
                  </div>
                  <div className="topic-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${(stats.correct / stats.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="panel section">
            <h2>{t("Your assessment history")}</h2>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">
                  {t(" Individual assessment results and time allowances ")}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t("Assessment")}</th>
                    <th scope="col">{t("Score")}</th>
                    <th scope="col">{t("Answered")}</th>
                    <th scope="col">{t("Time allowance")}</th>
                    <th scope="col">{t("Details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">{t(r.title)}</th>
                      <td>
                        {t(r.score)}
                        {t("/")}
                        {t(r.maxScore)}
                      </td>
                      <td>
                        {t(r.questions.length - r.unanswered)}
                        {t("/")}
                        {t(r.questions.length)}
                      </td>
                      <td>
                        {t(Math.round((r.deadline - r.startedAt) / 60000))}{" "}
                        {t(" minutes ")}
                        {t(
                          r.extraMinutes
                            ? ` (+${r.extraMinutes} approved)`
                            : "",
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/results/${r.id}`}
                          aria-label={t(`View result for ${r.title}`)}
                        >
                          {t(" View result ")}
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
          <strong>{t("Access metrics support learning.")}</strong>{" "}
          {t(
            " There are no speed rankings, disability scores, or cheating flags based on assistive technology. Independence is self-reported, never inferred from clicks or timing. ",
          )}
        </p>
      </div>
    </>
  );
}
