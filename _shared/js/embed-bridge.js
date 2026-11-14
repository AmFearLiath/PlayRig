/**
 * PLAYRIG - EMBED BRIDGE (Backwards-Compatibility Adapter)
 * Automatically delegates to the modern PlayRig Bridge & Runtime v1.0.0.
 */

(function () {
  'use strict';

  // Load playrig-bridge.js if not already present
  if (!window.PlayRig) {
    const script = document.createElement('script');
    script.src = (function() {
      const scripts = document.getElementsByTagName('script');
      const current = scripts[scripts.length - 1]?.src || '';
      return current.replace('embed-bridge.js', 'playrig-bridge.js');
    })();
    script.async = false;
    document.head.appendChild(script);
  }
})();
