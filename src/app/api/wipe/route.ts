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
    if (getAuthenticatedUserId(request) !== 1) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    await sql`DELETE FROM messages`;
    await sql`
      UPDATE presence
      SET is_online = FALSE, is_typing = FALSE, is_tab_visible = FALSE
    `;
    await sql`DELETE FROM login_attempts WHERE reset_at <= NOW()`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Échec du nettoyage de la base", error);
    return NextResponse.json(
      { error: "Impossible de nettoyer la base" },
      { status: 500 },
    );
  }
}
