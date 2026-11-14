/**
 * PLAYRIG API v1 - AUTH & PERMISSION MIDDLEWARE (SECURED)
 * Provides central GameChiller user identity, API-client verification, scope validation, and guest mode.
 *
 * Security:
 * - API-Client Authentication via X-API-Key
 * - Server-side Scope Enforcement
 * - External GameChiller identity verification (zero local admin escalation)
 * - Safe standard permissions for new users
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
  service: [
    'rigs:read',
    'storage:rig',
    'server:read'
  ],
  guest: [
    'rigs:read',
    'storage:session'
  ]
};

async function authenticateToken(req, res, next) {
  // 1. Check API-Client Key (X-API-Key Header for authorized GameChiller components)
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (apiKey) {
    try {
      const client = await db.getClientByApiKey(apiKey);
      if (client && client.status === 'active') {
        req.apiClient = client;
        req.user = {
          id: client.client_id,
          username: client.name,
          name: client.name,
          role: 'service',
          scopes: Array.isArray(client.scopes) ? client.scopes : (ROLE_SCOPES.service)
        };
        req.isGuest = false;
        return next();
      }
    } catch (e) {
      console.warn('[PlayRig API Auth] API-Key validation error:', e.message);
    }
  }

  // 2. Check User Bearer Token
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
        // Gated: External identities never automatically inherit admin role
        req.user.scopes = ROLE_SCOPES[user.role] || ROLE_SCOPES.user;
        return next();
      }
    } catch (e) {}
  }

  // 3. Fallback to Guest User with restricted permissions
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
