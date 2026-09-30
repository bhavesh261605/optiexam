"use client";
import { useLanguage } from "./language";
import { ThemeToggle } from "./ThemeToggle";
import { VoiceCommands } from "./VoiceCommands";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Target, Keyboard, Volume2, VolumeX } from "lucide-react";
import type { Exam, Preferences, User } from "@/lib/types";
import { api, Modal } from "./shared";
import { readPage as speakPage, stopReading } from "@/lib/page-reader";

const destinations = [
  { label: "Home", key: "h", href: "/dashboard" },
  { label: "Prepare", key: "p", href: "/access-lab" },
  { label: "Practice", key: "t", href: "/practice" },
  { label: "Progress", key: "g", href: "/analytics" },
  { label: "Perform", key: "m", href: "/exams" },
] as const;

export function LearningNavigation({
  user,
  prefs,
  onPreferences,
}: {
  user?: User | null;
  prefs: Preferences;
  onPreferences: (p: Preferences) => Promise<void>;
}) {
  const { t, language } = useLanguage();
  const [languageBusy, setLanguageBusy] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const [examOpen, setExamOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [audioBusy, setAudioBusy] = useState(false);
  const audioLock = useRef(false);
  const storageKey = `optiexam-navigation-${user?.id || "guest"}`;

  useEffect(() => {
    try {
      setShortcuts(localStorage.getItem(storageKey) === "true");
    } catch {
      setShortcuts(false);
    }
  }, [storageKey]);
  useEffect(() => {
    if (!examOpen || !user) return;
    let cancelled = false;
    setExams(null);
    setError("");
    api<Exam[]>("exams")
      .then((items) => {
        if (!cancelled) setExams(items);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [examOpen, user]);

  function toggleShortcuts() {
    const next = !shortcuts;
    setShortcuts(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {}
    setStatus(`Navigation shortcuts ${next ? "on" : "off"}.`);
  }
  async function toggleAudio() {
    if (audioLock.current) return;
    audioLock.current = true;
    setAudioBusy(true);
    const next = !prefs.tts;
    stopReading();
    try {
      await onPreferences({ ...prefs, tts: next });
      setStatus(
        next
          ? "Audio controls on. Use Read this page to listen."
          : "Audio off. Your screen reader stays in control.",
      );
    } catch (e) {
      setStatus(`Could not save audio preference: ${(e as Error).message}`);
    } finally {
      audioLock.current = false;
      setAudioBusy(false);
    }
  }
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => () => stopReading(), [path]);

  function readPage() {
    try {
      speakPage(language, prefs.rate, setStatus);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (
        event.altKey &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.repeat &&
        !event.isComposing &&
        !event.defaultPrevented &&
        !target?.closest("input,textarea,select,[contenteditable='true']") &&
        !document.querySelector("[role='dialog'],.exam-main")
      ) {
        const hubRoutes: Record<string, string> = {
          KeyL: "/access-lab",
          KeyP: "/practice",
          KeyM: "/exams",
        };
        if (hubRoutes[event.code]) {
          event.preventDefault();
          router.push(hubRoutes[event.code]);
          return;
        }
      }
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        target?.closest(
          "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']",
        ) ||
        document.querySelector("[role='dialog']")
      )
        return;
      const key = /^Key[A-Z]$/.test(event.code)
        ? event.code.slice(3).toLowerCase()
        : event.key.toLowerCase();
      if (key === "x") {
        event.preventDefault();
        toggleShortcuts();
        return;
      }
      if (!shortcuts) return;
      const destination = destinations.find((item) => item.key === key);
      if (!destination && !["e", "v", "i", "k"].includes(key)) return;
      event.preventDefault();
      if (destination)
        router.push(
          user
            ? destination.href
            : destination.key === "h"
              ? "/"
              : `/login?next=${encodeURIComponent(destination.href)}`,
        );
      else if (key === "e") {
        setQuery("");
        setExamOpen(true);
      } else if (key === "v") void toggleAudio();
      else if (key === "i") router.push(user ? "/profile" : "/login");
      else setHelpOpen(true);
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  const visibleExams = exams?.filter((exam) =>
    `${exam.title} ${exam.description} ${exam.kind}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const hint = (key: string) => (
    <kbd aria-hidden="true">
      {t("Alt+")}
      {t(key.toUpperCase())}
    </kbd>
  );
  return (
    <>
      {user?.role === "candidate" && <VoiceCommands />}
      <section
        className="learning-navigation"
        aria-label={t("Learning controls")}
      >
        <div className="learning-nav-row">
          <ThemeToggle />
          <button
            data-voice-action="exams"
            className="exam-picker"
            aria-haspopup="dialog"
            aria-expanded={examOpen}
            aria-keyshortcuts={shortcuts ? "Alt+E" : undefined}
            onClick={() => {
              setQuery("");
              setExamOpen(true);
            }}
          >
            <Target size={21} aria-hidden="true" /> {t(" All exams ")}
            {t(hint("e"))}
          </button>
          <nav aria-label={t("Learning navigation")}>
            {destinations.map((item) => {
              const href = user
                ? item.href
                : item.key === "h"
                  ? "/"
                  : `/login?next=${encodeURIComponent(item.href)}`;
              const active =
                path ===
                (user ? item.href : item.key === "h" ? "/" : item.href);
              return (
                <Link
                  key={item.key}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-keyshortcuts={
                    shortcuts ? `Alt+${item.key.toUpperCase()}` : undefined
                  }
                >
                  {t(item.label)} {t(hint(item.key))}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="learning-nav-tools">
          <label className="language-picker">
            <span>Language / भाषा</span>
            <select
              aria-label="Text and audio language / पाठ और ऑडियो की भाषा"
              value={language}
              disabled={languageBusy}
              onChange={async (event) => {
                const selected = event.target.value === "hi" ? "hi" : "en";
                setLanguageBusy(true);
                setError("");
                try {
                  await onPreferences({ ...prefs, language: selected });
                  setStatus(
                    selected === "hi"
                      ? "हिंदी पाठ और ऑडियो चुने गए हैं।"
                      : "English text and audio selected.",
                  );
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setLanguageBusy(false);
                }
              }}
            >
              <option value="en" lang="en">
                English
              </option>
              <option value="hi" lang="hi">
                हिंदी
              </option>
            </select>
          </label>
          <button
            data-voice-action="audio"
            aria-pressed={prefs.tts}
            disabled={audioBusy}
            aria-keyshortcuts={shortcuts ? "Alt+V" : undefined}
            onClick={toggleAudio}
          >
            {prefs.tts ? (
              <Volume2 size={20} aria-hidden="true" />
            ) : (
              <VolumeX size={20} aria-hidden="true" />
            )}
            {t(" Audio ")}
            {t(prefs.tts ? "on" : "off")} {t(hint("v"))}
          </button>
          {prefs.tts && (
            <>
              <button
                onClick={readPage}
                data-reading-start
                aria-keyshortcuts="Alt+R"
              >
                <span aria-hidden="true">🔊</span> {t("Read Page")}{" "}
                <kbd aria-hidden="true">Alt+R</kbd>
              </button>
              <button
                data-reading-stop
                aria-keyshortcuts="Alt+S"
                onClick={() => {
                  stopReading();
                  setStatus("Reading stopped.");
                }}
              >
                {t(" Stop reading ")} <kbd aria-hidden="true">Alt+S</kbd>
              </button>
            </>
          )}
          <Link
            className="learning-account"
            href={user ? "/profile" : "/login"}
            aria-keyshortcuts={shortcuts ? "Alt+I" : undefined}
          >
            {t(user ? "My account" : "Sign in")} {t(hint("i"))}
          </Link>
          <button
            data-voice-action="shortcuts"
            aria-pressed={shortcuts}
            onClick={toggleShortcuts}
            aria-keyshortcuts="Alt+X"
          >
            <Keyboard size={20} aria-hidden="true" /> {t(" Shortcuts")}
            {t(" ")}
            {t(shortcuts ? "on" : "off")}
            <kbd aria-hidden="true">Alt+X</kbd>
          </button>
          <button
            data-voice-action="guide"
            onClick={() => setHelpOpen(true)}
            aria-keyshortcuts={shortcuts ? "Alt+K" : undefined}
          >
            {t(" Keyboard guide ")}
          </button>
        </div>
        <p className="learning-nav-note">
          {language === "hi" && (
            <span>
              प्रश्न का हिंदी संस्करण उपलब्ध न होने पर मूल भाषा दिखाई
              जाएगी।{" "}
            </span>
          )}
          {t(
            shortcuts
              ? "Alt shortcuts enabled outside exams and text fields."
              : "Tab to navigate · Enter to open · Navigation shortcuts are off.",
          )}
        </p>
        <p className="learning-nav-note">
          {t(
            "Reading shortcuts: Alt+R starts reading; Alt+S stops immediately. Turn Audio off to disable them. Start is inactive while typing or recording; Stop still works while typing.",
          )}
        </p>
        <p className="learning-nav-status" role="status">
          {t(status)}
        </p>
      </section>
      <Modal
        open={examOpen}
        onOpenChange={setExamOpen}
        title={t("Choose an exam")}
        description={t(
          "Browse the assessments available to your account. Opening instructions does not start the timer.",
        )}
      >
        {!user ? (
          <p>
            <Link href="/login">
              {t("Sign in to see your available exams")}
            </Link>
            {t(", or explore the candidate demo from Home. ")}
          </p>
        ) : (
          <>
            <label htmlFor="exam-search">{t("Search exams")}</label>
            <input
              id="exam-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Title, subject or type")}
            />
            {error ? (
              <p role="alert">{t(error)}</p>
            ) : !exams ? (
              <p role="status">{t("Loading available exams…")}</p>
            ) : (
              <>
                <p role="status">
                  {t(visibleExams?.length)} {t(" of ")}
                  {t(exams.length)} {t(" available exams ")}
                </p>
                <ul className="exam-picker-list">
                  {visibleExams?.map((exam) => (
                    <li key={exam.id}>
                      <Link
                        href={`/instructions/${exam.id}`}
                        onClick={() => setExamOpen(false)}
                      >
                        <strong>{t(exam.title)}</strong>
                        <span>
                          {t(
                            exam.kind === "assigned"
                              ? "Assigned assessment"
                              : exam.kind === "mock"
                                ? "Mock test"
                                : "Practice set",
                          )}
                          {t(" ")}
                          {t(" · ")}
                          {t(exam.questionIds.length)} {t(" questions ·")}
                          {t(" ")}
                          {t(exam.duration)} {t(" minutes base time ")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {visibleExams?.length === 0 && (
                  <p>{t("No matching exams. Try a different search.")}</p>
                )}
              </>
            )}
          </>
        )}
      </Modal>
      <Modal
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title={t("Learning keyboard guide")}
        description={t(
          "All actions work with Tab, Shift+Tab and Enter. Escape closes dialogs and returns focus to the opening control.",
        )}
      >
        <p>
          {t(" Navigation shortcuts are ")}
          {t(shortcuts ? "on" : "off")}
          {t(
            ". They never run while typing, in dialogs, or during a timed exam. Browser and screen-reader key assignments can vary; leave shortcuts off if they conflict. ",
          )}
        </p>
        <dl className="navigation-key-list">
          <div>
            <dt>Alt+X</dt>
            <dd>{t("Toggle navigation shortcuts on or off")}</dd>
          </div>
          <div>
            <dt>Alt+R</dt>
            <dd>{t("Start reading (Audio on)")}</dd>
          </div>
          <div>
            <dt>Alt+S</dt>
            <dd>{t("Stop reading immediately (Audio on)")}</dd>
          </div>
          {destinations.map((item) => (
            <div key={item.key}>
              <dt>
                {t("Alt+")}
                {t(item.key.toUpperCase())}
              </dt>
              <dd>
                {t(item.label)}
                {t(
                  item.key === "p"
                    ? " — familiarise yourself in the Access Lab"
                    : "",
                )}
              </dd>
            </div>
          ))}
          <div>
            <dt>{t("Alt+E")}</dt>
            <dd>{t("Choose an exam")}</dd>
          </div>
          <div>
            <dt>{t("Alt+V")}</dt>
            <dd>{t("Toggle audio controls")}</dd>
          </div>
          <div>
            <dt>{t("Alt+I")}</dt>
            <dd>{t(user ? "My account" : "Sign in")}</dd>
          </div>
          <div>
            <dt>{t("Alt+K")}</dt>
            <dd>{t("Keyboard guide")}</dd>
          </div>
        </dl>
        <button
          className="button"
          aria-pressed={shortcuts}
          onClick={toggleShortcuts}
        >
          {t(
            shortcuts
              ? "Turn navigation shortcuts off"
              : "Enable navigation shortcuts",
          )}
        </button>
      </Modal>
    </>
  );
}
