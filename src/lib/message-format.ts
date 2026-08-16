export type MessageContentPart = {
  kind: "text" | "link";
  value: string;
};

const LINK_SPLIT_PATTERN = /(https?:\/\/[^\s<]+)/gi;
const LINK_PATTERN = /^https?:\/\/[^\s<]+$/i;

export function splitMessageLinks(text: string): MessageContentPart[] {
  return text
    .split(LINK_SPLIT_PATTERN)
    .filter(Boolean)
    .map((value) => ({
      kind: LINK_PATTERN.test(value) ? "link" : "text",
      value,
    }));
}

export function formatMessageTimestamp(
  value: string,
  timeZone?: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";

  const formatter = new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.day}/${parts.month}/${parts.year} à ${parts.hour}:${parts.minute}`;
}
