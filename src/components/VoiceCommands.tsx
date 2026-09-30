"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "./language";
import { isPageSpeaking, readPage, stopReading, speakText } from "@/lib/page-reader";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function parseVoiceCommand(text: string) {
  const clean = text
    .toLowerCase()
    .replace(/[।.!?,]/g, "")
    .trim();
  if (/^(practice|पैक्टिस|प्रैक्टिस|प्रैक्टिस खोलो|अभ्यास)$/.test(clean))
    return "practice";
  if (/^(home|होम|मुख्य पृष्ठ)$/.test(clean)) return "home";
  if (/^(prepare|learn|तैयारी|सीखें)$/.test(clean)) return "prepare";
  if (/^(read|read page|पढ़ो|पढ़ें|पृष्ठ पढ़ो|सुनाओ)$/.test(clean))
    return "read";
  if (/^(stop listening|voice off|सुनना बंद करो)$/.test(clean)) return "off";
  const commands: Record<string, string[]> = {
    exams: ["all exams", "ऑल एग्जाम्स", "सभी परीक्षाएं"],
    progress: ["progress", "प्रोग्रेस"],
    perform: ["perform", "परफॉर्म"],
    audioOn: ["audio on", "ऑडियो चालू"],
    audioOff: ["audio off", "ऑडियो बंद"],
    audio: ["audio", "ऑडियो"],
    stop: ["stop reading", "पढ़ना बंद करो"],
    account: ["my account", "मेरा खाता"],
    shortcuts: ["shortcuts", "शॉर्टकट"],
    guide: ["keyboard guide", "कीबोर्ड गाइड"],
    close: ["close", "बंद करें"],
    theme: ["theme", "थीम"],
    dark: ["dark mode", "डार्क मोड"],
    light: ["light mode", "लाइट मोड"],
    next: ["next field", "अगला फ़ील्ड"],
    activate: ["activate", "click", "खोलें"],
    submit: ["submit form", "फ़ॉर्म जमा करें"],
    login: ["log in", "login", "लॉग इन"],
    signup: ["create account", "खाता बनाएं"],
  };
  return (
    Object.keys(commands).find((key) => commands[key].includes(clean)) || null
  );
}

export function dictateIntoField(text: string) {
  const field = document.activeElement;
  if (
    !(
      field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
    ) ||
    field.disabled ||
    field.readOnly
  )
    return false;
  if (
    field instanceof HTMLInputElement &&
    !["text", "email", "password", "search", "tel", "url"].includes(field.type)
  )
    return false;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  const value = field.value.slice(0, start) + text + field.value.slice(end);
  const prototype =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
  try {
    field.setSelectionRange(start + text.length, start + text.length);
  } catch {}
  return true;
}

