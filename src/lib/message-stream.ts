import type { Message } from "@/types";

export function mergeStreamMessages(
  current: Message[],
  incoming: Message[],
): Message[] {
  const incomingIds = new Set(incoming.map((message) => message.id));
  const oldestIncomingId = incoming[0]?.id;
  const loadedHistory =
    oldestIncomingId === undefined
      ? []
      : current.filter(
          (message) =>
            message.id > 0 &&
            message.id < oldestIncomingId &&
            !incomingIds.has(message.id) &&
            !message.localOnly,
        );
  const localOnly = current.filter(
    (message) => message.localOnly && !incomingIds.has(message.id),
  );

  return [...loadedHistory, ...incoming, ...localOnly];
}
