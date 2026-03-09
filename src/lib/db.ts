import { neon } from "@neondatabase/serverless";
import argon2 from "argon2";

const sql = neon(process.env.DATABASE_URL!);

export default sql;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dbReady = false;

export async function initDB() {
  if (dbReady) return;

  const tables = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'messages', 'presence')
  `;

  if (tables.length === 3) {
    const users = await sql`SELECT COUNT(*) as count FROM users`;
    if (Number(users[0].count) > 0) {
      dbReady = true;
      return;
    }
  }

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      password TEXT NOT NULL,
      label TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT,
      media TEXT,
      media_type TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS presence (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      is_online BOOLEAN DEFAULT FALSE,
      is_typing BOOLEAN DEFAULT FALSE,
      last_seen TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    DO $$ BEGIN
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `;

  await sql`
    DO $$ BEGIN
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to INTEGER REFERENCES messages(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `;

  await sql`
    DO $$ BEGIN
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `;

  await sql`
    DO $$ BEGIN
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `;

  await sql`
    DO $$ BEGIN
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_key;
    EXCEPTION WHEN undefined_object THEN NULL;
    END $$
  `;

  const existing = await sql`SELECT id, password, label FROM users`;

  if (existing.length === 0) {
    const hash1 = await hashPassword(process.env.USER1_PASSWORD || "user01pwd@");
    const hash2 = await hashPassword(process.env.USER2_PASSWORD || "user02pwd@");
    await sql`INSERT INTO users (password, label) VALUES (${hash1}, 'Utilisateur 1')`;
    await sql`INSERT INTO users (password, label) VALUES (${hash2}, 'Utilisateur 2')`;
  } else {
    for (const user of existing) {
      if (!user.password.startsWith("$argon2")) {
        const hash = await hashPassword(user.password);
        await sql`UPDATE users SET password = ${hash} WHERE id = ${user.id}`;
      }
    }
  }

  await sql`
    INSERT INTO presence (user_id, is_online, is_typing)
    SELECT id, FALSE, FALSE FROM users
    ON CONFLICT (user_id) DO NOTHING
  `;

  dbReady = true;
}
