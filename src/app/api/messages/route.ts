import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { encryptOrNull, decryptOrNull, verifyToken } from "@/lib/crypto";

export const maxDuration = 60;

const PAGE_SIZE = 50;
const ALLOWED_MEDIA_TYPES = ["image", "video", "system"];
const MAX_CONTENT_LENGTH = 5000;


function authFromHeader(req: NextRequest): number | null {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return verifyToken(h.slice(7));
}

function isValidBase64Media(media: string): boolean {
  return /^data:(image|video)\/[a-zA-Z0-9.+-]+;base64,/.test(media);
}

export async function GET(req: NextRequest) {
  try {
    const uid = authFromHeader(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const before = req.nextUrl.searchParams.get("before");

    await sql`
      UPDATE messages SET is_read = TRUE
      WHERE sender_id != ${uid} AND is_read = FALSE AND (hidden = FALSE OR hidden IS NULL)
    `;

    let messages;
    if (before && !isNaN(Number(before))) {
      messages = await sql`
        SELECT id, sender_id, content, media, media_type, is_read, created_at, reply_to, edited
        FROM messages
        WHERE id < ${Number(before)} AND (hidden = FALSE OR hidden IS NULL)
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE}
      `;
      messages.reverse();
    } else {
      messages = await sql`
        SELECT id, sender_id, content, media, media_type, is_read, created_at, reply_to, edited
        FROM messages
        WHERE hidden = FALSE OR hidden IS NULL
        ORDER BY created_at DESC
        LIMIT ${PAGE_SIZE}
      `;
      messages.reverse();
    }

    const hasMore = messages.length === PAGE_SIZE && messages.length > 0
      ? (await sql`SELECT COUNT(*) as count FROM messages WHERE id < ${messages[0].id} AND (hidden = FALSE OR hidden IS NULL)`)[0].count > 0
      : false;

    const optimized = messages.map((msg) => ({
      ...msg,
      content: decryptOrNull(msg.content),
      media: decryptOrNull(msg.media),
    }));

    return NextResponse.json({ messages: optimized, hasMore });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = authFromHeader(req);
    if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const body = await req.json();
    const { content, media, mediaType, replyTo } = body;

    if (!content && !media) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    if (content && (typeof content !== "string" || content.length > MAX_CONTENT_LENGTH)) {
      return NextResponse.json({ error: "Message trop long" }, { status: 400 });
    }

    if (mediaType && !ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: "Type de média invalide" }, { status: 400 });
    }

    if (media) {
      if (typeof media !== "string" || !isValidBase64Media(media)) {
        return NextResponse.json({ error: "Format média invalide" }, { status: 400 });
      }
    }

    if (replyTo !== null && replyTo !== undefined) {
      if (typeof replyTo !== "number") {
        return NextResponse.json({ error: "Invalid replyTo" }, { status: 400 });
      }
    }

    const encContent = encryptOrNull(content || null);
    const rawMedia = media || null;

    const message = await sql`
      INSERT INTO messages (sender_id, content, media, media_type, reply_to)
      VALUES (${userId}, ${encContent}, ${rawMedia}, ${mediaType || null}, ${replyTo || null})
      RETURNING id, sender_id, content, media, media_type, is_read, created_at, reply_to, edited
    `;

    const msg = message[0];
    msg.content = content || null;
    msg.media = media || null;
    return NextResponse.json({ message: msg });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = authFromHeader(req);
    if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { messageId, content } = await req.json();
    if (!messageId || !content?.trim()) {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }

    if (typeof content !== "string" || content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: "Message trop long" }, { status: 400 });
    }

    const msg = await sql`SELECT sender_id FROM messages WHERE id = ${messageId}`;
    if (msg.length === 0) {
      return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    }
    if (msg[0].sender_id !== userId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const encContent = encryptOrNull(content.trim());

    await sql`
      UPDATE messages SET content = ${encContent}, edited = TRUE
      WHERE id = ${messageId} AND sender_id = ${userId}
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = authFromHeader(req);
    if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { messageId } = await req.json();
    if (!messageId || typeof messageId !== "number") {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }

    if (userId === 1) {
      await sql`DELETE FROM messages WHERE id = ${messageId}`;
    } else {
      await sql`UPDATE messages SET hidden = TRUE WHERE id = ${messageId}`;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
