import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { verifyToken } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  try {
    const h = req.headers.get("authorization");
    const uid = h?.startsWith("Bearer ") ? verifyToken(h.slice(7)) : null;
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const other = await sql`
      SELECT u.label, p.is_online, p.is_typing, p.is_tab_visible,
        (p.is_online AND p.is_tab_visible AND p.last_seen > NOW() - INTERVAL '8 seconds') AS really_online
      FROM presence p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id != ${uid}
      LIMIT 1
    `;

    if (other.length === 0) {
      return NextResponse.json({ otherOnline: false, otherTyping: false, otherLabel: "" });
    }

    const isOnline = other[0].really_online;

    return NextResponse.json({
      otherOnline: isOnline,
      otherTyping: other[0].is_typing && isOnline,
      otherLabel: other[0].label,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const h = req.headers.get("authorization");
    const userId = h?.startsWith("Bearer ") ? verifyToken(h.slice(7)) : null;
    if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { isTyping, isTabVisible } = await req.json();

    await sql`
      INSERT INTO presence (user_id, is_online, is_typing, is_tab_visible, last_seen)
      VALUES (${userId}, TRUE, ${isTyping || false}, ${isTabVisible ?? false}, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET is_online = TRUE, is_typing = ${isTyping || false}, is_tab_visible = ${isTabVisible ?? false}, last_seen = NOW()
    `;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
