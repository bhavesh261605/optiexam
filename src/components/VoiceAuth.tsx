"use client";
import { useLanguage } from "./language";
import { useState } from "react";
import { Mic, Square } from "lucide-react";
import { appendAudio, audioRequest, useRecorder } from "./audio/useRecorder";
import { speak } from "./shared";

type Challenge = {
  challenge_id: string;
  phrases: string[];
  language?: "en" | "hi";
};
export function VoiceAuth({
  mode,
  accountId,
}: {
  mode: "enroll" | "login";
  accountId?: string;
}) {
  const { t, language } = useLanguage();
  const [identifier, setIdentifier] = useState(accountId || "");
  const [consent, setConsent] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [samples, setSamples] = useState<Blob[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [failure, setFailure] = useState("");
  const recording = useRecorder(async (blob) => {
    if (!challenge) return;
    const next = [...samples, blob];
    if (mode === "enroll" && next.length < 3) {
      setSamples(next);
      setStatus(
        `Sample ${next.length} recorded. Read the next phrase and record sample ${next.length + 1}.`,
      );
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("challenge_id", challenge.challenge_id);
      form.set("identifier", identifier);
      form.set("consent", String(consent));
      if (mode === "enroll")
        next.forEach((audio, index) =>
          appendAudio(form, "files", audio, index),
        );
      else appendAudio(form, "file", blob);
      await audioRequest(mode, form);
      setStatus(
        mode === "enroll"
          ? "Voice profile enrolled. You can now use voice sign-in."
          : "Voice matched. Opening your dashboard.",
      );
      if (mode === "login") window.location.assign("/dashboard");
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
      setSamples([]);
      setChallenge(null);
    }
  });
  async function activate() {
    if (recording.recording) {
      recording.stop();
      return;
    }
    if (challenge) {
      await recording.start();
      return;
    }
    setBusy(true);
    setFailure("");
    try {
      const data = await audioRequest("challenge", {
        purpose: mode,
        language,
        identifier,
      });
      setChallenge(data);
      setStatus(
        "Your phrase is ready. Activate the microphone button, speak the phrase slowly, then activate it again to stop.",
      );
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const label = recording.recording
    ? "Stop recording"
    : challenge
      ? `Record ${mode === "enroll" ? `sample ${samples.length + 1} of 3` : "sign-in phrase"}`
      : "Get a voice challenge";
  if (process.env.NEXT_PUBLIC_VOICE_AUTH_AVAILABLE === "false") {
    return (
      <p role="status">
        {language === "hi"
          ? "वॉइस पहचान से साइन इन अभी इस होस्ट पर उपलब्ध नहीं है। कृपया ईमेल और पासवर्ड से साइन इन करें। वॉइस नेविगेशन और पेज पढ़ना उपलब्ध हैं।"
          : "Biometric voice sign-in is not available on this host yet. Please use email and password. Voice navigation and page reading remain available."}
      </p>
    );
  }
  return (
    <section
      className="voice-module panel section"
      data-audio-recording={
        recording.recording || recording.requesting ? "true" : undefined
      }
      aria-label={t(mode === "enroll" ? "Voice enrollment" : "Voice sign-in")}
    >
      <h2>
        {t(
          mode === "enroll"
            ? "Set up voice sign-in"
            : "Sign in with your voice",
        )}
      </h2>
      <p>
        {t(
          " Optional experimental voice verification. Password sign-in remains available. A voice match can be wrong and does not prove liveness. ",
        )}
      </p>
      {mode === "enroll" ? (
        <p>
          {t(" Voice account ID: ")}
          <strong>{t(accountId)}</strong>
          {t(". Use this ID or your account email when signing in. ")}
        </p>
      ) : (
        <label className="field-label">
          {t(" Account email or voice account ID ")}
          <input
            autoComplete="username"
            value={identifier}
            disabled={!!challenge || busy || recording.recording}
            onChange={(event) => setIdentifier(event.target.value)}
          />
        </label>
      )}
      <label className="inline">
        <input
          type="checkbox"
          checked={consent}
          disabled={busy || recording.recording || !!challenge}
          onChange={(event) => setConsent(event.target.checked)}
        />
        {t(
          mode === "enroll"
            ? "I consent to storing an encrypted voice template for this account. Recordings are deleted after processing."
            : "I consent to processing this recording to verify my voice.",
        )}
      </label>
      {challenge && (
        <div className="voice-phrase">
          <p>{t("Say exactly, slowly (at least 3 seconds):")}</p>
          <p className="text-xl font-semibold" role="status">
            {t(challenge.phrases[samples.length])}
          </p>
          <button
            className="button secondary"
            disabled={recording.recording}
            onClick={() => {
              try {
                speak(
                  challenge.phrases[samples.length],
                  1,
                  challenge.language || "en",
                );
              } catch (e) {
                setFailure((e as Error).message);
              }
            }}
          >
            {t(" Hear the phrase ")}
          </button>
        </div>
      )}
      <p>
        {t(
          " Recording stops automatically after 45 seconds. Wait until any spoken instructions finish before recording. ",
        )}
      </p>
      <button
        className="voice-record button"
        aria-label={t(label)}
        aria-pressed={recording.recording}
        disabled={
          !consent || !identifier.trim() || busy || recording.requesting
        }
        onClick={() => {
          window.speechSynthesis?.cancel();
          void activate();
        }}
      >
        {recording.recording ? (
          <Square aria-hidden="true" size={30} />
        ) : (
          <Mic aria-hidden="true" size={30} />
        )}
        <span className="sr-only">{t(label)}</span>
      </button>
      <p role="status">
        {t(
          busy
            ? "Processing securely. Please wait…"
            : recording.requesting
              ? "Waiting for microphone permission…"
              : recording.recording
                ? "Recording. Activate the same button to stop."
                : status,
        )}
      </p>
      {(failure || recording.error) && (
        <p role="alert" className="error">
          {t(failure || recording.error)}
        </p>
      )}
      {challenge && !recording.recording && !busy && (
        <button
          className="button secondary"
          onClick={() => {
            setChallenge(null);
            setSamples([]);
            setStatus(
              "Recording session cancelled. No voice profile was changed.",
            );
          }}
        >
          {t(" Cancel recording session ")}
        </button>
      )}
      {mode === "enroll" && (
        <details>
          <summary>{t("Remove my voice profile")}</summary>
          <p>
            {t(
              " Removes your biometric template. Your password and exam records stay available. ",
            )}
          </p>
          <button
            className="button secondary"
            disabled={busy || recording.recording}
            onClick={async () => {
              setBusy(true);
              setFailure("");
              try {
                await audioRequest("enroll", {}, "DELETE");
                setStatus("Voice profile deleted.");
                setChallenge(null);
                setSamples([]);
              } catch (e) {
                setFailure((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t(" Delete my voice template ")}
          </button>
        </details>
      )}
    </section>
  );
}
