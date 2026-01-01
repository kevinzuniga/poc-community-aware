const jwt = require('jsonwebtoken');
const { findUserById } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Generar JWT token para un usuario
 */
const generateToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    circleMemberId: user.circle_member_id
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verificar y decodificar JWT token
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

/**
 * Middleware de autenticación
 * Busca el token en:
 * 1. Header Authorization: Bearer <token>
 * 2. Cookie: token
 */
const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // Buscar en header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Buscar en cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Verificar token
    const decoded = verifyToken(token);

    // Obtener usuario de la DB
    const user = await findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Agregar usuario al request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      circleMemberId: user.circle_member_id
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Middleware opcional - no falla si no hay token
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = verifyToken(token);
      const user = await findUserById(decoded.userId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          circleMemberId: user.circle_member_id
        };
      }
    }

    next();
  } catch (error) {
    // Token inválido, continuar sin usuario
    next();
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  optionalAuth,
  JWT_SECRET
};
