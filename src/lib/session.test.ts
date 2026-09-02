import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const cryptoMocks = vi.hoisted(() => ({
  generateToken: vi.fn((userId: number) => `${userId}:token`),
  verifyToken: vi.fn((token: string) => (token.startsWith("2:") ? 2 : 1)),
}));

vi.mock("@/lib/crypto", () => cryptoMocks);

import {
  clearSessionCookie,
  getAuthenticatedUserId,
  isTrustedMutation,
  setSessionCookie,
} from "./session";

describe("session", () => {
  beforeEach(() => vi.clearAllMocks());

  it("préfère le cookie HttpOnly au header Bearer", () => {
    const request = new NextRequest("https://vexo.example/api/messages", {
      headers: {
        authorization: "Bearer 1:header",
        cookie: "vexo_session=2%3Acookie",
      },
    });

    expect(getAuthenticatedUserId(request)).toBe(2);
    expect(cryptoMocks.verifyToken).toHaveBeenCalledWith("2:cookie");
  });

  it("refuse les tokens Bearer et les requêtes anonymes", () => {
    expect(
      getAuthenticatedUserId(
        new NextRequest("https://vexo.example", {
          headers: { authorization: "Bearer 1:header" },
        }),
      ),
    ).toBeNull();
    expect(
      getAuthenticatedUserId(new NextRequest("https://vexo.example")),
    ).toBeNull();
  });

  it("pose puis efface un cookie de session strict", () => {
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, 1);
    expect(response.headers.get("set-cookie")).toMatch(
      /HttpOnly.*SameSite=Strict/i,
    );

    const logoutResponse = NextResponse.json({ ok: true });
    clearSessionCookie(logoutResponse);
    expect(logoutResponse.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });

  it("refuse les mutations cross-site ou avec une origine différente", () => {
    expect(
      isTrustedMutation(
        new NextRequest("https://vexo.example/api/messages", {
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toBe(false);
    expect(
      isTrustedMutation(
        new NextRequest("https://vexo.example/api/messages", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false);
    expect(
      isTrustedMutation(
        new NextRequest("https://vexo.example/api/messages", {
          headers: { origin: "https://vexo.example" },
        }),
      ),
    ).toBe(true);
    expect(
      isTrustedMutation(new NextRequest("https://vexo.example/api/messages")),
    ).toBe(true);
  });
});
