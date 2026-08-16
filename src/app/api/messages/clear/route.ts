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

    if (userId === 1) {
      await sql`DELETE FROM messages`;
    } else {
      await sql`
        INSERT INTO message_hidden_for (message_id, user_id)
        SELECT id, ${userId} FROM messages
        WHERE (hidden = FALSE OR hidden IS NULL)
        ON CONFLICT (message_id, user_id) DO NOTHING
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Échec du nettoyage de la conversation", error);
    return NextResponse.json(
      { error: "Impossible de nettoyer la conversation" },
      { status: 500 },
    );
  }
}
