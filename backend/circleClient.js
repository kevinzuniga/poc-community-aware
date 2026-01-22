/**
 * Circle.so API Client - Admin API v2 + Headless SDK
 *
 * Este cliente usa:
 * - Admin v2 Token para operaciones administrativas (crear miembros, posts)
 * - Headless SDK para generar member tokens
 * - Member tokens para autenticación en widgets
 */

const { createClient } = require('@circleco/headless-server-sdk');

const ADMIN_BASE_URL = 'https://app.circle.so/api/admin/v2';
const ADMIN_TOKEN = process.env.CIRCLE_ADMIN_TOKEN;
const HEADLESS_TOKEN = process.env.CIRCLE_HEADLESS_TOKEN;
const COMMUNITY_ID = process.env.CIRCLE_COMMUNITY_ID;
// En producción usa custom domain, en dev usa el dominio original de Circle
const CIRCLE_DOMAIN = process.env.CIRCLE_DOMAIN || 'fuxion-aware.circle.so';

// Space IDs
const SPACE_IDS = {
  curso: process.env.CIRCLE_SPACE_CURSO,
  comunidad: process.env.CIRCLE_SPACE_COMUNIDAD,
  anuncios: process.env.CIRCLE_SPACE_ANUNCIOS
};

// Headless SDK Client
const headlessClient = createClient({
  appToken: HEADLESS_TOKEN
});

// Cache para member tokens
const memberTokenCache = new Map();

/**
 * Helper para hacer requests a Circle API Admin v2
 */
const circleRequest = async (endpoint, options = {}) => {
  const url = `${ADMIN_BASE_URL}${endpoint}`;

  const headers = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  console.log(`[Circle API v2] ${options.method || 'GET'} ${endpoint}`);

  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || `Circle API error: ${response.status}`);
    error.status = response.status;
    error.data = data;
    console.error(`[Circle API v2] Error:`, data);
    throw error;
  }

  return data;
};

/**
 * Obtener un member access token usando Headless SDK
 * @param {number} circleMemberId - ID del miembro en Circle
 * @returns {Promise<Object>} - { accessToken, refreshToken, expiresAt }
 */
const getMemberToken = async (circleMemberId) => {
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
      expiresAt: new Date(response.access_token_expires_at).getTime() - (5 * 60 * 1000), // 5 min buffer
      communityMemberId: response.community_member_id
    };

    // Guardar en cache
    memberTokenCache.set(circleMemberId, tokenData);
    console.log(`[Headless SDK] Token generated for member ${circleMemberId}`);

    return tokenData;
  } catch (error) {
    console.error(`[Headless SDK] Error generating token:`, error);
    throw error;
  }
};

/**
 * Obtener URL para inyección de cookies (auto-login en widgets)
 * @param {string} accessToken - Access token del miembro
 * @param {string} returnUrl - URL opcional para redirigir después de la autenticación
 * @returns {string} - URL para redirección
 */
const getCookieInjectionUrl = (accessToken, returnUrl = null) => {
  let url = `https://${CIRCLE_DOMAIN}/session/cookies?access_token=${accessToken}`;
  if (returnUrl) {
    url += `&return_to=${encodeURIComponent(returnUrl)}`;
  }
  return url;
};

/**
 * Crear un nuevo miembro en la comunidad Circle
 */
const createMember = async ({ email, name }) => {
  const response = await circleRequest('/community_members', {
    method: 'POST',
    body: JSON.stringify({
      community_id: parseInt(COMMUNITY_ID),
      email,
      name: name || email.split('@')[0],
      skip_invitation: true
    })
  });

  return response.community_member || response;
};

/**
 * Buscar miembro por email
 */
