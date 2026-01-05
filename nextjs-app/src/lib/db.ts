/**
 * Database utilities using Vercel Postgres
 */

import { sql } from '@vercel/postgres';

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
