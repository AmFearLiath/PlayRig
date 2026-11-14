/**
 * NEXUS DESIGN SYSTEM - TOAST NOTIFICATION ENGINE
 */

(function() {
  function getContainer() {
    let container = document.getElementById('nexus-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'nexus-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  window.showToast = function(message, type = 'info', duration = 3200) {
    const container = getContainer();
    const toast = document.createElement('div');
    toast.className = `nexus-toast ${type}`;
    
    // Icon based on type
    const icons = {
      success: '✓',
      info: 'ℹ',
      warning: '⚠',
      error: '✕'
    };
    
    const iconSpan = document.createElement('span');
    iconSpan.style.fontWeight = 'bold';
    iconSpan.textContent = icons[type] || 'ℹ';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    
    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.25s forwards';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  };
})();

