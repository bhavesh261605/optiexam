"use client";
import { useLanguage } from "./language";
import { useEffect, useRef, useState } from "react";

export type GuardEvent = {
  kind:
    | "focus-left"
    | "focus-returned"
    | "fullscreen-entered"
    | "fullscreen-exited"
    | "clipboard-blocked";
  at: number;
};
export function ExamGuard({
  children,
  onEvent,
}: {
  children: React.ReactNode;
  onEvent?: (event: GuardEvent) => void;
}) {
  const { t } = useLanguage();
  const region = useRef<HTMLDivElement>(null);
  const callback = useRef(onEvent);
  callback.current = onEvent;
  const [events, setEvents] = useState<GuardEvent[]>([]);
  const [contain, setContain] = useState(false);
  const [protect, setProtect] = useState(false);
  const [full, setFull] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    function record(kind: GuardEvent["kind"]) {
      const event = { kind, at: Date.now() };
      setEvents((old) => [...old.slice(-49), event]);
      callback.current?.(event);
    }
    const blur = () => record("focus-left");
    const focus = () => record("focus-returned");
    const fullscreen = () => {
      const inside = !!document.fullscreenElement;
      setFull(inside);
      record(inside ? "fullscreen-entered" : "fullscreen-exited");
    };
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, []);
  function clipboard(event: React.ClipboardEvent) {
    if (
      !protect ||
      (event.target as HTMLElement).closest(
        "input,textarea,[contenteditable='true']",
      )
    )
      return;
    event.preventDefault();
    const item: GuardEvent = { kind: "clipboard-blocked", at: Date.now() };
    setEvents((old) => [...old.slice(-49), item]);
    callback.current?.(item);
    setStatus(
      "Copying question content is disabled in this optional mode. Clipboard remains available in answer fields.",
    );
  }
  return (
    <div
      ref={region}
      className="exam-guard"
      onCopy={clipboard}
      onCut={clipboard}
      onPaste={clipboard}
      onKeyDown={(event) => {
        if (event.key === "Escape" && contain) {
          setContain(false);
          setStatus("Keyboard containment off. Tab can leave the exam area.");
          return;
        }
        if (
          !contain ||
          event.key !== "Tab" ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          document.querySelector("[role='dialog']")
        )
          return;
        const controls = [
          ...(region.current?.querySelectorAll<HTMLElement>(
            "summary,a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex='0']",
          ) || []),
        ].filter(
          (element) =>
            element.getClientRects().length &&
            !element.closest("[hidden],[inert]"),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <details className="guard-settings">
        <summary>{t("Exam focus controls")}</summary>
        <p>
          {t(
            " Optional browser controls. Switching focus is not proof of misconduct. These controls cannot lock the operating system or block assistive software. ",
          )}
        </p>
        <div className="actions">
          <button
            className="button secondary"
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else if (document.documentElement.requestFullscreen)
                  await document.documentElement.requestFullscreen();
                else
                  throw new Error("Fullscreen is unavailable in this browser.");
              } catch (e) {
                setStatus((e as Error).message);
              }
            }}
          >
            {t(full ? "Exit fullscreen" : "Enter fullscreen")}
          </button>
        </div>
        <label className="inline">
          <input
            type="checkbox"
            checked={contain}
            onChange={(event) => setContain(event.target.checked)}
          />
          {t(" Keep Tab within the exam area (Escape releases it) ")}
        </label>
        <label className="inline">
          <input
            type="checkbox"
            checked={protect}
            onChange={(event) => setProtect(event.target.checked)}
          />
          {t(
            " Protect copying of question content; allow clipboard in answer fields ",
          )}
        </label>
        <p>
          {t(" Focus events recorded this visit:")}
          {t(" ")}
          {t(events.filter((event) => event.kind === "focus-left").length)}
          {t(". This count does not affect your score. ")}
        </p>
        <p role="status">{t(status)}</p>
      </details>
      {t(children)}
    </div>
  );
}
