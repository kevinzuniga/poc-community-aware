import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createSSOCode } from '@/lib/db';
import crypto from 'crypto';

const SSO_CLIENT_ID = process.env.SSO_CLIENT_ID || 'aware-circle-sso';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const responseType = searchParams.get('response_type');
  const state = searchParams.get('state');
  const scope = searchParams.get('scope');

  // Validate required params
  if (!clientId || !redirectUri || responseType !== 'code') {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing or invalid parameters' },
      { status: 400 }
    );
  }

  // Validate client_id
  if (clientId !== SSO_CLIENT_ID) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Invalid client_id' },
      { status: 401 }
    );
  }

  // Check if user is authenticated
  const user = await getCurrentUser();

  if (!user) {
    // Redirect to login with return URL
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Generate authorization code
  const code = crypto.randomBytes(32).toString('hex');

  // Store the code
  await createSSOCode(code, user.id, redirectUri, state);

  // Redirect back to Circle with the code
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) {
    callbackUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(callbackUrl);
}
