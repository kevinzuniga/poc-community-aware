import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMemberToken } from '@/lib/circle';

const CIRCLE_API_URL = 'https://app.circle.so/api/headless/v1';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.circleMemberId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { commentId } = await params;

  try {
    const tokenData = await getMemberToken(user.circleMemberId);

    const response = await fetch(
      `${CIRCLE_API_URL}/comments/${commentId}/like`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[API] Error liking comment:', error);
      return NextResponse.json({ error: 'Failed to like comment' }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.circleMemberId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { commentId } = await params;

  try {
    const tokenData = await getMemberToken(user.circleMemberId);

    const response = await fetch(
      `${CIRCLE_API_URL}/comments/${commentId}/like`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[API] Error unliking comment:', error);
      return NextResponse.json({ error: 'Failed to unlike comment' }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
