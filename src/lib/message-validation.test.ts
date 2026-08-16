import { describe, expect, it } from "vitest";
import {
  MAX_MEDIA_BYTES,
  validateMessagePayload,
  validateSelectedFile,
} from "./message-validation";

describe("validateMessagePayload", () => {
  it("refuse un message vide", () => {
    expect(validateMessagePayload({ content: "  ", media: null, mediaType: null, replyTo: null })).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("refuse les formats actifs comme SVG", () => {
    expect(
      validateMessagePayload({
        content: null,
        media: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        mediaType: "image",
        replyTo: null,
      }),
    ).toMatchObject({ ok: false, status: 415 });
  });

  it("accepte une petite image PNG", () => {
    expect(
      validateMessagePayload({
        content: null,
        media: "data:image/png;base64,aGVsbG8=",
        mediaType: "image",
        replyTo: null,
      }),
    ).toMatchObject({ ok: true });
  });
});

describe("validateSelectedFile", () => {
  it("refuse un fichier trop volumineux avant sa lecture", () => {
    expect(validateSelectedFile({ type: "image/png", size: MAX_MEDIA_BYTES + 1 })).toMatchObject({
      ok: false,
    });
  });
});
