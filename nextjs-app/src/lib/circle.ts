/**
 * Circle.so API Client - Admin API v2 + Headless SDK
 */

import { createClient } from '@circleco/headless-server-sdk';

const ADMIN_BASE_URL = 'https://app.circle.so/api/admin/v2';
const ADMIN_TOKEN = process.env.CIRCLE_ADMIN_TOKEN!;
const HEADLESS_TOKEN = process.env.CIRCLE_HEADLESS_TOKEN!;
const COMMUNITY_ID = process.env.CIRCLE_COMMUNITY_ID!;
const CIRCLE_DOMAIN = process.env.CIRCLE_DOMAIN || 'fuxion-aware.circle.so';

export const SPACE_IDS = {
  curso: process.env.CIRCLE_SPACE_CURSO!,
  comunidad: process.env.CIRCLE_SPACE_COMUNIDAD!,
  anuncios: process.env.CIRCLE_SPACE_ANUNCIOS!,
};

// Headless SDK Client
const headlessClient = createClient({
  appToken: HEADLESS_TOKEN,
});

// Cache para member tokens (en memoria - en producción usar Redis/KV)
const memberTokenCache = new Map<number, { accessToken: string; expiresAt: number }>();

/**
 * Helper para requests a Circle API Admin v2
 */
async function circleRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${ADMIN_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  console.log(`[Circle API v2] ${options.method || 'GET'} ${endpoint}`);

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`[Circle API v2] Error:`, data);
    throw new Error(data?.message || `Circle API error: ${response.status}`);
  }

  return data;
}

/**
 * Obtener member access token usando Headless SDK
 */
export async function getMemberToken(circleMemberId: number) {
  // Verificar cache
  const cached = memberTokenCache.get(circleMemberId);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[Headless SDK] Using cached token for member ${circleMemberId}`);
    return cached;
  }

  try {
    console.log(`[Headless SDK] Generating token for member ${circleMemberId}`);
    const response = await headlessClient.getMemberAPITokenFromCommunityMemberId(circleMemberId);

    const tokenData = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: new Date(response.access_token_expires_at).getTime() - (5 * 60 * 1000),
      communityMemberId: response.community_member_id,
    };

    memberTokenCache.set(circleMemberId, tokenData);
    console.log(`[Headless SDK] Token generated for member ${circleMemberId}`);

    return tokenData;
  } catch (error) {
    console.error(`[Headless SDK] Error generating token:`, error);
    throw error;
  }
}

/**
 * Obtener URL para inyección de cookies (auto-login)
 */
export function getCookieInjectionUrl(accessToken: string, returnUrl?: string) {
  let url = `https://${CIRCLE_DOMAIN}/session/cookies?access_token=${accessToken}`;
  if (returnUrl) {
    url += `&return_to=${encodeURIComponent(returnUrl)}`;
  }
  return url;
}

/**
 * Crear un nuevo miembro en Circle
 */
export async function createMember({ email, name }: { email: string; name: string }) {
  const response = await circleRequest('/community_members', {
    method: 'POST',
    body: JSON.stringify({
      community_id: parseInt(COMMUNITY_ID),
      email,
      name: name || email.split('@')[0],
      skip_invitation: true,
    }),
  });

  return response.community_member || response;
}

/**
 * Buscar miembro por email
 */
export async function findMemberByEmail(email: string) {
  try {
    const response = await circleRequest(
      `/community_members?community_id=${COMMUNITY_ID}&email=${encodeURIComponent(email)}`
    );

    if (response.records?.length > 0) {
      return response.records.find((m: any) => m.email.toLowerCase() === email.toLowerCase()) || null;
    }
    return null;
  } catch (error: any) {
    if (error.status === 404) return null;
    throw error;
  }
}

/**
 * Obtener posts del curso
 */
export async function getCursoPosts() {
  const response = await circleRequest(
    `/posts?community_id=${COMMUNITY_ID}&space_id=${SPACE_IDS.curso}&status=published`
  );
  return response.records || [];
}

/**
 * Health check
 */
export async function healthCheck() {
  try {
    const response = await circleRequest(`/spaces?community_id=${COMMUNITY_ID}&per_page=1`);
    return {
      ok: true,
      spacesCount: response.count || 0,
      hasHeadlessToken: !!HEADLESS_TOKEN,
    };
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

export function getConfig() {
  return {
    domain: CIRCLE_DOMAIN,
    communityId: COMMUNITY_ID,
    hasAdminToken: !!ADMIN_TOKEN,
    hasHeadlessToken: !!HEADLESS_TOKEN,
    spaceIds: SPACE_IDS,
  };
}
