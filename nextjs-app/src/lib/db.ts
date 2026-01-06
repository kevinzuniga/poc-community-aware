/**
 * Database utilities using Postgres
 * Compatible with both Vercel Postgres and Railway
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const query = strings.reduce((acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''), '');
  const result = await pool.query(query, values);
  return result;
};

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  circle_member_id: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Initialize database tables
 */
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      circle_member_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sso_codes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(255) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      redirect_uri TEXT NOT NULL,
      state TEXT,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sso_tokens (
      id SERIAL PRIMARY KEY,
      access_token VARCHAR(255) UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  console.log('Database initialized');
}

/**
 * Create a new user
 */
export async function createUser(email: string, passwordHash: string, name: string, circleMemberId?: number) {
  const result = await sql`
    INSERT INTO users (email, password_hash, name, circle_member_id)
    VALUES (${email}, ${passwordHash}, ${name}, ${circleMemberId || null})
    RETURNING id, email, name, circle_member_id, created_at
  `;
  return result.rows[0];
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await sql`
    SELECT * FROM users WHERE email = ${email}
  `;
  return result.rows[0] as User || null;
}

/**
 * Find user by ID
 */
export async function findUserById(id: number): Promise<User | null> {
  const result = await sql`
    SELECT * FROM users WHERE id = ${id}
  `;
  return result.rows[0] as User || null;
}

/**
 * Update user's Circle member ID
 */
export async function updateUserCircleMemberId(userId: number, circleMemberId: number) {
  await sql`
    UPDATE users
    SET circle_member_id = ${circleMemberId}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${userId}
  `;
}

/**
 * SSO Code functions
 */
export async function createSSOCode(code: string, userId: number, redirectUri: string, state: string | null) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await sql`
    INSERT INTO sso_codes (code, user_id, redirect_uri, state, expires_at)
    VALUES (${code}, ${userId}, ${redirectUri}, ${state}, ${expiresAt.toISOString()})
  `;
}

export async function findAndUseSSOCode(code: string): Promise<{ userId: number; redirectUri: string } | null> {
  const result = await sql`
    UPDATE sso_codes
    SET used = TRUE
    WHERE code = ${code} AND used = FALSE AND expires_at > NOW()
    RETURNING user_id, redirect_uri
  `;
  if (result.rows[0]) {
    return { userId: result.rows[0].user_id, redirectUri: result.rows[0].redirect_uri };
  }
  return null;
}

/**
 * SSO Token functions
 */
export async function createSSOToken(accessToken: string, userId: number) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await sql`
    INSERT INTO sso_tokens (access_token, user_id, expires_at)
    VALUES (${accessToken}, ${userId}, ${expiresAt.toISOString()})
  `;
}

export async function findUserBySSOToken(accessToken: string): Promise<User | null> {
  const result = await sql`
    SELECT u.* FROM users u
    JOIN sso_tokens t ON u.id = t.user_id
    WHERE t.access_token = ${accessToken} AND t.expires_at > NOW()
  `;
  return result.rows[0] as User || null;
}
