/**
 * PLAYRIG API v1 - AUTH & IDENTITY ROUTES
 * Provides central GameChiller user identity, context sync, and guest access.
 *
 * Author: Liath • Copyright: © GameChiller
 */

const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/v1/auth/me - Current user profile and scopes
router.get('/me', (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
      isGuest: req.isGuest,
      scopes: req.user.scopes || []
    },
    meta: {
      version: 'v1.0.0',
      timestamp: new Date().toISOString()
    }
  });
});

// GET /api/v1/auth/guest - Generates a standardized guest identity
router.get('/guest', (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: 'guest_' + Math.random().toString(36).substring(2, 9),
        username: 'gast',
        name: 'Gastspieler',
        role: 'guest',
        scopes: ['rigs:read', 'storage:session']
      },
      isGuest: true
    },
    meta: {
      version: 'v1.0.0',
      timestamp: new Date().toISOString()
    }
  });
});

// GET /api/v1/auth/context - Full GameChiller context payload
router.get('/context', (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.name || req.user.username,
        role: req.user.role,
        isGuest: req.isGuest
      },
      community: {
        id: 'c-gamechiller-01',
        name: 'GameChiller Network',
        slug: 'gamechiller',
        role: req.user.role === 'admin' ? 'owner' : 'member'
      },
      game: null,
      server: {
        id: 'srv-playrig-local',
        name: 'PlayRig Local Development Node',
        status: 'online'
      },
      permissions: req.user.scopes || [],
      platform: {
        engine: 'PlayRig Engine',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    },
    meta: {
      version: 'v1.0.0',
      timestamp: new Date().toISOString()
    }
  });
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Benutzername und Passwort sind erforderlich.' }
    });
  }

  try {
    const result = await db.authenticate(username, password);
    if (!result) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Ungültige Anmeldedaten.' }
      });
    }

    res.json({
      success: true,
      data: result,
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: err.message }
    });
  }
});

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Benutzername und Passwort sind erforderlich.' }
    });
  }

  try {
    await db.registerUser(username, displayName || username, password, 'user');
    const auth = await db.authenticate(username, password);
    res.status(201).json({
      success: true,
      data: auth,
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: err.message }
    });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    try { await db.logout(token); } catch (e) {}
  }
  res.json({
    success: true,
    data: { message: 'Erfolgreich abgemeldet.' },
    meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
  });
});

module.exports = router;
