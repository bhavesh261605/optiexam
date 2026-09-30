"use client";
import { useLanguage } from "./language";
import { useEffect, useId, useRef, useState } from "react";
import { appendAudio, audioRequest, useRecorder } from "./audio/useRecorder";
import { configureVoice } from "@/lib/i18n";

export function ExamControls({
  text,
  value,
  onChange,
  enabled = true,
}: {
  text: string;
  value: string;
  onChange: (text: string) => void;
  enabled?: boolean;
}) {
  const { t, language } = useLanguage();
  const recordingLanguage = useRef(language);
  const id = useId();
  const [rate, setRate] = useState(1);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [playback, setPlayback] = useState<"idle" | "playing" | "paused">(
    "idle",
  );
  const mounted = useRef(true);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.speechSynthesis?.cancel();
    };
  }, []);
  function read(fragment: string) {
    setError("");
    if (!enabled) return;
    if (!("speechSynthesis" in window)) {
      setError(
        "Read-aloud is unavailable in this browser. Text remains available to your screen reader.",
      );
      return;
    }
    if (!fragment.trim()) {
      setStatus("There is no text to read yet.");
      return;
    }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(fragment);
    utterance.current = speech;
    try {
      configureVoice(speech, language);
    } catch (error) {
      setError((error as Error).message);
      return;
    }
    speech.rate = rate;
    speech.onend = () => {
      if (mounted.current && utterance.current === speech) setPlayback("idle");
    };
    speech.onerror = (event) => {
      if (
        mounted.current &&
        !["canceled", "interrupted"].includes(event.error)
      ) {
        setPlayback("idle");
        setError(
          "Speech playback failed. Try replaying or use your screen reader.",
        );
      }
    };
    window.speechSynthesis.speak(speech);
    setPlayback("playing");
  }
  useEffect(() => {
    if (!enabled) {
      window.speechSynthesis?.cancel();
      setPlayback("idle");
    }
  }, [enabled]);
  const recorder = useRecorder(async (blob) => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      appendAudio(form, "file", blob);
      form.set("language", recordingLanguage.current);
      const result = await audioRequest("transcribe", form);
      if (mounted.current) {
        setTranscript(result.text);
        setStatus(
          "Transcript ready. Review it before adding it to your answer.",
        );
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  });
  return (
    <section
      className="voice-module panel section"
      aria-label={t("Audio answer controls")}
      data-audio-recording={
        recorder.recording || recorder.requesting ? "true" : undefined
      }
    >
      <h2>{t("Read, dictate and review")}</h2>
      <p>
        {t(
          "Reading shortcuts: Alt+R starts reading; Alt+S stops immediately. Turn Audio off to disable them. Start is inactive while typing or recording; Stop still works while typing.",
        )}
      </p>
      <p>
        {t(
          " Dictation creates an editable draft. Nothing is submitted automatically. ",
        )}
      </p>
      <div className="actions flex flex-wrap gap-3">
        <button
          className="button secondary"
          disabled={!enabled || recorder.recording}
          onClick={() => read(text)}
          data-reading-start
          aria-keyshortcuts={enabled ? "Alt+R" : undefined}
        >
          {t(" Read or replay question ")}
          <kbd aria-hidden="true">Alt+R</kbd>
        </button>
        <button
          className="button secondary"
          disabled={playback !== "playing"}
          onClick={() => {
            window.speechSynthesis?.pause();
            setPlayback("paused");
          }}
        >
          {t(" Pause reading ")}
        </button>
        <button
          className="button secondary"
          disabled={playback !== "paused"}
          onClick={() => {
            window.speechSynthesis?.resume();
            setPlayback("playing");
          }}
        >
          {t(" Resume reading ")}
        </button>
        <button
          className="button secondary"
          disabled={playback === "idle"}
          data-reading-stop
          aria-keyshortcuts={enabled ? "Alt+S" : undefined}
          onClick={() => {
            window.speechSynthesis?.cancel();
            setPlayback("idle");
          }}
        >
          {t(" Stop reading ")}
          <kbd aria-hidden="true">Alt+S</kbd>
        </button>
      </div>
      <div className="actions">
        <button
          className="button secondary"
          disabled={rate <= 0.5}
          onClick={() => setRate((n) => Math.max(0.5, n - 0.25))}
        >
          {t(" Slower speech ")}
        </button>
        <output aria-live="polite">
          {t(rate)}
          {t("× speech speed")}
        </output>
        <button
          className="button secondary"
          disabled={rate >= 2}
          onClick={() => setRate((n) => Math.min(2, n + 0.25))}
        >
          {t(" Faster speech ")}
        </button>
      </div>
      <p>
        {t(
          " Speed changes apply on the next replay. Keep built-in audio off when using your own screen reader. ",
        )}
      </p>
      <button
        className="button"
        aria-pressed={recorder.recording}
        disabled={busy || recorder.requesting}
        onClick={() => {
          if (recorder.recording) recorder.stop();
          else {
            window.speechSynthesis?.cancel();
            setPlayback("idle");
            recordingLanguage.current = language;
            void recorder.start();
          }
        }}
      >
        {t(recorder.recording ? "Stop dictation" : "Dictate an answer")}
      </button>
      {transcript !== null && (
        <div>
          <label htmlFor={`${id}-transcript`}>
            {t("Review recognized text")}
          </label>
          <textarea
            id={`${id}-transcript`}
            rows={4}
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
          />
          <div className="actions">
            <button
              className="button secondary"
              disabled={!enabled || recorder.recording}
              onClick={() => read(transcript)}
            >
              {t(" Read transcript back ")}
            </button>
            <button
              className="button"
              onClick={() => {
                onChange(
                  [value.trim(), transcript.trim()].filter(Boolean).join("\n"),
                );
                setTranscript(null);
                setStatus(
                  "Transcript added to your answer. You can still edit it.",
                );
              }}
            >
              {t(" Add transcript to answer ")}
            </button>
            <button
              className="button secondary"
              onClick={() => setTranscript(null)}
            >
              {t(" Discard transcript ")}
            </button>
          </div>
        </div>
      )}
      <label htmlFor={`${id}-answer`}>{t("Your answer")}</label>
      <textarea
        id={`${id}-answer`}
        rows={5}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        className="button secondary"
        disabled={!enabled || recorder.recording}
        onClick={() => read(value)}
      >
        {t(" Read my answer back ")}
      </button>
      <p role="status">
        {t(
          busy
            ? "Transcribing your recording…"
            : recorder.recording
              ? "Recording. Activate Stop dictation when finished. Maximum 45 seconds."
              : status,
        )}
      </p>
      {(error || recorder.error) && (
        <p role="alert" className="error">
          {t(error || recorder.error)}
        </p>
      )}
    </section>
  );
}
