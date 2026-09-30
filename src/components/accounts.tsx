"use client";
import { useLanguage } from "./language";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Keyboard, Settings2 } from "lucide-react";
import { api, PreferencesForm } from "./shared";
import type { User, Preferences } from "@/lib/types";
import { LearningNavigation } from "./learning-navigation";
import { VoiceCommands } from "./VoiceCommands";
import { VoiceAuth } from "./VoiceAuth";

export function PublicGateway({
  path,
  currentUser,
  prefs,
  onPreferences,
  onSignedIn,
  onDemo,
  busy,
  error,
}: {
  path: string;
  currentUser?: User | null;
  prefs: Preferences;
  onPreferences: (p: Preferences) => Promise<void>;
  onSignedIn: (u: User) => Promise<void>;
  onDemo: (id: string) => Promise<void>;
  busy: boolean;
  error: string;
}) {
  const { t } = useLanguage();
  const signup = path === "/signup";
  const landing = path !== "/login" && !signup;
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setFailure("");
    setShowPassword(false);
  }, [path]);
  useEffect(() => {
    if (failure) errorRef.current?.focus();
  }, [failure]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFailure("");
    const fields = new FormData(e.currentTarget);
    try {
      const data = await api<{ user: User }>(
        signup ? "register" : "signin",
        "POST",
        {
          name: signup ? fields.get("name") : undefined,
          email: fields.get("email"),
          password: fields.get("password"),
        },
      );
      await onSignedIn(data.user);
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="public-site">
      <a className="skip-link" href="#main">
        {t(" Skip to main content ")}
      </a>
      <header className="public-header">
        <Link href="/" className="public-brand" aria-label={t("OptiExam home")}>
          <img src="/optiexam-symbol.png" alt={t("")} width="52" height="52" />
          <span>{t("OptiExam")}</span>
        </Link>
        <nav aria-label={t("Account navigation")}>
          {currentUser ? (
            <Link
              className="button"
              href={currentUser.role === "admin" ? "/admin" : "/dashboard"}
            >
              {t(" Go to dashboard ")}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                aria-current={path === "/login" ? "page" : undefined}
              >
                {t(" Log in ")}
              </Link>
              <Link
                className="button"
                href="/signup"
                aria-current={signup ? "page" : undefined}
              >
                {t(" Create account ")}
              </Link>
            </>
          )}
        </nav>
      </header>
      {currentUser?.role === "candidate" && (
        <LearningNavigation
          user={currentUser}
          prefs={prefs}
          onPreferences={onPreferences}
        />
      )}
      {!landing && (
        <section className="reading-bar" aria-label={t("Reading preferences")}>
          <span>
            <Settings2 size={19} aria-hidden="true" />{" "}
            {t(" Reading preferences ")}
          </span>
          <label>
            <input
              type="checkbox"
              checked={prefs.contrast}
              onChange={(e) =>
                onPreferences({ ...prefs, contrast: e.target.checked }).catch(
                  (e) => setFailure(e.message),
                )
              }
            />
            {t(" ")}
            {t(" High contrast ")}
          </label>
          <label htmlFor="public-size">{t("Text size")}</label>
          <select
            id="public-size"
            value={prefs.scale}
            onChange={(e) =>
              onPreferences({ ...prefs, scale: Number(e.target.value) }).catch(
                (e) => setFailure(e.message),
              )
            }
          >
            {[100, 125, 150, 175, 200].map((n) => (
              <option key={n} value={n}>
                {t(n)}
                {t("% ")}
              </option>
            ))}
          </select>
        </section>
      )}
      {!landing && !currentUser && <VoiceCommands />}
      <main id="main" className={landing ? "landing-main" : "account-main"}>
        {landing ? (
          <>
            <section className="landing-hero">
              <div>
                <p className="eyebrow">
                  {t("EXAMINATIONS · PRACTICE · PROGRESS")}
                </p>
                <h1 tabIndex={-1}>
                  {t(" Your next exam. ")}
                  <br />
                  {t(" Your way to prepare. ")}
                </h1>
                <p className="hero-description">
                  {t(
                    " A clear, accessible space to practise, take examinations, and understand your results. Use your keyboard, screen reader, or the reading settings that suit you. ",
                  )}
                </p>
                <div className="hero-actions">
                  {currentUser ? (
                    <Link
                      className="button"
                      href={
                        currentUser.role === "admin" ? "/admin" : "/dashboard"
                      }
                    >
                      {t(" Continue to your dashboard ")}
                      <ArrowRight size={20} />
                    </Link>
                  ) : (
                    <>
                      <Link className="button" href="/signup">
                        {t(" Create your account ")}
                        <ArrowRight size={20} />
                      </Link>
                      <Link className="button secondary" href="/login">
                        {t(" Log in ")}
                      </Link>
                    </>
                  )}
                </div>
                <p className="quiet-note">
                  {t(" Set up once. Keep your preferences for every visit. ")}
                </p>
              </div>
              <aside className="start-guide" aria-labelledby="start-title">
                <span className="guide-label">{t("GETTING STARTED")}</span>
                <h2 id="start-title">{t("From preparation to results")}</h2>
                <ol>
                  <li>
                    <strong>{t("Create your account")}</strong>
                    <p>{t("Save your profile and reading preferences.")}</p>
                  </li>
                  <li>
                    <strong>{t("Get familiar with the controls")}</strong>
                    <p>
                      {t("Try the untimed Access Lab before an assessment.")}
                    </p>
                  </li>
                  <li>
                    <strong>{t("Practise or take an exam")}</strong>
                    <p>
                      {t(
                        " Review answers, submit, and explore your topic results. ",
                      )}
                    </p>
                  </li>
                </ol>
              </aside>
            </section>
            <section
              className="access-principles"
              aria-labelledby="access-title"
            >
              <h2 id="access-title">{t("Choose how you use OptiExam")}</h2>
              <div className="principles-grid">
                <article>
                  <Keyboard aria-hidden="true" />
                  <h3>{t("Navigate with a keyboard")}</h3>
                  <p>
                    {t(
                      " Use Tab to move, Enter to activate, and arrow keys to select answers. Focus stays visible. ",
                    )}
                  </p>
                </article>
                <article>
                  <Settings2 aria-hidden="true" />
                  <h3>{t("Make text easier to read")}</h3>
                  <p>
                    {t(
                      " Increase text size up to 200% and switch to high contrast. Controls remain labelled and easy to find. ",
                    )}
                  </p>
                </article>
                <article>
                  <BookOpen aria-hidden="true" />
                  <h3>{t("Use your screen reader")}</h3>
                  <p>
                    {t(
                      " Headings, form labels, and answer groups support navigation. Optional read-aloud stays under your control. ",
                    )}
                  </p>
                </article>
              </div>
            </section>
            {process.env.NEXT_PUBLIC_HOSTED !== "true" && (
              <section className="public-help">
                <h2>{t("Prefer to explore first?")}</h2>
                <p>
                  {t(
                    " Try the sample candidate workspace without creating an account. Sample activity is shared within this local prototype. ",
                  )}
                </p>
                <button
                  className="button secondary"
                  onClick={() => onDemo("candidate-demo")}
                  disabled={busy}
                >
                  {t(" Candidate workspace ")}
                  <ArrowRight size={18} />
                </button>
                <details>
                  <summary>{t("Administrator demo")}</summary>
                  <p>
                    {t(
                      " Create sample questions and assign exams. This is a local development workspace. ",
                    )}
                  </p>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => onDemo("admin-demo")}
                  >
                    {t(" Administrator workspace ")}
                  </button>
                </details>
                {error && <p role="alert">{t(error)}</p>}
              </section>
            )}
          </>
        ) : (
          <section className="account-panel" key={path}>
            <Link href="/" className="back-link">
              {t(" ← Back to home ")}
            </Link>
            <h1 tabIndex={-1}>
              {t(signup ? "Create your account" : "Log in to OptiExam")}
            </h1>
            <p>
              {t(
                signup
                  ? "Save your preferences, practise, and view your results in one place."
                  : "Continue to your examinations and practice workspace.",
              )}
            </p>
            {!signup && (
              <details>
                <summary>{t("Use voice sign-in")}</summary>
                <VoiceAuth mode="login" />
              </details>
            )}
            <p className="form-instructions">
              {t(
                " All fields are required. You can paste your password or use a password manager. ",
              )}
            </p>
            <form onSubmit={submit} aria-busy={saving}>
              {signup && (
                <label htmlFor="account-name">
                  {t(" Full name ")}
                  <input
                    id="account-name"
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
              )}
              <label htmlFor="account-email">
                {t(" Email address ")}
                <input
                  id="account-email"
                  name="email"
                  placeholder="username"
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </label>
              <label htmlFor="account-password">
                {t(" Password ")}
                <input
                  id="account-password"
                  name="password"
                  placeholder="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  minLength={signup ? 12 : 1}
                  maxLength={128}
                  aria-describedby="password-help"
                />
              </label>
              <div className="password-help">
                <span id="password-help">
                  {t(
                    signup
                      ? "Use 12–128 characters. A phrase with several words is welcome."
                      : "Enter the password you chose when signing up.",
                  )}
                </span>
                <button
                  type="button"
                  className="text-button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {t(showPassword ? "Hide password" : "Show password")}
                </button>
              </div>
              {failure && (
                <div
                  className="form-error"
                  ref={errorRef}
                  role="alert"
                  tabIndex={-1}
                >
                  {t(failure)}
                </div>
              )}
              <button
                className="button submit-account"
                disabled={saving}
                type="submit"
              >
                {t(
                  saving
                    ? "Please wait…"
                    : signup
                      ? "Create account"
                      : "Log in",
                )}
                <ArrowRight size={19} />
              </button>
            </form>
            <p className="account-switch">
              {t(signup ? "Already have an account?" : "New to OptiExam?")}
              {t(" ")}
              <Link href={signup ? "/login" : "/signup"}>
                {t(signup ? "Log in" : "Create an account")}
              </Link>
            </p>
            <p className="quiet-note">
              {t(
                process.env.NEXT_PUBLIC_HOSTED === "true"
                  ? "Accounts and examination results are saved securely online. Email verification and password recovery are not available yet."
                  : " Local prototype accounts are saved on this computer. Email verification and password recovery are not available yet. ",
              )}
            </p>
          </section>
        )}
      </main>
      <footer className="public-footer">
        <span>{t("OptiExam · Accessible examinations")}</span>
        <span>{t("Keyboard navigation · Adjustable reading preferences")}</span>
      </footer>
    </div>
  );
}