const findMemberByEmail = async (email) => {
  try {
    const response = await circleRequest(
      `/community_members?community_id=${COMMUNITY_ID}&email=${encodeURIComponent(email)}`
    );

    if (response.records && response.records.length > 0) {
      const member = response.records.find(m => m.email.toLowerCase() === email.toLowerCase());
      return member || null;
    }
    return null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

/**
 * Obtener información del miembro
 */
const getMember = async (memberId) => {
  return circleRequest(`/community_members/${memberId}?community_id=${COMMUNITY_ID}`);
};

/**
 * Obtener posts de un space específico
 */
const getSpacePosts = async (spaceId) => {
  const response = await circleRequest(
    `/posts?community_id=${COMMUNITY_ID}&space_id=${spaceId}&status=published`
  );
  return response.records || [];
};

/**
 * Obtener posts del curso (Leadership Academy)
 */
const getCursoPosts = async () => {
  return getSpacePosts(SPACE_IDS.curso);
};

/**
 * Obtener posts de anuncios
 */
const getAnnouncementPosts = async () => {
  return getSpacePosts(SPACE_IDS.anuncios);
};

/**
 * Crear un anuncio en el space de Anuncios
 * Usa Admin API v2 para crear posts como admin
 */
const createAnnouncement = async ({ title, body }) => {
  const response = await circleRequest('/posts', {
    method: 'POST',
    body: JSON.stringify({
      community_id: parseInt(COMMUNITY_ID),
      space_id: parseInt(SPACE_IDS.anuncios),
      name: title,
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: body
              }
            ]
          }
        ]
      },
      status: 'published',
      is_pinned: false
    })
  });

  return response.post || response;
};

/**
 * Verificar conexión con Circle API
 */
const healthCheck = async () => {
  try {
    const response = await circleRequest(`/spaces?community_id=${COMMUNITY_ID}&per_page=1`);
    return {
      ok: true,
      spacesCount: response.count || 0,
      hasHeadlessToken: !!HEADLESS_TOKEN
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

/**
 * Obtener configuración de widgets (URLs de iframes)
 */
const getWidgetConfig = () => {
  return {
    domain: CIRCLE_DOMAIN,
    communityId: COMMUNITY_ID,
    spaces: {
      curso: {
        id: SPACE_IDS.curso,
        embedUrl: `https://${CIRCLE_DOMAIN}/c/leadership-academy?iframe=true`
      },
      comunidad: {
        id: SPACE_IDS.comunidad,
        embedUrl: `https://${CIRCLE_DOMAIN}/c/space-aware?iframe=true`
      },
      anuncios: {
        id: SPACE_IDS.anuncios,
        embedUrl: `https://${CIRCLE_DOMAIN}/c/anuncios?iframe=true`
      }
    }
  };
};

/**
 * Listar Access Groups de la comunidad
 */
const getAccessGroups = async () => {
  const response = await circleRequest(`/access_groups?community_id=${COMMUNITY_ID}`);
  return response.records || [];
};

/**
 * Agregar miembro a un Access Group
 * @param {string} email - Email del miembro
 * @param {number} accessGroupId - ID del access group
 */
const addMemberToAccessGroup = async (email, accessGroupId) => {
  const response = await circleRequest(`/access_groups/${accessGroupId}/community_members`, {
    method: 'POST',
    body: JSON.stringify({
      community_id: parseInt(COMMUNITY_ID),
      email
    })
  });
  return response;
};

/**
 * Obtener miembros de un Access Group
 * @param {number} accessGroupId - ID del access group
 */
const getAccessGroupMembers = async (accessGroupId) => {
  const response = await circleRequest(`/access_groups/${accessGroupId}/community_members?community_id=${COMMUNITY_ID}`);
  return response.records || [];
};

module.exports = {
  createMember,
  findMemberByEmail,
  getMember,
  getMemberToken,
  getCookieInjectionUrl,
  getSpacePosts,
  getCursoPosts,
  getAnnouncementPosts,
  createAnnouncement,
  healthCheck,
  getWidgetConfig,
  getAccessGroups,
  addMemberToAccessGroup,
  getAccessGroupMembers,
  SPACE_IDS,
  getConfig: () => ({
    adminBaseUrl: ADMIN_BASE_URL,
    communityId: COMMUNITY_ID,
    domain: CIRCLE_DOMAIN,
    hasAdminToken: !!ADMIN_TOKEN,
    hasHeadlessToken: !!HEADLESS_TOKEN,
    spaceIds: SPACE_IDS
  })
};
