/**
 * PLAYRIG BRIDGE & RUNTIME v1.0.0
 * Official Integration Bridge between GameChiller Platform and PlayRig Modules.
 *
 * Provides bidirectional communication, user identity, permissions,
 * scoped storage, live context sync, screenshot capture, and strict
 * in-window navigation.
 *
 * Author: Liath • Copyright: © GameChiller • Version: v1.0.0
 */

(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const isEmbedParam = urlParams.get('embed') === 'true' || urlParams.get('embed') === '1';
  const isInIframe = window.self !== window.top;

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

  const eventListeners = new Map();

  function triggerEvent(name, payload) {
    const list = eventListeners.get(name);
    if (list) {
      list.forEach(fn => {
        try { fn(payload); } catch (e) { console.error('[PlayRig Bridge Error]', e); }
      });
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
     * Strict in-window navigation ensuring links never open duplicate tabs
     */
    navigate(targetUrl) {
      if (!targetUrl) return;
      if (isInIframe) {
        window.parent.postMessage({
          type: 'PLAYRIG_NAVIGATE',
          payload: { url: targetUrl }
        }, '*');
      } else {
        window.location.href = targetUrl;
      }
    },

    /**
     * Notify user or GameChiller host UI
     */
    notify(message, type = 'info', duration = 3000) {
      if (isInIframe) {
        window.parent.postMessage({
          type: 'PLAYRIG_NOTIFY',
          payload: { message, type, duration }
        }, '*');
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
        window.parent.postMessage({
          type: 'PLAYRIG_EVENT',
          event: event,
          payload: payload
        }, '*');
      }
      triggerEvent(event, payload);
      return this;
    },

    /**
     * Scoped Cloud Storage (Synced with MySQL & GameChiller)
     */
    storage: {
      async get(key, defaultValue = null) {
        try {
          const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
          const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
          const res = await fetch(`/api/v1/storage/user/${encodeURIComponent(key)}`, { headers });
          if (res.ok) {
            const data = await res.json();
            return data.data !== undefined ? data.data : defaultValue;
          }
        } catch (e) {}

        // Fallback to localStorage
        const local = localStorage.getItem(`playrig_store_${key}`);
        return local !== null ? JSON.parse(local) : defaultValue;
      },

      async set(key, value) {
        try {
          const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
          const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          };
          await fetch(`/api/v1/storage/user/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ value })
          });
        } catch (e) {}

        localStorage.setItem(`playrig_store_${key}`, JSON.stringify(value));
        return true;
      }
    },

    /**
     * Authenticated API helper
     */
    async api(endpoint, options = {}) {
      const token = localStorage.getItem('playrig_token') || localStorage.getItem('nexus_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {})
      };

      const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const url = path.startsWith('/api') ? path : `/api/v1${path}`;
      const res = await fetch(url, { ...options, headers });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.error || 'API Fehler');
      }
      return json;
    },

    /**
     * High-res Screenshot capture of Rig for Spotlight presentation
     */
    captureScreenshot() {
      try {
        if (typeof window.playrigCaptureScreenshot === 'function') {
          return window.playrigCaptureScreenshot();
        }

        const canvases = Array.from(document.querySelectorAll('canvas'));
        if (canvases.length > 0) {
          const best = canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
          return best.toDataURL('image/png');
        }
        return null;
      } catch (e) {
        console.error('[PlayRig Screenshot Capture Error]:', e);
        return null;
      }
    },

    /**
     * Initialize Bridge and Hook Host Communications
     */
    init(options = {}) {
      if (this.isEmbedded) {
        document.body.classList.add('is-embedded');
      }

      // Intercept and prevent target="_blank"
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.target === '_blank') {
          link.removeAttribute('target');
        }
      });

      // Notify GameChiller / Host that this Rig is ready
      if (isInIframe) {
        window.parent.postMessage({
          type: 'PLAYRIG_READY',
          payload: {
            title: document.title,
            url: window.location.href,
            minRuntime: 'v1.0.0'
          }
        }, '*');
      }

      // Handle Incoming Bridge Messages
      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;

        // Context Synchronization
        if (msg.type === 'PLAYRIG_INIT_CONTEXT' || msg.type === 'PLAYRIG_UPDATE_CONTEXT') {
          if (msg.payload) {
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
            document.documentElement.setAttribute('data-theme', newTheme);
            activeContext.theme = newTheme;
            triggerEvent('themeChange', newTheme);
          }
        }

        // Host requests Screenshot for Deck Spotlight
        if (msg.type === 'PLAYRIG_REQUEST_SCREENSHOT' || msg.type === 'nexus-capture-screenshot') {
          const dataUrl = PlayRig.captureScreenshot();
          if (dataUrl) {
            window.parent.postMessage({
              type: 'PLAYRIG_SCREENSHOT_CAPTURED',
              dataUrl: dataUrl
            }, '*');
          } else {
            window.parent.postMessage({
              type: 'PLAYRIG_SCREENSHOT_ERROR',
              error: 'Kein Canvas-Element für automatischen Screenshot gefunden'
            }, '*');
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
    }
  };

  // Auto-init on script evaluation
  PlayRig.init();

  window.PlayRig = PlayRig;
  window.PlayRigBridge = PlayRig;
  window.NexusEmbed = PlayRig;
})();
