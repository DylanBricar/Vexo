import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { decryptOrNull, verifyToken } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const h = req.headers.get("authorization");
  const uid = h?.startsWith("Bearer ") ? verifyToken(h.slice(7)) : null;
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const rows = await sql`
    SELECT media FROM messages
    WHERE id = ${Number(id)} AND (hidden = FALSE OR hidden IS NULL)
  `;

  if (rows.length === 0 || !rows[0].media) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const media = decryptOrNull(rows[0].media);
  return NextResponse.json({ media });
}
