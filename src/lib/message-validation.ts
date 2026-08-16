export const MAX_CONTENT_LENGTH = 5_000;
export const MAX_MEDIA_BYTES = 3 * 1024 * 1024;

const IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
const DATA_URL_PATTERN = /^data:([^;,]+);base64,([a-zA-Z0-9+/]*={0,2})$/;

type MessagePayload = {
  content?: unknown;
  media?: unknown;
  mediaType?: unknown;
  replyTo?: unknown;
};

type ValidMessagePayload = {
  content: string | null;
  media: string | null;
  mediaType: "image" | "video" | "system" | null;
  replyTo: number | null;
};

type ValidationResult =
  { ok: true; value: ValidMessagePayload } | InvalidResult;

type InvalidResult = { ok: false; error: string; status: number };
type ValueResult<T> = { ok: true; value: T } | InvalidResult;

type SelectedFile = Pick<File, "size" | "type">;

export function validateMessagePayload(rawPayload: unknown): ValidationResult {
  if (!rawPayload || typeof rawPayload !== "object")
    return invalid("Message invalide", 400);
  const payload = rawPayload as MessagePayload;
  const contentResult = normalizeContent(payload.content);
  if (!contentResult.ok) return contentResult;

  const mediaType = payload.mediaType ?? null;
  if (
    mediaType !== null &&
    mediaType !== "image" &&
    mediaType !== "video" &&
    mediaType !== "system"
  ) {
    return invalid("Type de média invalide", 415);
  }

  const replyTo = payload.replyTo ?? null;
  if (
    replyTo !== null &&
    (!Number.isSafeInteger(replyTo) || Number(replyTo) <= 0)
  ) {
    return invalid("Réponse invalide", 400);
  }

  const mediaResult = normalizeMedia(payload.media, mediaType);
  if (!mediaResult.ok) return mediaResult;
  if ((mediaType === "image" || mediaType === "video") && !mediaResult.value) {
    return invalid("Média manquant", 400);
  }
  if (!contentResult.value && !mediaResult.value)
    return invalid("Le message est vide", 400);
  if (mediaType === "system" && mediaResult.value)
    return invalid("Média système invalide", 400);

  return {
    ok: true,
    value: {
      content: contentResult.value,
      media: mediaResult.value,
      mediaType,
      replyTo: replyTo as number | null,
    },
  };
}

export function validateSelectedFile(file: SelectedFile): ValidationResult {
  if (!isAllowedMimeType(file.type))
    return invalid("Format de fichier non pris en charge", 415);
  if (file.size <= 0) return invalid("Le fichier est vide", 400);
  if (file.size > MAX_MEDIA_BYTES) {
    return invalid(
      `Le fichier dépasse la limite de ${formatMegabytes(MAX_MEDIA_BYTES)} Mo`,
      413,
    );
  }

  return {
    ok: true,
    value: {
      content: null,
      media: null,
      mediaType: file.type.startsWith("image/") ? "image" : "video",
      replyTo: null,
    },
  };
}

function normalizeContent(content: unknown): ValueResult<string | null> {
  if (content === null || content === undefined)
    return { ok: true, value: null };
  if (typeof content !== "string") return invalid("Message invalide", 400);

  const normalized = content.trim();
  if (normalized.length > MAX_CONTENT_LENGTH)
    return invalid("Message trop long", 413);
  return { ok: true, value: normalized || null };
}

function normalizeMedia(
  media: unknown,
  mediaType: unknown,
): ValueResult<string | null> {
  if (media === null || media === undefined || media === "")
    return { ok: true, value: null };
  if (typeof media !== "string") return invalid("Format média invalide", 400);

  const match = DATA_URL_PATTERN.exec(media);
  if (!match || !isAllowedMimeType(match[1]))
    return invalid("Format média invalide", 415);
  if (!match[2] || match[2].length % 4 !== 0)
    return invalid("Format média invalide", 415);
  const expectedType = match[1].startsWith("image/") ? "image" : "video";
  if (mediaType !== expectedType)
    return invalid("Type de média incohérent", 400);
  if (decodedBase64Size(match[2]) > MAX_MEDIA_BYTES) {
    return invalid(
      `Le fichier dépasse la limite de ${formatMegabytes(MAX_MEDIA_BYTES)} Mo`,
      413,
    );
  }

  return { ok: true, value: media };
}

function isAllowedMimeType(type: string): boolean {
  return (
    IMAGE_MIME_TYPES.has(type.toLowerCase()) ||
    VIDEO_MIME_TYPES.has(type.toLowerCase())
  );
}

function decodedBase64Size(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function formatMegabytes(bytes: number): number {
  return bytes / (1024 * 1024);
}

function invalid(error: string, status: number): InvalidResult {
  return { ok: false, error, status };
}
