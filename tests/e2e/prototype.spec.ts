import {
  test,
  expect,
  type Page,
  type Locator,
  request,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

async function tabTo(page: Page, locator: Locator) {
  for (let i = 0; i < 100; i++) {
    if (await locator.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Could not reach control with Tab");
}
async function activate(page: Page, locator: Locator) {
  await tabTo(page, locator);
  await page.keyboard.press("Enter");
}
async function accessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      description: v.description,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}

test("keyboard candidate flow, autosave recovery, results, and accessibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Candidate workspace" }).waitFor();
  await accessible(page);
  await activate(
    page,
    page.getByRole("button", { name: "Candidate workspace" }),
  );
  await expect(
    page.getByRole("heading", { name: "Your exam, your way" }),
  ).toBeVisible();
  await activate(page, page.getByRole("button", { name: "Save preferences" }));
  await expect(
    page.getByRole("heading", { name: "Examinations", exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.screenshot({ path: "../../work/dashboard.png", fullPage: true });
  await activate(page, page.getByRole("link", { name: "View instructions" }));
  await expect(
    page.getByRole("button", { name: "Start exam", exact: true }),
  ).toBeVisible();
  await accessible(page);
  await activate(
    page,
    page.getByRole("button", { name: "Start exam", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: /A train travels/ }),
  ).toBeVisible();
  const attemptId = page.url().split("/").pop()!;
  await accessible(page);
  await page.screenshot({ path: "../../work/exam.png", fullPage: true });
  const radios = page.getByRole("radio");
  await tabTo(page, radios.first());
  await page.keyboard.press("ArrowDown");
  await expect(radios.nth(1)).toBeChecked();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await activate(page, page.getByRole("button", { name: "Next question" }));
  await expect(page.locator("#question-heading")).toBeFocused();
  await tabTo(page, radios.first());
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowUp");
  // Native radio groups wrap with arrows. Explicitly step from the selected item to option D.
  if (!(await radios.nth(3).isChecked())) {
    for (let i = 0; i < 4 && !(await radios.nth(3).isChecked()); i++)
      await page.keyboard.press("ArrowDown");
  }
  await expect(radios.nth(3)).toBeChecked();
  await activate(
    page,
    page.getByRole("button", { name: "Mark for review", exact: true }),
  );
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Question 2, answered, marked for review",
      exact: true,
    }),
  ).toBeVisible();
  await activate(
    page,
    page.getByRole("button", { name: "Question 3, unanswered", exact: true }),
  );
  await page.route("**/api/attempts/*/responses/*", (route) =>
    route.abort("failed"),
  );
  await tabTo(page, radios.first());
  await page.keyboard.press("Space");
  await expect(
    page.getByText("Not saved — retrying. Keep this page open."),
  ).toBeVisible();
  await page.reload();
  await activate(
    page,
    page.getByRole("button", { name: "Question 3, answered", exact: true }),
  );
  await expect(radios.first()).toBeChecked();
  await page.unroute("**/api/attempts/*/responses/*");
  await activate(page, page.getByRole("button", { name: "Retry now" }));
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  const expected = [2, 2, 1, 2, 1];
  for (let j = 0; j < expected.length; j++) {
    await activate(page, page.getByRole("button", { name: "Next question" }));
    await tabTo(page, radios.first());
    await page.keyboard.press("Space");
    for (let k = 0; k < expected[j]; k++)
      await page.keyboard.press("ArrowDown");
    await expect(radios.nth(expected[j])).toBeChecked();
    await expect(
      page.getByText("All changes saved", { exact: true }),
    ).toBeVisible();
  }
  await activate(
    page,
    page.getByRole("button", { name: "Review answers", exact: true }),
  );
  await expect(
    page.getByRole("heading", { name: "Review your answers" }),
  ).toBeFocused();
  await accessible(page);
  await activate(
    page,
    page.getByRole("button", { name: "Submit exam", exact: true }),
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await accessible(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Submit exam", exact: true }),
  ).toBeFocused();
  await activate(
    page,
    page.getByRole("button", { name: "Submit exam", exact: true }),
  );
  await activate(
    page,
    page.getByRole("button", { name: "Confirm submission" }),
  );
  await expect(
    page.getByRole("heading", { name: "Examination result" }),
  ).toBeVisible();
  await accessible(page);
  const result = await (
    await page.request.get(`/api/attempts/${attemptId}/result`)
  ).json();
  expect(result.score).toBe(8);
  expect(result.correct).toBe(8);
  await page.screenshot({ path: "../../work/result.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("admin creates a question, publishes an assigned exam, and inspects results", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Administrator demo", { exact: true }).click();
  await page.getByRole("button", { name: "Administrator workspace" }).click();
  await page.getByRole("link", { name: "Question bank", exact: true }).click();
  await page.getByRole("button", { name: "New question" }).click();
  await page.getByLabel("Question text").fill("What is five plus five?");
  await page.getByLabel("Topic", { exact: true }).fill("Arithmetic");
  for (let i = 0; i < 4; i++)
    await page
      .getByLabel(`Option ${String.fromCharCode(65 + i)}`, { exact: true })
      .fill(["8", "9", "10", "11"][i]);
  await page.getByLabel("Correct answer").selectOption("2");
  await accessible(page);
  await page
    .getByRole("button", { name: "Save question", exact: true })
    .click();
  await expect(
    page.getByText("Question saved.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Exams & assignments", exact: true })
    .click();
  await page.getByRole("button", { name: "Create exam" }).click();
  await page.getByLabel("Exam title").fill("Arithmetic QA Assessment");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A test assessment created through the admin interface.");
  await page
    .getByRole("checkbox", { name: "What is five plus five?", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Aarav Sharma", exact: true })
    .check();
  await page.getByLabel("Publication status").selectOption("published");
  await page.getByRole("button", { name: "Save exam & assignments" }).click();
  await expect(
    page.getByRole("heading", { name: "Arithmetic QA Assessment" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Candidate results", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "8 / 8", exact: true }),
  ).toBeVisible();
  await accessible(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Candidate workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Arithmetic QA Assessment" }),
  ).toBeVisible();
});

test("mobile, 200 percent text, high contrast, and dialog focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Candidate workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Examinations", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Accessibility", exact: true })
    .click();
  await page.getByLabel("Text size").selectOption("200");
  await page.getByLabel("High contrast", { exact: false }).check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await accessible(page);
  await page.screenshot({
    path: "../../work/mobile-high-contrast.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  await page
    .getByRole("button", { name: "Accessibility", exact: true })
    .click();
  await page.getByLabel("Text size").selectOption("100");
  await page.getByLabel("High contrast", { exact: false }).uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
});

test("API enforces ownership, role, snapshot, expiry, and idempotent submission", async () => {
  const baseURL = process.env.AURA_TEST_URL || "http://127.0.0.1:3100";
  const admin = await request.newContext({ baseURL });
  const a = await request.newContext({ baseURL });
  const b = await request.newContext({ baseURL });
  await admin.post("/api/login", { data: { id: "admin-demo" } });
  await a.post("/api/login", { data: { id: "candidate-demo" } });
  await b.post("/api/login", { data: { id: "candidate-two" } });
  expect((await a.get("/api/admin")).status()).toBe(403);
  const question = await (
    await admin.post("/api/admin/questions", {
      data: {
        prompt: "Integration test: choose two.",
        options: ["One", "Two", "Three", "Four"],
        correct: 1,
        topic: "Test",
        marks: 3,
        alternative: "",
      },
    })
  ).json();
  const exam = await (
    await admin.post("/api/admin/exams", {
      data: {
        title: "API QA exam",
        description: "Test only",
        duration: 1,
        kind: "assigned",
        status: "published",
        questionIds: [question.id],
        assigned: ["candidate-demo"],
      },
    })
  ).json();
  expect(
    (await b.post("/api/attempts", { data: { examId: exam.id } })).status(),
  ).toBe(404);
  const started = await (
    await a.post("/api/attempts", { data: { examId: exam.id } })
  ).json();
  expect(JSON.stringify(started)).not.toContain('"correct"');
  expect((await b.get(`/api/attempts/${started.id}`)).status()).toBe(404);
  expect((await b.post(`/api/attempts/${started.id}/submit`)).status()).toBe(
    404,
  );
  await admin.post("/api/admin/questions", {
    data: { ...question, prompt: "This is an edited question.", correct: 0 },
  });
  const snapshot = await (await a.get(`/api/attempts/${started.id}`)).json();
  expect(snapshot.questions[0].prompt).toBe("Integration test: choose two.");
  expect(
    (
      await a.put(`/api/attempts/${started.id}/responses/${question.id}`, {
        data: { answer: 9, review: false },
      })
    ).status(),
  ).toBe(400);
  await a.put(`/api/attempts/${started.id}/responses/${question.id}`, {
    data: { answer: 1, review: false },
  });
  const first = await (
    await a.post(`/api/attempts/${started.id}/submit`)
  ).json();
  const second = await (
    await a.post(`/api/attempts/${started.id}/submit`)
  ).json();
  expect(first.score).toBe(3);
  expect(second.submittedAt).toBe(first.submittedAt);
  const late = await (
    await a.put(`/api/attempts/${started.id}/responses/${question.id}`, {
      data: { answer: 0, review: false },
    })
  ).json();
  expect(late.closed).toBe(true);
  const timed = await (
    await a.post("/api/attempts", { data: { examId: "reasoning-practice" } })
  ).json();
  const db = new DatabaseSync(
    process.env.AURA_TEST_DB || resolve("../../work/qa.sqlite"),
  );
  const row = db
    .prepare("SELECT data FROM attempts WHERE id=?")
    .get(timed.id) as { data: string };
  const raw = JSON.parse(row.data);
  raw.deadline = Date.now() - 1000;
  db.prepare("UPDATE attempts SET data=? WHERE id=?").run(
    JSON.stringify(raw),
    timed.id,
  );
  db.close();
  const expired = await (
    await a.put(`/api/attempts/${timed.id}/responses/q2`, {
      data: { answer: 3, review: false },
    })
  ).json();
  expect(expired.closed).toBe(true);
  const expiredResult = await (
    await a.get(`/api/attempts/${timed.id}/result`)
  ).json();
  expect(expiredResult.score).toBe(0);
  expect(expiredResult.status).toBe("evaluated");
  await admin.dispose();
  await a.dispose();
  await b.dispose();
});
