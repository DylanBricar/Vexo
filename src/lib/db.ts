import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import argon2 from "argon2";

type SqlClient = NeonQueryFunction<false, false>;

let sqlClient: SqlClient | null = null;
let dbReady = false;
let initialization: Promise<void> | null = null;

function getSqlClient(): SqlClient {
  if (sqlClient) return sqlClient;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL n'est pas configurée");
  sqlClient = neon(connectionString);
  return sqlClient;
}

const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  getSqlClient()(strings, ...values)) as SqlClient;

export default sql;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function initDB(): Promise<void> {
  if (dbReady) return;
  if (!initialization) {
    initialization = initializeSchema().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
}

async function initializeSchema(): Promise<void> {
  const tables = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'messages', 'presence', 'message_hidden_for', 'login_attempts')
  `;
  if (tables.length === 5) {
    const readiness = await sql`
      SELECT
        EXISTS (SELECT 1 FROM users) AS has_users,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'messages'
            AND column_name = 'updated_at'
        ) AS has_updated_at,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'messages'
            AND column_name = 'expires_at'
        ) AS has_expires_at,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'presence'
            AND column_name = 'is_tab_visible'
        ) AS has_tab_visibility
    `;
    const schema = readiness[0];
    if (
      schema?.has_users &&
      schema.has_updated_at &&
      schema.has_expires_at &&
      schema.has_tab_visibility
    ) {
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      reply_to INTEGER REFERENCES messages(id) ON DELETE SET NULL,
      edited BOOLEAN DEFAULT FALSE,
      hidden BOOLEAN DEFAULT FALSE
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS presence (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      is_online BOOLEAN DEFAULT FALSE,
      is_typing BOOLEAN DEFAULT FALSE,
      is_tab_visible BOOLEAN DEFAULT FALSE,
      last_seen TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS message_hidden_for (
      message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (message_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS login_attempts (
      identifier TEXT PRIMARY KEY,
      attempt_count INTEGER NOT NULL,
      reset_at TIMESTAMPTZ NOT NULL
    )
  `;

  await migrateLegacyColumns();
  await seedUsers();

  await sql`
    INSERT INTO presence (user_id, is_online, is_typing)
    SELECT id, FALSE, FALSE FROM users
    ON CONFLICT (user_id) DO NOTHING
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS messages_visible_created_idx
    ON messages (created_at DESC, id DESC)
    WHERE hidden = FALSE OR hidden IS NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS messages_unread_sender_idx
    ON messages (sender_id, is_read)
    WHERE is_read = FALSE
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS message_hidden_for_user_idx
    ON message_hidden_for (user_id, message_id)
  `;

  dbReady = true;
}

async function migrateLegacyColumns(): Promise<void> {
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to INTEGER REFERENCES messages(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;
  await sql`ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;
  await sql`ALTER TABLE presence ADD COLUMN IF NOT EXISTS is_tab_visible BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_password_key`;
  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'messages'
          AND column_name = 'created_at' AND data_type = 'timestamp without time zone'
      ) THEN
        ALTER TABLE messages
          ALTER COLUMN created_at TYPE TIMESTAMPTZ
          USING created_at AT TIME ZONE 'UTC';
      END IF;
    END $$
  `;
}

async function seedUsers(): Promise<void> {
  const existing = await sql`SELECT id, password FROM users`;
  if (existing.length === 0) {
    const password1 = requiredSeedPassword("USER1_PASSWORD");
    const password2 = requiredSeedPassword("USER2_PASSWORD");
    const [hash1, hash2] = await Promise.all([
      hashPassword(password1),
      hashPassword(password2),
    ]);
    await sql`
      INSERT INTO users (id, password, label)
      VALUES
        (1, ${hash1}, 'Utilisateur 1'),
        (2, ${hash2}, 'Utilisateur 2')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      SELECT setval(
        pg_get_serial_sequence('users', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM users), 1),
        TRUE
      )
    `;
    return;
  }

  await Promise.all(
    existing.map(async (user) => {
      if (
        typeof user.password === "string" &&
        !user.password.startsWith("$argon2")
      ) {
        const hash = await hashPassword(user.password);
        await sql`UPDATE users SET password = ${hash} WHERE id = ${user.id}`;
      }
    }),
  );
}

function requiredSeedPassword(
  name: "USER1_PASSWORD" | "USER2_PASSWORD",
): string {
  const password = process.env[name];
  if (!password || password.length < 12) {
    throw new Error(
      `${name} doit contenir au moins 12 caractères lors de l'initialisation`,
    );
  }
  return password;
}
