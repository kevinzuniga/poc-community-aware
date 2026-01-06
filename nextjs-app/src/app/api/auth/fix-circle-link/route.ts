import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const ADMIN_BASE_URL = 'https://app.circle.so/api/admin/v2';
const ADMIN_TOKEN = process.env.CIRCLE_ADMIN_TOKEN;
const COMMUNITY_ID = process.env.CIRCLE_COMMUNITY_ID;

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log(`[Fix Circle] Fixing link for user: ${user.email}`);

    // Step 1: Search for existing member in Circle by email
    const searchUrl = `${ADMIN_BASE_URL}/community_members?community_id=${COMMUNITY_ID}&email=${encodeURIComponent(user.email)}`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const searchData = await searchResponse.json();

    // Find exact email match
    let circleMember = searchData.records?.find(
      (m: any) => m.email?.toLowerCase() === user.email.toLowerCase()
    );

    // Step 2: If no member found, create one
    if (!circleMember) {
      console.log(`[Fix Circle] No member found, creating new one for ${user.email}`);

      const createResponse = await fetch(`${ADMIN_BASE_URL}/community_members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          community_id: parseInt(COMMUNITY_ID!),
          email: user.email,
          name: user.name || user.email.split('@')[0],
          skip_invitation: true,
        }),
      });

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        console.error('[Fix Circle] Failed to create member:', createData);
        return NextResponse.json({
          error: 'Failed to create Circle member',
          details: createData
        }, { status: 500 });
      }

      circleMember = createData.community_member || createData;
      console.log(`[Fix Circle] Created new member with ID: ${circleMember.id}`);
    }

    const newCircleMemberId = circleMember.id;

    // Step 3: Update our database with the correct ID
    if (user.circleMemberId !== newCircleMemberId) {
      console.log(`[Fix Circle] Updating DB: ${user.circleMemberId} -> ${newCircleMemberId}`);

      await pool.query(
        'UPDATE users SET circle_member_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newCircleMemberId, user.id]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Circle link fixed successfully',
      oldCircleMemberId: user.circleMemberId,
      newCircleMemberId: newCircleMemberId,
      circleMemberEmail: circleMember.email,
      action: user.circleMemberId !== newCircleMemberId ? 'updated' : 'no_change_needed'
    });
  } catch (error: any) {
    console.error('[Fix Circle] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
