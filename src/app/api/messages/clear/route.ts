import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyToken } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const h = req.headers.get("authorization");
    const userId = h?.startsWith("Bearer ") ? verifyToken(h.slice(7)) : null;
    if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    if (userId === 1) {
      await sql`DELETE FROM messages`;
    } else {
      await sql`UPDATE messages SET hidden = TRUE`;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
