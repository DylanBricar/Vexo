import { NextRequest } from "next/server";
import sql from "@/lib/db";
import { decryptOrNull, verifyToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const uid = token ? verifyToken(token) : null;
  if (!uid) {
    return new Response("Non autorisé", { status: 401 });
  }
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastHash = "";
      let lastPresenceHash = "";

      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cancelled = true;
        }
      };

      try {
        controller.enqueue(encoder.encode(": connected\n\n"));
      } catch {
        return;
      }

      const poll = async () => {
        if (cancelled) return;

        try {
          const presence = await sql`
            SELECT is_tab_visible FROM presence WHERE user_id = ${uid}
          `;
          const isTabVisible = presence.length > 0 && presence[0].is_tab_visible;

          if (isTabVisible) {
            await sql`
              UPDATE messages SET is_read = TRUE
              WHERE sender_id != ${uid} AND is_read = FALSE AND (hidden = FALSE OR hidden IS NULL)
            `;
          }

          const messages = await sql`
            SELECT id, sender_id, content, (media IS NOT NULL) as has_media, media_type, is_read, created_at, reply_to, edited
            FROM messages
            WHERE hidden = FALSE OR hidden IS NULL
            ORDER BY created_at DESC
            LIMIT 50
          `;
          messages.reverse();

          const currentHash = messages.map((m) => `${m.id}:${m.is_read}:${m.edited}`).join(",");

          if (currentHash !== lastHash) {
            lastHash = currentHash;

            const optimized = messages.map((msg) => ({
              id: msg.id,
              sender_id: msg.sender_id,
              content: decryptOrNull(msg.content),
              has_media: msg.has_media,
              media: null,
              media_type: msg.media_type,
              is_read: msg.is_read,
              created_at: msg.created_at,
              reply_to: msg.reply_to,
              edited: msg.edited,
            }));

            const hasMore = messages.length === 50 && messages.length > 0
              ? (await sql`SELECT COUNT(*) as count FROM messages WHERE id < ${messages[0].id} AND (hidden = FALSE OR hidden IS NULL)`)[0].count > 0
              : false;

            send("messages", { messages: optimized, hasMore });
          }

          const other = await sql`
            SELECT u.label, p.is_online, p.is_typing, p.is_tab_visible,
              (p.is_online AND p.is_tab_visible AND p.last_seen > NOW() - INTERVAL '8 seconds') AS really_online
            FROM presence p
            JOIN users u ON u.id = p.user_id
            WHERE p.user_id != ${uid}
            LIMIT 1
          `;

          if (other.length > 0) {
            const isOnline = other[0].really_online;
            const presenceHash = `${isOnline}:${other[0].is_typing}`;
            if (presenceHash !== lastPresenceHash) {
              lastPresenceHash = presenceHash;
              send("presence", {
                otherOnline: isOnline,
                otherTyping: other[0].is_typing && isOnline,
                otherLabel: other[0].label,
              });
            }

            // Force stale presence to offline (safety net if disconnect beacon failed)
            if (!isOnline) {
              await sql`
                UPDATE presence SET is_online = FALSE, is_typing = FALSE, is_tab_visible = FALSE
                WHERE user_id != ${uid} AND last_seen < NOW() - INTERVAL '10 seconds'
              `;
            }
          }
        } catch (err) {
        }
      };

      await poll();
      const interval = setInterval(poll, 1000);

      const keepalive = setInterval(() => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          cancelled = true;
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        cancelled = true;
        clearInterval(interval);
        clearInterval(keepalive);
        try {
          controller.close();
        } catch {
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
