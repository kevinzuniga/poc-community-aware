import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMemberTokenByEmail, getCookieInjectionUrl, getConfig } from '@/lib/circle';
import { updateUserCircleMemberId } from '@/lib/db';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const returnPath = searchParams.get('return_path');

    // Use email to get token - this auto-creates/activates member in Circle
    console.log(`[Circle Auth] Getting token for user ${user.email}`);
    const tokenData = await getMemberTokenByEmail(user.email);

    // Update our DB with Circle member ID if we didn't have it
    if (!user.circleMemberId && tokenData.communityMemberId) {
      console.log(`[Circle Auth] Saving Circle member ID ${tokenData.communityMemberId} for user ${user.id}`);
      await updateUserCircleMemberId(user.id, tokenData.communityMemberId);
    }

    // Circle only allows return_to on same domain, so we redirect to Circle first
    // then handle the redirect back to our app via JavaScript in MainApp
    const config = getConfig();
    const circlePath = returnPath || '/c/space-aware';
    const returnUrl = `https://${config.domain}${circlePath}`;

    const authUrl = getCookieInjectionUrl(tokenData.accessToken, returnUrl);

    console.log(`[Circle Auth] Generated auth URL for member ${tokenData.communityMemberId}`);
    console.log(`[Circle Auth] Auth URL: ${authUrl}`);
    console.log(`[Circle Auth] Token expires at: ${new Date(tokenData.expiresAt).toISOString()}`);

    return NextResponse.json({
      authUrl,
      expiresAt: tokenData.expiresAt,
      debug: {
        memberId: tokenData.communityMemberId,
        email: user.email,
        domain: getConfig().domain,
        tokenPreview: tokenData.accessToken.substring(0, 20) + '...'
      }
    });
  } catch (error: any) {
    console.error('Error getting auth URL:', error);

    // Check if it's an inactive member error
    const errorMessage = error.message || error.toString();
    const isInactiveError = errorMessage.includes('inactive') ||
                           errorMessage.includes('must accept') ||
                           errorMessage.includes('not active');

    if (isInactiveError) {
      return NextResponse.json({
        error: 'Circle account pending activation',
        code: 'MEMBER_INACTIVE',
        message: 'Tu cuenta de Circle está pendiente de activación.',
        email: user.email
      }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
}