export function ProfilePage({
  user,
  prefs,
  onUser,
  onPreferences,
  onSignOut,
}: {
  user: User;
  prefs: Preferences;
  onUser: (u: User) => void;
  onPreferences: (p: Preferences) => void;
  onSignOut: () => void;
}) {
  const { t } = useLanguage();
  const [name, setName] = useState(user.name),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      onUser(await api<User>("profile", "PUT", { name }));
      setMessage("Your profile has been saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-page">
      <h1 tabIndex={-1}>{t("Profile & account")}</h1>
      <p>{t("Manage your details and the way you use OptiExam.")}</p>
      <section className="panel">
        <h2>{t("Account details")}</h2>
        <form className="profile-form" onSubmit={save}>
          <label htmlFor="profile-name">
            {t(" Full name ")}
            <input
              id="profile-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
            />
          </label>
          <dl className="account-details">
            <dt>{t("Email address")}</dt>
            <dd>{t(user.email || "Demo account · no email address")}</dd>
            <dt>{t("Account type")}</dt>
            <dd>{t(user.role === "admin" ? "Administrator" : "Candidate")}</dd>
          </dl>
          {error && (
            <p role="alert" className="form-error">
              {t(error)}
            </p>
          )}
          <p role="status">{t(message)}</p>
          <button className="button" disabled={busy}>
            {t(busy ? "Saving…" : "Save profile")}
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>{t("Reading & navigation")}</h2>
        <p>{t("Your saved preferences apply throughout the workspace.")}</p>
        <PreferencesForm preferences={prefs} onSaved={onPreferences} />
      </section>
      {user.role === "candidate" && user.email && (
        <VoiceAuth mode="enroll" accountId={user.id} />
      )}
      {user.role === "candidate" && !user.email && (
        <section className="panel section">
          <h2>{t("Voice sign-in")}</h2>
          <p>
            {t(
              " Voice enrollment requires a personal account. Shared demo accounts do not store biometric profiles. ",
            )}
          </p>
          <p>
            {t("Sign out below, then choose Create account on the home page.")}
          </p>
        </section>
      )}
      <section className="panel">
        <h2>{t("Sign out of this account")}</h2>
        <p>
          {t(
            "Your saved answers and preferences will be here when you return.",
          )}
        </p>
        <button className="button secondary" onClick={onSignOut}>
          {t(" Sign out ")}
        </button>
      </section>
    </div>
  );
}
