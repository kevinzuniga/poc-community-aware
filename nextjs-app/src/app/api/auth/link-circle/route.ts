import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createMember, findMemberByEmail } from '@/lib/circle';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Check if already linked
    if (user.circleMemberId) {
      return NextResponse.json({
        success: true,
        message: 'User already linked to Circle',
        circleMemberId: user.circleMemberId
      });
    }

    // Find or create Circle member
    let circleMember = await findMemberByEmail(user.email);

    if (!circleMember) {
      console.log(`Creating Circle member for ${user.email}`);
      circleMember = await createMember({
        email: user.email,
        name: user.name || user.email.split('@')[0]
      });
    }

    const circleMemberId = circleMember.id;
    console.log(`Circle member ID: ${circleMemberId}`);

    // Update user in database
    await pool.query(
      'UPDATE users SET circle_member_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [circleMemberId, user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'User linked to Circle successfully',
      circleMemberId
    });
  } catch (error: any) {
    console.error('Error linking to Circle:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to link to Circle' },
      { status: 500 }
    );
  }
}
