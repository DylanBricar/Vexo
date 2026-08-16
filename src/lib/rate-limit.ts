import { createHash } from "node:crypto";
import sql from "@/lib/db";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

export async function checkLoginRateLimit(
  address: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const identifier = hashAddress(address);
  const rows = await sql`
    INSERT INTO login_attempts (identifier, attempt_count, reset_at)
    VALUES (${identifier}, 1, NOW() + (${WINDOW_MS} * INTERVAL '1 millisecond'))
    ON CONFLICT (identifier) DO UPDATE SET
      attempt_count = CASE
        WHEN login_attempts.reset_at <= NOW() THEN 1
        ELSE login_attempts.attempt_count + 1
      END,
      reset_at = CASE
        WHEN login_attempts.reset_at <= NOW() THEN NOW() + (${WINDOW_MS} * INTERVAL '1 millisecond')
        ELSE login_attempts.reset_at
      END
    RETURNING attempt_count, GREATEST(0, CEIL(EXTRACT(EPOCH FROM (reset_at - NOW()))))::INTEGER AS retry_after
  `;
  const attemptCount = Number(rows[0]?.attempt_count ?? MAX_ATTEMPTS + 1);

  return attemptCount <= MAX_ATTEMPTS
    ? { allowed: true }
    : { allowed: false, retryAfter: Number(rows[0]?.retry_after ?? 60) };
}

export async function clearLoginRateLimit(address: string): Promise<void> {
  await sql`DELETE FROM login_attempts WHERE identifier = ${hashAddress(address)}`;
}

function hashAddress(address: string): string {
  return createHash("sha256").update(address).digest("hex");
}
