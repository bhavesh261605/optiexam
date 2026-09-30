import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useReadingShortcuts } from "../../src/components/audio/useReadingShortcuts";
import { ExamControls } from "../../src/components/ExamControls";

function Harness({
  enabled = true,
  read = vi.fn(),
  stop = vi.fn(),
  page = vi.fn(),
  recording = false,
  dialog = false,
  disabled = false,
}) {
  useReadingShortcuts(enabled);
  return (
    <>
      <button data-reading-start onClick={page}>
        Read page
      </button>
      <main data-audio-recording={recording ? "true" : undefined}>
        <button data-reading-start disabled={disabled} onClick={read}>
          Read question
        </button>
        <button data-reading-stop onClick={stop}>
          Stop
        </button>
        <textarea aria-label="Answer" defaultValue="Keep this answer" />
        {dialog && (
          <div role="dialog" aria-label="Confirm">
            Confirm
          </div>
        )}
      </main>
    </>
  );
}

it("starts the current question once and preserves keyboard focus", () => {
  const read = vi.fn(),
    page = vi.fn();
  render(<Harness read={read} page={page} />);
  const button = screen.getByRole("button", { name: "Read question" });
  button.focus();
  fireEvent.keyDown(button, { key: "r", code: "KeyR", altKey: true });
  fireEvent.keyDown(button, {
    key: "r",
    code: "KeyR",
    altKey: true,
    repeat: true,
  });
  expect(read).toHaveBeenCalledOnce();
  expect(page).not.toHaveBeenCalled();
  expect(button).toHaveFocus();
});

it("never starts while typing but stops immediately without editing the answer", () => {
  vi.stubGlobal("speechSynthesis", { cancel: vi.fn() });
  const read = vi.fn(),
    stop = vi.fn();
  render(<Harness read={read} stop={stop} />);
  const answer = screen.getByRole("textbox");
  answer.focus();
  fireEvent.keyDown(answer, { key: "r", altKey: true });
  fireEvent.keyDown(answer, { key: "s", altKey: true });
  expect(read).not.toHaveBeenCalled();
  expect(stop).toHaveBeenCalledOnce();
  expect(answer).toHaveValue("Keep this answer");
  expect(answer).toHaveFocus();
});

it("respects Audio off, dialogs, microphone recording and disabled controls", () => {
  const read = vi.fn(),
    page = vi.fn();
  const view = render(<Harness read={read} page={page} enabled={false} />);
  const key = () => fireEvent.keyDown(window, { key: "r", altKey: true });
  key();
  view.rerender(<Harness read={read} page={page} dialog />);
  key();
  view.rerender(<Harness read={read} page={page} recording />);
  key();
  view.rerender(<Harness read={read} page={page} disabled />);
  key();
  expect(read).not.toHaveBeenCalled();
  expect(page).not.toHaveBeenCalled();
});

it("supports physical keys on Hindi keyboards without intercepting AltGr or composition", () => {
  const read = vi.fn();
  render(<Harness read={read} />);
  fireEvent.keyDown(window, { key: "र", code: "KeyR", altKey: true });
  fireEvent.keyDown(window, { key: "r", altKey: true, ctrlKey: true });
  fireEvent.keyDown(window, { key: "r", altKey: true, isComposing: true });
  fireEvent.keyDown(window, { key: "r" });
  expect(read).toHaveBeenCalledOnce();
});

it("cancels speech even when no stop button is available and cleans up on unmount", () => {
  const cancel = vi.fn();
  vi.stubGlobal("speechSynthesis", { cancel });
  function OnlyListener() {
    useReadingShortcuts(true);
    return null;
  }
  const view = render(<OnlyListener />);
  fireEvent.keyDown(window, { key: "s", altKey: true });
  expect(cancel).toHaveBeenCalledOnce();
  view.unmount();
  fireEvent.keyDown(window, { key: "s", altKey: true });
  expect(cancel).toHaveBeenCalledOnce();
});

it("starts and stops the real audio controls through the shortcut handler", () => {
  const speak = vi.fn(),
    cancel = vi.fn();
  vi.stubGlobal("speechSynthesis", {
    speak,
    cancel,
    getVoices: () => [{ lang: "en-IN" }],
  });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class {
      constructor(public text: string) {}
    },
  );
  function Practice() {
    useReadingShortcuts(true);
    return (
      <main>
        <ExamControls text="Current question" value="" onChange={() => {}} />
      </main>
    );
  }
  render(<Practice />);
  fireEvent.keyDown(window, { key: "r", altKey: true });
  expect(speak.mock.calls[0][0].text).toBe("Current question");
  expect(screen.getByRole("button", { name: "Stop reading" })).toBeEnabled();
  fireEvent.keyDown(window, { key: "s", altKey: true });
  expect(cancel).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Stop reading" })).toBeDisabled();
});
