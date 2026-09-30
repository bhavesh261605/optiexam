"use client";
import { useEffect, useRef, useState } from "react";

export function useRecorder(onRecording: (blob: Blob) => Promise<void>) {
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const callback = useRef(onRecording);
  callback.current = onRecording;
  function release() {
    if (timer.current) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state === "recording") recorder.current.stop();
      release();
    };
  }, []);
  async function start() {
    if (pending.current || recorder.current?.state === "recording") return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Microphone recording is unavailable. Use HTTPS or localhost and a supported browser. Keyboard input remains available.",
      );
      return;
    }
    pending.current = true;
    setRequesting(true);
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((mime) => MediaRecorder.isTypeSupported(mime));
      if (!mimeType)
        throw new Error(
          "This browser cannot create a supported audio format. Try another browser or type your answer.",
        );
      const instance = new MediaRecorder(media, { mimeType });
      recorder.current = instance;
      const chunks: BlobPart[] = [];
      let size = 0;
      instance.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          size += event.data.size;
          if (size > 8 * 1024 * 1024 && instance.state === "recording")
            instance.stop();
        }
      };
      instance.onerror = () => {
        release();
        if (mounted.current) {
          setRecording(false);
          setError("Recording failed. Check your microphone and try again.");
        }
      };
      instance.onstop = async () => {
        release();
        if (!mounted.current) return;
        setRecording(false);
        if (!size || size > 8 * 1024 * 1024) {
          setError(
            "Recording was empty or too large. Try a shorter recording.",
          );
          return;
        }
        try {
          await callback.current(new Blob(chunks, { type: mimeType }));
        } catch (e) {
          if (mounted.current) setError((e as Error).message);
        }
      };
      instance.start(250);
      setRecording(true);
      timer.current = setTimeout(() => {
        if (instance.state === "recording") instance.stop();
      }, 45000);
    } catch (e) {
      release();
      if (mounted.current)
        setError(
          (e as Error).name === "NotAllowedError"
            ? "Microphone permission was denied. Allow microphone access or use keyboard input."
            : (e as Error).message,
        );
    } finally {
      pending.current = false;
      if (mounted.current) setRequesting(false);
    }
  }
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  return { recording, requesting, error, start, stop };
}

export function appendAudio(
  form: FormData,
  key: string,
  blob: Blob,
  index = 0,
) {
  const extension = blob.type.includes("mp4")
    ? "m4a"
    : blob.type.includes("ogg")
      ? "ogg"
      : "webm";
  form.append(key, blob, `recording-${index}.${extension}`);
}

export async function audioRequest(
  path: string,
  body: FormData | object,
  method = "POST",
) {
  const multipart = body instanceof FormData;
  const response = await fetch(`/api/voice/${path}`, {
    method,
    headers: multipart ? undefined : { "Content-Type": "application/json" },
    body:
      method === "DELETE" ? undefined : multipart ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(160000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error ||
        "Audio request failed. Try again; keyboard input remains available.",
    );
  return data;
}
