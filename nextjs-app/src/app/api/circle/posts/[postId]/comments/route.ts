import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMemberToken } from '@/lib/circle';

const CIRCLE_API_URL = 'https://app.circle.so/api/headless/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.circleMemberId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { postId } = await params;
  const { searchParams } = new URL(request.url);
  const perPage = searchParams.get('per_page') || '50';
  const sort = searchParams.get('sort') || 'oldest';

  try {
    const tokenData = await getMemberToken(user.circleMemberId);

    const response = await fetch(
      `${CIRCLE_API_URL}/posts/${postId}/comments?per_page=${perPage}&sort=${sort}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[API] Error fetching comments:', error);
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.circleMemberId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { postId } = await params;
  const body = await request.json();

  try {
    const tokenData = await getMemberToken(user.circleMemberId);

    const response = await fetch(
      `${CIRCLE_API_URL}/posts/${postId}/comments`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[API] Error creating comment:', error);
      return NextResponse.json({ error: 'Failed to create comment' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
