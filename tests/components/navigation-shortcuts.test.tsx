import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LearningNavigation } from "../../src/components/learning-navigation";
import { LanguageProvider } from "../../src/components/language";
import { defaultPreferences } from "../../src/lib/types";
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));
it("toggles navigation shortcuts with Alt+X even when off, but not while typing", () => {
  localStorage.clear();
  vi.stubGlobal("speechSynthesis", {
    cancel: vi.fn(), getVoices: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  render(
    <LanguageProvider>
      <LearningNavigation prefs={defaultPreferences} onPreferences={vi.fn()} />
      <input aria-label="Answer" />
    </LanguageProvider>,
  );
  const button = screen.getByRole("button", { name: /Shortcuts off/i });
  expect(button).toHaveAttribute("aria-pressed", "false");
  fireEvent.keyDown(window, { key: "x", code: "KeyX", altKey: true });
  expect(button).toHaveAttribute("aria-pressed", "true");
  fireEvent.keyDown(screen.getByRole("textbox"), {
    key: "x",
    code: "KeyX",
    altKey: true,
  });
  expect(button).toHaveAttribute("aria-pressed", "true");
  fireEvent.keyDown(window, { key: "x", code: "KeyX", altKey: true });
  expect(button).toHaveAttribute("aria-pressed", "false");
});

