import { NextRequest, NextResponse } from 'next/server';
import { findUserBySSOToken } from '@/lib/db';

export async function GET(request: NextRequest) {
  // Get access token from Authorization header
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'Missing or invalid authorization header' },
      { status: 401 }
    );
  }

  const accessToken = authHeader.substring(7); // Remove "Bearer " prefix

  // Find user by access token
  const user = await findUserBySSOToken(accessToken);

  if (!user) {
    return NextResponse.json(
      { error: 'invalid_token', error_description: 'Invalid or expired access token' },
      { status: 401 }
    );
  }

  // Return user profile in Circle's expected format
  // Circle expects: id, email, name, and optionally avatar_url
  return NextResponse.json({
    id: user.id.toString(),
    email: user.email,
    name: user.name || user.email.split('@')[0],
    avatar_url: null, // Can be added later if you store user avatars
  });
}
