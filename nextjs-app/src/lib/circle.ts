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
 * Obtener member access token usando EMAIL directamente
 * Esto puede crear/activar al miembro automáticamente
 */
export async function getMemberTokenByEmail(email: string) {
  console.log(`[Headless] Getting token for email: ${email}`);

  try {
    const response = await fetch('https://app.circle.so/api/v1/headless/auth_token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HEADLESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Headless] Error response:`, data);
      throw new Error(data.message || `Auth failed: ${response.status}`);
    }

    console.log(`[Headless] Token obtained for email ${email}, member_id: ${data.community_member_id}`);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.access_token_expires_at).getTime() - (5 * 60 * 1000),
      communityMemberId: data.community_member_id,
    };
  } catch (error) {
    console.error(`[Headless] Error getting token by email:`, error);
    throw error;
  }
}

/**
 * Obtener member access token usando Headless SDK (por member ID)
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
 *
 * Usamos skip_invitation=true para no enviar emails.
 * El miembro puede quedar inactivo, pero intentaremos
 * autenticarlo via nuestro sistema propio.
 */
export async function createMember({ email, name }: { email: string; name: string }) {
  console.log(`[Circle] Creating member with email: ${email}, name: ${name}`);
  console.log(`[Circle] Using skip_invitation=true to avoid sending email`);

  const response = await circleRequest('/community_members', {
    method: 'POST',
    body: JSON.stringify({
      community_id: parseInt(COMMUNITY_ID),
      email,
      name: name || email.split('@')[0],
      skip_invitation: true,  // Don't send email, we'll handle auth ourselves
    }),
  });

  const member = response.community_member || response;
  console.log(`[Circle] Created member:`, {
    id: member.id,
    email: member.email,
    name: member.name,
    active: member.active,
  });

  // Verify the created member has the correct email
  if (member.email?.toLowerCase() !== email.toLowerCase()) {
    console.error(`[Circle] WARNING: Created member email (${member.email}) doesn't match requested email (${email})`);
  }

  return member;
}

/**
 * Buscar miembro por email - STRICT exact match only
 */
export async function findMemberByEmail(email: string) {
  try {
    console.log(`[Circle] Searching for member with exact email: ${email}`);

    const response = await circleRequest(
      `/community_members?community_id=${COMMUNITY_ID}&email=${encodeURIComponent(email)}`
    );

    console.log(`[Circle] Search returned ${response.records?.length || 0} records`);

    if (response.records?.length > 0) {
      // STRICT: Only return if email matches EXACTLY
      const exactMatch = response.records.find(
        (m: any) => m.email && m.email.toLowerCase() === email.toLowerCase()
      );

      if (exactMatch) {
        console.log(`[Circle] Found exact match: id=${exactMatch.id}, email=${exactMatch.email}`);
        return exactMatch;
      } else {
        console.log(`[Circle] No exact email match found among ${response.records.length} records`);
        // Log what emails were returned for debugging
        response.records.forEach((m: any) => {
          console.log(`[Circle]   - Record: id=${m.id}, email=${m.email}`);
        });
      }
    }

    console.log(`[Circle] No member found with email: ${email}`);
    return null;
  } catch (error: any) {
    console.error(`[Circle] Error searching for member:`, error);
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
