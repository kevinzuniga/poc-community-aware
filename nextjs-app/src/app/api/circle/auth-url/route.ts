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

    return NextResponse.json({
      authUrl,
      expiresAt: tokenData.expiresAt,
    });
  } catch (error: any) {
    console.error('Error getting auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
}
