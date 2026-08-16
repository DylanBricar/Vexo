import { describe, expect, it } from "vitest";
import { mergeStreamMessages } from "@/lib/message-stream";
import type { Message } from "@/types";

const message = (id: number, extra: Partial<Message> = {}): Message => ({
  id,
  sender_id: 1,
  content: `Message ${id}`,
  media: null,
  media_type: null,
  is_read: false,
  created_at: "2026-08-05T15:20:00Z",
  reply_to: null,
  edited: false,
  ...extra,
});

describe("mergeStreamMessages", () => {
  it("conserve l'historique charge quand le flux rafraichit sa fenetre", () => {
    const current = [message(1), message(2), message(3)];
    const incoming = [message(2, { edited: true }), message(3), message(4)];
    const result = mergeStreamMessages(current, incoming);

    expect(result.map(({ id }) => id)).toEqual([1, 2, 3, 4]);
    expect(result[1].edited).toBe(true);
  });

  it("garde un envoi optimiste jusqu'a sa confirmation", () => {
    const optimistic = message(-1, { localOnly: true, pending: true });

    expect(mergeStreamMessages([message(2), optimistic], [message(2)])).toEqual(
      [message(2), optimistic],
    );
  });

  it("retire la copie locale lorsqu'un message confirme arrive", () => {
    const confirmed = message(3);
    const localCopy = message(3, { localOnly: true });

    expect(mergeStreamMessages([message(2), localCopy], [confirmed])).toEqual([
      message(2),
      confirmed,
    ]);
  });
});
