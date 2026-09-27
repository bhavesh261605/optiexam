import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing, registration, profile persistence and returning login", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your next exam/ }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "../../work/optiexam-landing.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Create your account", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Kavya Iyer");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("kavya@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("my accessible practice account");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Examinations", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Profile & account", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("Kavya Rao");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your profile has been saved.",
  );
  await page.reload();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Kavya Rao",
  );
  await expect(
    page.getByText("kavya@example.test", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "../../work/optiexam-profile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .last()
    .click();
  await page.goto("/login");
  await page
    .getByLabel("Email address", { exact: true })
    .fill("kavya@example.test");
  await page.getByLabel("Password", { exact: true }).fill("incorrect password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByText("Email or password is incorrect.", { exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Password", { exact: true })
    .fill("my accessible practice account");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Examinations", exact: true }),
  ).toBeVisible();
  const me = await (await page.request.get("/api/me")).json();
  expect(me.user.name).toBe("Kavya Rao");
  expect(me.user.role).toBe("candidate");
  expect((await page.request.get("/api/admin")).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/login", { data: { id: me.user.id } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/register", {
        data: {
          name: "Kavya",
          email: "KAVYA@example.test",
          password: "my accessible practice account",
        },
      })
    ).status(),
  ).toBe(409);
});

test("public forms reflow at 200 percent and high contrast", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await page.getByLabel("High contrast", { exact: true }).check();
  await page.getByLabel("Text size", { exact: true }).selectOption("200");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "../../work/optiexam-signup-mobile.png",
    fullPage: true,
  });
});
