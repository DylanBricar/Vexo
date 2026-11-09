import { NextResponse } from "next/server";

type ParsedBody =
  { ok: true; value: unknown } | { ok: false; response: NextResponse };

function rejectBody(status: 400 | 413, error: string): ParsedBody {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

function tooLarge(): ParsedBody {
  return rejectBody(413, "Requête trop volumineuse");
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<ParsedBody> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > maxBytes) {
    return tooLarge();
  }

  const reader = request.body?.getReader();
  if (!reader) return rejectBody(400, "Requête invalide");

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return tooLarge();
      }
      text += decoder.decode(value, { stream: true });
    }
    return { ok: true, value: JSON.parse(text + decoder.decode()) };
  } catch {
    void reader.cancel().catch(() => undefined);
    return rejectBody(400, "Requête invalide");
  } finally {
    reader.releaseLock();
  }
}
