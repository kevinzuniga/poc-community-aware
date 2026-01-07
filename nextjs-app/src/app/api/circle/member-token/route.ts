import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMemberTokenByEmail } from '@/lib/circle';
import { updateUserCircleMemberId } from '@/lib/db';

/**
 * Get Circle member token for client-side SDK
 * Uses EMAIL to get token - this may auto-create/activate the member
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    // Use email to get token - this is the key!
    // Circle's headless auth_token endpoint can create/activate members by email
    console.log(`[member-token] Getting token for user ${user.email}`);
    const tokenData = await getMemberTokenByEmail(user.email);

    // Update our DB with the Circle member ID if we didn't have it
    if (!user.circleMemberId && tokenData.communityMemberId) {
      console.log(`[member-token] Updating user ${user.id} with Circle member ID ${tokenData.communityMemberId}`);
      await updateUserCircleMemberId(user.id, tokenData.communityMemberId);
    }

    return NextResponse.json({
      accessToken: tokenData.accessToken,
      expiresAt: tokenData.expiresAt,
      memberId: tokenData.communityMemberId,
    });
  } catch (error: any) {
    console.error('[member-token] Error getting member token:', error);

    // Check if it's an inactive member error
    const errorMessage = error.message || error.toString();
    const isInactiveError = errorMessage.includes('inactive') ||
                           errorMessage.includes('must accept') ||
                           errorMessage.includes('not active');

    if (isInactiveError) {
      return NextResponse.json({
        error: 'Circle account pending activation',
        code: 'MEMBER_INACTIVE',
      }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to get member token', details: errorMessage },
      { status: 500 }
    );
  }
}
