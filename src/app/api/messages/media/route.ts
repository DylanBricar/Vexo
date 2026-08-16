import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { decryptOrNull } from "@/lib/crypto";
import { getAuthenticatedUserId } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId)
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const rawId = request.nextUrl.searchParams.get("id");
    const messageId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : 0;
    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      return NextResponse.json(
        { error: "Identifiant invalide" },
        { status: 400 },
      );
    }

    const rows = await sql`
      SELECT m.media FROM messages m
      WHERE m.id = ${messageId} AND (m.hidden = FALSE OR m.hidden IS NULL)
        AND (m.expires_at IS NULL OR m.expires_at > NOW())
        AND NOT EXISTS (
          SELECT 1 FROM message_hidden_for h
          WHERE h.message_id = m.id AND h.user_id = ${userId}
        )
    `;
    if (!rows[0]?.media) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }

    return NextResponse.json(
      { media: decryptOrNull(rows[0].media) },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    console.error("Échec du chargement du média", error);
    return NextResponse.json(
      { error: "Impossible de charger le média" },
      { status: 500 },
    );
  }
}
