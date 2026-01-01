const express = require('express');
const router = express.Router();

const { authMiddleware } = require('../middleware/auth');
const circleClient = require('../circleClient');

/**
 * GET /api/circle/health
 * Verificar conexión con Circle API (público)
 */
router.get('/health', async (req, res) => {
  try {
    const health = await circleClient.healthCheck();
    const config = circleClient.getConfig();

    res.json({
      circle: health,
      config: {
        domain: config.domain,
        communityId: config.communityId,
        hasAdminToken: config.hasAdminToken,
        hasHeadlessToken: config.hasHeadlessToken,
        spaceIds: config.spaceIds
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' });
  }
});

/**
 * GET /api/circle/widget-config
 * Obtener configuración de widgets (público)
 */
router.get('/widget-config', (req, res) => {
  const config = circleClient.getWidgetConfig();
  res.json(config);
});

// Endpoints que requieren autenticación
router.use(authMiddleware);

/**
 * Verificar que el usuario tiene circle_member_id
 */
const requireCircleMember = (req, res, next) => {
  if (!req.user.circleMemberId) {
    return res.status(400).json({
      error: 'User is not linked to Circle. Please contact support.'
    });
  }
  next();
};

/**
 * GET /api/circle/auth-url
 * Obtener URL para inyección de cookies (auto-login en widgets)
 * El frontend redirige a esta URL en un iframe oculto para autenticar
 */
router.get('/auth-url', requireCircleMember, async (req, res) => {
  try {
    const tokenData = await circleClient.getMemberToken(req.user.circleMemberId);
    const authUrl = circleClient.getCookieInjectionUrl(tokenData.accessToken);

    res.json({
      authUrl,
      expiresAt: tokenData.expiresAt
    });
  } catch (error) {
    console.error('Error getting auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authentication URL' });
  }
});

/**
 * GET /api/circle/auth-redirect
 * Redirige directamente al usuario a Circle para inyectar cookies
 * Esta es la mejor opción para evitar problemas de third-party cookies
 */
router.get('/auth-redirect', requireCircleMember, async (req, res) => {
  try {
    const tokenData = await circleClient.getMemberToken(req.user.circleMemberId);
    const returnUrl = process.env.FRONTEND_URL + '?circle_auth=success';
    const authUrl = circleClient.getCookieInjectionUrl(tokenData.accessToken, returnUrl);

    console.log(`[Circle Auth] Redirecting user ${req.user.id} to Circle for auth`);
    console.log(`[Circle Auth] Auth URL: ${authUrl.substring(0, 100)}...`);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error in auth redirect:', error);
    res.redirect(process.env.FRONTEND_URL + '?circle_auth_error=true');
  }
});

/**
 * GET /api/circle/auth-callback
 * Callback después de la autenticación en Circle
 * Circle redirige aquí después de inyectar las cookies
 */
router.get('/auth-callback', (req, res) => {
  console.log('[Circle Auth] Callback received, redirecting to frontend');
  res.redirect(process.env.FRONTEND_URL + '?circle_auth=success');
});

/**
 * GET /api/circle/member-token
 * Obtener token del miembro para uso directo (si se necesita)
 */
router.get('/member-token', requireCircleMember, async (req, res) => {
  try {
    const tokenData = await circleClient.getMemberToken(req.user.circleMemberId);

    res.json({
      accessToken: tokenData.accessToken,
      expiresAt: tokenData.expiresAt,
      communityMemberId: tokenData.communityMemberId
    });
  } catch (error) {
    console.error('Error getting member token:', error);
    res.status(500).json({ error: 'Failed to get member token' });
  }
});

/**
 * GET /api/circle/curso/posts
 * Obtener posts del curso (para mostrar estructura en el frontend)
 */
router.get('/curso/posts', requireCircleMember, async (req, res) => {
  try {
    const posts = await circleClient.getCursoPosts();

    // Organizar posts por tipo (módulos y lecciones)
    const organized = {
      modulos: [],
      lecciones: []
    };

    posts.forEach(post => {
      const postData = {
        id: post.id,
        name: post.name,
        slug: post.slug,
        url: post.url,
        commentsCount: post.comments_count,
        likesCount: post.likes_count
      };

      if (post.name.toLowerCase().includes('modulo')) {
        organized.modulos.push(postData);
      } else if (post.name.toLowerCase().includes('leccion')) {
        organized.lecciones.push(postData);
      } else {
        // Es el post de bienvenida u otro
        organized.modulos.unshift(postData);
      }
    });

    res.json({
      posts,
      organized
    });
  } catch (error) {
    console.error('Error fetching curso posts:', error);
    res.status(500).json({ error: 'Failed to fetch curso posts' });
  }
});

/**
 * GET /api/circle/spaces/:spaceKey/posts
 * Obtener posts de cualquier space
 */
router.get('/spaces/:spaceKey/posts', requireCircleMember, async (req, res) => {
  try {
    const { spaceKey } = req.params;
    const spaceId = circleClient.SPACE_IDS[spaceKey];

    if (!spaceId) {
      return res.status(404).json({ error: 'Space not found' });
    }

    const posts = await circleClient.getSpacePosts(spaceId);
    res.json({ posts });
  } catch (error) {
    console.error('Error fetching space posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

/**
 * POST /api/circle/admin/announcements
 * Crear un anuncio en el space de Anuncios (solo admin)
 */
router.post('/admin/announcements', requireCircleMember, async (req, res) => {
  try {
    // Verificar que es admin (por ahora verificamos por email)
    if (!req.user.email.includes('admin') && !req.user.email.includes('kevin')) {
      return res.status(403).json({ error: 'Only admins can create announcements' });
    }

    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    const post = await circleClient.createAnnouncement({ title, body });

    res.status(201).json({
      message: 'Announcement created successfully',
      post
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

/**
 * GET /api/circle/announcements
 * Obtener lista de anuncios
 */
router.get('/announcements', requireCircleMember, async (req, res) => {
  try {
    const posts = await circleClient.getAnnouncementPosts();
    res.json({ posts });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

module.exports = router;
