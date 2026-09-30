"use client";
import { useLanguage } from "./language";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  BookOpen,
  FileText,
  Users,
  Trophy,
  Pencil,
  ArrowUp,
  ArrowDown,
  Check,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { Question, Exam, User, Attempt, Audit } from "@/lib/types";
import { api, Modal, PageHeading, Empty, Loading, ErrorNotice } from "./shared";
type Overview = {
  questions: Question[];
  exams: Exam[];
  candidates: User[];
  results: Attempt[];
  audit: Audit[];
};
export function AdminWorkspace({ path }: { path: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState<Partial<Question> | null>(null);
  const [exam, setExam] = useState<Partial<Exam> | null>(null);
  const [status, setStatus] = useState("");
  async function load() {
    try {
      setData(await api<Overview>("admin"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  if (!data)
    return error ? <ErrorNotice message={error} retry={load} /> : <Loading />;
  const tab = path.split("/")[2] || "overview";
  const title =
    tab === "questions"
      ? "Question bank"
      : tab === "exams"
        ? "Exams & assignments"
        : tab === "results"
          ? "Candidate results"
          : tab === "audit"
            ? "Audit log"
            : "Administration overview";
  return (
    <>
      <PageHeading
        eyebrow={t("ADMIN WORKSPACE")}
        title={t(title)}
        action={
          tab === "questions" ? (
            <button
              className="button"
              onClick={() =>
                setQuestion({ options: ["", "", "", ""], correct: 0, marks: 1 })
              }
            >
              <Plus size={18} />
              {t(" New question ")}
            </button>
          ) : tab === "exams" ? (
            <button
              className="button"
              onClick={() =>
                setExam({
                  questionIds: [],
                  assigned: [],
                  duration: 20,
                  kind: "assigned",
                  status: "draft",
                })
              }
            >
              <Plus size={18} />
              {t(" Create exam ")}
            </button>
          ) : undefined
        }
      >
        {t(
          tab === "overview"
            ? "Create accessible assessments and support every candidate."
            : tab === "questions"
              ? "Clear questions. Meaningful alternatives. A fair assessment."
              : tab === "exams"
                ? "Build assessments, set durations, and assign candidates."
                : tab === "audit"
                  ? "A record of important actions in this local workspace."
                  : "Scores and submissions from your assigned candidates.",
        )}
      </PageHeading>
      <div role="status" className="success-message">
        {t(status)}
      </div>
      {error && <ErrorNotice message={error} retry={load} />}
      {tab === "overview" && (
        <>
          <div className="stats-grid">
            <div className="stat">
              <div>
                <span>{t("Question bank")}</span>
                <strong>{t(data.questions.length)}</strong>
                <small>{t("Single-choice questions")}</small>
              </div>
              <BookOpen />
            </div>
            <div className="stat">
              <div>
                <span>{t("Published exams")}</span>
                <strong>
                  {t(data.exams.filter((e) => e.status === "published").length)}
                </strong>
                <small>{t("Available assessments")}</small>
              </div>
              <FileText />
            </div>
            <div className="stat">
              <div>
                <span>{t("Submitted attempts")}</span>
                <strong>{t(data.results.length)}</strong>
                <small>{t("Ready to review")}</small>
              </div>
              <Trophy />
            </div>
          </div>
          <section className="section">
            <h2>{t("Manage your assessments")}</h2>
            <div className="practice-grid">
              <article className="exam-card">
                <span className="tile-icon">
                  <BookOpen />
                </span>
                <h3>{t("A question bank for everyone")}</h3>
                <p>
                  {t(
                    " Write questions with clear answer options and accessible data descriptions. ",
                  )}
                </p>
                <Link className="text-button" href="/admin/questions">
                  {t(" Manage questions ")}
                  <ArrowRight size={18} />
                </Link>
              </article>
              <article className="exam-card">
                <span className="tile-icon">
                  <Users />
                </span>
                <h3>{t("Bring your next exam together")}</h3>
                <p>
                  {t(
                    " Choose questions, set the order, and assign the right candidates. ",
                  )}
                </p>
                <Link className="text-button" href="/admin/exams">
                  {t(" Manage exams ")}
                  <ArrowRight size={18} />
                </Link>
              </article>
            </div>
          </section>
        </>
      )}
      {tab === "questions" && (
        <>
          <div className="search-box">
            <Search size={19} />
            <label className="sr-only" htmlFor="question-search">
              {t(" Search questions ")}
            </label>
            <input
              id="question-search"
              placeholder={t("Search questions or topics")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="panel table-wrap">
            <table>
              <caption className="sr-only">{t("Question bank")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("Question")}</th>
                  <th scope="col">{t("Topic")}</th>
                  <th scope="col">{t("Marks")}</th>
                  <th scope="col">{t("Action")}</th>
                </tr>
              </thead>
              <tbody>
                {data.questions
                  .filter((q) =>
                    `${q.prompt} ${q.topic}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((q, i) => (
                    <tr key={q.id}>
                      <th scope="row">
                        <span className="question-row">
                          <span className="row-number">
                            {t(String(i + 1).padStart(2, "0"))}
                          </span>
                          {t(q.prompt)}
                        </span>
                        {q.alternative && (
                          <small className="alternative-label">
                            {t(" Text alternative included ")}
                          </small>
                        )}
                      </th>
                      <td>{t(q.topic)}</td>
                      <td>{t(q.marks)}</td>
                      <td>
                        <button
                          className="button secondary compact"
                          aria-label={t(`Edit question: ${q.prompt}`)}
                          onClick={() => setQuestion(q)}
                        >
                          <Pencil size={15} />
                          {t(" Edit ")}
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {data.questions.filter((q) =>
              `${q.prompt} ${q.topic}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            ).length === 0 && (
              <Empty title={t("No matching questions")}>
                {t(" Try another word or topic. ")}
              </Empty>
            )}
          </div>
        </>
      )}
      {tab === "exams" && (
        <div className="admin-exam-list">
          {data.exams.map((e) => (
            <article key={e.id} className="exam-card">
              <div className="section-heading">
                <h2>{t(e.title)}</h2>
                <span className="pill">{t(e.status)}</span>
              </div>
              <p>{t(e.description)}</p>
              <div className="exam-meta">
                <span>
                  {t(e.duration)} {t(" minutes")}
                </span>
                <span>
                  {t(e.questionIds.length)} {t(" questions")}
                </span>
                <span>
                  {t(
                    e.kind === "assigned"
                      ? `${e.assigned.length} candidates assigned`
                      : "Available to all candidates",
                  )}
                </span>
              </div>
              <button className="button secondary" onClick={() => setExam(e)}>
                <Pencil size={17} />
                {t(" Edit exam & assignments ")}
              </button>
            </article>
          ))}
        </div>
      )}
      {tab === "results" &&
        (data.results.length ? (
          <div className="panel table-wrap">
            <table>
              <caption className="sr-only">{t("Candidate scores")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("Candidate")}</th>
                  <th scope="col">{t("Exam")}</th>
                  <th scope="col">{t("Score")}</th>
                  <th scope="col">{t("Submitted")}</th>
                  <th scope="col">{t("Access feedback")}</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((a) => (
                  <tr key={a.id}>
                    <th scope="row">
                      {t(data.candidates.find((c) => c.id === a.userId)?.name)}
                    </th>
                    <td>{t(a.title)}</td>
                    <td>
                      {t(a.score)} {t(" / ")}
                      {t(a.maxScore)}
                    </td>
                    <td>
                      {t(new Date(a.submittedAt!).toLocaleString("en-IN"))}
                    </td>
                    <td>
                      {a.feedback ? (
                        <>
                          <strong>
                            {t(
                              a.feedback.navigation === "independent"
                                ? "Independent"
                                : a.feedback.navigation === "some-help"
                                  ? "Some help needed"
                                  : "Barrier reported",
                            )}
                          </strong>
                          <small className="feedback-detail">
                            {t(
                              a.feedback.barriers.length
                                ? a.feedback.barriers.join(", ")
                                : "No improvement areas selected",
                            )}
                            {t(" ")}
                            {t(" · self-reported ")}
                          </small>
                        </>
                      ) : (
                        "Not shared"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={t("No submissions yet")}>
            {t(" Candidate results appear here after an exam is submitted. ")}
          </Empty>
        ))}
      {tab === "audit" && (
        <div className="panel table-wrap">
          <table>
            <caption className="sr-only">{t("Recent audit events")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("Event")}</th>
                <th scope="col">{t("Details")}</th>
                <th scope="col">{t("Actor")}</th>
                <th scope="col">{t("Time")}</th>
              </tr>
            </thead>
            <tbody>
              {data.audit.map((a) => (
                <tr key={a.id}>
                  <th scope="row">{t(a.event.replaceAll("_", " "))}</th>
                  <td>{t(a.detail)}</td>
                  <td>{t(a.actor)}</td>
                  <td>{t(new Date(a.at).toLocaleString("en-IN"))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={question !== null}
        onOpenChange={(v) => {
          if (!v) setQuestion(null);
        }}
        title={t(question?.id ? "Edit question" : "Create a question")}
        description={t(
          "Single-choice questions need four distinct options and one correct answer.",
        )}
      >
        {question && (
          <QuestionEditor
            question={question}
            onSaved={async () => {
              setQuestion(null);
              await load();
              setStatus(
                "Question saved. Existing attempts keep their original questions.",
              );
            }}
          />
        )}
      </Modal>
      <Modal
        open={exam !== null}
        onOpenChange={(v) => {
          if (!v) setExam(null);
        }}
        title={t(exam?.id ? "Edit exam & assignments" : "Create an exam")}
        description={t(
          "Choose questions, arrange their order, and assign candidates before publishing.",
        )}
      >
        {exam && (
          <ExamEditor
            exam={exam}
            data={data}
            onSaved={async () => {
              setExam(null);
              await load();
              setStatus("Exam and assignments saved.");
            }}
          />
        )}
      </Modal>
    </>
  );
}
function QuestionEditor({
  question,
  onSaved,
}: {
  question: Partial<Question>;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [q, setQ] = useState(question);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("admin/questions", "POST", {
        ...q,
        alternative: q.alternative || "",
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="editor-form">
      <label>
        {t(" Question text ")}
        <textarea
          required
          minLength={5}
          maxLength={3000}
          rows={3}
          value={q.prompt || ""}
          onChange={(e) => setQ({ ...q, prompt: e.target.value })}
        />
      </label>
      <div className="form-grid">
        <label>
          {t(" Topic ")}
          <input
            required
            maxLength={100}
            value={q.topic || ""}
            onChange={(e) => setQ({ ...q, topic: e.target.value })}
          />
        </label>
        <label>
          {t(" Marks ")}
          <input
            required
            type="number"
            min={1}
            max={100}
            value={q.marks}
            onChange={(e) => setQ({ ...q, marks: Number(e.target.value) })}
          />
        </label>
      </div>
      <fieldset>
        <legend>{t("Answer options")}</legend>
        {q.options!.map((o, i) => (
          <label key={i}>
            {t(" Option ")}
            {t(String.fromCharCode(65 + i))}
            <input
              required
              maxLength={1000}
              value={o}
              onChange={(e) =>
                setQ({
                  ...q,
                  options: q.options!.map((s, j) =>
                    j === i ? e.target.value : s,
                  ),
                })
              }
            />
          </label>
        ))}
      </fieldset>
      <label>
        {t(" Correct answer ")}
        <select
          value={q.correct}
          onChange={(e) => setQ({ ...q, correct: Number(e.target.value) })}
        >
          {[0, 1, 2, 3].map((i) => (
            <option key={i} value={i}>
              {t(" Option ")}
              {t(String.fromCharCode(65 + i))}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t(" Accessible description or data equivalent ")}
        <textarea
          rows={3}
          maxLength={3000}
          value={q.alternative || ""}
          onChange={(e) => setQ({ ...q, alternative: e.target.value })}
        />
      </label>
      <p className="field-note">
        {t(
          " Include all information needed to answer any question that refers to a chart or diagram. This prototype supports text alternatives; media upload is not included. ",
        )}
      </p>
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <button className="button" type="submit" disabled={busy}>
        <Check size={18} />
        {t(busy ? "Saving…" : "Save question")}
      </button>
    </form>
  );
}
function ExamEditor({
  exam,
  data,
  onSaved,
}: {
  exam: Partial<Exam>;
  data: Overview;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [e, setE] = useState(exam);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function move(index: number, delta: number) {
    const ids = [...e.questionIds!];
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    setE({ ...e, questionIds: ids });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("admin/exams", "POST", {
        ...e,
        description: e.description || "",
      });
      onSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="editor-form">
      <label>
        {t(" Exam title ")}
        <input
          required
          minLength={3}
          maxLength={150}
          value={e.title || ""}
          onChange={(event) => setE({ ...e, title: event.target.value })}
        />
      </label>
      <label>
        {t(" Description ")}
        <textarea
          maxLength={2000}
          value={e.description || ""}
          onChange={(event) => setE({ ...e, description: event.target.value })}
        />
      </label>
      <div className="form-grid">
        <label>
          {t(" Duration in minutes ")}
          <input
            required
            type="number"
            min={1}
            max={180}
            value={e.duration}
            onChange={(event) =>
              setE({ ...e, duration: Number(event.target.value) })
            }
          />
        </label>
        <label>
          {t(" Type ")}
          <select
            value={e.kind}
            onChange={(event) =>
              setE({ ...e, kind: event.target.value as Exam["kind"] })
            }
          >
            <option value="assigned">{t("Assigned examination")}</option>
            <option value="practice">{t("Practice set")}</option>
            <option value="mock">{t("Mock test")}</option>
          </select>
        </label>
      </div>
      <fieldset>
        <legend>{t("Choose questions")}</legend>
        <div className="question-picker">
          {data.questions.map((q) => (
            <label key={q.id} className="inline">
              <input
                type="checkbox"
                checked={e.questionIds!.includes(q.id)}
                onChange={(event) =>
                  setE({
                    ...e,
                    questionIds: event.target.checked
                      ? [...e.questionIds!, q.id]
                      : e.questionIds!.filter((id) => id !== q.id),
                  })
                }
              />
              {t(q.prompt)}
            </label>
          ))}
        </div>
      </fieldset>
      {!!e.questionIds!.length && (
        <fieldset>
          <legend>{t("Question order")}</legend>
          <ol className="order-list">
            {e.questionIds!.map((id, i) => (
              <li key={id}>
                <span>
                  {t(data.questions.find((q) => q.id === id)?.prompt)}
                </span>
                <button
                  type="button"
                  className="icon-button"
                  disabled={i === 0}
                  aria-label={t(`Move question ${i + 1} up`)}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={i === e.questionIds!.length - 1}
                  aria-label={t(`Move question ${i + 1} down`)}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown size={17} />
                </button>
              </li>
            ))}
          </ol>
        </fieldset>
      )}
      {e.kind === "assigned" && (
        <fieldset>
          <legend>{t("Assign candidates")}</legend>
          {data.candidates.map((c) => (
            <label className="inline" key={c.id}>
              <input
                type="checkbox"
                checked={e.assigned!.includes(c.id)}
                onChange={(event) =>
                  setE({
                    ...e,
                    assigned: event.target.checked
                      ? [...e.assigned!, c.id]
                      : e.assigned!.filter((id) => id !== c.id),
                  })
                }
              />
              {t(c.name)}
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className="accommodation-editor">
        <legend>{t("Approved extra time")}</legend>
        <p className="field-note">
          {t(
            " Set minutes per candidate after reviewing their request. Changes apply to new attempts only. No diagnosis is stored here. ",
          )}
        </p>
        {data.candidates.map((c) => (
          <label key={c.id}>
            {t(c.name)} {t(" — extra minutes ")}
            <input
              type="number"
              min={0}
              max={180}
              value={e.extraMinutes?.[c.id] || 0}
              onChange={(event) =>
                setE({
                  ...e,
                  extraMinutes: {
                    ...e.extraMinutes,
                    [c.id]: Number(event.target.value),
                  },
                })
              }
            />
          </label>
        ))}
      </fieldset>
      <label className="inline">
        <input
          type="checkbox"
          checked={e.shuffleQuestions || false}
          onChange={(event) =>
            setE({ ...e, shuffleQuestions: event.target.checked })
          }
        />
        {t(" Randomize question order per attempt ")}
      </label>
      <p className="field-note">
        {t(
          " Each attempt keeps a stable order after starting. Assistive software stays available; focus changes do not trigger misconduct flags. ",
        )}
      </p>
      <label>
        {t(" Publication status ")}
        <select
          value={e.status}
          onChange={(event) =>
            setE({ ...e, status: event.target.value as Exam["status"] })
          }
        >
          <option value="draft">{t("Draft — hidden from candidates")}</option>
          <option value="published">
            {t("Published — available to candidates")}
          </option>
        </select>
      </label>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      <button className="button" type="submit" disabled={busy}>
        {t(busy ? "Saving…" : "Save exam & assignments")}
        <Check size={18} />
      </button>
    </form>
  );
}
