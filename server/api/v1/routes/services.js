/**
 * PLAYRIG API v1 - COMPANION SERVICES
 * Exposes registered companion services and capabilities.
 *
 * Author: Liath • Copyright: © GameChiller
 */

const express = require('express');
const router = express.Router();
const serviceManager = require('../../../services');

// GET /api/v1/services - List available companion services
router.get('/', (req, res) => {
  try {
    const list = serviceManager.listServices();
    res.json({
      success: true,
      data: list,
      meta: {
        total: list.length,
        version: 'v1.0.0',
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVICES_ERROR', message: err.message }
    });
  }
});

// GET /api/v1/services/:id/status - Health & status of specific service
router.get('/:id/status', async (req, res) => {
  try {
    const service = serviceManager.getService(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Service '${req.params.id}' nicht gefunden.` }
      });
    }

    const health = await service.healthCheck();
    res.json({
      success: true,
      data: {
        id: service.id,
        name: service.name,
        version: service.version,
        capabilities: service.capabilities,
        health
      },
      meta: { version: 'v1.0.0', timestamp: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVICE_STATUS_ERROR', message: err.message }
    });
  }
});

module.exports = router;
