import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  initDB: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: mocks.sql,
  initDB: mocks.initDB,
  verifyPassword: mocks.verifyPassword,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true }),
  checkLoginRateLimit: async () => ({ allowed: true }),
}));

vi.mock("@/lib/crypto", () => ({
  generateToken: () => "1:123:signature",
}));

describe("POST /api/auth", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.sql.mockReset().mockResolvedValue([
      { id: 1, password: "hash-1", label: "Utilisateur 1" },
      { id: 2, password: "hash-2", label: "Utilisateur 2" },
    ]);
    mocks.initDB.mockReset().mockResolvedValue(undefined);
    mocks.verifyPassword.mockReset().mockImplementation(async (hash: string) => hash === "hash-1");
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
  });
});
