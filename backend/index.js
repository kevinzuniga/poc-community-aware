require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { initDb } = require('./db');
const authRoutes = require('./routes/auth');
const circleRoutes = require('./routes/circle');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Rutas
app.use('/auth', authRoutes);
app.use('/api/circle', circleRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasCircleAdminToken: !!process.env.CIRCLE_ADMIN_TOKEN,
      hasCircleHeadlessToken: !!process.env.CIRCLE_HEADLESS_TOKEN,
      hasCommunityId: !!process.env.CIRCLE_COMMUNITY_ID,
      hasSpaceCurso: !!process.env.CIRCLE_SPACE_CURSO,
      hasSpaceComunidad: !!process.env.CIRCLE_SPACE_COMUNIDAD,
      hasSpaceAnuncios: !!process.env.CIRCLE_SPACE_ANUNCIOS
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Inicializar DB y arrancar servidor
const startServer = async () => {
  try {
    await initDb();

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║         Web POC v2 - Circle Widgets Backend            ║
╠════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                          ║
║                                                        ║
║  Auth:                                                 ║
║  POST /auth/register       - Register + create member  ║
║  POST /auth/login          - Login                     ║
║  POST /auth/logout         - Logout                    ║
║  GET  /auth/me             - Get current user          ║
║                                                        ║
║  Circle Widgets:                                       ║
║  GET  /api/circle/health       - API health check      ║
║  GET  /api/circle/widget-config - Widget URLs          ║
║  GET  /api/circle/auth-url     - Cookie injection URL  ║
║  GET  /api/circle/member-token - Member access token   ║
║  GET  /api/circle/curso/posts  - Curso posts           ║
║                                                        ║
║  GET  /health              - Server health check       ║
╚════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
