import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMemberToken } from '@/lib/circle';

const CIRCLE_API_URL = 'https://app.circle.so/api/headless/v1';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.circleMemberId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { spaceId } = await params;
  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('per_page') || '10';

  try {
    const tokenData = await getMemberToken(user.circleMemberId);

    const response = await fetch(
      `${CIRCLE_API_URL}/spaces/${spaceId}/posts?page=${page}&per_page=${perPage}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[API] Error fetching posts:', error);
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: response.status });
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
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.circleMemberId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { spaceId } = await params;
  const body = await request.json();

  try {
    const tokenData = await getMemberToken(user.circleMemberId);

    const response = await fetch(
      `${CIRCLE_API_URL}/spaces/${spaceId}/posts`,
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
      console.error('[API] Error creating post:', error);
      return NextResponse.json({ error: 'Failed to create post' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
