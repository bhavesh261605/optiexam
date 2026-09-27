"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Accessibility,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Keyboard,
  Volume2,
  Compass,
  ChartNoAxesCombined,
} from "lucide-react";
import {
  defaultPreferences,
  type User,
  type Preferences,
  type Exam,
  type Attempt,
  type Result,
} from "@/lib/types";
import {
  api,
  Modal,
  PreferencesForm,
  PageHeading,
  Empty,
  Loading,
  ErrorNotice,
  speak,
} from "./shared";
import { ExamWorkspace } from "./exam";
import { AdminWorkspace } from "./admin";
import {
  AccessLab,
  AnalyticsPage,
  AttemptInsights,
  AccessFeedback,
  IntegrityNote,
  NvdaGuide,
} from "./learning";

export function Workspace() {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [prefs, setPrefs] = useState(defaultPreferences);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const data = await api<{
        user: User | null;
        preferences: Preferences | null;
      }>("me");
      setUser(data.user);
      if (data.preferences) setPrefs(data.preferences);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.contrast = prefs.contrast
      ? "high"
      : "standard";
    document.documentElement.style.fontSize = `${prefs.scale}%`;
    document.documentElement.dataset.largeText =
      prefs.scale >= 150 ? "true" : "false";
    document.documentElement.dataset.motion = prefs.reducedMotion
      ? "reduced"
      : "standard";
  }, [prefs]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      heading?.focus();
      document.title = `${heading?.textContent || "Accessible examinations"} · OptiExam`;
    }, 150);
    window.speechSynthesis?.cancel();
    return () => clearTimeout(timer);
  }, [path, user]);
  async function signIn(id: string) {
    setBusy(true);
    try {
      const data = await api<{ user: User }>("login", "POST", { id });
      setUser(data.user);
      const me = await api<{ preferences: Preferences }>("me");
      setPrefs(me.preferences);
      router.push(
        data.user.role === "admin"
          ? "/admin"
          : me.preferences.setup
            ? "/dashboard"
            : "/setup",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    try {
      await api("logout", "POST");
      setUser(null);
      setPrefs(defaultPreferences);
      router.push("/");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!loaded)
    return (
      <main>
        <Loading />
      </main>
    );
  if (!user)
    return (
      <>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <main id="main" className="login-page">
          <section className="login-story">
            <Brand />
            <div>
              <span className="eyebrow">ACCESSIBLE EXAMINATIONS</span>
              <h1 tabIndex={-1}>
                Your examination
                <br />
                workspace.
              </h1>
              <p>
                Assigned exams, practice tests, and results. Set up your
                preferred reading and navigation controls before you begin.
              </p>
              <div className="login-features">
                <span>
                  <Keyboard /> Keyboard-first navigation
                </span>
                <span>
                  <Volume2 /> Read-aloud support
                </span>
                <span>
                  <Settings2 /> Your accessibility preferences
                </span>
              </div>
            </div>
            <p className="login-footer">
              OptiExam <span>Accessible Examination Platform · DT-13</span>
            </p>
          </section>
          <section className="login-panel">
            <span className="pill">LOCAL PROTOTYPE</span>
            <h2>Welcome to OptiExam</h2>
            <p>
              Choose a demo workspace to explore the full examination journey.
            </p>
            <button
              className="login-choice"
              disabled={busy}
              onClick={() => signIn("candidate-demo")}
            >
              <span className="tile-icon">
                <GraduationCap />
              </span>
              <span>
                <strong>Candidate workspace</strong>
                <small>Aarav Sharma · Candidate</small>
              </span>
              <ArrowRight />
            </button>
            <button
              className="login-choice"
              disabled={busy}
              onClick={() => signIn("admin-demo")}
            >
              <span className="tile-icon muted">
                <ShieldCheck />
              </span>
              <span>
                <strong>Administrator workspace</strong>
                <small>Ananya Rao · Administrator</small>
              </span>
              <ArrowRight />
            </button>
            <p className="demo-note">
              <ShieldCheck size={18} />
              Demo accounts use local sessions. Production sign-in is not
              connected.
            </p>
            {error && <ErrorNotice message={error} retry={load} />}
          </section>
        </main>
      </>
    );
  const isExam = path.startsWith("/exam/");
  const admin = user.role === "admin";
  const navigation = admin
    ? ([
        ["/admin", "Overview", LayoutDashboard],
        ["/admin/questions", "Question bank", BookOpen],
        ["/admin/exams", "Exams & assignments", FileText],
        ["/admin/results", "Candidate results", Trophy],
        ["/admin/audit", "Audit log", ShieldCheck],
      ] as const)
    : ([
        ["/dashboard", "Overview", LayoutDashboard],
        ["/access-lab", "Access lab", Compass],
        ["/exams", "My examinations", FileText],
        ["/practice", "Practice & mock tests", BookOpen],
        ["/results", "My results", Trophy],
        ["/analytics", "Learning insights", ChartNoAxesCombined],
      ] as const);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div className={isExam ? "app-layout exam-layout" : "app-layout"}>
        {!isExam && (
          <aside className="sidebar">
            <Brand />
            <div className="workspace-label">
              {admin ? "ADMIN WORKSPACE" : "CANDIDATE WORKSPACE"}
            </div>
            <nav aria-label="Main navigation">
              {navigation.map(([href, label, Icon]) => (
                <Link
                  key={href}
                  href={href}
                  className={path === href ? "nav-item active" : "nav-item"}
                  aria-current={path === href ? "page" : undefined}
                >
                  <Icon size={20} />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="access-card">
                <Accessibility size={23} />
                <strong>Made for your way of learning</strong>
                <p>Adjust your workspace at any time.</p>
                <button onClick={() => setSettings(true)}>
                  Accessibility settings <ArrowRight size={15} />
                </button>
              </div>
              <button className="nav-item" onClick={() => setHelp(true)}>
                <Keyboard size={20} />
                Keyboard help
              </button>
              <div className="profile">
                <span className="avatar">
                  {user.name
                    .split(" ")
                    .map((s) => s[0])
                    .join("")}
                </span>
                <span>
                  <strong>{user.name}</strong>
                  <small>{admin ? "Administrator" : "Candidate"} · Demo</small>
                </span>
                <button
                  aria-label="Sign out"
                  className="icon-button"
                  onClick={signOut}
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </aside>
        )}
        <div className="workspace">
          <header className="topbar">
            {isExam ? (
              <Brand />
            ) : (
              <div className="breadcrumb">
                Workspace <ChevronRight size={15} />
                <span>
                  {admin ? "Administration" : "Learning & examinations"}
                </span>
              </div>
            )}
            <div className="topbar-actions">
              <span className="demo-label">Demo workspace</span>
              <button
                className="button secondary compact"
                onClick={() => setSettings(true)}
              >
                <Accessibility size={18} />
                Accessibility
              </button>
            </div>
          </header>
          <main id="main" className={isExam ? "exam-main" : "main-content"}>
            {error && <ErrorNotice message={error} />}
            {admin ? (
              <AdminWorkspace path={path} />
            ) : path === "/setup" ? (
              <div className="setup">
                <PageHeading
                  eyebrow="MAKE YOURSELF COMFORTABLE"
                  title="Your exam, your way"
                >
                  Choose the settings that work for you. You can change them at
                  any time.
                </PageHeading>
                <section className="panel">
                  <PreferencesForm
                    preferences={prefs}
                    onPreview={setPrefs}
                    onSaved={(p) => {
                      setPrefs(p);
                      router.push("/dashboard");
                    }}
                  />
                </section>
              </div>
            ) : path === "/access-lab" ? (
              <AccessLab prefs={prefs} onSaved={setPrefs} />
            ) : path === "/analytics" ? (
              <AnalyticsPage />
            ) : path.startsWith("/instructions/") ? (
              <Instructions id={path.split("/")[2]} prefs={prefs} />
            ) : isExam ? (
              <ExamWorkspace
                id={path.split("/")[2]}
                prefs={prefs}
                onSettings={() => setSettings(true)}
              />
            ) : path.startsWith("/results/") ? (
              <ResultPage id={path.split("/")[2]} />
            ) : (
              <Dashboard
                path={path}
                user={user}
                prefs={prefs}
                onSettings={() => setSettings(true)}
              />
            )}
          </main>
          {!isExam && (
            <footer className="workspace-footer">
              <span>OptiExam · Accessible Examination & Practice</span>
              <span>Designed for independent learning</span>
            </footer>
          )}
        </div>
      </div>
      <Modal
        open={settings}
        onOpenChange={setSettings}
        title="Accessibility preferences"
        description="Personalize your workspace. Changes apply after saving."
      >
        <PreferencesForm
          key={String(settings)}
          preferences={prefs}
          onSaved={(p) => {
            setPrefs(p);
            setSettings(false);
          }}
          onCancel={() => setSettings(false)}
        />
      </Modal>
      <Modal
        open={help}
        onOpenChange={setHelp}
        title="Keyboard navigation"
        description="Every action is available using the keyboard."
      >
        <div className="shortcut-list">
          <p>
            <kbd>Tab</kbd> Move to the next control
          </p>
          <p>
            <kbd>Shift + Tab</kbd> Move to the previous control
          </p>
          <p>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Choose an answer in a radio group
          </p>
          <p>
            <kbd>Enter</kbd> Activate a button or link
          </p>
          <p>
            <kbd>Esc</kbd> Close a dialog
          </p>
        </div>
        <p>
          Optional exam shortcuts: N — next, P — previous, R — read, M — mark
          for review. Enable these in accessibility preferences. Leave them off
          when using screen-reader navigation.
        </p>
      </Modal>
    </>
  );
}
function Brand() {
  return (
    <div className="brand">
      <img className="brand-symbol" src="/optiexam-symbol.png" alt="OptiExam" width={76} height={76} />
    </div>
  );
}

function Dashboard({
  path,
  user,
  onSettings,
  prefs,
}: {
  path: string;
  user: User;
  onSettings: () => void;
  prefs: Preferences;
}) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  async function load() {
    try {
      setExams(await api<Exam[]>("exams"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  if (loading) return <Loading />;
  if (error) return <ErrorNotice message={error} retry={load} />;
  const complete = exams.filter((e) => e.attempt?.status === "evaluated");
  const active = exams.filter((e) => e.attempt?.status === "in_progress");
  const assigned = exams.filter((e) => e.kind === "assigned");
  const practice = exams.filter((e) => e.kind !== "assigned");
  const isHome = !["/exams", "/practice", "/results"].includes(path);
  const title =
    path === "/exams"
      ? "My examinations"
      : path === "/practice"
        ? "Practice & mock tests"
        : path === "/results"
          ? "My results"
          : "Examinations";
  return (
    <>
      <PageHeading
        eyebrow={isHome ? `${user.name} · Candidate` : undefined}
        title={title}
      >
        {isHome
          ? "Your assigned examinations and practice tests."
          : path === "/results"
            ? "Your progress, clearly explained."
            : path === "/practice"
              ? "Get familiar with the exam experience and build your confidence."
              : "Everything you need for your next assessment."}
      </PageHeading>
      {isHome && (
        <div className="exam-tools" aria-label="Preparation tools">
          <span>
            <Settings2 size={18} /> <strong>Your setup</strong>{" "}
            {prefs.contrast ? "High contrast" : "Standard contrast"} ·{" "}
            {prefs.scale}% text
          </span>
          <button className="text-button" onClick={onSettings}>
            Adjust accessibility
          </button>
          <Link href="/access-lab">
            Try exam controls <ArrowRight size={16} />
          </Link>
        </div>
      )}
      {active.length > 0 && path !== "/results" && (
        <section className="resume-banner">
          <div>
            <span className="pill">IN PROGRESS</span>
            <h2>{active[0].title}</h2>
            <p>
              Your saved answers are ready. The exam timer continues while you
              are away.
            </p>
          </div>
          <Link className="button" href={`/exam/${active[0].attempt!.id}`}>
            Resume exam <ArrowRight size={18} />
          </Link>
        </section>
      )}
      {(isHome || path === "/exams") && (
        <section className="section">
          <div className="section-heading">
            <h2>
              Assigned examinations{" "}
              <span className="count">{assigned.length}</span>
            </h2>
            {isHome && (
              <Link href="/exams">
                View all <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {assigned.length ? (
            assigned.map((e) => <ExamCard exam={e} key={e.id} featured />)
          ) : (
            <Empty title="No examinations assigned">
              New assignments will appear here.
            </Empty>
          )}
        </section>
      )}
      {(isHome || path === "/practice") && (
        <section className="section">
          <div className="section-heading">
            <h2>Practice & mock tests</h2>
            {isHome && (
              <Link href="/practice">
                Explore practice <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {path === "/practice" && (
            <div className="filter-group" aria-label="Filter practice sets">
              {["all", "practice", "mock"].map((f) => (
                <button
                  key={f}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f === "all"
                    ? "All sets"
                    : f === "mock"
                      ? "Mock tests"
                      : "Practice sets"}
                </button>
              ))}
            </div>
          )}
          <div className="practice-grid">
            {practice
              .filter((e) => filter === "all" || filter === e.kind)
              .map((e) => (
                <ExamCard key={e.id} exam={e} />
              ))}
          </div>
        </section>
      )}
      {(isHome || path === "/results") && (
        <section className="section">
          <div className="section-heading">
            <h2>Recent results</h2>
            {isHome && (
              <Link href="/results">
                All results <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {complete.length ? (
            <div className="panel results-list">
              {complete.map((e) => (
                <div key={e.id}>
                  <span className="tile-icon">
                    <Trophy size={22} />
                  </span>
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      Completed ·{" "}
                      {new Date(e.attempt!.submittedAt!).toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}
                    </small>
                  </span>
                  <strong>
                    {e.attempt!.score} / {e.attempt!.maxScore}
                  </strong>
                  <Link href={`/results/${e.attempt!.id}`}>
                    View result <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No results yet">
              Complete an exam or practice set to see your score and topic
              breakdown here.
            </Empty>
          )}
        </section>
      )}
    </>
  );
}
function ExamCard({
  exam: e,
  featured = false,
}: {
  exam: Exam;
  featured?: boolean;
}) {
  const done = e.attempt?.status === "evaluated";
  const resume = e.attempt?.status === "in_progress";
  const href = done
    ? `/results/${e.attempt!.id}`
    : resume
      ? `/exam/${e.attempt!.id}`
      : `/instructions/${e.id}`;
  return (
    <article className={featured ? "exam-card featured" : "exam-card"}>
      <div className="exam-card-top">
        <span className={featured ? "tile-icon" : "tile-icon muted"}>
          {e.kind === "mock" ? (
            <FileText />
          ) : e.kind === "practice" ? (
            <BookOpen />
          ) : (
            <GraduationCap />
          )}
        </span>
        <span className={done ? "pill success" : "pill"}>
          {done
            ? "COMPLETED"
            : e.kind === "assigned"
              ? "ASSIGNED TO YOU"
              : e.kind === "mock"
                ? "MOCK TEST"
                : "PRACTICE SET"}
        </span>
      </div>
      <div className="exam-card-body">
        <div>
          <h3>{e.title}</h3>
          <p>{e.description}</p>
          <div className="exam-meta">
            <span>
              <Clock size={16} />
              {e.duration +
                Object.values(e.extraMinutes || {}).reduce(
                  (sum, n) => sum + n,
                  0,
                )}{" "}
              minutes
            </span>
            <span>
              <FileText size={16} />
              {e.questions || e.questionIds.length} questions
            </span>
            {featured && (
              <span>
                <ShieldCheck size={16} />
                Single-choice MCQ
              </span>
            )}
          </div>
        </div>
        <Link className={featured ? "button" : "text-button"} href={href}>
          {done
            ? "View result"
            : resume
              ? "Resume exam"
              : featured
                ? "View instructions"
                : "Start practice"}
          <ArrowRight size={18} />
        </Link>
      </div>
      {featured && (
        <div className="exam-card-footer">
          <Accessibility size={17} />
          <span>
            Read-aloud support · Keyboard navigation · Answers saved
            automatically
          </span>
        </div>
      )}
    </article>
  );
}

function Instructions({ id, prefs }: { id: string; prefs: Preferences }) {
  const [exam, setExam] = useState<Exam>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    api<Exam[]>("exams")
      .then((es) => {
        const e = es.find((e) => e.id === id);
        if (!e) throw new Error("This exam is not available.");
        setExam(e);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  async function start() {
    setBusy(true);
    try {
      const a = await api<Attempt>("attempts", "POST", { examId: id });
      router.push(
        a.status === "evaluated" ? `/results/${a.id}` : `/exam/${a.id}`,
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  if (!exam) return error ? <ErrorNotice message={error} /> : <Loading />;
  return (
    <>
      <Link className="back-link" href="/dashboard">
        ← Back to overview
      </Link>
      <PageHeading eyebrow="BEFORE YOU BEGIN" title={exam.title}>
        {exam.description}
      </PageHeading>
      <div className="instructions-grid">
        <section className="panel instructions">
          <h2>A few things to know</h2>
          <ol>
            <li>
              <strong>Choose one answer per question.</strong>
              <p>
                You can change or clear your answer before submission. There is
                no negative marking.
              </p>
            </li>
            <li>
              <strong>Move through the exam your way.</strong>
              <p>
                Use Previous, Next, or the question navigator. Mark questions to
                return to later.
              </p>
            </li>
            <li>
              <strong>Your answers save automatically.</strong>
              <p>
                Wait for “All changes saved” before leaving. Refreshing restores
                confirmed answers.
              </p>
            </li>
            <li>
              <strong>The timer starts when you begin.</strong>
              <p>
                It continues if you close the page. At the deadline, saved
                answers are submitted automatically.
              </p>
            </li>
            <li>
              <strong>Review before submitting.</strong>
              <p>Check unanswered and marked questions. Submission is final.</p>
            </li>
          </ol>
          <h2>Keyboard and audio</h2>
          <Link className="preflight-link" href="/access-lab">
            <Compass size={22} />
            <span>
              <strong>Try the controls before you start</strong>
              <small>
                Untimed familiarization · Does not use an exam attempt
              </small>
            </span>
            <ArrowRight size={18} />
          </Link>
          <NvdaGuide />
          <p>
            Tab moves between controls. Arrow keys change the selected answer.
            All speech features are optional.
          </p>
          {prefs.tts && (
            <button
              className="button secondary"
              onClick={() => {
                try {
                  speak(
                    "Your audio is ready. Good luck with your assessment.",
                    prefs.rate,
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Volume2 size={18} />
              Test audio
            </button>
          )}
        </section>
        <aside className="panel exam-summary">
          <span className="tile-icon">
            <GraduationCap size={28} />
          </span>
          <h2>Assessment summary</h2>
          <dl>
            <div>
              <dt>Duration</dt>
              <dd>
                {exam.duration +
                  Object.values(exam.extraMinutes || {}).reduce(
                    (a, b) => a + b,
                    0,
                  )}{" "}
                minutes
              </dd>
            </div>
            <div>
              <dt>Approved extra time</dt>
              <dd>
                {Object.values(exam.extraMinutes || {}).reduce(
                  (a, b) => a + b,
                  0,
                )}{" "}
                minutes
              </dd>
            </div>
            <div>
              <dt>Questions</dt>
              <dd>{exam.questionIds.length}</dd>
            </div>
            <div>
              <dt>Question type</dt>
              <dd>Single choice</dd>
            </div>
            <div>
              <dt>Attempts</dt>
              <dd>One per assessment</dd>
            </div>
          </dl>
          <p>
            <ShieldCheck size={18} /> Your accessibility settings remain
            available during the exam.
          </p>
          <button className="button full" disabled={busy} onClick={start}>
            {busy
              ? "Preparing exam…"
              : exam.attempt
                ? "Continue to attempt"
                : "Start exam"}
            <ArrowRight size={18} />
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </aside>
      </div>
      <IntegrityNote shuffle={exam.shuffleQuestions} />
    </>
  );
}

export function ResultPage({ id }: { id: string }) {
  const [result, setResult] = useState<Result>();
  const [error, setError] = useState("");
  useEffect(() => {
    api<Result>(`attempts/${id}/result`)
      .then(setResult)
      .catch((e) => setError(e.message));
  }, [id]);
  if (!result) return error ? <ErrorNotice message={error} /> : <Loading />;
  return (
    <>
      <Link className="back-link" href="/results">
        ← Back to results
      </Link>
      <PageHeading eyebrow="ASSESSMENT COMPLETE" title="Examination result">
        {result.title} · Your answers have been submitted successfully.
      </PageHeading>
      <div className="result-hero panel">
        <span className="result-trophy">
          <Trophy size={38} />
        </span>
        <div>
          <span className="eyebrow">YOUR SCORE</span>
          <h2>
            {result.score} <span>/ {result.maxScore}</span>
          </h2>
          <p>
            {Math.round(((result.score || 0) / result.maxScore) * 100)}% of
            available marks earned
          </p>
        </div>
        <div className="result-counts">
          <div>
            <strong>{result.correct}</strong>
            <span>Correct</span>
          </div>
          <div>
            <strong>{result.incorrect}</strong>
            <span>Incorrect</span>
          </div>
          <div>
            <strong>{result.unanswered}</strong>
            <span>Unanswered</span>
          </div>
        </div>
      </div>
      <section className="panel section">
        <h2>Performance by topic</h2>
        <p className="subheading">
          Use this breakdown to decide what to practice next.
        </p>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Correct answers by topic</caption>
            <thead>
              <tr>
                <th scope="col">Topic</th>
                <th scope="col">Correct answers</th>
                <th scope="col">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {result.topics.map((t) => (
                <tr key={t.topic}>
                  <th scope="row">{t.topic}</th>
                  <td>
                    {t.correct} / {t.total}
                  </td>
                  <td>
                    <span className="performance-bar" aria-hidden="true">
                      <span
                        style={{ width: `${(t.correct / t.total) * 100}%` }}
                      />
                    </span>
                    {Math.round((t.correct / t.total) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <AttemptInsights result={result} />
      <AccessFeedback result={result} />
      <div className="actions">
        <Link href="/analytics" className="button secondary">
          Learning insights <ChartNoAxesCombined size={18} />
        </Link>
        <Link href="/dashboard" className="button secondary">
          Back to overview
        </Link>
        <Link href="/practice" className="button">
          Keep practicing <ArrowRight size={18} />
        </Link>
      </div>
    </>
  );
}
