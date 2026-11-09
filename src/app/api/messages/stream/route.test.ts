import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  transaction: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: Object.assign(mocks.sql, { transaction: mocks.transaction }),
}));
vi.mock("@/lib/session", () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));

beforeEach(() => {
  vi.useFakeTimers();
  mocks.sql.mockReset();
  mocks.transaction
    .mockReset()
    .mockImplementation(async (queries) => Promise.all(queries(mocks.sql)));
  mocks.getAuthenticatedUserId.mockReset().mockReturnValue(1);
});

afterEach(() => vi.useRealTimers());

it("espace les lectures seul, les accélère à deux et les arrête à la fermeture", async () => {
  let otherOnline = false;
  mocks.sql.mockImplementation(async ([statement]: TemplateStringsArray) =>
    statement.includes("SELECT u.label")
      ? [{ label: "Partenaire", really_online: otherOnline }]
      : [],
  );
  const response = await GET(
    new NextRequest("https://vexo.example/api/messages/stream"),
  );
  const reader = response.body!.getReader();
  try {
    const decoder = new TextDecoder();
    await reader.read(); // Commentaire de connexion SSE.
    const messages = await reader.read();
    expect(decoder.decode(messages.value)).toContain(
      'data: {"hasMore":false,"messages":[]}',
    );
    const presence = await reader.read();
    expect(decoder.decode(presence.value)).toContain('"otherOnline":false');

    expect(mocks.sql).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    otherOnline = true;
    await vi.advanceTimersByTimeAsync(3_999);
    expect(mocks.sql).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.sql).toHaveBeenCalledTimes(4);

    const online = await reader.read();
    expect(decoder.decode(online.value)).toContain('"otherOnline":true');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.sql).toHaveBeenCalledTimes(6);
    expect(mocks.transaction).toHaveBeenCalledTimes(3);
  } finally {
    await reader.cancel();
  }
  await vi.advanceTimersByTimeAsync(30_000);
  expect(mocks.sql).toHaveBeenCalledTimes(6);
  expect(mocks.transaction).toHaveBeenCalledTimes(3);
});

it("suspend les lectures de la base tant que le flux est saturé", async () => {
  mocks.sql.mockResolvedValue([]);
  const response = await GET(
    new NextRequest("https://vexo.example/api/messages/stream"),
  );
  const reader = response.body!.getReader();
  try {
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mocks.sql).toHaveBeenCalledTimes(2);

    await reader.read();
    await reader.read();
    await reader.read();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(mocks.sql).toHaveBeenCalledTimes(4);
  } finally {
    await reader.cancel();
  }
});

it("ne consulte pas la base sans session", async () => {
  mocks.getAuthenticatedUserId.mockReturnValue(null);
  const response = await GET(
    new NextRequest("https://vexo.example/api/messages/stream"),
  );
  expect(response.status).toBe(401);
  expect(mocks.sql).not.toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it("ferme le flux avant le délai de la plateforme même si une requête est en cours", async () => {
  mocks.sql.mockImplementation(() => new Promise(() => {}));
  const response = await GET(
    new NextRequest("https://vexo.example/api/messages/stream"),
  );
  const reader = response.body!.getReader();
  await vi.advanceTimersByTimeAsync(285_000);
  let chunk = await reader.read();
  while (!chunk.done) {
    chunk = await reader.read();
  }

  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.sql).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("arrête les vérifications lorsque la requête HTTP est annulée", async () => {
  mocks.sql.mockResolvedValue([]);
  const abortController = new AbortController();
  const response = await GET(
    new NextRequest("https://vexo.example/api/messages/stream", {
      signal: abortController.signal,
    }),
  );
  const reader = response.body!.getReader();
  await reader.read();
  const signal = mocks.transaction.mock.calls[0][1].fetchOptions.signal;
  expect(signal.aborted).toBe(false);
  abortController.abort();
  expect(signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.sql).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});
