import { describe, expect, it } from "vitest";
import { formatMessageTimestamp, splitMessageLinks } from "./message-format";

describe("formatMessageTimestamp", () => {
  it("affiche la date complete et l'heure du message", () => {
    expect(formatMessageTimestamp("2026-08-05T13:20:00Z")).toBe(
      "05/08/2026 à 15:20",
    );
  });

  it("renvoie une valeur sure pour une date invalide", () => {
    expect(formatMessageTimestamp("date-invalide")).toBe("Date inconnue");
  });
});

describe("splitMessageLinks", () => {
  it("reconnait plusieurs liens sans alterner les resultats", () => {
    expect(
      splitMessageLinks("Voir https://example.com puis https://example.org/a"),
    ).toEqual([
      { kind: "text", value: "Voir " },
      { kind: "link", value: "https://example.com" },
      { kind: "text", value: " puis " },
      { kind: "link", value: "https://example.org/a" },
    ]);
  });
});
