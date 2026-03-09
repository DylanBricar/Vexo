import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyToken } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const h = req.headers.get("authorization");
    const userId = h?.startsWith("Bearer ") ? verifyToken(h.slice(7)) : null;
    if (userId !== 1) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    await sql`DELETE FROM messages`;
    await sql`UPDATE presence SET is_online = FALSE, is_typing = FALSE`;

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
