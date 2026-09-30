import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider, useLanguage } from "../../src/components/language";
import { AudioPractice } from "../../src/components/AudioPractice";
import { translate, configureVoice } from "../../src/lib/i18n";

function ChooseLanguage() {
  const { setLanguage } = useLanguage();
  return (
    <>
      <button onClick={() => setLanguage("hi")}>Hindi</button>
      <button onClick={() => setLanguage("en")}>English</button>
    </>
  );
}

describe("Hindi text and audio", () => {
  it("switches text, accessible names and document language without changing an answer", async () => {
    render(
      <LanguageProvider>
        <ChooseLanguage />
        <AudioPractice userId="hindi-test" audioEnabled />
      </LanguageProvider>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), {
      target: { value: "मेरा उत्तर 165 है। My original answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Hindi" }));
    await waitFor(() => expect(document.documentElement.lang).toBe("hi"));
    expect(
      screen.getByRole("heading", { name: "ऑडियो और सुलभ सामग्री प्रयोगशाला" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "प्रश्न सुनें या दोबारा चलाएँ" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "आपका उत्तर" })).toHaveValue(
      "मेरा उत्तर 165 है। My original answer.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "English" }),
    );
    expect(screen.getByRole("textbox", { name: "Your answer" })).toHaveValue(
      "मेरा उत्तर 165 है। My original answer.",
    );
  });

  it("selects a Hindi voice and reads the translated question", () => {
    const hindiVoice = { lang: "hi-IN", name: "Hindi" };
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      cancel: vi.fn(),
      getVoices: () => [hindiVoice],
      speak,
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    );
    render(
      <LanguageProvider>
        <ChooseLanguage />
        <AudioPractice userId="hindi-tts" audioEnabled />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hindi" }));
    fireEvent.click(
      screen.getByRole("button", { name: "प्रश्न सुनें या दोबारा चलाएँ" }),
    );
    expect(speak).toHaveBeenCalledOnce();
    const utterance = speak.mock.calls[0][0];
    expect(utterance.lang).toBe("hi-IN");
    expect(utterance.voice).toBe(hindiVoice);
    expect(utterance.text).toContain("जनवरी: 40 पुस्तकें");
  });

  it("reports a missing Hindi voice rather than choosing an English voice", () => {
    vi.stubGlobal("speechSynthesis", { getVoices: () => [{ lang: "en-US" }] });
    expect(() => configureVoice({} as SpeechSynthesisUtterance, "hi")).toThrow(
      "हिंदी आवाज़ उपलब्ध नहीं",
    );
  });

  it("preserves English test options and unknown authored content", () => {
    expect(translate("She has completed the test.", "hi")).toBe(
      "She has completed the test.",
    );
    expect(translate("A newly authored question", "hi")).toBe(
      "A newly authored question",
    );
    expect(translate("QUESTION 01 OF 08", "hi")).toBe("प्रश्न 01, कुल 08");
    expect(translate("Your answer", "en")).toBe("Your answer");
  });
});
