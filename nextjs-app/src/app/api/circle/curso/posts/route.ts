import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCursoPosts } from '@/lib/circle';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    const posts = await getCursoPosts();

    return NextResponse.json({ posts });
  } catch (error: any) {
    console.error('Error fetching curso posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch curso posts' },
      { status: 500 }
    );
  }
}
