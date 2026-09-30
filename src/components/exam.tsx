"use client";
import { useLanguage } from "./language";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Flag,
  Volume2,
  Pause,
  Play,
  Square,
  Settings2,
  ShieldCheck,
  Keyboard,
} from "lucide-react";
import type { Attempt, Preferences, Answer } from "@/lib/types";
import { api, Modal, Loading, ErrorNotice, speak } from "./shared";
import { NvdaGuide } from "./learning";
import { ExamGuard } from "./ExamGuard";
import { useQuestionTime } from "./audio/useQuestionTime";

export function ExamWorkspace({
  id,
  prefs,
  onSettings,
}: {
  id: string;
  prefs: Preferences;
  onSettings: () => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [attempt, setAttempt] = useState<Attempt>();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("All changes saved");
  const [review, setReview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [help, setHelp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef<Record<string, Answer>>({});
  const running = useRef(false);
  const current = useRef<Attempt | undefined>(undefined);
  const timeBase = useRef({ server: 0, performance: 0 });
  const heading = useRef<HTMLHeadingElement>(null);
  const autoSubmit = useRef(false);
  const lastRemaining = useRef<number | null>(null);
  const mounted = useRef(true);
  const storageKey = `aura-pending-${id}`;
  useQuestionTime(
    id,
    attempt?.questions[index]?.id,
    attempt?.status === "in_progress" && !review,
  );
  const persist = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pending.current));
    } catch {
      setError(
        "This browser cannot keep a recovery copy. Keep this page open until all changes are saved.",
      );
    }
  }, [storageKey]);
  const flush = useCallback(async () => {
    if (running.current) return false;
    running.current = true;
    try {
      while (Object.keys(pending.current).length) {
        const qid = Object.keys(pending.current)[0];
        const value = pending.current[qid];
        setSaveStatus("Saving changes…");
        const response = await api<{ closed?: boolean }>(
          `attempts/${id}/responses/${qid}`,
          "PUT",
          value,
        );
        if (response.closed) {
          pending.current = {};
          persist();
          router.replace(`/results/${id}`);
          return false;
        }
        if (pending.current[qid] === value) delete pending.current[qid];
        persist();
      }
      if (mounted.current) setSaveStatus("All changes saved");
      return true;
    } catch {
      if (mounted.current)
        setSaveStatus("Not saved — retrying. Keep this page open.");
      return false;
    } finally {
      running.current = false;
    }
  }, [id, persist, router]);
  useEffect(() => {
    mounted.current = true;
    api<Attempt>(`attempts/${id}`)
      .then((a) => {
        if (a.status === "evaluated") {
          router.replace(`/results/${id}`);
          return;
        }
        timeBase.current = {
          server: a.serverNow!,
          performance: performance.now(),
        };
        setRemaining(
          Math.max(0, Math.ceil((a.deadline - a.serverNow!) / 1000)),
        );
        try {
          const stored = JSON.parse(
            localStorage.getItem(storageKey) || "{}",
          ) as Record<string, Answer>;
          for (const [qid, value] of Object.entries(stored)) {
            const q = a.questions.find((q) => q.id === qid);
            if (
              q &&
              typeof value?.review === "boolean" &&
              (value.answer === null ||
                (Number.isInteger(value.answer) &&
                  value.answer! >= 0 &&
                  value.answer! < q.options.length))
            )
              pending.current[qid] = value;
          }
        } catch {
          setError(
            "A browser recovery copy could not be read. Your server-saved answers have been restored.",
          );
        }
        a.answers = { ...a.answers, ...pending.current };
        current.current = a;
        setAttempt(a);
        flush();
      })
      .catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
      window.speechSynthesis?.cancel();
    };
  }, [id, router, storageKey, flush]);
  useEffect(() => {
    const retry = setInterval(() => {
      if (Object.keys(pending.current).length) flush();
    }, 4000);
    const online = () => flush();
    const unload = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", unload);
    return () => {
      clearInterval(retry);
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", unload);
    };
  }, [flush]);
  const submit = useCallback(
    async (expired = false) => {
      setSubmitting(true);
      setError("");
      try {
        if (!expired) {
          const saved = await flush();
          if (!saved || Object.keys(pending.current).length) {
            setError(
              "Your answers are still saving. Wait for “All changes saved”, then submit again.",
            );
            setSubmitting(false);
            return;
          }
        }
        await api(`attempts/${id}/submit`, "POST");
        pending.current = {};
        persist();
        router.replace(`/results/${id}`);
      } catch (e) {
        setError((e as Error).message);
        setSubmitting(false);
        autoSubmit.current = false;
      }
    },
    [id, flush, persist, router],
  );
  useEffect(() => {
    if (!attempt) return;
    const tick = () => {
      const now =
        timeBase.current.server +
        (performance.now() - timeBase.current.performance);
      const seconds = Math.max(0, Math.ceil((attempt.deadline - now) / 1000));
      setRemaining(seconds);
      for (const milestone of [900, 600, 300, 60])
        if (
          lastRemaining.current !== null &&
          lastRemaining.current > milestone &&
          seconds <= milestone
        )
          setAnnouncement(
            `${milestone / 60} minute${milestone === 60 ? "" : "s"} remaining.`,
          );
      lastRemaining.current = seconds;
      if (seconds === 0 && !autoSubmit.current) {
        autoSubmit.current = true;
        setAnnouncement("Time has expired. Submitting your saved answers.");
        submit(true);
      }
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt?.deadline, submit]);
  useEffect(() => {
    heading.current?.focus();
    window.speechSynthesis?.cancel();
  }, [index, review, !!attempt]);
  function answer(qid: string, value: Answer) {
    if (!current.current || remaining <= 0 || submitting) return;
    pending.current[qid] = value;
    persist();
    const next = {
      ...current.current,
      answers: { ...current.current.answers, [qid]: value },
    };
    current.current = next;
    setAttempt(next);
    setSaveStatus("Saving changes…");
    flush();
  }
  function navigate(i: number) {
    setIndex(i);
    setReview(false);
  }
  function read() {
    if (!attempt) return;
    const q = attempt.questions[index];
    try {
      speak(
        `Question ${index + 1} of ${attempt.questions.length}. ${q.prompt} ${q.alternative} ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(". ")}`,
        prefs.rate,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (!prefs.shortcuts || !attempt) return;
    const key = (e: KeyboardEvent) => {
      if (
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        confirm ||
        help ||
        document.querySelector('[role="dialog"]') ||
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(
          (e.target as HTMLElement).tagName,
        ) ||
        (e.target as HTMLElement).isContentEditable
      )
        return;
      const q = attempt.questions[index];
      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          navigate(Math.min(index + 1, attempt.questions.length - 1));
          break;
        case "p":
          e.preventDefault();
          navigate(Math.max(0, index - 1));
          break;
        case "r":
          if (prefs.tts) {
            e.preventDefault();
            read();
          }
          break;
        case "m":
          e.preventDefault();
          answer(q.id, {
            answer: attempt.answers[q.id]?.answer ?? null,
            review: !attempt.answers[q.id]?.review,
          });
          break;
        case "?":
          setHelp(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  if (!attempt) return error ? <ErrorNotice message={error} /> : <Loading />;
  const q = attempt.questions[index];
  const response = attempt.answers[q.id] || { answer: null, review: false };
  const answered = attempt.questions.filter(
    (q) => attempt.answers[q.id]?.answer != null,
  ).length;
  const marked = attempt.questions.filter(
    (q) => attempt.answers[q.id]?.review,
  ).length;
  const unsaved = Object.keys(pending.current).length > 0;
  const time = `${Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  return (
    <ExamGuard>
      <div className="sr-only" role="status" aria-live="polite">
        {t(announcement)}
      </div>
      <div className="exam-titlebar">
        <div>
          <span className="eyebrow">{t("ASSESSMENT IN PROGRESS")}</span>
          <h1 tabIndex={-1}>{t(attempt.title)}</h1>
        </div>
        <div className={remaining <= 60 ? "timer urgent" : "timer"}>
          <Clock size={22} />
          <div>
            <span>{t("Time remaining")}</span>
            <strong
              role="timer"
              aria-live="off"
              aria-label={t(
                `${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds remaining`,
              )}
            >
              {t(time)}
            </strong>
          </div>
          <button
            className="icon-button"
            aria-label={t("Hear remaining time")}
            onClick={() => {
              const text = `Time remaining: ${Math.floor(remaining / 60)} minutes ${remaining % 60} seconds.`;
              setAnnouncement(text);
              if (prefs.tts)
                try {
                  speak(text, prefs.rate);
                } catch (e) {
                  setError((e as Error).message);
                }
            }}
          >
            <Volume2 size={20} />
          </button>
        </div>
      </div>
      <div className="exam-progress">
        <span
          style={{ width: `${(answered / attempt.questions.length) * 100}%` }}
        />
      </div>
      <div className="exam-grid">
        <section className="question-panel panel">
          {error && <ErrorNotice message={error} />}
          <div className="question-meta">
            <span>
              {t(
                review
                  ? "FINAL CHECK"
                  : `QUESTION ${String(index + 1).padStart(2, "0")} OF ${String(attempt.questions.length).padStart(2, "0")}`,
              )}
            </span>
            <span>{t(review ? `${answered} answered` : q.topic)}</span>
          </div>
          {review ? (
            <>
              <h2 ref={heading} tabIndex={-1}>
                {t(" Review your answers ")}
              </h2>
              <p>
                {t(attempt.questions.length - answered)} {t(" unanswered · ")}
                {t(marked)}
                {t(" ")}
                {t(" marked for review. Select any question to return to it. ")}
              </p>
              <div className="review-list">
                {attempt.questions.map((q, i) => (
                  <button key={q.id} onClick={() => navigate(i)}>
                    <span>
                      <strong>
                        {t("Question ")}
                        {t(i + 1)}
                      </strong>
                      <small>{t(q.prompt)}</small>
                    </span>
                    <span>
                      {t(
                        attempt.answers[q.id]?.answer != null
                          ? "Answered"
                          : "Unanswered",
                      )}
                      {t(
                        attempt.answers[q.id]?.review
                          ? " · Marked for review"
                          : "",
                      )}
                      <ArrowRight size={18} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="question-actions">
                <button
                  className="button secondary"
                  onClick={() => setReview(false)}
                >
                  {t(" Return to exam ")}
                </button>
                <button
                  className="button"
                  disabled={unsaved || submitting}
                  onClick={() => setConfirm(true)}
                >
                  {t(" Submit exam ")}
                  <Check size={18} />
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 id="question-heading" ref={heading} tabIndex={-1}>
                {t(q.prompt)}
              </h2>
              {q.alternative && (
                <div className="alternative">
                  <strong>{t("Accessible data description")}</strong>
                  <p>{t(q.alternative)}</p>
                </div>
              )}
              {prefs.tts && (
                <div
                  className="audio-controls"
                  aria-label={t("Question audio")}
                >
                  <button
                    className="text-button"
                    onClick={read}
                    data-reading-start
                    aria-keyshortcuts="Alt+R"
                  >
                    <Volume2 size={18} />
                    {t(" Read question ")}
                    <kbd aria-hidden="true">Alt+R</kbd>
                  </button>
                  <button
                    aria-label={t("Pause reading")}
                    className="icon-button"
                    onClick={() => window.speechSynthesis?.pause()}
                  >
                    <Pause size={17} />
                  </button>
                  <button
                    aria-label={t("Resume reading")}
                    className="icon-button"
                    onClick={() => window.speechSynthesis?.resume()}
                  >
                    <Play size={17} />
                  </button>
                  <button
                    aria-label={t("Stop reading")}
                    className="text-button"
                    data-reading-stop
                    aria-keyshortcuts="Alt+S"
                    onClick={() => window.speechSynthesis?.cancel()}
                  >
                    <Square size={16} />
                    {t("Stop reading")} <kbd aria-hidden="true">Alt+S</kbd>
                  </button>
                </div>
              )}
              <fieldset
                className="answer-options"
                disabled={submitting || remaining <= 0}
              >
                <legend>
                  {t(" Select one answer")}
                  {t(" ")}
                  <span>
                    {t(" · ")}
                    {t(q.marks)} {t(" mark")}
                    {t(q.marks === 1 ? "" : "s")}
                  </span>
                </legend>
                {q.options.map((option, i) => (
                  <label
                    key={`${q.id}-${i}`}
                    className={
                      response.answer === i
                        ? "answer-option selected"
                        : "answer-option"
                    }
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={i}
                      checked={response.answer === i}
                      onChange={() => answer(q.id, { ...response, answer: i })}
                    />
                    <span className="option-letter">
                      {t(String.fromCharCode(65 + i))}
                    </span>
                    <span
                      lang={/[\u0900-\u097f]/.test(t(option)) ? "hi" : "en"}
                    >
                      {t(option)}
                    </span>
                    {response.answer === i && (
                      <Check size={20} aria-hidden="true" />
                    )}
                  </label>
                ))}
              </fieldset>
              <div className="question-utilities">
                <button
                  className={
                    response.review ? "button marked" : "button secondary"
                  }
                  aria-pressed={response.review}
                  onClick={() => {
                    answer(q.id, { ...response, review: !response.review });
                    setAnnouncement(
                      response.review
                        ? "Review mark removed."
                        : "Question marked for review.",
                    );
                  }}
                  disabled={submitting || remaining <= 0}
                >
                  <Flag size={17} />
                  {t(response.review ? "Marked for review" : "Mark for review")}
                </button>
                <button
                  className="text-button muted-text"
                  disabled={
                    response.answer === null || submitting || remaining <= 0
                  }
                  onClick={() => answer(q.id, { ...response, answer: null })}
                >
                  {t(" Clear answer ")}
                </button>
              </div>
              <div className="question-actions">
                <button
                  className="button secondary"
                  disabled={index === 0}
                  onClick={() => navigate(index - 1)}
                >
                  <ArrowLeft size={18} />
                  {t(" Previous ")}
                </button>
                <span className="question-page">
                  {t(index + 1)} {t(" / ")}
                  {t(attempt.questions.length)}
                </span>
                <button
                  className="button"
                  onClick={() =>
                    index === attempt.questions.length - 1
                      ? setReview(true)
                      : navigate(index + 1)
                  }
                >
                  {t(
                    index === attempt.questions.length - 1
                      ? "Review answers"
                      : "Next question",
                  )}
                  <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}
          <div
            className={
              saveStatus.startsWith("Not")
                ? "save-status failed"
                : "save-status"
            }
            role="status"
          >
            <ShieldCheck size={17} />
            <span>{t(saveStatus)}</span>
            {saveStatus.startsWith("Not") && (
              <button onClick={() => flush()}>{t("Retry now")}</button>
            )}
          </div>
        </section>
        <aside className="exam-side">
          <section className="panel navigator">
            <div className="section-heading">
              <h2>{t("Your progress")}</h2>
              <strong>
                {t(answered)}
                {t("/")}
                {t(attempt.questions.length)}
              </strong>
            </div>
            <p>
              {t(answered)} {t(" answered · ")}
              {t(attempt.questions.length - answered)}
              {t(" ")}
              {t(" remaining ")}
            </p>
            <nav aria-label={t("Question navigator")} className="question-grid">
              {attempt.questions.map((question, i) => {
                const r = attempt.answers[question.id];
                return (
                  <button
                    key={question.id}
                    className={`${i === index && !review ? "current " : ""}${r?.answer != null ? "answered " : ""}${r?.review ? "flagged" : ""}`}
                    aria-current={i === index && !review ? "step" : undefined}
                    aria-label={t(
                      `Question ${i + 1}, ${r?.answer != null ? "answered" : "unanswered"}${r?.review ? ", marked for review" : ""}`,
                    )}
                    onClick={() => navigate(i)}
                  >
                    <span>{t(i + 1)}</span>
                    {r?.review ? (
                      <Flag size={12} />
                    ) : r?.answer != null ? (
                      <Check size={13} />
                    ) : (
                      <span className="unanswered-dash">{t("—")}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="navigator-key">
              <span>
                <Check size={14} />
                {t(" Answered ")}
              </span>
              <span>{t("— Unanswered")}</span>
              <span>
                <Flag size={14} />
                {t(" For review ")}
              </span>
            </div>
            <button
              className="button secondary full"
              onClick={() => setReview(true)}
            >
              {t(" Review & submit ")}
              <ArrowRight size={17} />
            </button>
          </section>
          <section className="exam-tools">
            <h2>{t("Your exam tools")}</h2>
            {!!attempt.extraMinutes && (
              <p className="accommodation-badge">
                {t(attempt.extraMinutes)}{" "}
                {t(" minutes of approved extra time included. ")}
              </p>
            )}
            <button onClick={onSettings}>
              <Settings2 size={18} />
              {t(" Accessibility preferences ")}
            </button>
            <button onClick={() => setHelp(true)}>
              <Keyboard size={18} />
              {t(" Keyboard help ")}
            </button>
            <NvdaGuide />
            <p>{t("You can return to any question before submitting.")}</p>
          </section>
        </aside>
      </div>
      <Modal
        open={confirm}
        onOpenChange={setConfirm}
        title={t("Submit your exam?")}
        description={t(
          "Submission is final. You won’t be able to change your answers afterwards.",
        )}
      >
        <dl className="submit-summary">
          <div>
            <dt>{t("Answered")}</dt>
            <dd>
              {t(answered)} {t(" of ")}
              {t(attempt.questions.length)}
            </dd>
          </div>
          <div>
            <dt>{t("Unanswered")}</dt>
            <dd>{t(attempt.questions.length - answered)}</dd>
          </div>
          <div>
            <dt>{t("Marked for review")}</dt>
            <dd>{t(marked)}</dd>
          </div>
        </dl>
        {error && (
          <p className="error" role="alert">
            {t(error)}
          </p>
        )}
        <div className="actions">
          <button
            className="button secondary"
            onClick={() => setConfirm(false)}
          >
            {t(" Keep reviewing ")}
          </button>
          <button
            className="button"
            disabled={submitting || unsaved}
            onClick={() => submit()}
          >
            {t(submitting ? "Submitting…" : "Confirm submission")}
          </button>
        </div>
      </Modal>
      <Modal
        open={help}
        onOpenChange={setHelp}
        title={t("Exam keyboard help")}
        description={t(
          "Use Tab to move between controls and arrow keys to choose answers.",
        )}
      >
        <p>
          {t(
            "Reading shortcuts: Alt+R starts reading; Alt+S stops immediately. Turn Audio off to disable them. Start is inactive while typing or recording; Stop still works while typing.",
          )}
        </p>
        <p>
          {t(
            " Enter or Space activates a button. Escape closes a dialog. Your focus moves to the question heading when you navigate. ",
          )}
        </p>
        <p>
          {t(" Optional shortcuts are ")}
          {t(prefs.shortcuts ? "on" : "off")}
          {t(
            ": N — next, P — previous, R — read, M — review. They don’t run while focus is on an input or button. You can disable them in accessibility preferences. ",
          )}
        </p>
      </Modal>
    </ExamGuard>
  );
}
