import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const initialMessage = {
  id: 1,
  sender_id: 2,
  content: "Message existant",
  media: null,
  media_type: null,
  is_read: false,
  created_at: "2026-08-05T13:20:00Z",
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

test("l'onglet masqué suspend la présence et la reconnexion du flux", async ({
  page,
}) => {
  await page.clock.install();
  await mockChat(page, 0);
  const visibilityUpdates: boolean[] = [];
  let streamRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/presence")) {
      visibilityUpdates.push(request.postDataJSON().isTabVisible);
    }
    if (request.url().endsWith("/api/messages/stream")) streamRequests++;
  });
  await login(page);
  await expect(page.getByText(initialMessage.content)).toBeVisible();
  await expect.poll(() => visibilityUpdates).toEqual([true]);

  await setChatVisibility(page, "hidden");
  await expect.poll(() => visibilityUpdates).toEqual([true, false]);
  const streamRequestsAtHide = streamRequests;
  await page.clock.fastForward(21_000);
  expect(visibilityUpdates).toEqual([true, false]);
  expect(streamRequests).toBe(streamRequestsAtHide);

  await setChatVisibility(page, "visible");
  await expect.poll(() => visibilityUpdates).toEqual([true, false, true]);
  await expect.poll(() => streamRequests).toBeGreaterThan(streamRequestsAtHide);
});

test("une session expirée arrête le trafic et revient à la connexion", async ({
  page,
}) => {
  await page.clock.install();
  await mockChat(page, 0);
  let presenceRequests = 0;
  let streamRequests = 0;
  await page.route("**/api/presence", (route) => {
    presenceRequests++;
    return route.fulfill({ status: 401, json: { error: "Non autorisé" } });
  });
  page.on("request", (request) => {
    if (request.url().endsWith("/api/messages/stream")) streamRequests++;
  });
  await page.goto("/");
  await page.getByPlaceholder("Mot de passe").fill("correct-password");
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(
    page.getByText("Ta session a expiré. Reconnecte-toi."),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Mot de passe")).toBeVisible();

  const streamRequestsAtExpiry = streamRequests;
  await page.clock.fastForward(31_000);
  expect(presenceRequests).toBe(1);
  expect(streamRequests).toBe(streamRequestsAtExpiry);
});

async function setChatVisibility(
  page: Page,
  visibility: DocumentVisibilityState,
) {
  await page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, visibility);
}

test("un retour arrière après avoir quitté demande une nouvelle connexion", async ({
  page,
}) => {
  await mockChat(page, 0);
  await page.route("**/api/disconnect", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await login(page);
  await expect(page.getByText(initialMessage.content)).toBeVisible();

  const disconnect = page.waitForRequest("**/api/disconnect");
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    ),
  );
  await disconnect;
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );

  await expect(page.getByPlaceholder("Mot de passe")).toBeVisible();
  await expect(page.getByText(initialMessage.content)).toHaveCount(0);
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
          created_at: "2026-08-05T13:21:00Z",
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
  expect(pageResponse.headers()["content-security-policy"]).toMatch(
    /'nonce-[^']+' 'strict-dynamic'/,
  );
  expect(robotsResponse.headers()["x-robots-tag"]).toBe(expectedPolicy);
  expect(robotsResponse.headers()["content-security-policy"]).toBeUndefined();
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
