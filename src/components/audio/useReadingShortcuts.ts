"use client";
import { useEffect } from "react";
import { stopReading } from "@/lib/page-reader";

/** Invoke the same accessible controls as a click; one listener per workspace. */
export function useReadingShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function keydown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      const key =
        event.code === "KeyR"
          ? "r"
          : event.code === "KeyS"
            ? "s"
            : event.key.toLowerCase();
      if (key !== "r" && key !== "s") return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        key === "r" &&
        (target?.closest(
          "input,textarea,select,[contenteditable]:not([contenteditable='false']),[role='textbox'],[role='combobox']",
        ) ||
          document.querySelector(
            "[role='dialog'],[role='alertdialog'],[data-audio-recording='true']",
          ))
      )
        return;

      const attribute =
        key === "r" ? "data-reading-start" : "data-reading-stop";
      const local = document.querySelector<HTMLButtonElement>(
        `main button[${attribute}]`,
      );
      const page = document.querySelector<HTMLButtonElement>(
        `button[${attribute}]`,
      );
      const button = local || page;
      if (key === "r") {
        if (!button || button.disabled || button.closest("[hidden],[inert]"))
          return;
        event.preventDefault();
        button.click();
      } else {
        // Stop remains available while typing or a dialog is open, without moving focus.
        event.preventDefault();
        if (button && !button.disabled) button.click();
        stopReading();
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [enabled]);
}
