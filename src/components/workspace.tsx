"use client";
import { stopReading } from "@/lib/page-reader";
import { useLanguage } from "./language";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
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
import { PublicGateway, ProfilePage } from "./accounts";
import { CandidateHub } from "./CandidateHub";
import { LearningNavigation } from "./learning-navigation";
import { AudioPractice } from "./AudioPractice";
import { useReadingShortcuts } from "./audio/useReadingShortcuts";
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
  const { t, setLanguage } = useLanguage();
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [prefs, setPrefs] = useState(defaultPreferences);
  useReadingShortcuts(prefs.tts);
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
      else {
        try {
          const saved = JSON.parse(
            localStorage.getItem("optiexam-guest-preferences") || "null",
          );
          if (
            saved &&
            typeof saved.contrast === "boolean" &&
            [100, 125, 150, 175, 200].includes(saved.scale)
          )
            setPrefs({
              ...defaultPreferences,
              contrast: saved.contrast,
              scale: saved.scale,
              language: saved.language === "hi" ? "hi" : "en",
              tts: false,
            });
        } catch {}
      }
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    if (loaded) setLanguage(prefs.language === "hi" ? "hi" : "en");
  }, [prefs.language, loaded, setLanguage]);
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
    stopReading();
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
          : "/dashboard",
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
  async function savePreferences(p: Preferences) {
    if (user) await api("preferences", "PUT", p);
    else {
      try {
        localStorage.setItem("optiexam-guest-preferences", JSON.stringify(p));
      } catch {}
    }
    setPrefs(p);
  }
  if (!loaded)
    return (
      <main>
        <Loading />
      </main>
    );
  if (!user || path === "/")
    return (
      <PublicGateway
        currentUser={user}
        path={path}
        prefs={prefs}
        onPreferences={savePreferences}
        onSignedIn={async (u) => {
          const data = await api<{ preferences: Preferences }>("me");
          const merged =
            path === "/signup"
              ? {
                  ...data.preferences,
                  contrast: prefs.contrast,
                  scale: prefs.scale,
                  language: prefs.language || "en",
                }
              : data.preferences;
          if (path === "/signup") await api("preferences", "PUT", merged);
          setUser(u);
          setPrefs(merged);
          router.push(u.role === "admin" ? "/admin" : "/dashboard");
        }}
        onDemo={signIn}
        busy={busy}
        error={error}
      />
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
        ["/audio-practice", "Audio practice", Volume2],
        ["/exams", "My examinations", FileText],
        ["/practice", "Practice & mock tests", BookOpen],
        ["/results", "My results", Trophy],
        ["/analytics", "Learning insights", ChartNoAxesCombined],
      ] as const);
  return (
    <>
      <a className="skip-link" href="#main">
        {t(" Skip to main content ")}
      </a>
      <div className={isExam ? "app-layout exam-layout" : "app-layout"}>
        {!isExam && (
          <aside className="sidebar">
            <Brand />
            <div className="workspace-label">
              {t(admin ? "ADMIN WORKSPACE" : "CANDIDATE WORKSPACE")}
            </div>
            <nav aria-label={t("Main navigation")}>
              {navigation.map(([href, label, Icon]) => (
                <Link
                  key={href}
                  href={href}
                  className={path === href ? "nav-item active" : "nav-item"}
                  aria-current={path === href ? "page" : undefined}
                >
                  <Icon size={20} />
                  {t(label)}
                </Link>
              ))}
              <Link
                className={path === "/profile" ? "nav-item active" : "nav-item"}
                href="/profile"
                aria-current={path === "/profile" ? "page" : undefined}
              >
                <Settings2 size={20} />
                {t(" Profile & account ")}
              </Link>
            </nav>
            <div className="sidebar-bottom">
              <div className="access-card">
                <Settings2 size={23} />
                <strong>{t("Reading & navigation")}</strong>
                <p>{t("Adjust your workspace at any time.")}</p>
                <button onClick={() => setSettings(true)}>
                  {t(" Accessibility settings ")}
                  <ArrowRight size={15} />
                </button>
              </div>
              <button className="nav-item" onClick={() => setHelp(true)}>
                <Keyboard size={20} />
                {t(" Keyboard help ")}
              </button>
              <div className="profile">
                <span className="avatar">
                  {t(
                    user.name
                      .split(" ")
                      .map((s) => s[0])
                      .join(""),
                  )}
                </span>
                <span>
                  <strong>{t(user.name)}</strong>
                  <small>
                    {t(admin ? "Administrator" : "Candidate")}
                    {t(!user.email ? " · Demo" : "")}
                  </small>
                </span>
                <button
                  aria-label={t("Sign out")}
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
                {t(" Workspace ")}
                <ChevronRight size={15} />
                <span>
                  {t(admin ? "Administration" : "Learning & examinations")}
                </span>
              </div>
            )}
            <div className="topbar-actions">
              <Link href="/profile" className="account-link">
                {t(user.name)}
              </Link>
              <button
                className="button secondary compact"
                onClick={() => setSettings(true)}
              >
                <Settings2 size={18} />
                {t(" Accessibility ")}
              </button>
            </div>
          </header>
          {!admin && !isExam && (
            <LearningNavigation
              user={user}
              prefs={prefs}
              onPreferences={savePreferences}
            />
          )}
          <main id="main" className={isExam ? "exam-main" : "main-content"}>
            {error && <ErrorNotice message={error} />}
            {path === "/profile" ? (
              <ProfilePage
                user={user}
                prefs={prefs}
                onUser={setUser}
                onPreferences={setPrefs}
                onSignOut={signOut}
              />
            ) : admin ? (
              <AdminWorkspace path={path} />
            ) : path === "/setup" ? (
              <div className="setup">
                <PageHeading
                  eyebrow={t("MAKE YOURSELF COMFORTABLE")}
                  title={t("Your exam, your way")}
                >
                  {t(
                    " Choose the settings that work for you. You can change them at any time. ",
                  )}
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
            ) : path === "/audio-practice" ? (
              <AudioPractice userId={user.id} audioEnabled={prefs.tts} />
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
              <span>{t("OptiExam · Accessible Examination & Practice")}</span>
              <span>{t("Designed for independent learning")}</span>
            </footer>
          )}
        </div>
      </div>
      <Modal
        open={settings}
        onOpenChange={setSettings}
        title={t("Accessibility preferences")}
        description={t(
          "Personalize your workspace. Changes apply after saving.",
        )}
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
        title={t("Keyboard navigation")}
        description={t("Every action is available using the keyboard.")}
      >
        <div className="shortcut-list">
          <p>
            <kbd>Alt+R</kbd> {t("Start reading (Audio on)")}
          </p>
          <p>
            <kbd>Alt+S</kbd> {t("Stop reading immediately (Audio on)")}
          </p>
          <p>
            <kbd>{t("Tab")}</kbd> {t(" Move to the next control ")}
          </p>
          <p>
            <kbd>{t("Shift + Tab")}</kbd> {t(" Move to the previous control ")}
          </p>
          <p>
            <kbd>{t("↑")}</kbd>
            <kbd>{t("↓")}</kbd> {t(" Choose an answer in a radio group ")}
          </p>
          <p>
            <kbd>{t("Enter")}</kbd> {t(" Activate a button or link ")}
          </p>
          <p>
            <kbd>{t("Esc")}</kbd> {t(" Close a dialog ")}
          </p>
        </div>
        <p>
          {t(
            " Optional exam shortcuts: N — next, P — previous, R — read, M — mark for review. Enable these in accessibility preferences. Leave them off when using screen-reader navigation. ",
          )}
        </p>
      </Modal>
    </>
  );
}
function Brand() {
  const { t } = useLanguage();
  return (
    <div className="brand">
      <img
        className="brand-symbol"
        src="/optiexam-symbol.png"
        alt={t("OptiExam")}
        width={76}
        height={76}
      />
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
  const { t } = useLanguage();
  const [exams, setExams] = useState<Exam[]>([]);
  const [hubResults, setHubResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  async function load() {
    try {
      const [examData, resultData] = await Promise.all([api<Exam[]>("exams"), api<Result[]>("analytics")]);
      setExams(examData); setHubResults(resultData);
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
      {isHome ? (
        <CandidateHub user={user} exams={exams} results={hubResults} />
      ) : (
        <PageHeading
          eyebrow={t(isHome ? `${user.name} · Candidate` : undefined)}
          title={t(title)}
        >
          {t(
            isHome
              ? "Your assigned examinations and practice tests."
              : path === "/results"
                ? "Your progress, clearly explained."
                : path === "/practice"
                  ? "Get familiar with the exam experience and build your confidence."
                  : "Everything you need for your next assessment.",
          )}
        </PageHeading>
      )}
      {isHome && (
        <div className="exam-tools" aria-label={t("Preparation tools")}>
          <span>
            <Settings2 size={18} /> <strong>{t("Your setup")}</strong>
            {t(" ")}
            {t(prefs.contrast ? "High contrast" : "Standard contrast")}{" "}
            {t(" ·")}
            {t(" ")}
            {t(prefs.scale)}
            {t("% text ")}
          </span>
          <button className="text-button" onClick={onSettings}>
            {t(" Adjust accessibility ")}
          </button>
          <Link href="/access-lab">
            {t(" Try exam controls ")}
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
      {active.length > 0 && path !== "/results" && (
        <section className="resume-banner">
          <div>
            <span className="pill">{t("IN PROGRESS")}</span>
            <h2>{t(active[0].title)}</h2>
            <p>
              {t(
                " Your saved answers are ready. The exam timer continues while you are away. ",
              )}
            </p>
          </div>
          <Link className="button" href={`/exam/${active[0].attempt!.id}`}>
            {t(" Resume exam ")}
            <ArrowRight size={18} />
          </Link>
        </section>
      )}
      {(isHome || path === "/exams") && (
        <section className="section">
          <div className="section-heading">
            <h2>
              {t(" Assigned examinations")}
              {t(" ")}
              <span className="count">{t(assigned.length)}</span>
            </h2>
            {isHome && (
              <Link href="/exams">
                {t(" View all ")}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {assigned.length ? (
            assigned.map((e) => <ExamCard exam={e} key={e.id} featured />)
          ) : (
            <Empty title={t("No examinations assigned")}>
              {t(" New assignments will appear here. ")}
            </Empty>
          )}
        </section>
      )}
      {(isHome || path === "/practice") && (
        <section className="section">
          <div className="section-heading">
            <h2>{t("Practice & mock tests")}</h2>
            {isHome && (
              <Link href="/practice">
                {t(" Explore practice ")}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
          {path === "/practice" && (
            <div
              className="filter-group"
              aria-label={t("Filter practice sets")}
            >
              {["all", "practice", "mock"].map((f) => (
                <button
                  key={f}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {t(
                    f === "all"
                      ? "All sets"
                      : f === "mock"
                        ? "Mock tests"
                        : "Practice sets",
                  )}
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
            <h2>{t("Recent results")}</h2>
            {isHome && (
              <Link href="/results">
                {t(" All results ")}
                <ArrowRight size={16} />
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
                    <strong>{t(e.title)}</strong>
                    <small>
                      {t(" Completed ·")}
                      {t(" ")}
                      {t(
                        new Date(e.attempt!.submittedAt!).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short", year: "numeric" },
                        ),
                      )}
                    </small>
                  </span>
                  <strong>
                    {t(e.attempt!.score)} {t(" / ")}
                    {t(e.attempt!.maxScore)}
                  </strong>
                  <Link href={`/results/${e.attempt!.id}`}>
                    {t(" View result ")}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <Empty title={t("No results yet")}>
              {t(
                " Complete an exam or practice set to see your score and topic breakdown here. ",
              )}
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
  const { t } = useLanguage();
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
          {t(
            done
              ? "COMPLETED"
              : e.kind === "assigned"
                ? "ASSIGNED TO YOU"
                : e.kind === "mock"
                  ? "MOCK TEST"
                  : "PRACTICE SET",
          )}
        </span>
      </div>
      <div className="exam-card-body">
        <div>
          <h3>{t(e.title)}</h3>
          <p>{t(e.description)}</p>
          <div className="exam-meta">
            <span>
              <Clock size={16} />
              {t(
                e.duration +
                  Object.values(e.extraMinutes || {}).reduce(
                    (sum, n) => sum + n,
                    0,
                  ),
              )}
              {t(" ")}
              {t(" minutes ")}
            </span>
            <span>
              <FileText size={16} />
              {t(e.questions || e.questionIds.length)} {t(" questions ")}
            </span>
            {featured && (
              <span>
                <ShieldCheck size={16} />
                {t(" Single-choice MCQ ")}
              </span>
            )}
          </div>
        </div>
        <Link className={featured ? "button" : "text-button"} href={href}>
          {t(
            done
              ? "View result"
              : resume
                ? "Resume exam"
                : featured
                  ? "View instructions"
                  : "Start practice",
          )}
          <ArrowRight size={18} />
        </Link>
      </div>
      {featured && (
        <div className="exam-card-footer">
          <Settings2 size={17} />
          <span>
            {t(
              " Read-aloud support · Keyboard navigation · Answers saved automatically ",
            )}
          </span>
        </div>
      )}
    </article>
  );
}

function Instructions({ id, prefs }: { id: string; prefs: Preferences }) {
  const { t } = useLanguage();
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
        {t(" ← Back to overview ")}
      </Link>
      <PageHeading eyebrow={t("BEFORE YOU BEGIN")} title={t(exam.title)}>
        {t(exam.description)}
      </PageHeading>
      <div className="instructions-grid">
        <section className="panel instructions">
          <h2>{t("A few things to know")}</h2>
          <ol>
            <li>
              <strong>{t("Choose one answer per question.")}</strong>
              <p>
                {t(
                  " You can change or clear your answer before submission. There is no negative marking. ",
                )}
              </p>
            </li>
            <li>
              <strong>{t("Move through the exam your way.")}</strong>
              <p>
                {t(
                  " Use Previous, Next, or the question navigator. Mark questions to return to later. ",
                )}
              </p>
            </li>
            <li>
              <strong>{t("Your answers save automatically.")}</strong>
              <p>
                {t(
                  " Wait for “All changes saved” before leaving. Refreshing restores confirmed answers. ",
                )}
              </p>
            </li>
            <li>
              <strong>{t("The timer starts when you begin.")}</strong>
              <p>
                {t(
                  " It continues if you close the page. At the deadline, saved answers are submitted automatically. ",
                )}
              </p>
            </li>
            <li>
              <strong>{t("Review before submitting.")}</strong>
              <p>
                {t(
                  "Check unanswered and marked questions. Submission is final.",
                )}
              </p>
            </li>
          </ol>
          <h2>{t("Keyboard and audio")}</h2>
          <Link className="preflight-link" href="/access-lab">
            <Compass size={22} />
            <span>
              <strong>{t("Try the controls before you start")}</strong>
              <small>
                {t(" Untimed familiarization · Does not use an exam attempt ")}
              </small>
            </span>
            <ArrowRight size={18} />
          </Link>
          <NvdaGuide />
          <p>
            {t(
              " Tab moves between controls. Arrow keys change the selected answer. All speech features are optional. ",
            )}
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
              {t(" Test audio ")}
            </button>
          )}
        </section>
        <aside className="panel exam-summary">
          <span className="tile-icon">
            <GraduationCap size={28} />
          </span>
          <h2>{t("Assessment summary")}</h2>
          <dl>
            <div>
              <dt>{t("Duration")}</dt>
              <dd>
                {t(
                  exam.duration +
                    Object.values(exam.extraMinutes || {}).reduce(
                      (a, b) => a + b,
                      0,
                    ),
                )}
                {t(" ")}
                {t(" minutes ")}
              </dd>
            </div>
            <div>
              <dt>{t("Approved extra time")}</dt>
              <dd>
                {t(
                  Object.values(exam.extraMinutes || {}).reduce(
                    (a, b) => a + b,
                    0,
                  ),
                )}
                {t(" ")}
                {t(" minutes ")}
              </dd>
            </div>
            <div>
              <dt>{t("Questions")}</dt>
              <dd>{t(exam.questionIds.length)}</dd>
            </div>
            <div>
              <dt>{t("Question type")}</dt>
              <dd>{t("Single choice")}</dd>
            </div>
            <div>
              <dt>{t("Attempts")}</dt>
              <dd>{t("One per assessment")}</dd>
            </div>
          </dl>
          <p>
            <ShieldCheck size={18} />{" "}
            {t(
              " Your accessibility settings remain available during the exam. ",
            )}
          </p>
          <button className="button full" disabled={busy} onClick={start}>
            {t(
              busy
                ? "Preparing exam…"
                : exam.attempt
                  ? "Continue to attempt"
                  : "Start exam",
            )}
            <ArrowRight size={18} />
          </button>
          {error && (
            <p role="alert" className="error">
              {t(error)}
            </p>
          )}
        </aside>
      </div>
      <IntegrityNote shuffle={exam.shuffleQuestions} />
    </>
  );
}

export function ResultPage({ id }: { id: string }) {
  const { t } = useLanguage();
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
        {t(" ← Back to results ")}
      </Link>
      <PageHeading
        eyebrow={t("ASSESSMENT COMPLETE")}
        title={t("Examination result")}
      >
        {t(result.title)}{" "}
        {t(" · Your answers have been submitted successfully. ")}
      </PageHeading>
      <div className="result-hero panel">
        <span className="result-trophy">
          <Trophy size={38} />
        </span>
        <div>
          <span className="eyebrow">{t("YOUR SCORE")}</span>
          <h2>
            {t(result.score)}{" "}
            <span>
              {t("/ ")}
              {t(result.maxScore)}
            </span>
          </h2>
          <p>
            {t(Math.round(((result.score || 0) / result.maxScore) * 100))}
            {t("% of available marks earned ")}
          </p>
        </div>
        <div className="result-counts">
          <div>
            <strong>{t(result.correct)}</strong>
            <span>{t("Correct")}</span>
          </div>
          <div>
            <strong>{t(result.incorrect)}</strong>
            <span>{t("Incorrect")}</span>
          </div>
          <div>
            <strong>{t(result.unanswered)}</strong>
            <span>{t("Unanswered")}</span>
          </div>
        </div>
      </div>
      <section className="panel section">
        <h2>{t("Performance by topic")}</h2>
        <p className="subheading">
          {t(" Use this breakdown to decide what to practice next. ")}
        </p>
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              {t("Correct answers by topic")}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("Topic")}</th>
                <th scope="col">{t("Correct answers")}</th>
                <th scope="col">{t("Accuracy")}</th>
              </tr>
            </thead>
            <tbody>
              {result.topics.map((stats) => (
                <tr key={stats.topic}>
                  <th scope="row">{t(stats.topic)}</th>
                  <td>
                    {t(stats.correct)} {t(" / ")}
                    {t(stats.total)}
                  </td>
                  <td>
                    <span className="performance-bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${(stats.correct / stats.total) * 100}%`,
                        }}
                      />
                    </span>
                    {t(Math.round((stats.correct / stats.total) * 100))}
                    {t("% ")}
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
          {t(" Learning insights ")}
          <ChartNoAxesCombined size={18} />
        </Link>
        <Link href="/dashboard" className="button secondary">
          {t(" Back to overview ")}
        </Link>
        <Link href="/practice" className="button">
          {t(" Keep practicing ")}
          <ArrowRight size={18} />
        </Link>
      </div>
    </>
  );
}
