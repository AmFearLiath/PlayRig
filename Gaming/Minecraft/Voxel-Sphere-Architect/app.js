/**
 * VOXEL SPHERE ARCHITECT - APPLICATION CONTROLLER
 * High-performance 3D Three.js renderer + 2D Interactive Blueprint Slice engine.
 */

(function () {
  'use strict';

  // --- State ---
  let isDirty = false;
  let syncHeight = true;

  const state = {
    shape: 'sphere',
    rx: 16,
    ry: 16,
    rz: 16,
    mode: 'hollow', // 'hollow' | 'filled'
    thickness: 1,
    torusTubeRadius: 4,
    currentLayerY: 0,
    showGhostLayer: true,
    isolateLayer3D: false,
    viewMode: '3d', // '3d' | '2d'
    blockType: 'minecraft:stone',
    blockColor: 0x8a929a,
    zoom2D: 14, // pixels per block
    pan2D: { x: 0, y: 0 },
    isPanning: false,
    panStart: { x: 0, y: 0 }
  };

  const palettes = {
    'minecraft:stone': { name: 'Stone', color: 0x828c94, hex: '#828c94' },
    'minecraft:deepslate': { name: 'Deepslate', color: 0x3d3f44, hex: '#3d3f44' },
    'minecraft:obsidian': { name: 'Obsidian', color: 0x1f1636, hex: '#1f1636' },
    'minecraft:quartz_block': { name: 'Quartz', color: 0xedebe4, hex: '#edebe4' },
    'minecraft:gold_block': { name: 'Gold', color: 0xf5c32c, hex: '#f5c32c' },
    'minecraft:emerald_block': { name: 'Emerald', color: 0x22cc62, hex: '#22cc62' },
    'minecraft:glowstone': { name: 'Glowstone', color: 0xf9c05e, hex: '#f9c05e' },
    'minecraft:cyan_stained_glass': { name: 'Glass', color: 0x1daec9, hex: '#1daec9', transparent: true, opacity: 0.65 }
  };

  const engine = new VoxelEngine();
  let threeScene, threeCamera, threeRenderer, threeControls;
  let instancedMesh = null;
  let blueprintCanvas, blueprintCtx;

  // --- Initialization ---
  function init() {
    init3D();
    init2D();
    bindEvents();
    recalculate();
  }

  // --- 3D Engine (Three.js with InstancedMesh) ---
  function init3D() {
    const container = document.getElementById('three-container');
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x060910);

    threeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    threeCamera.position.set(45, 35, 55);

    threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    threeRenderer.setSize(width, height);
    threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRenderer.shadowMap.enabled = false;
    container.appendChild(threeRenderer.domElement);

    // Orbit Controls
    threeControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
    threeControls.enableDamping = true;
    threeControls.dampingFactor = 0.08;
    threeControls.target.set(0, 0, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    threeScene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight1.position.set(50, 80, 40);
    threeScene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.35);
    dirLight2.position.set(-40, -20, -30);
    threeScene.add(dirLight2);

    // Subtle Ground Grid
    const gridHelper = new THREE.GridHelper(100, 50, 0x06b6d4, 0x1e293b);
    gridHelper.position.y = -0.5;
    threeScene.add(gridHelper);

    // Render loop
    function animate() {
      requestAnimationFrame(animate);
      threeControls.update();
      threeRenderer.render(threeScene, threeCamera);
    }
    animate();

    window.addEventListener('resize', onWindowResize);
  }

  function onWindowResize() {
    const container = document.getElementById('three-container');
    if (!container || !threeRenderer) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    threeCamera.aspect = width / height;
    threeCamera.updateProjectionMatrix();
    threeRenderer.setSize(width, height);

    if (blueprintCanvas) {
      renderBlueprint();
    }
  }

  // --- Update 3D Voxel Instances ---
  function update3DScene() {
    if (instancedMesh) {
      threeScene.remove(instancedMesh);
      instancedMesh.geometry.dispose();
      instancedMesh.material.dispose();
      instancedMesh = null;
    }

    const voxels = engine.voxels;
    if (voxels.length === 0) return;

    // Filter voxels if isolation is enabled
    const visibleVoxels = state.isolateLayer3D
      ? voxels.filter(v => v.y === state.currentLayerY)
      : voxels;

    if (visibleVoxels.length === 0) return;

    const boxGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    const pal = palettes[state.blockType] || palettes['minecraft:stone'];
    const boxMat = new THREE.MeshStandardMaterial({
      color: pal.color,
      roughness: 0.6,
      metalness: 0.2,
      transparent: pal.transparent || false,
      opacity: pal.opacity || 1.0
    });

    instancedMesh = new THREE.InstancedMesh(boxGeo, boxMat, visibleVoxels.length);
    instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const activeColor = new THREE.Color(0x38bdf8);
    const normalColor = new THREE.Color(pal.color);
    const dimColor = new THREE.Color(0x27354a);

    const hasColorSupport = !!instancedMesh.setColorAt;

    for (let i = 0; i < visibleVoxels.length; i++) {
      const v = visibleVoxels[i];
      dummy.position.set(v.x, v.y, v.z);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(i, dummy.matrix);

      if (hasColorSupport) {
        if (!state.isolateLayer3D && v.y === state.currentLayerY) {
          instancedMesh.setColorAt(i, activeColor);
        } else if (!state.isolateLayer3D && Math.abs(v.y - state.currentLayerY) > 0) {
          // Subtle shading distinction
          instancedMesh.setColorAt(i, normalColor);
        } else {
          instancedMesh.setColorAt(i, normalColor);
        }
      }
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    threeScene.add(instancedMesh);
  }

  // --- 2D Blueprint Engine ---
  function init2D() {
    blueprintCanvas = document.getElementById('blueprint-canvas');
    blueprintCtx = blueprintCanvas.getContext('2d');

    // Pan & Zoom handlers
    const container = document.getElementById('blueprint-canvas-container');

    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
      state.zoom2D = Math.max(4, Math.min(60, state.zoom2D * zoomFactor));
      renderBlueprint();
    });

    blueprintCanvas.addEventListener('mousedown', (e) => {
      state.isPanning = true;
      state.panStart = { x: e.clientX - state.pan2D.x, y: e.clientY - state.pan2D.y };
    });

    window.addEventListener('mousemove', (e) => {
      if (!state.isPanning) {
        // Track hover coordinate
        inspectHoverCoord(e);
        return;
      }
      state.pan2D = { x: e.clientX - state.panStart.x, y: e.clientY - state.panStart.y };
      renderBlueprint();
    });

    window.addEventListener('mouseup', () => {
      state.isPanning = false;
    });
  }

  function inspectHoverCoord(e) {
    if (state.viewMode !== '2d') return;
    const rect = blueprintCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const centerX = blueprintCanvas.width / 2 + state.pan2D.x;
    const centerY = blueprintCanvas.height / 2 + state.pan2D.y;
    const blockSize = state.zoom2D;

    const blockX = Math.floor((mouseX - centerX + blockSize / 2) / blockSize);
    const blockZ = Math.floor((mouseY - centerY + blockSize / 2) / blockSize);

    const hudCoord = document.getElementById('hud-coords');
    if (hudCoord) {
      hudCoord.textContent = `X: ${blockX}, Y: ${state.currentLayerY}, Z: ${blockZ}`;
    }
  }

  function renderBlueprint() {
    if (!blueprintCanvas) return;
    const container = document.getElementById('blueprint-canvas-container');
    blueprintCanvas.width = container.clientWidth || 800;
    blueprintCanvas.height = container.clientHeight || 600;

    const width = blueprintCanvas.width;
    const height = blueprintCanvas.height;
    const ctx = blueprintCtx;

    // Clear background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2 + state.pan2D.x;
    const centerY = height / 2 + state.pan2D.y;
    const size = state.zoom2D;

    // Draw Grid Lines
    ctx.lineWidth = 1;
    const minGridX = Math.floor(-centerX / size) - 1;
    const maxGridX = Math.ceil((width - centerX) / size) + 1;
    const minGridZ = Math.floor(-centerY / size) - 1;
    const maxGridZ = Math.ceil((height - centerY) / size) + 1;

    for (let x = minGridX; x <= maxGridX; x++) {
      const screenX = centerX + x * size - size / 2;
      ctx.beginPath();
      if (x === 0) {
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
        ctx.lineWidth = 2;
      } else if (x % 5 === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
      }
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();

      // Axis label
      if (x % 5 === 0 && size >= 10) {
        ctx.fillStyle = x === 0 ? '#38bdf8' : 'rgba(255, 255, 255, 0.35)';
        ctx.font = '10px JetBrains Mono';
        ctx.fillText(`${x}`, screenX + 2, centerY + 12);
      }
    }

    for (let z = minGridZ; z <= maxGridZ; z++) {
      const screenZ = centerY + z * size - size / 2;
      ctx.beginPath();
      if (z === 0) {
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
        ctx.lineWidth = 2;
      } else if (z % 5 === 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.lineWidth = 1;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
      }
      ctx.moveTo(0, screenZ);
      ctx.lineTo(width, screenZ);
      ctx.stroke();

      if (z % 5 === 0 && size >= 10) {
        ctx.fillStyle = z === 0 ? '#818cf8' : 'rgba(255, 255, 255, 0.35)';
        ctx.font = '10px JetBrains Mono';
        ctx.fillText(`${z}`, centerX + 4, screenZ - 2);
      }
    }

    // Ghost Layer (Y - 1)
    if (state.showGhostLayer) {
      const ghostBlocks = engine.getLayer(state.currentLayerY - 1);
      ctx.fillStyle = 'rgba(99, 102, 241, 0.22)';
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
      ctx.lineWidth = 1;

      for (let i = 0; i < ghostBlocks.length; i++) {
        const b = ghostBlocks[i];
        const screenX = centerX + b.x * size - size / 2;
        const screenZ = centerY + b.z * size - size / 2;
        ctx.fillRect(screenX, screenZ, size - 1, size - 1);
        ctx.strokeRect(screenX, screenZ, size - 1, size - 1);
      }
    }

    // Current Layer Blocks
    const currentBlocks = engine.getLayer(state.currentLayerY);
    const pal = palettes[state.blockType] || palettes['minecraft:stone'];

    ctx.fillStyle = pal.hex;
    ctx.strokeStyle = '#ffffff';

    for (let i = 0; i < currentBlocks.length; i++) {
      const b = currentBlocks[i];
      const screenX = centerX + b.x * size - size / 2;
      const screenZ = centerY + b.z * size - size / 2;

      // Glow box
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(screenX, screenZ, size - 1, size - 1);

      ctx.fillStyle = pal.hex;
      ctx.fillRect(screenX + 1, screenZ + 1, size - 3, size - 3);

      if (size > 14) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.strokeRect(screenX, screenZ, size - 1, size - 1);
      }
    }

    // HUD Layer count update
    const hudLayerCount = document.getElementById('hud-layer-count');
    if (hudLayerCount) {
      hudLayerCount.textContent = `${currentBlocks.length} Blöcke`;
    }
  }

  // --- Recalculate Geometry ---
  function recalculate() {
    const res = engine.generate({
      shape: state.shape,
      rx: state.rx,
      ry: state.ry,
      rz: state.rz,
      mode: state.mode,
      thickness: state.thickness,
      torusTubeRadius: state.torusTubeRadius
    });

    // Update Layer Slider Limits
    const layerSlider = document.getElementById('layer-slider');
    const minY = res.bounds.minY;
    const maxY = res.bounds.maxY;

    layerSlider.min = minY;
    layerSlider.max = maxY;

    // Clamp current layer
    if (state.currentLayerY < minY) state.currentLayerY = minY;
    if (state.currentLayerY > maxY) state.currentLayerY = maxY;
    layerSlider.value = state.currentLayerY;

    updateUIStats();
    update3DScene();
    renderBlueprint();
  }

  // --- Update UI Stats ---
  function updateUIStats() {
    const bill = engine.getMaterialBill();
    const bounds = engine.bounds;

    document.getElementById('stat-total-blocks').textContent = bill.total.toLocaleString();
    document.getElementById('stat-stacks').textContent = `${bill.stacks} Stacks + ${bill.remainder}`;
    document.getElementById('stat-chests').textContent = `${bill.doubleChests} Doppelkisten`;
    document.getElementById('stat-shulkers').textContent = `${bill.shulkers} Shulker-Kisten`;

    const widthX = bounds.maxX - bounds.minX + 1;
    const heightY = bounds.maxY - bounds.minY + 1;
    const lengthZ = bounds.maxZ - bounds.minZ + 1;
    document.getElementById('stat-dimensions').textContent = `${widthX} × ${heightY} × ${lengthZ}`;

    document.getElementById('layer-badge').textContent = `Y = ${state.currentLayerY}`;
    document.getElementById('layer-slider-label').textContent = `${state.currentLayerY}`;
  }

  // --- Event Bindings ---
  function bindEvents() {
    // Shape Buttons
    document.querySelectorAll('.shape-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.shape = btn.dataset.shape;

        // Toggle visibility of shape-specific sliders
        const rxGroup = document.getElementById('group-rx');
        const ryGroup = document.getElementById('group-ry');
        const rzGroup = document.getElementById('group-rz');
        const torusGroup = document.getElementById('group-torus');
        const syncWrap = document.getElementById('wrap-sync-height');

        isDirty = true;

        if (state.shape === 'sphere' || state.shape === 'dome') {
          rxGroup.style.display = 'flex';
          ryGroup.style.display = 'flex';
          rzGroup.style.display = 'none';
          torusGroup.style.display = 'none';
          if (syncWrap) syncWrap.style.display = 'inline-flex';
          state.rz = state.rx;
          if (syncHeight) {
            state.ry = state.rx;
            document.getElementById('slider-ry').value = state.rx;
            document.getElementById('val-ry').textContent = state.rx;
          }
        } else if (state.shape === 'ellipsoid') {
          rxGroup.style.display = 'flex';
          ryGroup.style.display = 'flex';
          rzGroup.style.display = 'flex';
          torusGroup.style.display = 'none';
          if (syncWrap) syncWrap.style.display = 'none';
        } else if (state.shape === 'cylinder') {
          rxGroup.style.display = 'flex';
          ryGroup.style.display = 'flex';
          rzGroup.style.display = 'none';
          torusGroup.style.display = 'none';
          if (syncWrap) syncWrap.style.display = 'none';
          state.rz = state.rx;
        } else if (state.shape === 'torus') {
          rxGroup.style.display = 'flex';
          ryGroup.style.display = 'none';
          rzGroup.style.display = 'none';
          torusGroup.style.display = 'flex';
          if (syncWrap) syncWrap.style.display = 'none';
          state.rz = state.rx;
        }

        recalculate();
      });
    });

    // Height sync toggle
    const checkSync = document.getElementById('check-sync-height');
    if (checkSync) {
      checkSync.addEventListener('change', (e) => {
        syncHeight = e.target.checked;
        if (syncHeight) {
          state.ry = state.rx;
          document.getElementById('slider-ry').value = state.rx;
          document.getElementById('val-ry').textContent = state.rx;
          recalculate();
        }
      });
    }

    // Dimension Sliders
    bindSlider('slider-rx', 'val-rx', val => {
      isDirty = true;
      state.rx = parseInt(val, 10);
      state.rz = state.rx;

      if ((state.shape === 'sphere' || state.shape === 'dome') && syncHeight) {
        state.ry = state.rx;
        document.getElementById('slider-ry').value = state.rx;
        document.getElementById('val-ry').textContent = state.rx;
      }
      recalculate();
    });

    bindSlider('slider-ry', 'val-ry', val => {
      isDirty = true;
      state.ry = parseInt(val, 10);
      if ((state.shape === 'sphere' || state.shape === 'dome') && state.ry !== state.rx) {
        syncHeight = false;
        if (checkSync) checkSync.checked = false;
      }
      recalculate();
    });

    bindSlider('slider-rz', 'val-rz', val => {
      isDirty = true;
      state.rz = parseInt(val, 10);
      recalculate();
    });

    bindSlider('slider-thickness', 'val-thickness', val => {
      isDirty = true;
      state.thickness = parseInt(val, 10);
      recalculate();
    });

    bindSlider('slider-torus', 'val-torus', val => {
      isDirty = true;
      state.torusTubeRadius = parseInt(val, 10);
      recalculate();
    });

    // Mode Toggle (Hollow / Filled)
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mode = btn.dataset.mode;

        const thicknessGroup = document.getElementById('group-thickness');
        thicknessGroup.style.display = state.mode === 'filled' ? 'none' : 'flex';
        recalculate();
      });
    });

    // Layer Stepper Slider & Buttons
    const layerSlider = document.getElementById('layer-slider');
    layerSlider.addEventListener('input', (e) => {
      state.currentLayerY = parseInt(e.target.value, 10);
      updateUIStats();
      update3DScene();
      renderBlueprint();
    });

    document.getElementById('btn-layer-prev').addEventListener('click', () => {
      if (state.currentLayerY > engine.bounds.minY) {
        state.currentLayerY--;
        layerSlider.value = state.currentLayerY;
        updateUIStats();
        update3DScene();
        renderBlueprint();
      }
    });

    document.getElementById('btn-layer-next').addEventListener('click', () => {
      if (state.currentLayerY < engine.bounds.maxY) {
        state.currentLayerY++;
        layerSlider.value = state.currentLayerY;
        updateUIStats();
        update3DScene();
        renderBlueprint();
      }
    });

    // Keyboard navigation for layers
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        document.getElementById('btn-layer-next').click();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        document.getElementById('btn-layer-prev').click();
      }
    });

    // Viewport Mode Tabs (3D vs 2D)
    document.getElementById('tab-3d').addEventListener('click', () => {
      state.viewMode = '3d';
      document.getElementById('tab-3d').classList.add('active');
      document.getElementById('tab-2d').classList.remove('active');
      document.getElementById('three-container').style.display = 'block';
      document.getElementById('blueprint-canvas-container').classList.remove('active');
      document.getElementById('camera-controls').style.display = 'flex';
      onWindowResize();
    });

    document.getElementById('tab-2d').addEventListener('click', () => {
      state.viewMode = '2d';
      document.getElementById('tab-2d').classList.add('active');
      document.getElementById('tab-3d').classList.remove('active');
      document.getElementById('three-container').style.display = 'none';
      document.getElementById('blueprint-canvas-container').classList.add('active');
      document.getElementById('camera-controls').style.display = 'none';
      renderBlueprint();
    });

    // Checkbox Options
    document.getElementById('check-ghost').addEventListener('change', (e) => {
      state.showGhostLayer = e.target.checked;
      renderBlueprint();
    });

    document.getElementById('check-isolate-3d').addEventListener('change', (e) => {
      state.isolateLayer3D = e.target.checked;
      update3DScene();
    });

    // Camera Presets
    document.getElementById('cam-iso').addEventListener('click', () => {
      const maxR = Math.max(state.rx, state.ry, state.rz);
      threeCamera.position.set(maxR * 2.2, maxR * 1.8, maxR * 2.2);
      threeControls.target.set(0, 0, 0);
    });

    document.getElementById('cam-top').addEventListener('click', () => {
      const maxR = Math.max(state.rx, state.ry, state.rz);
      threeCamera.position.set(0, maxR * 3.2, 0.01);
      threeControls.target.set(0, 0, 0);
    });

    document.getElementById('cam-front').addEventListener('click', () => {
      const maxR = Math.max(state.rx, state.ry, state.rz);
      threeCamera.position.set(0, 0, maxR * 3.2);
      threeControls.target.set(0, 0, 0);
    });

    // Palette selector
    document.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.palette-item').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        state.blockType = item.dataset.block;
        update3DScene();
        renderBlueprint();
      });
    });

    // Return to Hub & Unsaved Changes Guard
    const returnModal = document.getElementById('return-hub-modal');
    const btnReturnHub = document.getElementById('btn-return-hub');

    function navigateToHub() {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'nexus-close' }, '*');
      }
      window.location.href = '/';
    }

    if (btnReturnHub) {
      btnReturnHub.addEventListener('click', () => {
        if (isDirty) {
          returnModal.classList.add('active');
        } else {
          navigateToHub();
        }
      });
    }

    const btnSaveAndLeave = document.getElementById('btn-save-and-leave');
    if (btnSaveAndLeave) {
      btnSaveAndLeave.addEventListener('click', () => {
        try {
          localStorage.setItem('nexus_saved_voxel_state', JSON.stringify({
            rx: state.rx, ry: state.ry, rz: state.rz, shape: state.shape, mode: state.mode, thickness: state.thickness, blockType: state.blockType
          }));
        } catch (e) {}
        navigateToHub();
      });
    }

    const btnDiscardAndLeave = document.getElementById('btn-discard-and-leave');
    if (btnDiscardAndLeave) {
      btnDiscardAndLeave.addEventListener('click', () => {
        navigateToHub();
      });
    }

    const btnCancelLeave = document.getElementById('btn-cancel-leave');
    if (btnCancelLeave) {
      btnCancelLeave.addEventListener('click', () => {
        returnModal.classList.remove('active');
      });
    }

    const btnCloseReturnModal = document.getElementById('btn-close-return-modal');
    if (btnCloseReturnModal) {
      btnCloseReturnModal.addEventListener('click', () => {
        returnModal.classList.remove('active');
      });
    }

    // Export Modal Actions
    const exportModal = document.getElementById('export-modal');
    document.getElementById('btn-open-export').addEventListener('click', () => {
      exportModal.classList.add('active');
      generateExportData();
    });

    document.getElementById('btn-close-export').addEventListener('click', () => {
      exportModal.classList.remove('active');
    });

    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) exportModal.classList.remove('active');
    });

    document.getElementById('btn-copy-commands').addEventListener('click', () => {
      const textarea = document.getElementById('export-text');
      textarea.select();
      navigator.clipboard.writeText(textarea.value).then(() => {
        window.showToast('Befehle erfolgreich in die Zwischenablage kopiert!', 'success');
      });
    });

    document.getElementById('btn-download-mcfunction').addEventListener('click', () => {
      const content = document.getElementById('export-text').value;
      const blob = new Blob([content], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `voxel_${state.shape}_r${state.rx}.mcfunction`;
      a.click();
      window.showToast('mcfunction-Datei heruntergeladen!', 'success');
    });

    document.getElementById('btn-download-png').addEventListener('click', () => {
      renderBlueprint();
      const link = document.createElement('a');
      link.download = `blueprint_y${state.currentLayerY}.png`;
      link.href = blueprintCanvas.toDataURL('image/png');
      link.click();
      window.showToast('2D-Bauplan als PNG exportiert!', 'success');
    });
  }

  function bindSlider(sliderId, valLabelId, onChange) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(valLabelId);
    slider.addEventListener('input', (e) => {
      label.textContent = e.target.value;
      onChange(e.target.value);
    });
  }

  function generateExportData() {
    const cmds = engine.generateCommands(state.blockType);
    const previewCmds = cmds.slice(0, 1500).join('\n');
    const header = `# Voxel Architect Export - Shape: ${state.shape}, Total Blocks: ${engine.totalCount}\n# Generiert für Minecraft Java & Bedrock\n\n`;
    document.getElementById('export-text').value = header + previewCmds + (cmds.length > 1500 ? `\n\n# ... (${cmds.length - 1500} weitere Befehle. Für vollständige Liste als .mcfunction herunterladen)` : '');
  }

  // Run on DOM load
  document.addEventListener('DOMContentLoaded', init);
})();

