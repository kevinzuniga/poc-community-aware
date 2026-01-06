import { NextRequest, NextResponse } from 'next/server';
import { findAndUseSSOCode, createSSOToken } from '@/lib/db';
import crypto from 'crypto';

const SSO_CLIENT_ID = process.env.SSO_CLIENT_ID || 'aware-circle-sso';
const SSO_CLIENT_SECRET = process.env.SSO_CLIENT_SECRET || 'dev-secret-change-in-production';

export async function POST(request: NextRequest) {
  let grantType: string | null = null;
  let code: string | null = null;
  let clientId: string | null = null;
  let clientSecret: string | null = null;
  let redirectUri: string | null = null;

  // Handle both form-urlencoded and JSON
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    grantType = formData.get('grant_type') as string;
    code = formData.get('code') as string;
    clientId = formData.get('client_id') as string;
    clientSecret = formData.get('client_secret') as string;
    redirectUri = formData.get('redirect_uri') as string;
  } else {
    const body = await request.json();
    grantType = body.grant_type;
    code = body.code;
    clientId = body.client_id;
    clientSecret = body.client_secret;
    redirectUri = body.redirect_uri;
  }

  // Validate grant type
  if (grantType !== 'authorization_code') {
    return NextResponse.json(
      { error: 'unsupported_grant_type', error_description: 'Only authorization_code grant is supported' },
      { status: 400 }
    );
  }

  // Validate client credentials
  if (clientId !== SSO_CLIENT_ID || clientSecret !== SSO_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'invalid_client', error_description: 'Invalid client credentials' },
      { status: 401 }
    );
  }

  // Validate code
  if (!code) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing authorization code' },
      { status: 400 }
    );
  }

  // Find and validate the code
  const codeData = await findAndUseSSOCode(code);

  if (!codeData) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
      { status: 400 }
    );
  }

  // Generate access token
  const accessToken = crypto.randomBytes(32).toString('hex');

  // Store the token
  await createSSOToken(accessToken, codeData.userId);

  // Return token response
  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 86400, // 24 hours
  });
}
