import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const initialMessage = {
  id: 1,
  sender_id: 2,
  content: "Message existant",
  media: null,
  media_type: null,
  is_read: false,
  created_at: "2026-08-05T15:20:00",
  reply_to: null,
  edited: false,
};

test("le champ de connexion est utilisable sans attendre l'initialisation", async ({ page }) => {
  await page.route("**/api/init", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({ status: 200, json: { ok: true } });
  });

  await page.goto("/");

  await expect(page.getByPlaceholder("Mot de passe")).toBeEnabled({ timeout: 300 });
});

test("l'envoi est optimiste et affiche la date complete", async ({ page }) => {
  await mockChat(page, 1_500);
  await login(page);

  await expect(page.getByText("05/08/2026 à 15:20")).toBeVisible();

  const composer = page.getByPlaceholder("Message...");
  await composer.fill("Message instantané");
  await page.locator('form').last().locator('button[type="submit"]').click();

  await expect(composer).toHaveValue("", { timeout: 300 });
  await expect(page.getByText("Message instantané")).toBeVisible({ timeout: 300 });
});

test("le chat ne deborde pas sur un petit mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockChat(page, 0);
  await login(page);

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

  const viewport = page.locator('meta[name="viewport"]');
  await expect(viewport).not.toHaveAttribute("content", /user-scalable=no|maximum-scale=1/);
});

test("l'ecran de connexion respecte les controles WCAG automatisables", async ({ page }) => {
  await page.route("**/api/init", (route) => route.fulfill({ status: 200, json: { ok: true } }));
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

async function login(page: Page) {
  await page.goto("/");
  await page.getByPlaceholder("Mot de passe").fill("correct-password");
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page.getByPlaceholder("Message...")).toBeVisible();
}

async function mockChat(page: Page, postDelayMs: number) {
  await page.route("**/api/init", (route) => route.fulfill({ status: 200, json: { ok: true } }));
  await page.route("**/api/auth", (route) => route.fulfill({
    status: 200,
    json: { userId: 1, label: "Utilisateur 1", token: "test-token" },
  }));
  await page.route("**/api/presence", (route) => route.fulfill({ status: 200, json: { ok: true } }));
  await page.route("**/api/messages/stream*", (route) => route.fulfill({
    status: 200,
    contentType: "text/event-stream",
    body: `event: messages\ndata: ${JSON.stringify({ messages: [initialMessage], hasMore: false })}\n\n`,
  }));
  await page.route("**/api/messages", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    if (postDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, postDelayMs));
    const requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      json: {
        message: {
          ...initialMessage,
          id: 2,
          sender_id: 1,
          content: requestBody.content,
          created_at: "2026-08-05T15:21:00",
        },
      },
    });
  });
}
