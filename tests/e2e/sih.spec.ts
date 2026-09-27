import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("access lab is repeatable, persists familiarization, and never creates an attempt", async ({
  page,
}) => {
  await page.request.post("/api/login", { data: { id: "candidate-demo" } });
  const before = await (await page.request.get("/api/exams")).json();
  await page.goto("/access-lab");
  await expect(
    page.getByRole("heading", { name: "Get comfortable before it counts." }),
  ).toBeVisible();
  await page.getByRole("radio").first().check();
  await page
    .getByRole("button", { name: "Next question", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark for review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review practice", exact: true })
    .click();
  await page.getByRole("button", { name: "Finish familiarization" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Finish familiarization" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Finish familiarization" }).click();
  await page
    .getByRole("button", { name: "Confirm practice completion" })
    .click();
  await expect(
    page.getByRole("heading", { name: "You’ve explored the exam controls." }),
  ).toBeVisible();
  const after = await (await page.request.get("/api/exams")).json();
  expect(after.filter((e: any) => e.attempt).length).toBe(
    before.filter((e: any) => e.attempt).length,
  );
  expect(
    (await (await page.request.get("/api/me")).json()).preferences
      .orientationCompleted,
  ).toBe(true);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("radio")).toHaveCount(3);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({ path: "../../work/sih-lab.png", fullPage: true });
});

test("accommodations, random order, contextual analytics, and feedback respect ownership", async ({
  page,
  playwright,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  await admin.post("/api/login", { data: { id: "admin-demo" } });
  const exam = await (
    await admin.post("/api/admin/exams", {
      data: {
        title: "SIH access assessment",
        description: "QA scenario",
        duration: 10,
        kind: "assigned",
        status: "published",
        questionIds: ["q1", "q2", "q3"],
        assigned: ["candidate-demo", "candidate-two"],
        extraMinutes: { "candidate-demo": 5, "candidate-two": 10 },
        shuffleQuestions: true,
      },
    })
  ).json();
  expect(exam.id).toBeTruthy();
  await page.request.post("/api/login", { data: { id: "candidate-demo" } });
  const available = await (await page.request.get("/api/exams")).json();
  expect(available.find((e: any) => e.id === exam.id).extraMinutes).toEqual({
    "candidate-demo": 5,
  });
  const a = await (
    await page.request.post("/api/attempts", {
      data: { examId: exam.id, extraMinutes: 999 },
    })
  ).json();
  expect(a.deadline - a.startedAt).toBe(15 * 60000);
  expect(a.extraMinutes).toBe(5);
  expect(a.questions.map((q: any) => q.id).sort()).toEqual(["q1", "q2", "q3"]);
  expect(JSON.stringify(a)).not.toContain('"correct"');
  await admin.post("/api/admin/exams", {
    data: { ...exam, extraMinutes: { "candidate-demo": 100 } },
  });
  const restored = await (
    await page.request.get(`/api/attempts/${a.id}`)
  ).json();
  expect(restored.deadline).toBe(a.deadline);
  expect(restored.questions.map((q: any) => q.id)).toEqual(
    a.questions.map((q: any) => q.id),
  );
  const endpoint = `/api/attempts/${a.id}/responses/q1`;
  await page.request.put(endpoint, { data: { answer: 0, review: true } });
  await page.request.put(endpoint, { data: { answer: 1, review: false } });
  await page.request.put(endpoint, { data: { answer: 1, review: false } });
  await page.request.post(`/api/attempts/${a.id}/submit`);
  await page.goto(`/results/${a.id}`);
  await expect(
    page.getByRole("heading", { name: "Your assessment experience" }),
  ).toBeVisible();
  await page
    .getByLabel("Could you navigate independently?")
    .selectOption("some-help");
  await page
    .getByRole("checkbox", { name: "Finding or moving between controls" })
    .check();
  await page.getByRole("button", { name: "Share access feedback" }).click();
  await expect(
    page.getByText("Feedback saved. Your exam score is unchanged."),
  ).toBeVisible();
  const result = await (
    await page.request.get(`/api/attempts/${a.id}/result`)
  ).json();
  expect(result.score).toBe(1);
  expect(result.answerChanges).toBe(1);
  expect(result.reviewHistory).toEqual(["q1"]);
  expect(result.feedback.navigation).toBe("some-help");
  const other = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  await other.post("/api/login", { data: { id: "candidate-two" } });
  expect(
    (
      await other.put(`/api/attempts/${a.id}/feedback`, {
        data: { navigation: "independent", barriers: [] },
      })
    ).status(),
  ).toBe(404);
  const overview = await (await admin.get("/api/admin")).json();
  expect(
    overview.results.find((r: any) => r.id === a.id).feedback.barriers,
  ).toEqual(["navigation"]);
  await page
    .getByRole("link", { name: "Learning insights", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Progress that respects your pace." }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "SIH access assessment" }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: "../../work/sih-insights.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Accessibility", exact: true })
    .click();
  await page.getByLabel("Text size").selectOption("200");
  await page.getByLabel("High contrast", { exact: false }).check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-large-text", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const high = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    high.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await admin.dispose();
  await other.dispose();
});
