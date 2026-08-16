import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { decryptOrNull, encryptOrNull } from "@/lib/crypto";
import {
  MAX_CONTENT_LENGTH,
  validateMessagePayload,
} from "@/lib/message-validation";
import { getAuthenticatedUserId, isTrustedMutation } from "@/lib/session";

export const maxDuration = 60;

const PAGE_SIZE = 50;
const PAGE_FETCH_SIZE = PAGE_SIZE + 1;

export async function GET(request: NextRequest) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) return unauthorized();

    const before = parsePositiveInteger(
      request.nextUrl.searchParams.get("before"),
    );
    const rows = before
      ? await sql`
          SELECT id, sender_id, content, (media IS NOT NULL) AS has_media,
            media_type, is_read, created_at, reply_to, edited
          FROM messages m
          WHERE m.id < ${before}
            AND (m.hidden = FALSE OR m.hidden IS NULL)
            AND (m.expires_at IS NULL OR m.expires_at > NOW())
            AND NOT EXISTS (
              SELECT 1 FROM message_hidden_for h
              WHERE h.message_id = m.id AND h.user_id = ${userId}
            )
          ORDER BY m.id DESC
          LIMIT ${PAGE_FETCH_SIZE}
        `
      : await sql`
          SELECT id, sender_id, content, (media IS NOT NULL) AS has_media,
            media_type, is_read, created_at, reply_to, edited
          FROM messages m
          WHERE (m.hidden = FALSE OR m.hidden IS NULL)
            AND (m.expires_at IS NULL OR m.expires_at > NOW())
            AND NOT EXISTS (
              SELECT 1 FROM message_hidden_for h
              WHERE h.message_id = m.id AND h.user_id = ${userId}
            )
          ORDER BY m.id DESC
          LIMIT ${PAGE_FETCH_SIZE}
        `;

    const hasMore = rows.length > PAGE_SIZE;
    const messages = rows
      .slice(0, PAGE_SIZE)
      .reverse()
      .map((message) => ({
        ...message,
        content: decryptOrNull(message.content),
        media: null,
      }));
    return NextResponse.json({ messages, hasMore });
  } catch (error) {
    console.error("Échec du chargement des messages", error);
    return NextResponse.json(
      { error: "Impossible de charger les messages" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request)) return forbiddenOrigin();

  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) return unauthorized();

    const validation = validateMessagePayload(await request.json());
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status },
      );
    }

    const payload = validation.value;
    if (payload.replyTo && !(await messageExists(payload.replyTo, userId))) {
      return NextResponse.json(
        { error: "Message cité introuvable" },
        { status: 400 },
      );
    }

    const content =
      payload.mediaType === "system"
        ? await screenshotNoticeFor(userId)
        : payload.content;
    const encryptedContent = encryptOrNull(content);
    const encryptedMedia = encryptOrNull(payload.media);
    const rows = await sql`
      INSERT INTO messages (sender_id, content, media, media_type, reply_to)
      VALUES (${userId}, ${encryptedContent}, ${encryptedMedia}, ${payload.mediaType}, ${payload.replyTo})
      RETURNING id, sender_id, content, media, media_type, is_read, created_at, reply_to, edited
    `;

    const message = {
      ...rows[0],
      content,
      media: payload.media,
    };
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Échec de l'envoi du message", error);
    return NextResponse.json(
      { error: "Impossible d'envoyer le message" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!isTrustedMutation(request)) return forbiddenOrigin();

  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) return unauthorized();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return invalidRequest();

    const { messageId, content } = body as {
      messageId?: unknown;
      content?: unknown;
    };
    if (
      !Number.isSafeInteger(messageId) ||
      Number(messageId) <= 0 ||
      typeof content !== "string"
    ) {
      return invalidRequest();
    }
    const normalized = content.trim();
    if (!normalized || normalized.length > MAX_CONTENT_LENGTH)
      return invalidRequest();

    const rows = await sql`
      UPDATE messages
      SET content = ${encryptOrNull(normalized)}, edited = TRUE, updated_at = NOW()
      WHERE id = ${messageId as number} AND sender_id = ${userId}
      RETURNING id
    `;
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Message introuvable" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Échec de la modification du message", error);
    return NextResponse.json(
      { error: "Impossible de modifier le message" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedMutation(request)) return forbiddenOrigin();

  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId) return unauthorized();
    const body: unknown = await request.json();
    const messageId =
      body && typeof body === "object" && "messageId" in body
        ? (body as { messageId?: unknown }).messageId
        : null;
    if (!Number.isSafeInteger(messageId) || Number(messageId) <= 0)
      return invalidRequest();

    const rows =
      userId === 1
        ? await sql`DELETE FROM messages WHERE id = ${messageId as number} RETURNING id`
        : await sql`
          INSERT INTO message_hidden_for (message_id, user_id)
          SELECT id, ${userId} FROM messages WHERE id = ${messageId as number}
          ON CONFLICT (message_id, user_id) DO NOTHING
          RETURNING message_id AS id
        `;
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Message introuvable" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Échec de la suppression du message", error);
    return NextResponse.json(
      { error: "Impossible de supprimer le message" },
      { status: 500 },
    );
  }
}

async function messageExists(
  messageId: number,
  userId: number,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM messages m
    WHERE m.id = ${messageId}
      AND (m.hidden = FALSE OR m.hidden IS NULL)
      AND (m.expires_at IS NULL OR m.expires_at > NOW())
      AND NOT EXISTS (
        SELECT 1 FROM message_hidden_for h
        WHERE h.message_id = m.id AND h.user_id = ${userId}
      )
  `;
  return rows.length > 0;
}

async function screenshotNoticeFor(userId: number): Promise<string> {
  const rows = await sql`SELECT label FROM users WHERE id = ${userId}`;
  const label =
    typeof rows[0]?.label === "string" ? rows[0].label : "Un utilisateur";
  return `${label} a peut-être fait une capture d'écran`;
}

function parsePositiveInteger(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function unauthorized() {
  return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
}

function forbiddenOrigin() {
  return NextResponse.json({ error: "Origine non autorisée" }, { status: 403 });
}

function invalidRequest() {
  return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
}
