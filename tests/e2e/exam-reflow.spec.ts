import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

test("exam reflows with 200 percent text and high contrast on mobile", async ({
  page,
}) => {
  await page.request.post("/api/login", { data: { id: "candidate-two" } });
  await page.request.put("/api/preferences", {
    data: {
      contrast: true,
      scale: 200,
      tts: true,
      rate: 1,
      reducedMotion: true,
      shortcuts: false,
      setup: true,
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/instructions/numerical-mock");
  await page.getByRole("button", { name: "Start exam", exact: true }).click();
  await expect(page.locator("#question-heading")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("radio").nth(1).check();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({ path: "../../work/mobile-exam.png", fullPage: true });
  await page
    .getByRole("button", { name: "Review & submit", exact: true })
    .click();
  await page.getByRole("button", { name: "Submit exam", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(
    page.getByRole("heading", { name: "Examination result" }),
  ).toBeVisible();
});

test("the visible deadline automatically submits an open exam", async ({
  page,
}) => {
  await page.request.post("/api/login", { data: { id: "candidate-two" } });
  const attempt = await (
    await page.request.post("/api/attempts", {
      data: { examId: "general-aptitude" },
    })
  ).json();
  const db = new DatabaseSync(
    process.env.AURA_TEST_DB || resolve("../../work/qa.sqlite"),
  );
  const row = db
    .prepare("SELECT data FROM attempts WHERE id=?")
    .get(attempt.id) as { data: string };
  const data = JSON.parse(row.data);
  data.deadline = Date.now() + 7000;
  db.prepare("UPDATE attempts SET data=? WHERE id=?").run(
    JSON.stringify(data),
    attempt.id,
  );
  db.close();
  await page.goto(`/exam/${attempt.id}`);
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Examination result" }),
  ).toBeVisible({ timeout: 20000 });
  const result = await (
    await page.request.get(`/api/attempts/${attempt.id}/result`)
  ).json();
  expect(result.status).toBe("evaluated");
  expect(result.unanswered).toBe(8);
});
