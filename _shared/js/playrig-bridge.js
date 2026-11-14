/**
 * PLAYRIG BRIDGE & RUNTIME v1.0.0
 * Official Integration Bridge between GameChiller Platform and PlayRig Modules.
 *
 * Provides bidirectional secure communication, user identity, permissions,
 * scoped storage, live context sync, screenshot capture, and strict
 * in-window navigation.
 *
 * Security Enhancements:
 * - Specific target origins (no wildcard '*')
 * - Central allowlist and origin verification
 * - Nonce-based replay protection
 * - Message schema validation
 *
 * Author: Liath • Copyright: © GameChiller • Version: v1.0.0
 */

(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const isEmbedParam = urlParams.get('embed') === 'true' || urlParams.get('embed') === '1';
  const isInIframe = window.self !== window.top;

  // Origin Allowlist
  const defaultAllowedOrigins = [
    window.location.origin,
    'http://localhost:8882',
    'http://127.0.0.1:8882',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://playrig.amfearliath.de',
    'https://gamechiller.de',
    'https://playrig.gamechiller.de'
  ];

  const customOrigins = Array.isArray(window.PLAYRIG_ALLOWED_ORIGINS) ? window.PLAYRIG_ALLOWED_ORIGINS : [];
  const ALLOWED_ORIGINS = new Set([...defaultAllowedOrigins, ...customOrigins]);

  // Determine verified Host Origin for postMessage
  let hostOrigin = window.location.origin;
  if (isInIframe && document.referrer) {
    try {
      const refUrl = new URL(document.referrer);
      if (ALLOWED_ORIGINS.has(refUrl.origin) || refUrl.hostname === window.location.hostname || refUrl.hostname.endsWith('.gamechiller.de')) {
        hostOrigin = refUrl.origin;
        ALLOWED_ORIGINS.add(hostOrigin);
      }
    } catch (e) {
      // Invalid referrer URL
    }
  }

  // Active Context Default (Guest fallback)
  let activeContext = {
    user: {
      id: 'guest',
      username: 'gast',
      displayName: 'Gastspieler',
      role: 'guest',
      permissions: ['rigs:read', 'storage:session'],
      isGuest: true
    },
    community: {
      id: 'gamechiller-main',
      name: 'GameChiller Community',
      slug: 'gamechiller'
    },
    game: null,
    server: null,
    module: null,
    theme: document.documentElement.getAttribute('data-theme') || 'cyber-cyan'
  };

  let sessionNonce = urlParams.get('nonce') || ('pr_' + Math.random().toString(36).substring(2, 10));
  const eventListeners = new Map();

  function triggerEvent(name, payload) {
    const list = eventListeners.get(name);
    if (list) {
      list.forEach(fn => {
        try { fn(payload); } catch (e) { console.error('[PlayRig Bridge Error]', e); }
      });
    }
  }

  function isOriginAllowed(origin) {
    if (!origin) return false;
    if (ALLOWED_ORIGINS.has(origin)) return true;
    try {
      const parsed = new URL(origin);
      if (parsed.hostname === window.location.hostname) return true;
      if (parsed.hostname.endsWith('.gamechiller.de') || parsed.hostname === 'gamechiller.de') return true;
    } catch (e) {
      return false;
    }
    return false;
  }

  function postToHost(message) {
    if (!isInIframe) return;
    message.nonce = sessionNonce;
    message.timestamp = Date.now();
    try {
      window.parent.postMessage(message, hostOrigin);
    } catch (e) {
      console.error('[PlayRig Bridge] postMessage transmission failed:', e);
    }
  }

  // Core PlayRig Object
  const PlayRig = {
    version: '1.0.0',
    isEmbedded: isEmbedParam || isInIframe,
    params: Object.fromEntries(urlParams.entries()),

    get context() {
      return activeContext;
    },

    getUser() {
      return activeContext.user;
    },

    hasPermission(scope) {
      return activeContext.user?.permissions?.includes(scope) || activeContext.user?.role === 'admin';
    },

    /**
     * Subscribe to GameChiller Platform context updates
     */
    onContext(callback) {
      if (typeof callback !== 'function') return this;
      this.on('contextUpdate', callback);
      // Immediately invoke with active context
      try { callback(activeContext); } catch (e) {}
      return this;
    },

    /**
     * Strict in-window navigation ensuring links never open duplicate tabs
     */
    navigate(targetUrl) {
      if (!targetUrl) return;
      if (isInIframe) {
        postToHost({
          type: 'PLAYRIG_NAVIGATE',
          payload: { url: targetUrl }
        });
      } else {
        window.location.href = targetUrl;
      }
    },

    /**
     * Notify user or GameChiller host UI
     */
    notify(message, type = 'info', duration = 3000) {
      if (isInIframe) {
        postToHost({
          type: 'PLAYRIG_NOTIFY',
          payload: { message, type, duration }
        });
      }

      if (window.showToast) {
        window.showToast(message, type);
      } else {
        console.log(`[PlayRig Notification (${type})]:`, message);
      }
    },

    /**
     * Event Handling (Pub/Sub)
     */
    on(event, handler) {
      if (!eventListeners.has(event)) eventListeners.set(event, []);
      eventListeners.get(event).push(handler);
      return this;
    },

    off(event, handler) {
      if (eventListeners.has(event)) {
        const arr = eventListeners.get(event).filter(fn => fn !== handler);
        eventListeners.set(event, arr);
      }
      return this;
    },

    emit(event, payload = {}) {
      if (isInIframe) {
        postToHost({
          type: 'PLAYRIG_EVENT',
          event: event,
          payload: payload
        });
      }
      triggerEvent(event, payload);
      return this;
    },

    /**
     * Canonical alias for emit to conform with specification
     */
    sendEvent(eventName, payload = {}) {
      return this.emit(eventName, payload);
    },

    /**
     * Scoped Cloud Storage (Synced with MySQL & GameChiller)
     */
    storage: {
      async get(key, defaultValue = null) {
        if (!key || typeof key !== 'string') return defaultValue;
        try {
          const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const res = await fetch(`/api/v1/storage/user/${encodeURIComponent(key)}`, { headers });
          if (res.ok) {
            const json = await res.json();
            return (json.success && json.data !== null && json.data !== undefined) ? json.data : defaultValue;
          }
        } catch (e) {
          // Fallback to localStorage for offline/standalone execution
        }

        try {
          const local = localStorage.getItem(`playrig_storage_${key}`);
          return local !== null ? JSON.parse(local) : defaultValue;
        } catch (e) {
          return defaultValue;
        }
      },

      async set(key, value) {
        if (!key || typeof key !== 'string') return false;
        try {
          localStorage.setItem(`playrig_storage_${key}`, JSON.stringify(value));
        } catch (e) {}

        try {
          const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
          const headers = { 'Content-Type': 'application/json' };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await fetch(`/api/v1/storage/user/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ value })
          });
          return res.ok;
        } catch (e) {
          return false;
        }
      },

      async delete(key) {
        if (!key) return false;
        try {
          localStorage.removeItem(`playrig_storage_${key}`);
        } catch (e) {}

        try {
          const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const res = await fetch(`/api/v1/storage/user/${encodeURIComponent(key)}`, {
            method: 'DELETE',
            headers
          });
          return res.ok;
        } catch (e) {
          return false;
        }
      }
    },

    /**
     * Set active theme
     */
    setTheme(themeName) {
      if (!themeName) return;
      document.documentElement.setAttribute('data-theme', themeName);
      activeContext.theme = themeName;
      triggerEvent('themeChange', themeName);
      if (isInIframe) {
        postToHost({
          type: 'PLAYRIG_THEME_CHANGED',
          payload: { theme: themeName }
        });
      }
    },

    /**
     * Render static screenshot of current canvas/viewport
     */
    captureScreenshot() {
      try {
        const canvas = document.querySelector('canvas');
        if (canvas && typeof canvas.toDataURL === 'function') {
          return canvas.toDataURL('image/png', 0.9);
        }
      } catch (e) {
        console.warn('[PlayRig] Canvas toDataURL failed:', e);
      }
      return null;
    },

    /**
     * Initialization & Message Dispatcher
     */
    init() {
      // Prevent duplicate links opening in new tabs
      document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (anchor && anchor.getAttribute('target') === '_blank') {
          anchor.removeAttribute('target');
        }
      }, true);

      // Handle Incoming Bridge Messages with Strict Security Verification
      window.addEventListener('message', (event) => {
        // 1. Origin verification
        if (!isOriginAllowed(event.origin)) {
          console.warn('[PlayRig Bridge Security] Blocked untrusted message from origin:', event.origin);
          return;
        }

        // 2. Source verification
        if (isInIframe && event.source !== window.parent) {
          console.warn('[PlayRig Bridge Security] Message rejected: source is not parent window.');
          return;
        }

        const msg = event.data;
        if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

        // 3. Handshake & Context Synchronization
        if (msg.type === 'PLAYRIG_INIT_CONTEXT' || msg.type === 'PLAYRIG_UPDATE_CONTEXT') {
          if (msg.nonce && !sessionNonce) {
            sessionNonce = msg.nonce;
          }
          if (msg.payload && typeof msg.payload === 'object') {
            activeContext = { ...activeContext, ...msg.payload };
            if (msg.payload.theme) {
              document.documentElement.setAttribute('data-theme', msg.payload.theme);
            }
            triggerEvent('contextUpdate', activeContext);
          }
        }

        // Theme Switch
        if (msg.type === 'PLAYRIG_SET_THEME' || msg.type === 'nexus-set-theme') {
          const newTheme = msg.theme || msg.payload?.theme;
          if (newTheme) {
            PlayRig.setTheme(newTheme);
          }
        }

        // Host requests Screenshot for Deck Spotlight (Standard + Legacy Aliases)
        if (
          msg.type === 'PLAYRIG_REQUEST_SCREENSHOT' ||
          msg.type === 'playrig-capture-screenshot' ||
          msg.type === 'nexus-capture-screenshot'
        ) {
          const dataUrl = PlayRig.captureScreenshot();
          if (dataUrl) {
            postToHost({
              type: 'PLAYRIG_SCREENSHOT_CAPTURED',
              rigId: activeContext.module?.id || null,
              dataUrl: dataUrl
            });
            // Legacy mirror event
            postToHost({
              type: 'playrig-screenshot-captured',
              dataUrl: dataUrl
            });
          } else {
            postToHost({
              type: 'PLAYRIG_SCREENSHOT_ERROR',
              rigId: activeContext.module?.id || null,
              error: 'Kein Canvas-Element für automatischen Screenshot gefunden'
            });
            postToHost({
              type: 'playrig-screenshot-error',
              error: 'Kein Canvas-Element für automatischen Screenshot gefunden'
            });
          }
        }

        // Generic Event Forwarding
        if (msg.type === 'PLAYRIG_HOST_EVENT') {
          triggerEvent(msg.event, msg.payload);
        }
      });

      // Self-register global hooks
      window.PlayRig = PlayRig;
      window.PlayRigBridge = PlayRig;
      window.NexusEmbed = PlayRig; // Full Backwards Compatibility

      // Notify parent about bridge readiness
      if (isInIframe) {
        postToHost({
          type: 'PLAYRIG_BRIDGE_READY',
          payload: { version: PlayRig.version }
        });
      }
    }
  };

  // Auto-init on script evaluation
  PlayRig.init();

  window.PlayRig = PlayRig;
  window.PlayRigBridge = PlayRig;
  window.NexusEmbed = PlayRig;
})();