export function VoiceCommands() {
  const { language } = useLanguage();
  const router = useRouter();
  const path = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("");
  const [supported, setSupported] = useState(false);
  const pending = useRef("");
  const [confirmation, setConfirmation] = useState(0);
  const confirming = useRef(false);
  const hi = language === "hi";
  const context = useRef({ path, router });
  context.current = { path, router };

  useEffect(() => {
    const w = window as SpeechWindow;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    function key(event: KeyboardEvent) {
      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.repeat &&
        !event.isComposing &&
        !event.defaultPrevented &&
        event.code === "KeyL"
      ) {
        event.preventDefault();
        setEnabled((value) => !value);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  useEffect(() => {
    if (!pending.current) return;
    const message = pending.current;
    pending.current = "";
    let cancelled = false;
    const timer = setTimeout(() => {
      void speakText(message, hi ? "hi" : "en").catch(() => {
        if (!cancelled) setStatus(hi ? "आदेश पूरा हुआ, लेकिन ऑडियो नहीं चल सका।" : "Command completed, but audio confirmation could not play.");
      }).finally(() => { if (!cancelled) confirming.current = false; });
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); confirming.current = false; };

  }, [path, hi, confirmation]);

  useEffect(() => {
    if (!enabled) return;
    const w = window as SpeechWindow;
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) {
      setEnabled(false);
      return;
    }
    const recognition = new Constructor();
    recognition.lang = hi ? "hi-IN" : "en-IN";
    recognition.continuous = true;
    recognition.interimResults = false;
    let disposed = false,
      running = false,
      starting = false,
      failed = false;
    let lastCommand = 0;
    const blocked = () =>
      document.hidden ||
      Boolean(
        document.querySelector("[data-audio-recording='true'],.exam-main"),
      );
    const tick = () => {
      if (disposed || failed) return;
      if (blocked()) {
        if (running || starting) {
          running = false;
          starting = false;
          recognition.abort();
          setStatus(
            hi
              ? "आवाज़ आदेश अस्थायी रूप से रुके हैं।"
              : "Voice commands temporarily paused.",
          );
        }
        return;
      }
      if (!running && !starting) {
        starting = true;
        try {
          recognition.start();
        } catch {
          starting = false;
          failed = true;
          setEnabled(false);
          setStatus(
            hi
              ? "माइक्रोफ़ोन शुरू नहीं हुआ। दोबारा चालू करें।"
              : "Microphone could not start. Toggle voice commands to retry.",
          );
        }
      }
    };
    recognition.onstart = () => {
      starting = false;
      running = true;
      setStatus(hi ? "सुन रहा है। आदेश बोलें।" : "Listening. Say a command.");
    };
    recognition.onend = () => {
      running = false;
      starting = false;
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      failed = true;
      setEnabled(false);
      setStatus(
        hi
          ? `आवाज़ पहचान बंद: ${event.error}। माइक्रोफ़ोन की अनुमति और इंटरनेट जाँचें।`
          : `Voice recognition stopped: ${event.error}. Check microphone permission and connection.`,
      );
    };
    recognition.onresult = (event) => {
      if (disposed || failed || blocked()) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const transcript = event.results[i][0].transcript.trim();
        const command = parseVoiceCommand(
          transcript.replace(/^(command|आदेश)\s+/i, ""),
        );
        const speaking =
          isPageSpeaking() ||
          confirming.current ||
          window.speechSynthesis?.speaking;
        if (speaking && command !== "stop" && command !== "off") continue;
        if (
          !speaking &&
          !/^(command|आदेश)\s+/i.test(transcript) &&
          command !== "off" &&
          dictateIntoField(transcript)
        ) {
          setStatus(
            hi
              ? "फ़ील्ड में पाठ जोड़ा गया।"
              : "Text added to the focused field.",
          );
          continue;
        }
        if (!command || (!["stop", "off"].includes(command) && Date.now() - lastCommand < 1500)) continue;
        lastCommand = Date.now();
        recognition.abort();
        running = false;
        starting = false;
        if (command === "off") {
          setEnabled(false);
          setStatus(hi ? "आवाज़ आदेश बंद।" : "Voice commands off.");
          return;
        }
        if (command === "read") {
          try {
            readPage(language, 1, setStatus);
          } catch (error) {
            setStatus((error as Error).message);
          }
          return;
        }
        if (command === "stop") {
          stopReading();
          confirming.current = false;
          setStatus(hi ? "पढ़ना बंद।" : "Reading stopped.");
          return;
        }
        const routes: Record<string, string> = {
          home: "/dashboard",
          prepare: "/access-lab",
          practice: "/practice",
          progress: "/analytics",
          perform: "/exams",
          account: "/profile",
          login: "/login",
          signup: "/signup",
        };
        let succeeded = false;
        if (routes[command]) {
          context.current.router.push(routes[command]);
          succeeded = true;
        } else if (command === "close") {
          const button = document.querySelector<HTMLButtonElement>(
            "[role='dialog'] button[aria-label], [role='alertdialog'] button[aria-label]",
          );
          if (button) {
            button.click();
            succeeded = true;
          }
        } else if (command === "submit") {
          const form = document.activeElement?.closest("form");
          if (form instanceof HTMLFormElement) { form.requestSubmit(); succeeded = true; }
        } else if (command === "activate") {
          const active = document.activeElement;
          if ((active instanceof HTMLButtonElement && !active.disabled) || active instanceof HTMLAnchorElement) { active.click(); succeeded = true; }
        } else if (command === "next") {
          const fields = Array.from(
            document.querySelectorAll<HTMLElement>(
              "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not(:disabled), textarea:not(:disabled), button[type='submit']",
            ),
          );
          const next =
            fields[fields.indexOf(document.activeElement as HTMLElement) + 1];
          if (next) {
            next.focus();
            succeeded = true;
          }
        } else {
          const action = command.startsWith("audio")
            ? "audio"
            : ["dark", "light"].includes(command)
              ? "theme"
              : command;
          const button = document.querySelector<HTMLButtonElement>(
            `[data-voice-action="${action}"]`,
          );
          if (button && !button.disabled) {
            const state =
              button.getAttribute("aria-pressed") === "true" ||
              button.getAttribute("aria-checked") === "true";
            const explicit = ["audioOn", "dark"].includes(command)
              ? true
              : ["audioOff", "light"].includes(command)
                ? false
                : undefined;
            if (explicit === undefined || state !== explicit) button.click();
            succeeded = true;
          }
        }
        if (!succeeded) {
          setStatus(
            hi
              ? "यह नियंत्रण इस पृष्ठ पर उपलब्ध नहीं है।"
              : "That control is not available on this page.",
          );
          return;
        }
        const labels: Record<string, string> = {
          prepare: "तैयारी",
          practice: "अभ्यास",
          home: "मुख्य पृष्ठ",
          progress: "प्रगति",
          perform: "परीक्षा",
          account: "खाता",
          exams: "सभी परीक्षाएँ",
          guide: "कीबोर्ड गाइड",
        };
        const message = hi
          ? `${labels[command] || command} आदेश पूरा हुआ।`
          : `${command} command completed.`;
        confirming.current = true;
        pending.current = message;
        setStatus(message);
        setConfirmation((value) => value + 1);
        return;
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => {
      disposed = true;
      clearInterval(timer);
      recognition.onstart =
        recognition.onend =
        recognition.onerror =
        recognition.onresult =
          null;
      recognition.abort();
    };
  }, [enabled, hi, language]);

  useEffect(() => () => stopReading(), []);
  return (
    <section
      className="voice-panel"
      aria-label={hi ? "आवाज़ आदेश" : "Voice commands"}
    >
      <button
        aria-pressed={enabled}
        aria-keyshortcuts="Alt+L"
        disabled={!supported}
        onClick={() => {
          setEnabled(!enabled);
          setStatus("");
        }}
      >
        {hi ? "आवाज़ आदेश" : "Voice commands"}:{" "}
        {enabled ? (hi ? "चालू" : "on") : hi ? "बंद" : "off"}{" "}
        <kbd aria-hidden="true">Alt+L</kbd>
      </button>
      <p>
        {!supported
          ? hi
            ? "इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है।"
            : "Speech recognition is unavailable in this browser."
          : hi
            ? "बोलें: होम, तैयारी, प्रैक्टिस, पढ़ो। भाषा चयन पहचान की भाषा बदलता है। माइक्रोफ़ोन अनुमति आवश्यक है; ब्राउज़र ऑडियो ऑनलाइन संसाधित कर सकता है।"
            : "Say All exams, Home, Learn, Practice, Progress, Perform, Audio on/off, Read Page, Stop reading, My account, Shortcuts, Keyboard guide, Close or Dark/Light mode. Microphone permission is required; audio, including dictated fields, may be processed online by your browser."}
      </p>
      <p>
        {hi
          ? "फ़ोकस वाले फ़ील्ड में बोलकर लिखें। अगले फ़ील्ड के लिए command next field बोलें। लिखते समय आदेश से पहले command कहें। रिकॉर्डिंग और परीक्षा में माइक्रोफ़ोन रुकेगा।"
          : "Focused text fields accept dictation. Say ‘command next field’ to move focus; prefix toolbar commands with ‘command’ while typing. Say ‘command submit form’ to submit, or ‘activate’ on a focused button. During playback, only Stop reading or Voice off is accepted. Microphone pauses during recording and exams."}
      </p>
      <p role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
