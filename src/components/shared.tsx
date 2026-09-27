"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowRight, Volume2, Check, Accessibility } from "lucide-react";
import { useState, useRef } from "react";
import type { Preferences } from "@/lib/types";
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
export function speak(text: string, rate = 1) {
  if (!("speechSynthesis" in window))
    throw new Error(
      "Speech is not supported by this browser. All content remains available as text.",
    );
  window.speechSynthesis.cancel();
  const message = new SpeechSynthesisUtterance(text);
  message.lang = "en-IN";
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
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
          <Dialog.Close
            className="icon-button modal-close"
            aria-label="Close dialog"
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
  const [prefs, setPrefs] = useState(preferences);
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
      <div className="screen-reader-preset">
        <KeyboardHint />
        <div>
          <strong>Already using a screen reader?</strong>
          <p>
            Keep NVDA or your preferred reader in control. This preset switches
            off browser read-aloud and letter shortcuts.
          </p>
          <button
            className="button secondary compact"
            onClick={() => change({ tts: false, shortcuts: false })}
          >
            Use my screen reader
          </button>
        </div>
      </div>
      <div className="setting">
        <label htmlFor="text-size">
          Text size
          <span>Adjust the size of text throughout your workspace.</span>
        </label>
        <select
          id="text-size"
          value={prefs.scale}
          onChange={(e) => change({ scale: Number(e.target.value) })}
        >
          {[100, 125, 150, 175, 200].map((n) => (
            <option key={n} value={n}>
              {n}%{n === 100 ? " · Default" : ""}
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
            {label}
            <span>{description}</span>
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
        <label htmlFor="speech-rate">Speech speed</label>
        <select
          id="speech-rate"
          value={prefs.rate}
          onChange={(e) => change({ rate: Number(e.target.value) })}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
      </div>
      <div className="settings-preview">
        <span className="eyebrow">PREVIEW</span>
        <p style={{ fontSize: `${prefs.scale / 100}rem` }}>
          A comfortable space to do your best.
        </p>
        <label className="inline">
          <input type="radio" name="preview" defaultChecked /> An example answer
          option
        </label>
        <button
          className="button secondary"
          onClick={() => {
            try {
              speak(
                "Your audio is ready. You can read any question aloud.",
                prefs.rate,
              );
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Volume2 size={18} /> Test audio
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="actions">
        {onCancel && (
          <button className="button secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="button" onClick={save} disabled={busy}>
          <Check size={18} />
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}
function KeyboardHint() {
  return <Accessibility size={23} aria-hidden="true" />;
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
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1}>{title}</h1>
        {children && <p className="subheading">{children}</p>}
      </div>
      {action}
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
  return (
    <div className="empty-state">
      <Accessibility size={26} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Loading() {
  return (
    <p className="loading" role="status">
      Loading your workspace…
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
  return (
    <div className="error" role="alert">
      <p>{message}</p>
      {retry && (
        <button className="button secondary" onClick={retry}>
          Try again <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
