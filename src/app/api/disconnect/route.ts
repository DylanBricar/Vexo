import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import sql from "@/lib/db";
import { encrypt, verifyToken } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    let userId: number | null = null;
    let userLabel: string | null = null;

    try {
      const body = await req.json();
      const tokenUid = body.token ? verifyToken(body.token) : null;
      if (!tokenUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      userId = tokenUid;
      userLabel = body.userLabel;
    } catch {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }

    await sql`
      UPDATE presence SET is_online = FALSE, is_typing = FALSE, last_seen = NOW()
      WHERE user_id = ${userId}
    `;

    let systemMsgId: number | null = null;
    if (userLabel) {
      const result = await sql`
        INSERT INTO messages (sender_id, content, media_type)
        VALUES (${userId}, ${encrypt(`${userLabel} a quitté la conversation`)}, 'system')
        RETURNING id
      `;
      systemMsgId = result[0]?.id ?? null;
    }

    after(async () => {
      if (systemMsgId) {
        await new Promise((r) => setTimeout(r, 60000));
        await sql`DELETE FROM messages WHERE id = ${systemMsgId} AND media_type = 'system'`;
      }

      await new Promise((r) => setTimeout(r, 5000));

      const online = await sql`
        SELECT COUNT(*) as count FROM presence
        WHERE is_online = TRUE AND last_seen > NOW() - INTERVAL '15 seconds'
      `;

      if (Number(online[0].count) === 0) {
        await sql`DELETE FROM messages`;
      }
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
