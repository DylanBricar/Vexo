import { describe, expect, it } from "vitest";
import {
  MAX_MEDIA_BYTES,
  validateMessagePayload,
  validateSelectedFile,
} from "./message-validation";

describe("validateMessagePayload", () => {
  it("refuse un message vide", () => {
    expect(
      validateMessagePayload({
        content: "  ",
        media: null,
        mediaType: null,
        replyTo: null,
      }),
    ).toMatchObject({
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

  it.each([
    [null, 400],
    [{ content: 42 }, 400],
    [{ content: "a".repeat(5_001) }, 413],
    [{ content: "ok", mediaType: "audio" }, 415],
    [{ content: "ok", replyTo: -1 }, 400],
    [
      {
        content: null,
        media: "data:image/png;base64,aGVsbG8=",
        mediaType: "video",
      },
      400,
    ],
    [{ content: null, media: "not-a-data-url", mediaType: "image" }, 415],
    [
      {
        content: null,
        media: "data:image/png;base64,a",
        mediaType: "image",
      },
      415,
    ],
    [{ content: "image annoncée", mediaType: "image" }, 400],
  ])("refuse une charge invalide", (payload, status) => {
    expect(validateMessagePayload(payload)).toMatchObject({
      ok: false,
      status,
    });
  });

  it("accepte une vidéo WebM cohérente", () => {
    expect(
      validateMessagePayload({
        content: "vidéo",
        media: "data:video/webm;base64,aGVsbG8=",
        mediaType: "video",
        replyTo: 12,
      }),
    ).toMatchObject({ ok: true });
  });
});

describe("validateSelectedFile", () => {
  it("refuse un fichier trop volumineux avant sa lecture", () => {
    expect(
      validateSelectedFile({ type: "image/png", size: MAX_MEDIA_BYTES + 1 }),
    ).toMatchObject({
      ok: false,
    });
  });

  it.each([
    [{ type: "image/svg+xml", size: 100 }, 415],
    [{ type: "image/png", size: 0 }, 400],
  ])("refuse un fichier invalide", (file, status) => {
    expect(validateSelectedFile(file)).toMatchObject({ ok: false, status });
  });

  it("accepte un fichier vidéo pris en charge", () => {
    expect(
      validateSelectedFile({ type: "video/mp4", size: 1_024 }),
    ).toMatchObject({
      ok: true,
      value: { mediaType: "video" },
    });
  });
});
