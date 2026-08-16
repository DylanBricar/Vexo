import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  clearSessionCookie,
  getAuthenticatedUserId,
  isTrustedMutation,
} from "@/lib/session";

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

    const users = await sql`SELECT label FROM users WHERE id = ${userId}`;
    const label = typeof users[0]?.label === "string" ? users[0].label : null;

    await sql`
      UPDATE presence
      SET is_online = FALSE, is_typing = FALSE, is_tab_visible = FALSE, last_seen = NOW()
      WHERE user_id = ${userId}
    `;
    await sql`
      DELETE FROM messages
      WHERE is_read = TRUE AND media_type IS DISTINCT FROM 'system'
        AND (hidden = FALSE OR hidden IS NULL)
    `;
    await sql`DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at <= NOW()`;

    if (label) {
      await sql`
        INSERT INTO messages (sender_id, content, media_type, expires_at)
        VALUES (${userId}, ${encrypt(`${label} a quitté la conversation`)}, 'system', NOW() + INTERVAL '1 minute')
      `;
    }

    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error("Échec de la déconnexion", error);
    return NextResponse.json(
      { error: "Impossible de se déconnecter" },
      { status: 500 },
    );
  }
}
