import type { Language } from "./i18n";
let generation = 0;
let controller: AbortController | undefined;
let player: HTMLAudioElement | undefined;
let objectUrl: string | undefined;
let speaking = false;
export const isPageSpeaking = () => speaking;
export function stopReading() {
  generation++; speaking = false;
  controller?.abort(); controller = undefined;
  if (player) { player.pause(); player.removeAttribute("src"); player.load(); player = undefined; }
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = undefined; }
  window.speechSynthesis?.cancel();
}
export function speechChunks(text: string) {
  const chars = Array.from(text.trim()); const chunks: string[] = [];
  while (chars.length) {
    let end = Math.min(chars.length, 450);
    if (chars.length > end) for (let i = end; i > 200; i--) if (/[\s।.!?]/u.test(chars[i - 1])) { end = i; break; }
    const chunk = chars.splice(0, end).join("").trim(); if (chunk) chunks.push(chunk);
  }
  return chunks;
}
export async function speakText(text: string, language: Language, rate = 1, status: (message: string) => void = () => {}) {
  if (!text.trim()) throw new Error("No text found to read on this page.");
  stopReading(); const current = generation;
  const request = new AbortController(); controller = request; speaking = true;
  const hi = language === "hi";
  status(hi ? "ऑडियो तैयार हो रहा है…" : "Preparing audio…");
  try {
    for (const chunk of speechChunks(text)) {
      const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: chunk, language }), signal: request.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Speech request failed.");
      if (!Array.isArray(result.audios) || !result.audios.length) throw new Error("Speech service returned no audio.");
      for (const encoded of result.audios) {
        if (current !== generation || request.signal.aborted) return;
        const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
        const audio = new Audio(objectUrl); player = audio; audio.playbackRate = Math.min(2, Math.max(.5, rate));
        await new Promise<void>((resolve, reject) => {
          const clean = () => { audio.onended = audio.onerror = audio.onplaying = null; request.signal.removeEventListener("abort", abort); };
          const abort = () => { clean(); resolve(); };
          audio.onended = () => { clean(); resolve(); };
          audio.onerror = () => { clean(); reject(new Error("Audio playback failed. Please try again.")); };
          audio.onplaying = () => { if (current === generation) status(hi ? "पढ़ रहा है। रोकने के लिए Alt+S दबाएँ।" : "Reading. Press Alt+S to stop."); };
          request.signal.addEventListener("abort", abort, { once: true });
          audio.play().catch(() => { clean(); reject(new Error(hi ? "ऑडियो चलाने के लिए पृष्ठ सुनें बटन दबाएँ।" : "Select Read Page to allow audio playback in this browser.")); });
        });
        if (current !== generation) return;
        URL.revokeObjectURL(objectUrl); objectUrl = undefined; player = undefined;
      }
    }
    if (current === generation) status(hi ? "पढ़ना पूरा हुआ।" : "Reading finished.");
  } catch (error) {
    if (current !== generation || request.signal.aborted) return;
    status((error as Error).message); throw error;
  } finally { if (current === generation) stopReading(); }
}
export function readPage(language: Language, rate = 1, status: (message: string) => void = () => {}) {
  const container = document.getElementById("exam-main-content") || document.querySelector("main") || document.body;
  const text = (container.innerText || container.textContent || "").trim();
  if (!text) throw new Error("No text found to read on this page.");
  void speakText(text, language, rate, status).catch(() => {});
}
