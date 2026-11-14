/** Draggable floating panel manager with persisted positions and z-order. */
export class WindowManager {
  constructor() { this.windows = [...document.querySelectorAll('.floating-window')]; this.z = 31; this.bind(); this.restore(); }
  bind() {
    for (const win of this.windows) {
      const bar = win.querySelector('.window-titlebar');
      bar.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; this.bringToFront(win); const rect = win.getBoundingClientRect(); const sx = e.clientX, sy = e.clientY; const startX = rect.left, startY = rect.top; bar.setPointerCapture(e.pointerId);
        const move = ev => { win.style.left = `${Math.max(0, Math.min(innerWidth - 100, startX + ev.clientX - sx))}px`; win.style.top = `${Math.max(68, Math.min(innerHeight - 100, startY + ev.clientY - sy))}px`; };
        const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); this.persist(); }; bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
      });
      win.addEventListener('pointerdown', () => this.bringToFront(win));
      win.querySelector('[data-close]').addEventListener('click', () => this.close(win.dataset.window));
      win.querySelector('[data-minimize]').addEventListener('click', () => { win.classList.toggle('minimized'); this.persist(); });
    }
    document.querySelectorAll('[data-window]').forEach(btn => { if (btn.classList.contains('menu-button')) btn.addEventListener('click', () => this.toggle(btn.dataset.window)); });
  }
  open(id) { const win = document.getElementById(`window-${id}`); if (!win) return; win.classList.add('open'); win.classList.remove('minimized'); this.bringToFront(win); document.querySelectorAll('.menu-button').forEach(b => b.classList.toggle('active', b.dataset.window === id)); this.persist(); }
  close(id) { const win = document.getElementById(`window-${id}`); if (win) win.classList.remove('open'); document.querySelectorAll('.menu-button').forEach(b => b.classList.toggle('active', b.dataset.window === id)); this.persist(); }
  toggle(id) { const win = document.getElementById(`window-${id}`); if (!win) return; win.classList.contains('open') ? this.close(id) : this.open(id); }
  bringToFront(win) { win.style.zIndex = ++this.z; }
  persist() { const state = {}; for (const w of this.windows) state[w.dataset.window] = { left: w.style.left, top: w.style.top, width: w.style.width, height: w.style.height, open: w.classList.contains('open'), minimized: w.classList.contains('minimized'), z: Number(w.style.zIndex) || 0 }; try { localStorage.setItem('playrig-emergence-windows', JSON.stringify(state)); } catch {} }
  restore() { try { const state = JSON.parse(localStorage.getItem('playrig-emergence-windows') || '{}'); for (const w of this.windows) { const s = state[w.dataset.window]; if (!s) continue; for (const k of ['left','top','width','height']) if (s[k]) w.style[k] = s[k]; w.classList.toggle('open', !!s.open); w.classList.toggle('minimized', !!s.minimized); if (s.z) w.style.zIndex = s.z; } } catch {} }
}
