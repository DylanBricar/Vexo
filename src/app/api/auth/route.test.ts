import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  initDB: vi.fn(),
  verifyPassword: vi.fn(),
  checkLoginRateLimit: vi.fn(),
  clearLoginRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: mocks.sql,
  initDB: mocks.initDB,
  verifyPassword: mocks.verifyPassword,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkLoginRateLimit: mocks.checkLoginRateLimit,
  clearLoginRateLimit: mocks.clearLoginRateLimit,
}));

vi.mock("@/lib/crypto", () => ({
  generateToken: () => "1:123:signature",
  verifyToken: () => 1,
}));

describe("POST /api/auth", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.sql.mockReset().mockResolvedValue([
      { id: 1, password: "hash-1", label: "Utilisateur 1" },
      { id: 2, password: "hash-2", label: "Utilisateur 2" },
    ]);
    mocks.initDB.mockReset().mockResolvedValue(undefined);
    mocks.checkLoginRateLimit.mockReset().mockResolvedValue({ allowed: true });
    mocks.clearLoginRateLimit.mockReset().mockResolvedValue(undefined);
    mocks.verifyPassword
      .mockReset()
      .mockImplementation(async (hash: string) => hash === "hash-1");
  });

  it("place la session dans un cookie HttpOnly sans exposer le token au client", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("https://vexo.example/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "correct-password" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: 1,
      label: "Utilisateur 1",
    });
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=Strict/i);
    expect(mocks.verifyPassword).toHaveBeenCalledTimes(2);
    expect(mocks.clearLoginRateLimit).toHaveBeenCalledWith("unknown");
  });

  it("refuse une origine tierce avant tout accès à la base", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      authRequest(
        { password: "secret" },
        {
          origin: "https://evil.example",
        },
      ),
    );

    expect(response.status).toBe(403);
    expect(mocks.initDB).not.toHaveBeenCalled();
  });

  it("renvoie Retry-After lorsque la limite est atteinte", async () => {
    mocks.checkLoginRateLimit.mockResolvedValue({
      allowed: false,
      retryAfter: 42,
    });
    const { POST } = await import("./route");
    const response = await POST(
      authRequest(
        { password: "secret" },
        {
          "x-forwarded-for": "203.0.113.4, 10.0.0.1",
        },
      ),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(mocks.checkLoginRateLimit).toHaveBeenCalledWith("203.0.113.4");
  });

  it("préfère l'adresse normalisée par Vercel", async () => {
    const { POST } = await import("./route");
    await POST(
      authRequest(
        { password: "correct-password" },
        {
          "x-vercel-forwarded-for": "198.51.100.7",
          "x-forwarded-for": "203.0.113.4",
        },
      ),
    );

    expect(mocks.checkLoginRateLimit).toHaveBeenCalledWith("198.51.100.7");
  });

  it.each([
    [{}, 400],
    [{ password: 42 }, 400],
    [{ password: "x".repeat(257) }, 400],
  ])("valide strictement le mot de passe", async (body, status) => {
    const { POST } = await import("./route");
    expect((await POST(authRequest(body))).status).toBe(status);
  });

  it("refuse un mot de passe qui ne correspond à aucun utilisateur", async () => {
    mocks.verifyPassword.mockResolvedValue(false);
    const { POST } = await import("./route");
    expect((await POST(authRequest({ password: "incorrect" }))).status).toBe(
      401,
    );
  });

  it("masque les erreurs internes", async () => {
    mocks.initDB.mockRejectedValue(new Error("database secret"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { POST } = await import("./route");
    const response = await POST(authRequest({ password: "secret" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Erreur de connexion",
    });
    consoleError.mockRestore();
  });
});

function authRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://vexo.example/api/auth", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
