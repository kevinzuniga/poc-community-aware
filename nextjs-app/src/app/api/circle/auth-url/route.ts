import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMemberToken, getCookieInjectionUrl, getConfig } from '@/lib/circle';

export async function GET(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);
    const returnPath = searchParams.get('return_path');

    const tokenData = await getMemberToken(user.circleMemberId);

    // Build return URL if path provided
    let returnUrl: string | undefined;
    if (returnPath) {
      const config = getConfig();
      returnUrl = `https://${config.domain}${returnPath}`;
    }

    const authUrl = getCookieInjectionUrl(tokenData.accessToken, returnUrl);

    console.log(`[Circle Auth] Generated auth URL for member ${user.circleMemberId}`);
    console.log(`[Circle Auth] Auth URL: ${authUrl}`);
    console.log(`[Circle Auth] Token expires at: ${new Date(tokenData.expiresAt).toISOString()}`);

    return NextResponse.json({
      authUrl,
      expiresAt: tokenData.expiresAt,
      debug: {
        memberId: user.circleMemberId,
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
        message: 'Tu cuenta de Circle está pendiente de activación. Revisa tu email y haz clic en el enlace de invitación de Circle.',
        memberId: user.circleMemberId
      }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
}
