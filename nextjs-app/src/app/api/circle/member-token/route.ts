import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMemberToken } from '@/lib/circle';

/**
 * Get Circle member token for client-side SDK
 * This token allows the client to make authenticated requests to Circle's API
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  if (!user.circleMemberId) {
    return NextResponse.json(
      { error: 'User is not linked to Circle' },
      { status: 400 }
    );
  }

  try {
    const tokenData = await getMemberToken(user.circleMemberId);

    return NextResponse.json({
      accessToken: tokenData.accessToken,
      expiresAt: tokenData.expiresAt,
      memberId: user.circleMemberId,
    });
  } catch (error: any) {
    console.error('Error getting member token:', error);

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
      { error: 'Failed to get member token' },
      { status: 500 }
    );
  }
}
