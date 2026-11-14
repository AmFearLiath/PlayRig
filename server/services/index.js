/**
 * PLAYRIG - BACKEND SERVICE MANAGER
 * Central registry, discovery and lifecycle coordinator for all backend companion services.
 */

const fs = require('fs');
const path = require('path');

class ServiceManager {
  constructor() {
    this.services = new Map();
    this.context = null;
  }

  /**
   * Register a service instance
   * @param {BaseService} serviceInstance 
   */
  register(serviceInstance) {
    if (!serviceInstance || !serviceInstance.id) {
      console.warn('[ServiceManager] Ungültiger Service übergeben.');
      return;
    }
    this.services.set(serviceInstance.id, serviceInstance);
    console.log(`[ServiceManager] Service registriert: ${serviceInstance.name} (v${serviceInstance.version}) [ID: ${serviceInstance.id}]`);
  }

  /**
   * Auto-discover services in subdirectories of server/services/
   */
  autoDiscover() {
    const servicesDir = __dirname;
    const entries = fs.readdirSync(servicesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const serviceIndexPath = path.join(servicesDir, entry.name, 'index.js');
        if (fs.existsSync(serviceIndexPath)) {
          try {
            const serviceMod = require(serviceIndexPath);
            const instance = typeof serviceMod === 'function' ? new serviceMod() : serviceMod;
            this.register(instance);
          } catch (err) {
            console.error(`[ServiceManager] Fehler beim Laden des Service '${entry.name}':`, err);
          }
        }
      }
    }
  }

  /**
   * Initialize all registered services
   * @param {Object} context 
   */
  async initAll(context) {
    this.context = context;
    for (const [id, service] of this.services.entries()) {
      try {
        if (typeof service.init === 'function') {
          await service.init(context);
        }
      } catch (err) {
        console.error(`[ServiceManager] Fehler bei init() von '${id}':`, err);
        service.status = 'error';
        service.error = err;
      }
    }
  }

  get(id) {
    return this.services.get(id);
  }

  has(id) {
    return this.services.has(id);
  }

  list() {
    return Array.from(this.services.values()).map(s => ({
      id: s.id,
      name: s.name,
      version: s.version,
      game: s.game || null,
      description: s.description || '',
      capabilities: s.capabilities || [],
      status: s.status || 'ready'
    }));
  }

  /**
   * Mount Express routes for all services
   * @param {express.Application} app 
   */
  registerRoutes(app) {
    // 1. General Services discovery endpoint
    app.get('/api/services', (req, res) => {
      res.json({
        total: this.services.size,
        services: this.list()
      });
    });

    // 2. Specific Service status endpoint
    app.get('/api/services/:id/status', async (req, res) => {
      const s = this.get(req.params.id);
      if (!s) {
        return res.status(404).json({ error: `Service '${req.params.id}' nicht gefunden` });
      }
      const health = typeof s.healthCheck === 'function' ? await s.healthCheck() : { id: s.id, status: s.status };
      res.json(health);
    });

    // 3. Delegate to each service's own routes if implemented
    for (const [id, service] of this.services.entries()) {
      if (typeof service.registerRoutes === 'function') {
        const express = require('express');
        const router = express.Router();
        service.registerRoutes(router, this.context);
        app.use(`/api/services/${id}`, router);
      }
    }
  }
}

// Singleton instance
const manager = new ServiceManager();
manager.autoDiscover();

module.exports = manager;

