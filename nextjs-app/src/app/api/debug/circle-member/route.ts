import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

const ADMIN_BASE_URL = 'https://app.circle.so/api/admin/v2';
const ADMIN_TOKEN = process.env.CIRCLE_ADMIN_TOKEN;
const COMMUNITY_ID = process.env.CIRCLE_COMMUNITY_ID;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Search for member by email in Circle
    const searchUrl = `${ADMIN_BASE_URL}/community_members?community_id=${COMMUNITY_ID}&email=${encodeURIComponent(user.email)}`;

    console.log(`[Debug] Searching Circle for email: ${user.email}`);
    console.log(`[Debug] URL: ${searchUrl}`);

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    console.log(`[Debug] Circle API response:`, JSON.stringify(data, null, 2));

    // Find exact match
    const exactMatch = data.records?.find(
      (m: any) => m.email?.toLowerCase() === user.email.toLowerCase()
    );

    return NextResponse.json({
      appUser: {
        id: user.id,
        email: user.email,
        name: user.name,
        storedCircleMemberId: user.circleMemberId,
      },
      circleSearch: {
        totalRecords: data.records?.length || 0,
        records: data.records || [],
        exactMatch: exactMatch || null,
      },
      recommendation: exactMatch
        ? (exactMatch.id === user.circleMemberId
            ? 'IDs match - token might be expired or invalid'
            : `ID mismatch! DB has ${user.circleMemberId}, Circle has ${exactMatch.id}. Need to update DB.`)
        : 'No Circle member found for this email. Need to create one.',
    });
  } catch (error: any) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
