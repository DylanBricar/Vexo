import { NextRequest } from "next/server";
import sql from "@/lib/db";
import { decryptOrNull } from "@/lib/crypto";
import { getAuthenticatedUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_SIZE = 50;
const PAGE_FETCH_SIZE = PAGE_SIZE + 1;
const POLL_INTERVAL_MS = 1_000;
const KEEPALIVE_INTERVAL_MS = 15_000;

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return new Response("Non autorisé", { status: 401 });

  let cancelled = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastMessageHash = "";
      let lastPresenceHash = "";

      const send = (event: string, data: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          cleanup();
        }
      };

      const poll = async () => {
        if (cancelled) return;
        try {
          const [messageRows, otherRows] = await Promise.all([
            sql`
              WITH marked_read AS (
                UPDATE messages m SET is_read = TRUE, updated_at = NOW()
                WHERE m.sender_id != ${userId} AND m.is_read = FALSE
                  AND (m.hidden = FALSE OR m.hidden IS NULL)
                  AND (m.expires_at IS NULL OR m.expires_at > NOW())
                  AND EXISTS (
                    SELECT 1 FROM presence p
                    WHERE p.user_id = ${userId} AND p.is_tab_visible = TRUE
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM message_hidden_for h
                    WHERE h.message_id = m.id AND h.user_id = ${userId}
                  )
                RETURNING m.id
              )
              SELECT id, sender_id, content, (media IS NOT NULL) AS has_media,
                media_type, is_read, created_at, reply_to, edited, updated_at
              FROM messages m
              WHERE (m.hidden = FALSE OR m.hidden IS NULL)
                AND (m.expires_at IS NULL OR m.expires_at > NOW())
                AND NOT EXISTS (
                  SELECT 1 FROM message_hidden_for h
                  WHERE h.message_id = m.id AND h.user_id = ${userId}
                )
              ORDER BY m.id DESC
              LIMIT ${PAGE_FETCH_SIZE}
            `,
            sql`
              SELECT u.label, p.is_typing,
                (p.is_online AND p.is_tab_visible AND p.last_seen > NOW() - INTERVAL '8 seconds') AS really_online
              FROM presence p
              JOIN users u ON u.id = p.user_id
              WHERE p.user_id != ${userId}
              ORDER BY p.user_id
              LIMIT 1
            `,
          ]);

          const hasMore = messageRows.length > PAGE_SIZE;
          const visibleMessages = messageRows.slice(0, PAGE_SIZE).reverse();
          const messageHash = visibleMessages
            .map(
              (message) =>
                `${message.id}:${message.is_read}:${message.updated_at}`,
            )
            .join(",");
          if (messageHash !== lastMessageHash) {
            lastMessageHash = messageHash;
            send("messages", {
              hasMore,
              messages: visibleMessages.map((message) => ({
                id: message.id,
                sender_id: message.sender_id,
                content: decryptOrNull(message.content),
                has_media: message.has_media,
                media: null,
                media_type: message.media_type,
                is_read: message.is_read,
                created_at: message.created_at,
                reply_to: message.reply_to,
                edited: message.edited,
              })),
            });
          }

          const other = otherRows[0];
          const otherOnline = Boolean(other?.really_online);
          const otherTyping = Boolean(other?.is_typing && otherOnline);
          const otherLabel =
            typeof other?.label === "string" ? other.label : "";
          const presenceHash = `${otherOnline}:${otherTyping}:${otherLabel}`;
          if (presenceHash !== lastPresenceHash) {
            lastPresenceHash = presenceHash;
            send("presence", { otherOnline, otherTyping, otherLabel });
          }

          if (other && !otherOnline) {
            await sql`
              UPDATE presence SET is_online = FALSE, is_typing = FALSE, is_tab_visible = FALSE
              WHERE user_id != ${userId} AND last_seen < NOW() - INTERVAL '10 seconds'
            `;
          }
        } catch (error) {
          console.error("Échec du polling du flux de messages", error);
        } finally {
          if (!cancelled) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      };

      const cleanup = () => {
        if (cancelled) return;
        cancelled = true;
        if (pollTimer) clearTimeout(pollTimer);
        if (keepaliveTimer) clearInterval(keepaliveTimer);
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
      try {
        controller.enqueue(encoder.encode(": connected\n\n"));
      } catch {
        cleanup();
        return;
      }

      keepaliveTimer = setInterval(() => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          cleanup();
        }
      }, KEEPALIVE_INTERVAL_MS);
      await poll();
    },
    cancel() {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (keepaliveTimer) clearInterval(keepaliveTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "private, no-store, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
