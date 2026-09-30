import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  VoiceCommands,
  parseVoiceCommand,
} from "../../src/components/VoiceCommands";
import { LanguageProvider } from "../../src/components/language";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push }),
}));
it("matches explicit bilingual commands without navigating on unrelated sentences", () => {
  expect(parseVoiceCommand("पैक्टिस।")).toBe("practice");
  expect(parseVoiceCommand("प्रैक्टिस")).toBe("practice");
  expect(parseVoiceCommand("होम")).toBe("home");
  expect(parseVoiceCommand("तैयारी")).toBe("prepare");
  expect(parseVoiceCommand("Read.")).toBe("read");
  expect(parseVoiceCommand("I practice at home")).toBeNull();
});
it("starts only on opt-in, configures continuous recognition and navigates once per final result", () => {
  let instance: any;
  class MockRecognition {
    start = vi.fn();
    abort = vi.fn();
    onresult: any;
    onerror: any;
    constructor() {
      instance = this;
    }
  }
  vi.stubGlobal("SpeechRecognition", MockRecognition);
  const view = render(
    <LanguageProvider>
      <VoiceCommands />
    </LanguageProvider>,
  );
  expect(instance).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: /Voice commands/ }));
  expect(instance.lang).toBe("en-IN");
  expect(instance.continuous).toBe(true);
  fireEvent(window, new Event("focus"));
  instance.onresult({
    resultIndex: 0,
    results: [{ isFinal: true, 0: { transcript: "Practice" } }],
  });
  expect(push).toHaveBeenCalledWith("/practice");
  view.unmount();
  expect(instance.abort).toHaveBeenCalled();
  expect(instance.onresult).toBeNull();
});
it("shows unsupported browsers without requesting a microphone", () => {
  render(
    <LanguageProvider>
      <VoiceCommands />
    </LanguageProvider>,
  );
  expect(screen.getByRole("button", { name: /Voice commands/ })).toBeDisabled();
});
