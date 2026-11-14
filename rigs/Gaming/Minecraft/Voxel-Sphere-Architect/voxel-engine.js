/**
 * VOXEL SPHERE ARCHITECT - ALGORITHM ENGINE
 * High-performance 3D Voxel Generator for Spheres, Ellipsoids, Domes, Cylinders and Tori.
 */

class VoxelEngine {
  constructor() {
    this.voxels = []; // Array of {x, y, z, color}
    this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    this.layers = new Map(); // y -> array of {x, z}
    this.totalCount = 0;
  }

  /**
   * Generates voxels based on current parameters
   */
  generate(params) {
    const {
      shape = 'sphere',       // 'sphere', 'dome', 'ellipsoid', 'cylinder', 'torus'
      rx = 16,                // Radius X
      ry = 16,                // Radius Y
      rz = 16,                // Radius Z
      mode = 'hollow',        // 'hollow', 'filled'
      thickness = 1,          // Wall thickness in blocks
      torusTubeRadius = 4     // For torus
    } = params;

    const voxelSet = new Set();
    const isFilled = mode === 'filled';
    const effectiveThickness = isFilled ? 9999 : Math.max(1, thickness);

    // Compute bounds for iteration
    const maxExtentX = Math.ceil(rx);
    const maxExtentY = Math.ceil(ry);
    const maxExtentZ = Math.ceil(rz);

    const minIterY = (shape === 'dome') ? 0 : -maxExtentY;
    const maxIterY = maxExtentY;

    for (let y = minIterY; y <= maxIterY; y++) {
      for (let z = -maxExtentZ; z <= maxExtentZ; z++) {
        for (let x = -maxExtentX; x <= maxExtentX; x++) {
          let insideOuter = false;
          let insideInner = false;

          if (shape === 'sphere' || shape === 'dome') {
            // Normalized sphere metric: (x+0.5)^2 / rx^2 + ...
            const distSq = (x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz);
            insideOuter = distSq <= 1.0;

            if (!isFilled) {
              const innerRx = Math.max(0.1, rx - effectiveThickness);
              const innerRy = Math.max(0.1, ry - effectiveThickness);
              const innerRz = Math.max(0.1, rz - effectiveThickness);
              const distSqInner = (x * x) / (innerRx * innerRx) + (y * y) / (innerRy * innerRy) + (z * z) / (innerRz * innerRz);
              insideInner = distSqInner < 1.0;
            }
          } else if (shape === 'ellipsoid') {
            const distSq = (x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz);
            insideOuter = distSq <= 1.0;

            if (!isFilled) {
              const innerRx = Math.max(0.1, rx - effectiveThickness);
              const innerRy = Math.max(0.1, ry - effectiveThickness);
              const innerRz = Math.max(0.1, rz - effectiveThickness);
              const distSqInner = (x * x) / (innerRx * innerRx) + (y * y) / (innerRy * innerRy) + (z * z) / (innerRz * innerRz);
              insideInner = distSqInner < 1.0;
            }
          } else if (shape === 'cylinder') {
            const distSqHorizontal = (x * x) / (rx * rx) + (z * z) / (rz * rz);
            insideOuter = distSqHorizontal <= 1.0 && Math.abs(y) <= ry;

            if (!isFilled) {
              const innerRx = Math.max(0.1, rx - effectiveThickness);
              const innerRz = Math.max(0.1, rz - effectiveThickness);
              const distSqInner = (x * x) / (innerRx * innerRx) + (z * z) / (innerRz * innerRz);
              insideInner = distSqInner < 1.0 && Math.abs(y) <= (ry - effectiveThickness);
            }
          } else if (shape === 'torus') {
            const R = rx; // Major radius
            const r = torusTubeRadius; // Minor radius
            const distFromAxis = Math.sqrt(x * x + z * z);
            const torusDistSq = Math.pow(distFromAxis - R, 2) + (y * y);
            insideOuter = torusDistSq <= (r * r);

            if (!isFilled) {
              const innerR = Math.max(0.1, r - effectiveThickness);
              insideInner = torusDistSq < (innerR * innerR);
            }
          }

          if (insideOuter && !insideInner) {
            voxelSet.add(`${x},${y},${z}`);
          }
        }
      }
    }

    // Process and sort voxels
    this.voxels = [];
    this.layers = new Map();
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    voxelSet.forEach(key => {
      const [x, y, z] = key.split(',').map(Number);
      this.voxels.push({ x, y, z });

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;

      if (!this.layers.has(y)) {
        this.layers.set(y, []);
      }
      this.layers.get(y).push({ x, z });
    });

    if (this.voxels.length === 0) {
      minX = maxX = minY = maxY = minZ = maxZ = 0;
    }

    this.bounds = { minX, maxX, minY, maxY, minZ, maxZ };
    this.totalCount = this.voxels.length;

    return {
      totalCount: this.totalCount,
      bounds: this.bounds,
      layerKeys: Array.from(this.layers.keys()).sort((a, b) => a - b)
    };
  }

  /**
   * Returns voxels for a specific Y slice
   */
  getLayer(y) {
    return this.layers.get(y) || [];
  }

  /**
   * Generates Minecraft /setblock commands
   */
  generateCommands(blockId = 'minecraft:stone', origin = { x: 0, y: 0, z: 0 }) {
    return this.voxels.map(v => 
      `/setblock ~${v.x + origin.x} ~${v.y + origin.y} ~${v.z + origin.z} ${blockId}`
    );
  }

  /**
   * Calculates material stack metrics
   */
  getMaterialBill() {
    const total = this.totalCount;
    const stacks = Math.floor(total / 64);
    const remainder = total % 64;
    const doubleChests = (total / (64 * 54)).toFixed(1);
    const shulkers = (total / (64 * 27)).toFixed(1);

    return { total, stacks, remainder, doubleChests, shulkers };
  }
}

window.VoxelEngine = VoxelEngine;

