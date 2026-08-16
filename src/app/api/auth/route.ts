import { NextRequest, NextResponse } from "next/server";
import sql, { initDB, verifyPassword } from "@/lib/db";
import { checkLoginRateLimit, clearLoginRateLimit } from "@/lib/rate-limit";
import { isTrustedMutation, setSessionCookie } from "@/lib/session";

const MAX_PASSWORD_LENGTH = 256;

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json(
      { error: "Origine non autorisée" },
      { status: 403 },
    );
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

    const body: unknown = await request.json();
    const password = getPassword(body);
    if (!password) {
      return NextResponse.json(
        { error: "Mot de passe requis" },
        { status: 400 },
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
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}
