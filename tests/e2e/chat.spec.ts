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

test("le champ de connexion est immédiatement utilisable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByPlaceholder("Mot de passe")).toBeEnabled({
    timeout: 300,
  });
});

test("l'envoi est optimiste et affiche la date complete", async ({ page }) => {
  await mockChat(page, 1_500);
  await login(page);

  await expect(page.getByText("05/08/2026 à 15:20")).toBeVisible();

  const composer = page.getByPlaceholder("Message...");
  await composer.fill("Message instantané");
  await page.locator("form").last().locator('button[type="submit"]').click();

  await expect(composer).toHaveValue("", { timeout: 300 });
  await expect(page.getByText("Message instantané")).toBeVisible({
    timeout: 300,
  });
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 768, height: 1_024 },
]) {
  test(`le chat ne deborde pas a ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockChat(page, 0);
    await login(page);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).not.toHaveAttribute(
      "content",
      /user-scalable=no|maximum-scale=1/,
    );
  });
}

test("l'ecran de connexion respecte les controles WCAG automatisables", async ({
  page,
}) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("la conversation respecte les controles WCAG automatisables", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await mockChat(page, 0);
  await login(page);
  await page.waitForTimeout(100);
  expect(browserErrors).toEqual([]);

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
  await page.route("**/api/auth", (route) =>
    route.fulfill({
      status: 200,
      json: { userId: 1, label: "Utilisateur 1" },
    }),
  );
  await page.route("**/api/presence", (route) =>
    route.fulfill({ status: 200, json: { ok: true } }),
  );
  await page.route("**/api/messages/stream*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `event: messages\ndata: ${JSON.stringify({ messages: [initialMessage], hasMore: false })}\n\n`,
    }),
  );
  await page.route("**/api/messages", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    if (postDelayMs > 0)
      await new Promise((resolve) => setTimeout(resolve, postDelayMs));
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

test("les pages et API privées refusent l'indexation", async ({ request }) => {
  const pageResponse = await request.get("/");
  const apiResponse = await request.get("/api/messages");
  const robotsResponse = await request.get("/robots.txt");
  const robotsBody = await robotsResponse.text();
  const expectedPolicy =
    "noindex, nofollow, noarchive, nosnippet, noimageindex";

  expect(pageResponse.headers()["x-robots-tag"]).toBe(expectedPolicy);
  expect(apiResponse.headers()["x-robots-tag"]).toBe(expectedPolicy);
  expect(apiResponse.headers()["cache-control"]).toContain("no-store");
  for (const crawler of [
    "GPTBot",
    "Google-Extended",
    "ClaudeBot",
    "CCBot",
    "Applebot-Extended",
    "Meta-ExternalAgent",
  ]) {
    const crawlerBlock = robotsBody
      .split(/\r?\n\r?\n/)
      .find((block) => block.includes(`User-Agent: ${crawler}`));
    expect(crawlerBlock).toContain("Disallow: /");
  }
});
