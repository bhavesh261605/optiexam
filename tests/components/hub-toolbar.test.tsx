import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useState } from "react";
import { dictateIntoField, parseVoiceCommand, VoiceCommands } from "../../src/components/VoiceCommands";
import { LanguageProvider } from "../../src/components/language";
import { ThemeToggle } from "../../src/components/ThemeToggle";
import { milestoneStats } from "../../src/components/CandidateHub";
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ push: vi.fn() }) }));
it("maps every requested toolbar command", () => {
  for (const [text, action] of Object.entries({ "All exams":"exams", "ऑल एग्जाम्स":"exams", "learn":"prepare", "Progress":"progress", "Perform":"perform", "Audio on":"audioOn", "Audio off":"audioOff", "ऑडियो":"audio", "Read Page":"read", "Stop reading":"stop", "मेरा खाता":"account", "Shortcuts":"shortcuts", "Keyboard guide":"guide" })) expect(parseVoiceCommand(text)).toBe(action);
});
it("dictates into controlled fields and replaces selected text without submitting", () => {
  function Form() { const [value, setValue] = useState("old text"); return <input aria-label="Answer" value={value} onChange={e => setValue(e.target.value)} />; }
  render(<Form />); const field = screen.getByRole("textbox") as HTMLInputElement; field.focus(); field.setSelectionRange(0, 3);
  act(() => { expect(dictateIntoField("new")).toBe(true); }); expect(field).toHaveValue("new text");
});
it("sets and persists dark and light themes", () => {
  localStorage.clear(); render(<LanguageProvider><ThemeToggle /></LanguageProvider>);
  const toggle = screen.getByRole("switch"); fireEvent.click(toggle); expect(document.documentElement.dataset.theme).toBe("dark"); expect(localStorage.getItem("optiexam-theme")).toBe("dark");
  fireEvent.click(toggle); expect(document.documentElement.dataset.theme).toBe("light");
});
it("uses completed dates for milestones and streak", () => {
  const now = new Date(2026, 9, 1, 12);
  const exams = [{ kind:"practice", attempt:{ submittedAt: now.getTime() } }, { kind:"mock", attempt:{ submittedAt: new Date(2026,8,30,12).getTime() } }] as any;
  expect(milestoneStats(exams, now)).toEqual({ streak:2, practiced:1, mocks:0 });
});
it("honours explicit audio off and allows Stop reading while speech is active", () => {
  let recognition: any; class Mock { start=vi.fn(); abort=vi.fn(); constructor(){recognition=this;} }
  vi.stubGlobal("SpeechRecognition", Mock); vi.stubGlobal("speechSynthesis", { cancel:vi.fn(), speaking:false });
  const click = vi.fn(); render(<LanguageProvider><VoiceCommands /><button data-voice-action="audio" aria-pressed="false" onClick={click}>Audio</button></LanguageProvider>);
  fireEvent.click(screen.getByRole("button",{name:/Voice commands/}));
  act(() => recognition.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:"Audio off"}}]})); expect(click).not.toHaveBeenCalled();
  (window.speechSynthesis as any).speaking = true;
  vi.mocked(window.speechSynthesis.cancel).mockClear();
  act(() => recognition.onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:"Stop reading"}}]}));
  expect(window.speechSynthesis.cancel).toHaveBeenCalled();
});
