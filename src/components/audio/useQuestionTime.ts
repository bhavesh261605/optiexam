"use client";
import { useEffect } from "react";

export function useQuestionTime(
  attemptId: string,
  questionId?: string,
  enabled = false,
) {
  useEffect(() => {
    if (!questionId || !enabled) return;
    let since = performance.now();
    let active = document.visibilityState === "visible" && document.hasFocus();
    function flush() {
      const now = performance.now();
      const seconds = Math.min(30, Math.max(0, (now - since) / 1000));
      since = now;
      if (!active || seconds < 0.1) return;
      // Best-effort client-reported reading time; never used for scoring or misconduct.
      void fetch(`/api/attempts/${attemptId}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, seconds }),
        keepalive: true,
      }).catch(() => {});
    }
    function change() {
      flush();
      active = document.visibilityState === "visible" && document.hasFocus();
    }
    const interval = setInterval(flush, 15000);
    document.addEventListener("visibilitychange", change);
    window.addEventListener("blur", change);
    window.addEventListener("focus", change);
    return () => {
      flush();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", change);
      window.removeEventListener("blur", change);
      window.removeEventListener("focus", change);
    };
  }, [attemptId, questionId, enabled]);
}
