import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getAuthenticatedUserId, isTrustedMutation } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json(
      { error: "Origine non autorisée" },
      { status: 403 },
    );
  }

  try {
    const userId = getAuthenticatedUserId(request);
    if (!userId)
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    }
    const { isTyping, isTabVisible } = body as Record<string, unknown>;
    if (typeof isTyping !== "boolean" || typeof isTabVisible !== "boolean") {
      return NextResponse.json({ error: "Présence invalide" }, { status: 400 });
    }

    await sql`
      INSERT INTO presence (user_id, is_online, is_typing, is_tab_visible, last_seen)
      VALUES (${userId}, TRUE, ${isTyping}, ${isTabVisible}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        is_online = TRUE,
        is_typing = ${isTyping},
        is_tab_visible = ${isTabVisible},
        last_seen = NOW()
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Échec de la mise à jour de présence", error);
    return NextResponse.json(
      { error: "Impossible de mettre à jour la présence" },
      { status: 500 },
    );
  }
}
