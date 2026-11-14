/**
 * PLAYRIG API v1 - AUTH & PERMISSION MIDDLEWARE
 * Provides central GameChiller user identity, scope verification, and guest mode.
 *
 * Author: Liath • Copyright: © GameChiller
 */

const db = require('../../../db');

// Scope hierarchy / default role permissions
const ROLE_SCOPES = {
  admin: [
    '*',
    'rigs:read', 'rigs:write', 'rigs:admin',
    'storage:user', 'storage:rig', 'storage:global',
    'server:manage', 'services:manage', 'community:admin'
  ],
  creator: [
    'rigs:read', 'rigs:write',
    'storage:user', 'storage:rig',
    'server:read', 'community:read'
  ],
  user: [
    'rigs:read',
    'storage:user',
    'community:read'
  ],
  guest: [
    'rigs:read',
    'storage:session'
  ]
};

async function authenticateToken(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const user = await db.getUserByToken(token);
      if (user) {
        req.user = user;
        req.isGuest = false;
        req.user.scopes = ROLE_SCOPES[user.role] || ROLE_SCOPES.user;
        return next();
      }
    } catch (e) {}
  }

  // Fallback to Guest User with restricted permissions
  req.user = {
    id: 'guest',
    username: 'gast',
    name: 'Gastspieler',
    role: 'guest',
    scopes: ROLE_SCOPES.guest
  };
  req.isGuest = true;
  next();
}

function requireAuth(req, res, next) {
  if (req.isGuest || !req.user || req.user.id === 'guest') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentifizierung erforderlich. Bitte über GameChiller anmelden.'
      }
    });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Administrator-Berechtigung erforderlich.'
      }
    });
  }
  next();
}

function requireScope(scope) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Authentifizierung erforderlich.' }
      });
    }

    const userScopes = req.user.scopes || [];
    const hasScope = userScopes.includes('*') || userScopes.includes(scope);
    if (!hasScope) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `Fehlende Berechtigung. Erforderlicher Scope: '${scope}'.`,
          requiredScope: scope
        }
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireAuth,
  requireAdmin,
  requireScope,
  ROLE_SCOPES
};
