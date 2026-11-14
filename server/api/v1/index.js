/**
 * PLAYRIG CENTRAL API v1 - ROOT ROUTER
 * Unified Entrypoint for GameChiller Platform & Auths.
 *
 * Author: Liath • Copyright: © GameChiller
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./middleware/auth');

// Apply global V1 auth & guest context extractor
router.use(authenticateToken);

// Mount Submodules
router.use('/auth', require('./routes/auth'));
router.use('/rigs', require('./routes/rigs'));
router.use('/storage', require('./routes/storage'));
router.use('/services', require('./routes/services'));
router.use('/docs', require('./routes/docs'));
router.use('/updater', require('./routes/updater'));

// Root V1 Info
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'PlayRig Integration API',
      version: 'v1.0.0',
      status: 'active',
      ecosystem: 'GameChiller Network',
      endpoints: {
        auth: '/api/v1/auth',
        rigs: '/api/v1/rigs',
        storage: '/api/v1/storage',
        services: '/api/v1/services',
        docs: '/api/v1/docs',
        updater: '/api/v1/updater'
      }
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;

