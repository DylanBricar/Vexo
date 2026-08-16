import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  encryptOrNull: vi.fn((value: string | null) => value ? `encrypted:${value}` : null),
}));

vi.mock("@/lib/db", () => ({ default: mocks.sql }));
vi.mock("@/lib/crypto", () => ({
  decryptOrNull: (value: string | null) => value,
  encryptOrNull: mocks.encryptOrNull,
  verifyToken: () => 1,
}));

describe("POST /api/messages", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.sql.mockReset().mockResolvedValue([{
      id: 10,
      sender_id: 1,
      content: null,
      media: null,
      media_type: "image",
      is_read: false,
      created_at: "2026-08-05T15:20:00",
      reply_to: null,
      edited: false,
    }]);
    mocks.encryptOrNull.mockClear();
  });

  it("refuse les medias SVG", async () => {
    const { POST } = await import("./route");
    const response = await POST(requestFor({
      content: null,
      media: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      mediaType: "image",
      replyTo: null,
    }));

    expect(response.status).toBe(415);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("chiffre le media avant de le stocker", async () => {
    const media = "data:image/png;base64,aGVsbG8=";
    const { POST } = await import("./route");
    const response = await POST(requestFor({ content: null, media, mediaType: "image", replyTo: null }));

    expect(response.ok).toBe(true);
    expect(mocks.encryptOrNull).toHaveBeenCalledWith(media);
    const insertedValues = mocks.sql.mock.calls[0].slice(1);
    expect(insertedValues).toContain(`encrypted:${media}`);
  });
});

function requestFor(body: unknown) {
  return new NextRequest("https://vexo.example/api/messages", {
    method: "POST",
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
