import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import sql, { initDB, verifyPassword } from "@/lib/db";
import { checkLoginRateLimit, clearLoginRateLimit } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-body";
import { isTrustedMutation, setSessionCookie } from "@/lib/session";

const MAX_PASSWORD_LENGTH = 256;
const MAX_LOGIN_BODY_BYTES = 4 * 1024;

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json(
      { error: "Origine non autorisée" },
      { status: 403 },
    );
  }

  const body = await readJsonBody(request, MAX_LOGIN_BODY_BYTES);
  if (!body.ok) return body.response;
  const password = getPassword(body.value);
  if (!password) {
    return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
  }

  try {
    await initDB();
    const address = getClientAddress(request);
    const { allowed, retryAfter } = await checkLoginRateLimit(address);
    if (!allowed) {
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${retryAfter ?? 60}s` },
        { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } },
      );
    }

    const users = await sql`SELECT id, password, label FROM users ORDER BY id`;
    const matches = await Promise.all(
      users.map(async (user) =>
        (await verifyPassword(user.password, password)) ? user : null,
      ),
    );
    const user = matches.find(Boolean);
    if (!user)
      return NextResponse.json(
        { error: "Mot de passe incorrect" },
        { status: 401 },
      );

    await clearLoginRateLimit(address);
    const response = NextResponse.json({ userId: user.id, label: user.label });
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    console.error("Échec de la connexion", error);
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}

function getPassword(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("password" in body)) return null;
  const password = (body as { password?: unknown }).password;
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return null;
  }
  return password;
}

function getClientAddress(request: NextRequest): string {
  let forwarded = request.headers.get("x-vercel-forwarded-for");
  if (forwarded === null && process.env.VERCEL !== "1") {
    forwarded =
      request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
  }
  const address = forwarded?.split(",")[0]?.trim() ?? "";
  const family = isIP(address);
  if (family === 4) return address;
  if (family !== 6 || address.includes("%")) return "unknown";

  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [head, tail] = canonical.split("::");
  const leading = head ? head.split(":") : [];
  const trailing = tail ? tail.split(":") : [];
  const groups = [
    ...leading,
    ...Array<string>(8 - leading.length - trailing.length).fill("0"),
    ...trailing,
  ].map((group) => parseInt(group, 16));
  if (
    groups.slice(0, 5).every((group) => group === 0) &&
    groups[5] === 0xffff
  ) {
    return `${groups[6] >>> 8}.${groups[6] & 255}.${groups[7] >>> 8}.${groups[7] & 255}`;
  }
  const prefix = groups.slice(0, 4).map((group) => group.toString(16));
  return `${prefix.join(":")}::/64`;
}
