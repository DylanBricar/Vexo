import { NextRequest } from "next/server";
import sql from "@/lib/db";
import { decryptOrNull } from "@/lib/crypto";
import { getAuthenticatedUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE_SIZE = 50;
const PAGE_FETCH_SIZE = PAGE_SIZE + 1;
const ACTIVE_POLL_INTERVAL_MS = 1_000;
const IDLE_POLL_INTERVAL_MS = 4_000;
const PRESENCE_TIMEOUT_SECONDS = 25;
const KEEPALIVE_INTERVAL_MS = 15_000;
const STREAM_LIFETIME_MS = maxDuration * 1_000 - 15_000;

export async function GET(request: NextRequest) {
  const userId = getAuthenticatedUserId(request);
  if (!userId) return new Response("Non autorisé", { status: 401 });

  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let cancelled = false;
      let pollTimer: ReturnType<typeof setTimeout> | undefined;
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

      const poll = async (initial = false) => {
        if (cancelled) return;
        if (!initial && (controller.desiredSize ?? 0) <= 0) {
          pollTimer = setTimeout(poll, IDLE_POLL_INTERVAL_MS);
          return;
        }
        let nextPollDelay = IDLE_POLL_INTERVAL_MS;
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
                    WHERE p.user_id = ${userId} AND p.is_online = TRUE AND p.is_tab_visible = TRUE
                      AND p.last_seen > NOW() - (${PRESENCE_TIMEOUT_SECONDS} * INTERVAL '1 second')
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
                (p.is_online AND p.is_tab_visible AND
                  p.last_seen > NOW() - (${PRESENCE_TIMEOUT_SECONDS} * INTERVAL '1 second')) AS really_online
              FROM presence p
              JOIN users u ON u.id = p.user_id
              WHERE p.user_id != ${userId}
              ORDER BY p.user_id
              LIMIT 1
            `,
          ]);

          const hasMore = messageRows.length > PAGE_SIZE;
          const visibleMessages = messageRows.slice(0, PAGE_SIZE).reverse();
          const messageHash = `${hasMore}:${visibleMessages
            .map(
              ({ id, is_read, updated_at }) => `${id}:${is_read}:${updated_at}`,
            )
            .join(",")}`;
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
          if (otherOnline) nextPollDelay = ACTIVE_POLL_INTERVAL_MS;
          const otherTyping = Boolean(other?.is_typing && otherOnline);
          const otherLabel =
            typeof other?.label === "string" ? other.label : "";
          const presenceHash = `${otherOnline}:${otherTyping}:${otherLabel}`;
          if (presenceHash !== lastPresenceHash) {
            lastPresenceHash = presenceHash;
            send("presence", { otherOnline, otherTyping, otherLabel });
          }
        } catch (error) {
          console.error("Échec du polling du flux de messages", error);
        } finally {
          if (!cancelled) pollTimer = setTimeout(poll, nextPollDelay);
        }
      };

      const close = () => {
        if (cancelled) return;
        cleanup();
        controller.close();
      };

      if (request.signal.aborted) {
        controller.close();
        return;
      }

      const lifetimeTimer = setTimeout(close, STREAM_LIFETIME_MS);
      const keepaliveTimer = setInterval(() => {
        if (cancelled || (controller.desiredSize ?? 0) <= 0) return;
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          cleanup();
        }
      }, KEEPALIVE_INTERVAL_MS);

      cleanup = () => {
        cancelled = true;
        clearTimeout(pollTimer);
        clearInterval(keepaliveTimer);
        clearTimeout(lifetimeTimer);
        request.signal.removeEventListener("abort", close);
      };
      request.signal.addEventListener("abort", close, { once: true });
      controller.enqueue(encoder.encode(": connected\n\n"));
      void poll(true);
    },
    cancel() {
      cleanup();
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
