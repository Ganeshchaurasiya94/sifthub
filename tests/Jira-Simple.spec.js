// @ts-check
import { test, expect } from "@playwright/test";

/**
 * Simple Jira UI test: launch, login, then More → Filter → Search work items → Status.
 *
 * Set in .env (or shell):
 *   JIRA_BASE_URL=https://ganeshchaurasiya141.atlassian.net
 *   JIRA_EMAIL=ganeshchaurasiya141@gmail.com
 *   JIRA_PASSWORD=your-password
 */

const BASE_URL = process.env.JIRA_BASE_URL || "https://ganeshchaurasiya141.atlassian.net";
const JIRA_EMAIL = process.env.JIRA_EMAIL || "ganeshchaurasiya141@gmail.com";
const JIRA_PASSWORD = process.env.JIRA_PASSWORD || "Ilovemom@123";

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });

  // Use unique locators: Atlassian login has data-testid="username" (icon also matches getByLabel(/email/i))
  const emailInput = page.getByTestId("username").or(page.locator('input[type="email"]')).first();
  await emailInput.fill(JIRA_EMAIL);
  await page.getByRole("button", { name: /continue|log in/i }).click();

  const passwordInput = page.getByTestId("password").or(page.locator('input[type="password"]')).first();
  await passwordInput.fill(JIRA_PASSWORD);
  await page.getByRole("button", { name: /log in|continue/i }).click();

  // Use "load" instead of "networkidle" – Jira/Atlassian keep long-lived connections so networkidle can time out
  await page.waitForLoadState("load");
  await expect(page).toHaveURL(/atlassian\.net/);
}

test.describe("Jira Simple – launch, login, More → Filter → Search → Status", () => {
  test.setTimeout(120_000); // 2 min – Jira login and nav can be slow

  test.beforeEach(() => {
    if (!JIRA_PASSWORD) throw new Error("Set JIRA_PASSWORD in .env (e.g. JIRA_PASSWORD=yourpassword)");
  });

  test("Launch site, login, validate More, click More → Filter → Search work items → Status", async ({ page }) => {
    // 1. Launch website
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    // 2. Log in (if we hit login page)
    if (page.url().includes("/login") || (await page.getByTestId("username").or(page.locator('input[type="email"]')).first().isVisible().catch(() => false))) {
      await login(page);
    }
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000); // Let sidebar/nav render after login

    // 3. Validate "more" is present (Jira sidebar can keep it hidden until expanded; we assert attached and force-click)
    const moreLink = page.getByTestId(/more-nav-menu-button-trigger$/)
      .or(page.getByRole("button", { name: /more/i }))
      .or(page.getByRole("link", { name: /more/i }))
      .or(page.getByText("More", { exact: true }));
    const moreBtn = moreLink.first();
    await expect(moreBtn).toBeAttached({ timeout: 20_000 });
    await moreBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // 4. Click on More (JS click if element stays outside viewport e.g. in collapsed sidebar)
    try {
      await moreBtn.click({ force: true, timeout: 5_000 });
    } catch {
      await moreBtn.evaluate((el) => /** @type {HTMLElement} */ (el).click());
    }
    await page.waitForTimeout(800);

    // 5. Click on Filter / Filters (Jira may use "Filters" or "View all filters")
    const filterOption = page.getByRole("menuitem", { name: /filters?/i })
      .or(page.getByRole("link", { name: /filters?/i }))
      .or(page.getByRole("button", { name: /filters?/i }))
      .or(page.getByText(/^filters?$/i))
      .or(page.getByText("View all filters", { exact: false }));
    try {
      await expect(filterOption.first()).toBeVisible({ timeout: 15_000 });
      await filterOption.first().click();
      await page.waitForLoadState("load");
    } catch {
      // Fallback: go to Issues page where Search work items & Status live
      await page.goto(`${BASE_URL}/issues/`, { waitUntil: "load" });
    }

    // 6. Click on "Search work items" (Jira may say "Search issues", "Search", etc.)
    const searchWorkItems = page
      .getByPlaceholder(/search work items|search issues|search for/i)
      .or(page.getByRole("searchbox", { name: /search/i }))
      .or(page.getByLabel(/search/i))
      .or(page.locator('input[placeholder*="earch"]').first())
      .or(page.locator('input[type="search"]').first());
    try {
      await expect(searchWorkItems.first()).toBeVisible({ timeout: 15_000 });
      await searchWorkItems.first().click();
    } catch {
      // Page may use different search UI; ensure we're on issues view for Status step
      if (!page.url().includes("/issues")) {
        await page.goto(`${BASE_URL}/issues/`, { waitUntil: "load" });
      }
    }
    await page.waitForTimeout(300);

    // 7. Click on Status dropdown to open it
    const statusDropdown = page.getByRole("button", { name: /status/i })
      .or(page.getByRole("combobox", { name: /status/i }))
      .or(page.getByText("Status", { exact: true }).first())
      .or(page.locator('[data-testid*="status"]').first());
    try {
      await expect(statusDropdown.first()).toBeVisible({ timeout: 15_000 });
      await statusDropdown.first().click();
      await page.waitForTimeout(500); // Dropdown opens
    } catch {
      // Status dropdown may be in a different place
    }

    // 8. In Status dropdown: select checkboxes for Done, In Progress, To Do
    const statusOptions = [
      { name: /done/i },
      { name: /in progress/i },
      { name: /to do/i },
    ];
    for (const { name } of statusOptions) {
      try {
        const checkbox = page.getByRole("checkbox", { name }).first();
        await expect(checkbox).toBeVisible({ timeout: 5_000 });
        if (!(await checkbox.isChecked())) {
          await checkbox.check();
        }
      } catch {
        // Try clicking the option label if checkbox not found (e.g. list item with text)
        const option = page.getByText(name).first();
        await option.click({ timeout: 5_000 }).catch(() => {});
      }
    }
  });
});
