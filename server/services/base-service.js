/**
 * PLAYRIG - BASE BACKEND SERVICE
 * Abstract interface for game engines, save editors, and platform companion services.
 */

class BaseService {
  constructor(options = {}) {
    this.id = options.id || 'base-service';
    this.name = options.name || 'Unnamed Service';
    this.version = options.version || '1.0.0';
    this.game = options.game || null;
    this.description = options.description || '';
    this.capabilities = options.capabilities || [];
    this.status = 'initialized'; // 'initialized', 'ready', 'error'
    this.error = null;
  }

  /**
   * Called during server startup to initialize dependencies, load catalogs, etc.
   * @param {Object} context - Server context { rootDir, db, logger }
   */
  async init(context) {
    this.status = 'ready';
    return true;
  }

  /**
   * Health and capability report
   */
  async healthCheck() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      game: this.game,
      status: this.status,
      capabilities: this.capabilities,
      error: this.error ? this.error.message : null
    };
  }

  /**
   * Register Express REST API routes for this service.
   * Routes are mounted under `/api/services/${this.id}/`
   * @param {express.Router} router 
   * @param {Object} context 
   */
  registerRoutes(router, context) {
    // Override in subclass
  }
}

module.exports = BaseService;

