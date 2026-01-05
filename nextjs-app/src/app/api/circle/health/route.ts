import { NextResponse } from 'next/server';
import { healthCheck, getConfig } from '@/lib/circle';

export async function GET() {
  try {
    const health = await healthCheck();
    const config = getConfig();

    return NextResponse.json({
      circle: health,
      config: {
        domain: config.domain,
        communityId: config.communityId,
        hasAdminToken: config.hasAdminToken,
        hasHeadlessToken: config.hasHeadlessToken,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}
