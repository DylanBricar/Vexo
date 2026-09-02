import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  encryptOrNull: vi.fn((value: string | null) =>
    value ? `encrypted:${value}` : null,
  ),
  verifyToken: vi.fn(() => 1 as number | null),
}));

vi.mock("@/lib/db", () => ({ default: mocks.sql }));
vi.mock("@/lib/crypto", () => ({
  decryptOrNull: (value: string | null) => value,
  encryptOrNull: mocks.encryptOrNull,
  generateToken: () => "1:123:signature",
  verifyToken: mocks.verifyToken,
}));

describe("/api/messages", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.sql.mockReset().mockResolvedValue([
      {
        id: 10,
        sender_id: 1,
        content: null,
        media: null,
        media_type: "image",
        is_read: false,
        created_at: "2026-08-05T15:20:00",
        reply_to: null,
        edited: false,
      },
    ]);
    mocks.encryptOrNull.mockClear();
    mocks.verifyToken.mockReset().mockReturnValue(1);
  });

  it("refuse les medias SVG", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      requestFor({
        content: null,
        media: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        mediaType: "image",
        replyTo: null,
      }),
    );

    expect(response.status).toBe(415);
    expect(mocks.sql).not.toHaveBeenCalled();
  });

  it("chiffre le media avant de le stocker", async () => {
    const media = "data:image/png;base64,aGVsbG8=";
    const { POST } = await import("./route");
    const response = await POST(
      requestFor({ content: null, media, mediaType: "image", replyTo: null }),
    );

    expect(response.ok).toBe(true);
    expect(mocks.encryptOrNull).toHaveBeenCalledWith(media);
    const insertedValues = mocks.sql.mock.calls[0].slice(1);
    expect(insertedValues).toContain(`encrypted:${media}`);
  });

  it("refuse les requêtes anonymes et cross-site", async () => {
    const { GET, POST } = await import("./route");
    expect(
      (await GET(new NextRequest("https://vexo.example/api/messages"))).status,
    ).toBe(401);
    expect(
      (
        await POST(
          requestFor({ content: "test" }, "POST", {
            origin: "https://evil.example",
          }),
        )
      ).status,
    ).toBe(403);
  });

  it("charge une page sans requête COUNT supplémentaire", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      id: 51 - index,
      sender_id: index % 2 ? 1 : 2,
      content: `message-${index}`,
      has_media: false,
      media_type: null,
      is_read: false,
      created_at: "2026-08-05T15:20:00",
      reply_to: null,
      edited: false,
    }));
    mocks.sql.mockResolvedValue(rows);
    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("https://vexo.example/api/messages?before=100", {
        headers: { cookie: "vexo_session=test-token" },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(50);
    expect(data.hasMore).toBe(true);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it("refuse une réponse vers un message absent", async () => {
    mocks.sql.mockResolvedValueOnce([]);
    const { POST } = await import("./route");
    const response = await POST(
      requestFor({ content: "réponse", replyTo: 404 }),
    );

    expect(response.status).toBe(400);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it("fabrique le texte d'un signal système côté serveur", async () => {
    mocks.sql
      .mockResolvedValueOnce([{ label: "Utilisateur sûr" }])
      .mockResolvedValueOnce([
        {
          id: 20,
          sender_id: 1,
          content: null,
          media: null,
          media_type: "system",
          is_read: false,
          created_at: "2026-08-05T15:20:00",
          reply_to: null,
          edited: false,
        },
      ]);
    const { POST } = await import("./route");
    const response = await POST(
      requestFor({ content: "texte forgé", mediaType: "system" }),
    );

    expect(response.status).toBe(201);
    expect(mocks.encryptOrNull).toHaveBeenCalledWith(
      "Utilisateur sûr a peut-être fait une capture d'écran",
    );
  });

  it("modifie seulement un message appartenant à l'utilisateur", async () => {
    mocks.sql.mockResolvedValue([{ id: 10 }]);
    const { PATCH } = await import("./route");
    expect(
      (await PATCH(requestFor({ messageId: 10, content: "corrigé" }, "PATCH")))
        .status,
    ).toBe(200);

    mocks.sql.mockResolvedValue([]);
    expect(
      (await PATCH(requestFor({ messageId: 11, content: "corrigé" }, "PATCH")))
        .status,
    ).toBe(404);
    expect(
      (await PATCH(requestFor({ messageId: -1, content: "" }, "PATCH"))).status,
    ).toBe(400);
  });

  it("supprime pour l'administrateur et masque pour l'autre utilisateur", async () => {
    mocks.sql.mockResolvedValue([{ id: 10 }]);
    const { DELETE } = await import("./route");
    expect((await DELETE(requestFor({ messageId: 10 }, "DELETE"))).status).toBe(
      200,
    );

    mocks.verifyToken.mockReturnValue(2);
    expect((await DELETE(requestFor({ messageId: 11 }, "DELETE"))).status).toBe(
      200,
    );

    mocks.sql.mockResolvedValue([]);
    expect((await DELETE(requestFor({ messageId: 12 }, "DELETE"))).status).toBe(
      404,
    );
  });
});

function requestFor(
  body: unknown,
  method = "POST",
  extraHeaders: Record<string, string> = {},
) {
  return new NextRequest("https://vexo.example/api/messages", {
    method,
    headers: {
      cookie: "vexo_session=test-token",
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}
