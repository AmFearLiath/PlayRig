/**
 * NEXUS DESIGN SYSTEM - EMBED BRIDGE
 * Manages iframe sandboxing, query parameter detection, and parent-child communication.
 */

(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const isEmbedParam = urlParams.get('embed') === 'true' || urlParams.get('embed') === '1';
  const isInIframe = window.self !== window.top;

  window.NexusEmbed = {
    isEmbedded: isEmbedParam || isInIframe,
    params: Object.fromEntries(urlParams.entries()),

    init() {
      if (this.isEmbedded) {
        document.body.classList.add('is-embedded');
      }

      // Notify parent frame that the tool is ready
      if (isInIframe) {
        window.parent.postMessage({
          type: 'nexus-tool-ready',
          title: document.title,
          url: window.location.href
        }, '*');
      }

      // Listen for commands from host platform
      window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'nexus-set-theme') {
          document.documentElement.setAttribute('data-theme', data.theme);
        }

        if (data.type === 'nexus-capture-screenshot' || data.type === 'playrig-capture-screenshot') {
          try {
            if (typeof window.playrigCaptureScreenshot === 'function') {
              const customDataUrl = window.playrigCaptureScreenshot();
              window.parent.postMessage({ type: 'playrig-screenshot-captured', dataUrl: customDataUrl }, '*');
              return;
            }

            const canvases = Array.from(document.querySelectorAll('canvas'));
            if (canvases.length > 0) {
              const bestCanvas = canvases.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
              const dataUrl = bestCanvas.toDataURL('image/png');
              window.parent.postMessage({ type: 'playrig-screenshot-captured', dataUrl }, '*');
            } else {
              window.parent.postMessage({ type: 'playrig-screenshot-error', error: 'Kein Canvas-Element für Screenshot gefunden' }, '*');
            }
          } catch (e) {
            window.parent.postMessage({ type: 'playrig-screenshot-error', error: e.message }, '*');
          }
        }
      });
    },

    sendToHost(type, payload = {}) {
      if (isInIframe) {
        window.parent.postMessage({
          type: `nexus-${type}`,
          payload: payload
        }, '*');
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.NexusEmbed.init();
  });
})();

