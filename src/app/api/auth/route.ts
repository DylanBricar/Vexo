import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyPassword } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateToken } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const { allowed, retryAfter } = checkRateLimit(ip);

    if (!allowed) {
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${retryAfter}s` },
        { status: 429 }
      );
    }

    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });
    }

    const users = await sql`SELECT id, password, label FROM users`;

    for (const user of users) {
      const match = await verifyPassword(user.password, password);
      if (match) {
        return NextResponse.json({ userId: user.id, label: user.label, token: generateToken(user.id) });
      }
    }

    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
