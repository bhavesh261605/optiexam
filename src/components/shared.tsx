"use client";
import { useLanguage } from "./language";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowRight, Volume2, Check, Settings2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Preferences } from "@/lib/types";
import { configureVoice, speechText, type Language } from "@/lib/i18n";
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Request failed. Please try again.");
  return data;
}
export function speak(
  text: string,
  rate = 1,
  language: Language = document.documentElement.lang === "hi" ? "hi" : "en",
) {
  if (!("speechSynthesis" in window))
    throw new Error(
      "Speech is not supported by this browser. All content remains available as text.",
    );
  window.speechSynthesis.cancel();
  const message = new SpeechSynthesisUtterance(speechText(text, language));
  configureVoice(message, language);
  message.rate = rate;
  window.speechSynthesis.speak(message);
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className="modal"
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
        >
          <Dialog.Title>{t(title)}</Dialog.Title>
          <Dialog.Description>{t(description)}</Dialog.Description>
          {t(children)}
          <Dialog.Close
            className="icon-button modal-close"
            aria-label={t("Close dialog")}
          >
            <X size={20} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function PreferencesForm({
  preferences,
  onSaved,
  onCancel,
  onPreview,
}: {
  preferences: Preferences;
  onSaved: (p: Preferences) => void;
  onCancel?: () => void;
  onPreview?: (p: Preferences) => void;
}) {
  const { t } = useLanguage();
  const [prefs, setPrefs] = useState(preferences);
  useEffect(() => setPrefs(preferences), [preferences]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function change(p: Partial<Preferences>) {
    const next = { ...prefs, ...p };
    setPrefs(next);
    onPreview?.(next);
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const saved = await api<Preferences>("preferences", "PUT", {
        ...prefs,
        setup: true,
      });
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="preferences-form">
      <div className="setting">
        <label htmlFor="preferred-language">
          Language / भाषा
          <span>
            {prefs.language === "hi"
              ? "पाठ, प्रश्न सुनने और बोलकर लिखने की भाषा।"
              : "Language for text, read-aloud and dictation."}
          </span>
        </label>
        <select
          id="preferred-language"
          value={prefs.language || "en"}
          onChange={(event) =>
            change({ language: event.target.value === "hi" ? "hi" : "en" })
          }
        >
          <option value="en" lang="en">
            English
          </option>
          <option value="hi" lang="hi">
            हिंदी
          </option>
        </select>
      </div>
      <div className="screen-reader-preset">
        <KeyboardHint />
        <div>
          <strong>{t("Already using a screen reader?")}</strong>
          <p>
            {t(
              " Keep NVDA or your preferred reader in control. This preset switches off browser read-aloud and letter shortcuts. ",
            )}
          </p>
          <button
            className="button secondary compact"
            onClick={() => change({ tts: false, shortcuts: false })}
          >
            {t(" Use my screen reader ")}
          </button>
        </div>
      </div>
      <div className="setting">
        <label htmlFor="text-size">
          {t(" Text size ")}
          <span>{t("Adjust the size of text throughout your workspace.")}</span>
        </label>
        <select
          id="text-size"
          value={prefs.scale}
          onChange={(e) => change({ scale: Number(e.target.value) })}
        >
          {[100, 125, 150, 175, 200].map((n) => (
            <option key={n} value={n}>
              {t(n)}
              {t("%")}
              {t(n === 100 ? " · Default" : "")}
            </option>
          ))}
        </select>
      </div>
      {(
        [
          [
            "contrast",
            "High contrast",
            "Stronger borders and a dark background.",
          ],
          [
            "tts",
            "Read-aloud controls",
            "Listen to questions when you choose.",
          ],
          [
            "reducedMotion",
            "Reduce motion",
            "Keep transitions and movement to a minimum.",
          ],
          [
            "shortcuts",
            "Exam keyboard shortcuts",
            "Optional N, P, R, and M keys. Turn off for screen readers.",
          ],
        ] as const
      ).map(([key, label, description]) => (
        <div className="setting" key={key}>
          <label htmlFor={key}>
            {t(label)}
            <span>{t(description)}</span>
          </label>
          <input
            id={key}
            className="toggle"
            type="checkbox"
            checked={prefs[key]}
            onChange={(e) => change({ [key]: e.target.checked })}
          />
        </div>
      ))}
      <div className="setting">
        <label htmlFor="speech-rate">{t("Speech speed")}</label>
        <select
          id="speech-rate"
          value={prefs.rate}
          onChange={(e) => change({ rate: Number(e.target.value) })}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => (
            <option key={n} value={n}>
              {t(n)}
              {t("× ")}
            </option>
          ))}
        </select>
      </div>
      <div className="settings-preview">
        <span className="eyebrow">{t("PREVIEW")}</span>
        <p style={{ fontSize: `${prefs.scale / 100}rem` }}>
          {t(" A comfortable space to do your best. ")}
        </p>
        <label className="inline">
          <input type="radio" name="preview" defaultChecked />{" "}
          {t(" An example answer option ")}
        </label>
        <button
          className="button secondary"
          onClick={() => {
            try {
              speak(
                "Your audio is ready. You can read any question aloud.",
                prefs.rate,
                prefs.language || "en",
              );
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Volume2 size={18} /> {t(" Test audio ")}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {t(error)}
        </p>
      )}
      <div className="actions">
        {onCancel && (
          <button className="button secondary" onClick={onCancel}>
            {t(" Cancel ")}
          </button>
        )}
        <button className="button" onClick={save} disabled={busy}>
          <Check size={18} />
          {t(busy ? "Saving…" : "Save preferences")}
        </button>
      </div>
    </div>
  );
}
function KeyboardHint() {
  const { t } = useLanguage();
  return <Settings2 size={23} aria-hidden="true" />;
}
export function PageHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{t(eyebrow)}</p>}
        <h1 tabIndex={-1}>{t(title)}</h1>
        {children && <p className="subheading">{t(children)}</p>}
      </div>
      {t(action)}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="empty-state">
      <Settings2 size={26} />
      <h3>{t(title)}</h3>
      <p>{t(children)}</p>
    </div>
  );
}
export function Loading() {
  const { t } = useLanguage();
  return (
    <p className="loading" role="status">
      {t(" Loading your workspace… ")}
    </p>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="error" role="alert">
      <p>{t(message)}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          {t(" Try again ")}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
