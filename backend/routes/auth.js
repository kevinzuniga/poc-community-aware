const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { createUser, findUserByEmail } = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');
const circleClient = require('../circleClient');

const SALT_ROUNDS = 10;

/**
 * POST /auth/register
 * Registrar nuevo usuario
 * Body: { email, password, name? }
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Verificar si el usuario ya existe
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hashear password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Crear miembro en Circle
    let circleMember = null;
    let circleMemberId = null;

    try {
      // Primero verificar si ya existe en Circle
      circleMember = await circleClient.findMemberByEmail(email);

      if (circleMember) {
        circleMemberId = circleMember.id;
        console.log(`Member already exists in Circle: ${circleMemberId}`);
      } else {
        // Crear nuevo miembro
        circleMember = await circleClient.createMember({
          email,
          name: name || email.split('@')[0]
        });
        circleMemberId = circleMember.id;
        console.log(`Created new Circle member: ${circleMemberId}`);
      }

      // Agregar miembro al Access Group por defecto (LA Feb 2026)
      const defaultAccessGroupId = process.env.CIRCLE_DEFAULT_ACCESS_GROUP_ID;
      if (defaultAccessGroupId) {
        try {
          await circleClient.addMemberToAccessGroup(email, parseInt(defaultAccessGroupId));
          console.log(`Added member ${email} to access group ${defaultAccessGroupId}`);
        } catch (accessGroupError) {
          console.error('Error adding member to access group:', accessGroupError.message);
          // No falla el registro si no se puede agregar al access group
        }
      }
    } catch (circleError) {
      console.error('Error creating Circle member:', circleError);
      // Continuar sin Circle member ID - se puede reintentar después
    }

    // Crear usuario en DB local
    const user = await createUser({
      email,
      password_hash,
      name: name || email.split('@')[0],
      circle_member_id: circleMemberId
    });

    // Generar token
    const token = generateToken({
      id: user.id,
      email: user.email,
      circle_member_id: circleMemberId
    });

    // Establecer cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        circleMemberId: circleMemberId
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * POST /auth/login
 * Iniciar sesión
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Buscar usuario
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verificar password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generar token
    const token = generateToken({
      id: user.id,
      email: user.email,
      circle_member_id: user.circle_member_id
    });

    // Establecer cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        circleMemberId: user.circle_member_id
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

/**
 * POST /auth/logout
 * Cerrar sesión
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /auth/me
 * Obtener usuario actual
 */
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: req.user
  });
});

module.exports = router;
