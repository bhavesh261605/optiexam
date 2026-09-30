import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ExamControls } from "../../src/components/ExamControls";
import { VoiceAuth } from "../../src/components/VoiceAuth";
import {
  AccessibleChart,
  AccessibleEquation,
} from "../../src/components/AccessibleContent";
import { ExamGuard } from "../../src/components/ExamGuard";

function microphone() {
  const stop = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }),
    },
  });
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    state = "inactive";
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({
        data: new Blob(["sample"], { type: "audio/webm" }),
      });
      this.onstop?.();
    }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  return stop;
}

describe("audio controls", () => {
  it("keeps dictation separate until candidate reviews and adds it", async () => {
    const stop = microphone();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          json: async () => ({ text: "Recognized answer" }),
        }),
    );
    const change = vi.fn();
    render(
      <ExamControls text="Question" value="Existing draft" onChange={change} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dictate an answer" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Stop dictation" }),
    );
    expect(await screen.findByLabelText("Review recognized text")).toHaveValue(
      "Recognized answer",
    );
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Add transcript to answer" }),
    );
    expect(change).toHaveBeenCalledWith("Existing draft\nRecognized answer");
    expect(stop).toHaveBeenCalled();
  });
  it("preserves existing answer on a network failure", async () => {
    microphone();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Connection lost")),
    );
    const change = vi.fn();
    render(<ExamControls text="Question" value="Keep me" onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Dictate an answer" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Stop dictation" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection lost",
    );
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Your answer")).toHaveValue("Keep me");
  });
  it("handles unavailable microphone and keeps keyboard input", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    render(<ExamControls text="Question" value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Dictate an answer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable");
    expect(screen.getByLabelText("Your answer")).toBeEnabled();
  });
  it("enrolls exactly three samples with consent and a challenge", async () => {
    microphone();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          challenge_id: "fresh",
          phrases: ["first phrase", "second phrase", "third phrase"],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enrolled: true }),
      });
    vi.stubGlobal("fetch", fetch);
    render(<VoiceAuth mode="enroll" accountId="candidate-a" />);
    expect(
      screen.getByRole("button", { name: "Get a voice challenge" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Get a voice challenge" }),
    );
    for (let index = 1; index <= 3; index++) {
      fireEvent.click(
        await screen.findByRole("button", {
          name: `Record sample ${index} of 3`,
        }),
      );
      fireEvent.click(
        await screen.findByRole("button", { name: "Stop recording" }),
      );
    }
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const form = fetch.mock.calls[1][1].body as FormData;
    expect(form.getAll("files")).toHaveLength(3);
    expect(form.get("consent")).toBe("true");
    expect(await screen.findByText(/Voice profile enrolled/)).toBeVisible();
  });
  it("stops microphone tracks on unmount", async () => {
    const stop = microphone();
    const { unmount } = render(
      <ExamControls text="Question" value="" onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dictate an answer" }));
    await screen.findByRole("button", { name: "Stop dictation" });
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});

it("renders structural math and associated chart table headers", () => {
  const { container } = render(
    <>
      <AccessibleEquation
        description="One half"
        equation={{
          tag: "mfrac",
          children: [
            { tag: "mn", text: "1" },
            { tag: "mn", text: "2" },
          ],
        }}
      />
      <AccessibleChart
        title="Books"
        description="Monthly totals"
        columns={["Month", "Count"]}
        rows={[["January", 40]]}
      />
    </>,
  );
  expect(container.querySelector("math mfrac")?.namespaceURI).toBe(
    "http://www.w3.org/1998/Math/MathML",
  );
  expect(screen.getByRole("columnheader", { name: "Count" })).toHaveAttribute(
    "scope",
    "col",
  );
  expect(screen.getByRole("rowheader", { name: "January" })).toHaveAttribute(
    "scope",
    "row",
  );
});

it("exam guard releases containment with Escape and permits answer-field clipboard", () => {
  render(
    <ExamGuard>
      <textarea aria-label="Answer" />
    </ExamGuard>,
  );
  const contain = screen.getByRole("checkbox", { name: /Keep Tab/ });
  fireEvent.click(contain);
  expect(contain).toBeChecked();
  fireEvent.keyDown(contain, { key: "Escape" });
  expect(contain).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: /Protect copying/ }));
  const event = new Event("paste", { bubbles: true, cancelable: true });
  screen.getByLabelText("Answer").dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
