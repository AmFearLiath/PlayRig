// PlayRig Database Layer - MySQL (Port 3307)
// Powered by mysql2/promise
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

// Load .env if present
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {}
}

const defaultPort = process.platform === 'win32' ? 3307 : 3306;

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || String(defaultPort), 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'playrig_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'playrig_salt_2026').digest('hex');
}

async function init() {
  try {
    const adminConn = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password
    });
    await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await adminConn.end();

    pool = mysql.createPool(DB_CONFIG);

    // Create Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(128) NOT NULL,
        password_hash VARCHAR(128) NOT NULL,
        role ENUM('admin', 'creator', 'user') DEFAULT 'user',
        status ENUM('active', 'suspended') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        icon VARCHAR(32) DEFAULT 'folder',
        description VARCHAR(255) DEFAULT '',
        subcategories JSON,
        sort_order INT DEFAULT 0
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rigs (
        id VARCHAR(96) PRIMARY KEY,
        title VARCHAR(160) NOT NULL,
        description TEXT,
        category VARCHAR(64) NOT NULL,
        subcategory VARCHAR(64) NOT NULL,
        path VARCHAR(255) NOT NULL,
        version VARCHAR(32) DEFAULT 'v0.0.1',
        author VARCHAR(64) DEFAULT 'Liath',
        copyright VARCHAR(64) DEFAULT '© GameChiller',
        icon VARCHAR(32) DEFAULT 'cube',
        color VARCHAR(32) DEFAULT '#00d2ff',
        tags JSON,
        status ENUM('active', 'wip', 'deprecated') DEFAULT 'active',
        access ENUM('public', 'private', 'unlisted') DEFAULT 'public',
        original_author VARCHAR(64) DEFAULT 'Liath',
        forked_from VARCHAR(96) DEFAULT NULL,
        views INT DEFAULT 0,
        stars INT DEFAULT 0,
        forks INT DEFAULT 0,
        featured TINYINT(1) DEFAULT 0,
        settings JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX(category),
        INDEX(access),
        INDEX(author)
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id VARCHAR(64),
        username VARCHAR(64),
        action VARCHAR(64) NOT NULL,
        details TEXT
      ) ENGINE=InnoDB;
    `);

    // Rig Storage Table for GameChiller User & Component Settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rig_storage (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NULL,
        rig_id VARCHAR(96) NULL,
        storage_key VARCHAR(128) NOT NULL,
        data_value JSON NOT NULL,
        is_global TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_key (user_id, storage_key),
        INDEX idx_rig_key (rig_id, storage_key),
        INDEX idx_global_key (is_global, storage_key)
      ) ENGINE=InnoDB;
    `);

    // GameChiller Registered Clients & API Consumers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gamechiller_clients (
        client_id VARCHAR(64) PRIMARY KEY,
        client_secret VARCHAR(128) NOT NULL,
        name VARCHAR(128) NOT NULL,
        scopes JSON NOT NULL,
        status ENUM('active', 'revoked') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Ensure schema columns on rigs exist
    const rigMigrations = [
      'ALTER TABLE rigs ADD COLUMN featured TINYINT(1) DEFAULT 0',
      'ALTER TABLE rigs ADD COLUMN thumbnail VARCHAR(255) DEFAULT NULL',
      'ALTER TABLE rigs ADD COLUMN screenshot VARCHAR(255) DEFAULT NULL',
      'ALTER TABLE rigs ADD COLUMN permissions JSON DEFAULT NULL',
      'ALTER TABLE rigs ADD COLUMN dependencies JSON DEFAULT NULL',
      "ALTER TABLE rigs ADD COLUMN min_runtime_version VARCHAR(32) DEFAULT 'v1.0.0'",
      'ALTER TABLE rigs ADD COLUMN docs JSON DEFAULT NULL'
    ];
    for (const sql of rigMigrations) {
      try { await pool.query(sql); } catch (e) {}
    }

    // Seed Initial Data & Fix Paths
    await seedInitialData();
    console.log('[PlayRig DB] MySQL connection pool ready on port ' + DB_CONFIG.port);
    return true;
  } catch (err) {
    console.error('[PlayRig DB] Init error:', err.message);
    throw err;
  }
}

async function seedInitialData() {
  // Check users
  const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
  if (users[0].count === 0) {
    const adminPass = hashPassword('admin123');
    const creatorPass = hashPassword('creator123');
    await pool.query(`
      INSERT INTO users (id, username, name, password_hash, role, status) VALUES
      ('u-admin-01', 'admin', 'System Admin', ?, 'admin', 'active'),
      ('u-creator-01', 'creator', 'Liath', ?, 'creator', 'active')
    `, [adminPass, creatorPass]);
  }

  // Seed default categories
  const defaultCategories = [
    {
      id: 'gaming',
      name: 'Gaming & Sandbox',
      icon: 'gamepad',
      description: 'Generatoren, Editoren und Tools für Sandbox & Games',
      subcategories: ['Minecraft', 'Enshrouded', 'Procedural', 'RPG-Tools', 'Shooter-Tools', 'Helper', 'Map-Generators'],
      sort_order: 1
    },
    {
      id: 'animations',
      name: 'Animations & Visual FX',
      icon: 'sparkles',
      description: 'Border-Beams, 3D Spotlights, Partikelsysteme und Shader',
      subcategories: ['Border-Beams', 'Spotlights-3D', 'Particles-FX', 'Buttons-Ripples', 'Canvas-Shaders', 'Transitions-Loaders', 'Emergence'],
      sort_order: 2
    },
    {
      id: 'helper',
      name: 'Helper & Utility',
      icon: 'wrench',
      description: 'Produktivitäts-Helfer, Konverter und Rechner',
      subcategories: ['Converters', 'Formatters', 'Calculators', 'Generators'],
      sort_order: 3
    },
    {
      id: 'creative',
      name: 'Creative & Art',
      icon: 'palette',
      description: 'Generative Kunst, Farbsysteme und Vektoren',
      subcategories: ['Generative-Art', 'Color-Palettes', 'Patterns', 'Audio-Visual'],
      sort_order: 4
    },
    {
      id: 'dev-lab',
      name: 'Dev Lab & Showcase',
      icon: 'code',
      description: 'Experimentelle Tech-Demos und Prototypen',
      subcategories: ['ThreeJS-Experiments', 'WebGL-Canvas', 'CSS-Micro-Interactions', 'Algorithms'],
      sort_order: 5
    }
  ];

  for (const cat of defaultCategories) {
    await pool.query(`
      INSERT INTO categories (id, name, icon, description, subcategories, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        icon = VALUES(icon),
        description = VALUES(description),
        subcategories = VALUES(subcategories),
        sort_order = VALUES(sort_order)
    `, [cat.id, cat.name, cat.icon, cat.description, JSON.stringify(cat.subcategories), cat.sort_order]);
  }

  // Seed or update flagship rig: Voxel Sphere & Dome Architect
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, settings
    ) VALUES (
      'voxel-sphere-architect',
      'Voxel Sphere & Dome Architect',
      'High-End 3D Voxel Generator für Kugeln, Kuppeln, Ellipsoide und Torus-Geometrien mit voxelgenauem Schichten-Viewer, Aspect-Ratio Höheneinstellung und Multi-Format Blueprint Export.',
      'gaming',
      'Minecraft',
      'rigs/Gaming/Minecraft/Voxel-Sphere-Architect/index.html',
      'v0.0.1',
      'Liath',
      '© GameChiller',
      'cube',
      '#00d2ff',
      ?,
      'active',
      'public',
      'Liath',
      142,
      48,
      12,
      1,
      ?
    )
    ON DUPLICATE KEY UPDATE
      path = 'rigs/Gaming/Minecraft/Voxel-Sphere-Architect/index.html',
      featured = 1,
      views = GREATEST(views, 142),
      stars = GREATEST(stars, 48),
      forks = GREATEST(forks, 12)
  `, [
    JSON.stringify(['3D', 'Voxel', 'Minecraft', 'Three.js', 'Blueprint', 'Generator']),
    JSON.stringify({ defaultTheme: 'cyber-cyan', heightDecoupled: true })
  ]);

  // Seed Particle Gravity Vortex
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, settings
    ) VALUES (
      'particle-gravity-vortex',
      'Particle Gravity Vortex Lab',
      'Echtzeit-Partikelfeld mit orbitaler Physik, Gravitationslinsen, Schockwellen-Impulsen und dynamischen Farbpaletten.',
      'animations',
      'Particles-FX',
      'rigs/Animations/Particles-FX/Particle-Gravity-Vortex/index.html',
      'v0.0.1',
      'Liath',
      '© GameChiller',
      'sparkles',
      '#6366f1',
      ?,
      'active',
      'public',
      'Liath',
      98,
      35,
      8,
      0,
      ?
    )
    ON DUPLICATE KEY UPDATE
      path = 'rigs/Animations/Particles-FX/Particle-Gravity-Vortex/index.html'
  `, [
    JSON.stringify(['Physics', 'Particles', 'Canvas2D', 'Vortex', 'Animation']),
    JSON.stringify({ defaultTheme: 'cyber-cyan' })
  ]);

  // Seed Enshrouded Save Editor
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, thumbnail, settings
    ) VALUES (
      'enshrouded-save-editor',
      'Enshrouded Character & Save Editor',
      'High-End Savegame Editor für Keen Games Enshrouded. Automatische Steam-Erkennung, Level & XP Booster, 16 Ausrüstungs-Slots, Rucksack-Manager, Item-Katalog mit über 4.300 Original-Icons und automatisches Backup.',
      'gaming',
      'Enshrouded',
      'rigs/Gaming/Enshrouded/Save-Editor/index.html',
      'v0.0.1',
      'Liath',
      '© GameChiller',
      'shield',
      '#f59e0b',
      ?,
      'active',
      'public',
      'Liath',
      215,
      64,
      14,
      1,
      '/rigs/Gaming/Enshrouded/Save-Editor/thumbnail.png',
      ?
    )
    ON DUPLICATE KEY UPDATE
      path = 'rigs/Gaming/Enshrouded/Save-Editor/index.html',
      thumbnail = '/rigs/Gaming/Enshrouded/Save-Editor/thumbnail.png',
      featured = 1
  `, [
    JSON.stringify(['Enshrouded', 'Savegame', 'RPG', 'Inventory', 'Level', 'Backup']),
    JSON.stringify({ defaultTheme: 'royal-gold', services: { required: ['enshrouded'], optional: [] } })
  ]);

  // Seed RPG Dice Loot Vault
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, thumbnail, settings
    ) VALUES (
      'rpg-dice-loot-vault',
      'Retro RPG Dice & Loot Vault',
      'Multi-Dice Roller (D4 bis D100) mit 3D-Canvas Physikwürfeln, prozeduraler Sound-Synthese, Nat-20 Kritischer Treffer Fanfare und Diablo-inspiriertem Schatzkisten-Simulator.',
      'gaming',
      'RPG-Tools',
      'rigs/Gaming/RPG-Tools/rpg-dice-loot-vault/index.html',
      'v0.0.1',
      'Liath',
      '© GameChiller',
      'sparkles',
      '#f59e0b',
      ?,
      'active',
      'public',
      'Liath',
      130,
      42,
      9,
      1,
      '/rigs/Gaming/RPG-Tools/rpg-dice-loot-vault/thumbnail.png',
      ?
    )
    ON DUPLICATE KEY UPDATE
      path = 'rigs/Gaming/RPG-Tools/rpg-dice-loot-vault/index.html',
      thumbnail = '/rigs/Gaming/RPG-Tools/rpg-dice-loot-vault/thumbnail.png'
  `, [
    JSON.stringify(['RPG', 'Dice', 'Loot', 'D&D', 'Audio-SFX', 'Canvas2D', 'Physics']),
    JSON.stringify({ defaultTheme: 'royal-gold' })
  ]);

  // Seed Cyber Matrix Rain Lab
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, thumbnail, settings
    ) VALUES (
      'cyber-matrix-rain-lab',
      'Cyber Matrix Rain & Glyph Lab',
      'Kultiger Cyberpunk Digital-Rain Generator mit Katakana, Runen, Hexadezimal-Glyphen, Schockwellen-Mausinteraktion, Neon-Paletten und prozeduralem Web Audio Regen-Ambiente.',
      'animations',
      'Canvas-Shaders',
      'rigs/Animations/Canvas-Shaders/cyber-matrix-rain-lab/index.html',
      'v0.0.1',
      'Liath',
      '© GameChiller',
      'code',
      '#00ff88',
      ?,
      'active',
      'public',
      'Liath',
      180,
      56,
      15,
      0,
      '/rigs/Animations/Canvas-Shaders/cyber-matrix-rain-lab/thumbnail.png',
      ?
    )
    ON DUPLICATE KEY UPDATE
      path = 'rigs/Animations/Canvas-Shaders/cyber-matrix-rain-lab/index.html',
      thumbnail = '/rigs/Animations/Canvas-Shaders/cyber-matrix-rain-lab/thumbnail.png'
  `, [
    JSON.stringify(['Matrix', 'Cyberpunk', 'Canvas', 'Glyphs', 'Procedural', 'Audio']),
    JSON.stringify({ defaultTheme: 'cyber-cyan' })
  ]);

  // Seed Glassmorphism & Border Beam Studio
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, thumbnail, settings
    ) VALUES (
      'glassmorphism-beam-studio',
      'Glassmorphism & Border-Beam Studio',
      'Visueller Echtzeit-Generator für moderne Glassmorphismus-Karten und animierte rotierende Border-Beams mit 3D-Mausneigung, Unschärfe-Reglern und 1-Klick CSS/Tailwind-Export.',
      'helper',
      'Generators',
      'rigs/Helper/Generators/glassmorphism-beam-studio/index.html',
      'v0.0.1',
      'Liath',
      '© GameChiller',
      'palette',
      '#00f0ff',
      ?,
      'active',
      'public',
      'Liath',
      112,
      39,
      7,
      1,
      '/rigs/Helper/Generators/glassmorphism-beam-studio/thumbnail.png',
      ?
    )
    ON DUPLICATE KEY UPDATE
      path = 'rigs/Helper/Generators/glassmorphism-beam-studio/index.html',
      thumbnail = '/rigs/Helper/Generators/glassmorphism-beam-studio/thumbnail.png'
  `, [
    JSON.stringify(['CSS3', 'Glassmorphism', 'Border-Beam', 'Generator', 'Tailwind', 'UI-Design']),
    JSON.stringify({ defaultTheme: 'cyber-cyan' })
  ]);

  // Seed Audio Reactive Ribbon
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, thumbnail, settings
    ) VALUES (
      'audio-reactive-ribbon',
      'Audio Reactive Ribbon Visualizer',
      'Interaktiver 3D-Bänder Audio-Visualizer mit integriertem prozeduralem Synthwave Beat-Generator, Mikrofon-Live-Input, Audiodatei-Wiedergabe und FFT-Frequenzanalyse.',
      'creative',
      'Audio-Visual',
      'rigs/Creative/Audio-Visual/audio-reactive-ribbon/index.html',
      'v0.0.1',
      'Liath',
      '© GameChiller',
      'sparkles',
      '#ec4899',
      ?,
      'active',
      'public',
      'Liath',
      165,
      51,
      11,
      1,
      '/rigs/Creative/Audio-Visual/audio-reactive-ribbon/thumbnail.png',
      ?
    )
    ON DUPLICATE KEY UPDATE
      path = 'rigs/Creative/Audio-Visual/audio-reactive-ribbon/index.html',
      thumbnail = '/rigs/Creative/Audio-Visual/audio-reactive-ribbon/thumbnail.png'
  `, [
    JSON.stringify(['WebAudio', 'FFT', 'Visualizer', 'Synthwave', 'Canvas2D', 'Music']),
    JSON.stringify({ defaultTheme: 'neon-synth' })
  ]);

  // Seed Crosshair Scope Lab
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, thumbnail, settings
    ) VALUES (
      'crosshair-scope-lab',
      'FPS Tactical Crosshair & Scope Lab',
      'Professioneller Fadenkreuz- und Scope-Generator für CS2, Valorant & Apex Legends. Mit Live-Rückstoßsimulation (Spray Pattern), Ziel-Dummy, Szenarien und 1-Klick Code-Export.',
      'gaming',
      'Shooter-Tools',
      'rigs/Gaming/Shooter-Tools/crosshair-scope-lab/index.html',
      'v0.0.1',
      'Liath',
      '© GameChiller',
      'crosshair',
      '#10b981',
      ?,
      'active',
      'public',
      'Liath',
      125,
      38,
      6,
      0,
      '/rigs/Gaming/Shooter-Tools/crosshair-scope-lab/thumbnail.png',
      ?
    )
    ON DUPLICATE KEY UPDATE
      path = 'rigs/Gaming/Shooter-Tools/crosshair-scope-lab/index.html',
      thumbnail = '/rigs/Gaming/Shooter-Tools/crosshair-scope-lab/thumbnail.png'
  `, [
    JSON.stringify(['FPS', 'Crosshair', 'Valorant', 'CS2', 'Scope', 'Shooter']),
    JSON.stringify({ defaultTheme: 'emerald-matrix' })
  ]);

  // Seed Speedrun Splits Tracker
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, thumbnail, settings
    ) VALUES (
      'speedrun-splits-tracker',
      'Speedrun Splits Tracker & Delta Stopwatch',
      'Präzisions-Splitter und Delta-Stoppuhr nach Vorbild von LiveSplit für Speedruns und Bosskämpfe. Mit Delta-Vergleich (+/- PB), goldenen Split-Fanfaren, OBS Chroma-Key und Hotkeys.',
      'gaming',
      'Helper',
      'rigs/Gaming/Helper/speedrun-splits-tracker/index.html',
      'v0.0.1',
      'Liath',
      '© GameChiller',
      'clock',
      '#fbbf24',
      ?,
      'active',
      'public',
      'Liath',
      140,
      45,
      10,
      0,
      '/rigs/Gaming/Helper/speedrun-splits-tracker/thumbnail.png',
      ?
    )
    ON DUPLICATE KEY UPDATE
      path = 'rigs/Gaming/Helper/speedrun-splits-tracker/index.html',
      thumbnail = '/rigs/Gaming/Helper/speedrun-splits-tracker/thumbnail.png'
  `, [
    JSON.stringify(['Speedrun', 'LiveSplit', 'Stopwatch', 'OBS', 'Enshrouded']),
    JSON.stringify({ defaultTheme: 'royal-gold' })
  ]);

  // Seed Celestial Gravity Sandbox
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, thumbnail, settings
    ) VALUES (
      'celestial-gravity-sandbox',
      'Celestial Gravity N-Body Sandbox',
      'Interaktiver N-Körper Gravitations- und Raumfahrt-Simulator. Berechnet Newtonsche Himmelsmechanik in Echtzeit mit Katapult-Steuerung, Stern-Kollisionen und kosmischem Synth-Drone.',
      'gaming',
      'Procedural',
      'rigs/Gaming/Procedural/celestial-gravity-sandbox/index.html',
      'v0.0.1',
      'Liath',
      '© GameChiller',
      'orbit',
      '#38bdf8',
      ?,
      'active',
      'public',
      'Liath',
      205,
      62,
      18,
      1,
      '/rigs/Gaming/Procedural/celestial-gravity-sandbox/thumbnail.png',
      ?
    )
    ON DUPLICATE KEY UPDATE
      path = 'rigs/Gaming/Procedural/celestial-gravity-sandbox/index.html',
      thumbnail = '/rigs/Gaming/Procedural/celestial-gravity-sandbox/thumbnail.png'
  `, [
    JSON.stringify(['Space', 'Physics', 'N-Body', 'Simulation', 'Gravity', 'Procedural']),
    JSON.stringify({ defaultTheme: 'cyber-cyan' })
  ]);

  // Seed Emergence Laboratory
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, thumbnail, settings
    ) VALUES (
      'emergence-laboratory',
      'Emergence Laboratory',
      'Ein interaktives Forschungslabor für zelluläre Automaten und emergente Systeme. Untersuche Conway\\'s Game of Life, HighLife, Seeds, Day & Night, Brian\\'s Brain, Anneal sowie konfigurierbare B/S-Regeln, Populations- und Entropie-Messung, Experiment-Snapshots und JSON-Export.',
      'animations',
      'Emergence',
      'rigs/Animations/Emergence/Emergence-Laboratory/index.html',
      'v1.0.0',
      'Liath',
      '© GameChiller',
      'sparkles',
      '#00e5ff',
      ?,
      'active',
      'public',
      'Liath',
      210,
      68,
      16,
      1,
      '/rigs/Animations/Emergence/Emergence-Laboratory/thumbnail.png',
      ?
    )
    ON DUPLICATE KEY UPDATE
      title = 'Emergence Laboratory',
      category = 'animations',
      subcategory = 'Emergence',
      path = 'rigs/Animations/Emergence/Emergence-Laboratory/index.html',
      thumbnail = '/rigs/Animations/Emergence/Emergence-Laboratory/thumbnail.png',
      version = 'v1.0.0',
      author = 'Liath',
      copyright = '© GameChiller'
  `, [
    JSON.stringify(['Cellular-Automata', 'Game-of-Life', 'Emergence', 'Simulation', 'Science', 'Canvas2D', 'Entropy', 'Export']),
    JSON.stringify({ defaultTheme: 'cyber-cyan' })
  ]);

  // Seed Settlement Generator
  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, views, stars, forks, featured, thumbnail, settings
    ) VALUES (
      'settlement-generator',
      'Settlement Generator',
      'Eigenständiger World-Editor mit Azgaar Full JSON Import, gemeinsamem World Core, interaktiver 2D-Kartenansicht und Dateninspektor.',
      'dev-lab',
      'World Editor',
      'rigs/Dev Lab & Showcase/World Editor/Settlement Generator/index.html',
      'v0.1.0',
      'Liath',
      '© GameChiller',
      'map',
      '#00e5ff',
      ?,
      'active',
      'public',
      'Liath',
      85,
      24,
      5,
      1,
      '/rigs/Dev Lab & Showcase/World Editor/Settlement Generator/thumbnail.png',
      ?
    )
    ON DUPLICATE KEY UPDATE
      title = 'Settlement Generator',
      category = 'dev-lab',
      subcategory = 'World Editor',
      path = 'rigs/Dev Lab & Showcase/World Editor/Settlement Generator/index.html',
      thumbnail = '/rigs/Dev Lab & Showcase/World Editor/Settlement Generator/thumbnail.png',
      version = 'v0.1.0',
      author = 'Liath',
      copyright = '© GameChiller'
  `, [
    JSON.stringify(['World Editor', 'Azgaar', 'Fantasy Map', 'World Core', 'Settlement', '2D Map']),
    JSON.stringify({ defaultTheme: 'cyber-cyan' })
  ]);

  // Fix any legacy path referencing 'projects/Gaming' and set default thumbnails
  await pool.query(`
    UPDATE rigs 
    SET path = 'rigs/Gaming/Minecraft/Voxel-Sphere-Architect/index.html',
        thumbnail = '/rigs/Gaming/Minecraft/Voxel-Sphere-Architect/thumbnail.png'
    WHERE id = 'voxel-sphere-architect'
  `);
  await pool.query(`
    UPDATE rigs 
    SET thumbnail = '/rigs/Animations/Particles-FX/Particle-Gravity-Vortex/thumbnail.png'
    WHERE id = 'particle-gravity-vortex'
  `);

  // Run automatic filesystem discovery to synchronize any other pulled/existing rigs on disk
  await syncRigsFromDisk();
}

/**
 * Automatically discovers, validates and registers all Rigs found in the rigs/ directory
 */
async function syncRigsFromDisk() {
  const rigsBaseDir = path.resolve(__dirname, '..', 'rigs');
  if (!fs.existsSync(rigsBaseDir)) {
    return { scanned: 0, newlyRegistered: [], updated: [] };
  }

  // Load registry.js for rich metadata enrichment if available
  const registryMap = new Map();
  try {
    const regFile = path.resolve(__dirname, '..', 'registry.js');
    if (fs.existsSync(regFile)) {
      const regContent = fs.readFileSync(regFile, 'utf8');
      const match = regContent.match(/window\.PLAYRIG_REGISTRY\s*=\s*(\[[\s\S]*?\]);/);
      if (match) {
        const items = new Function('return ' + match[1])();
        for (const item of items) {
          if (item.id) registryMap.set(item.id.toLowerCase(), item);
          if (item.path) registryMap.set(item.path.toLowerCase().replace(/\\/g, '/'), item);
        }
      }
    }
  } catch (e) {
    console.warn('[Rig Sync] Hinweis beim Lesen von registry.js:', e.message);
  }

  function findRigFolders(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const hasIndex = entries.some(e => e.isFile() && e.name.toLowerCase() === 'index.html');
    if (hasIndex) {
      results.push(dir);
      return results;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        results.push(...findRigFolders(path.join(dir, e.name)));
      }
    }
    return results;
  }

  const rigFolders = findRigFolders(rigsBaseDir);
  const newlyRegistered = [];
  const updated = [];

  for (const rigDir of rigFolders) {
    try {
      const relPath = path.relative(path.resolve(__dirname, '..'), path.join(rigDir, 'index.html')).replace(/\\/g, '/');
      const folderName = path.basename(rigDir);
      
      // Read docs.json if present
      let docs = {};
      const docsFile = path.join(rigDir, 'docs.json');
      if (fs.existsSync(docsFile)) {
        try {
          docs = JSON.parse(fs.readFileSync(docsFile, 'utf8'));
        } catch (e) {}
      }

      // Check thumbnail
      let thumbPath = null;
      if (fs.existsSync(path.join(rigDir, 'thumbnail.png'))) {
        thumbPath = '/' + path.relative(path.resolve(__dirname, '..'), path.join(rigDir, 'thumbnail.png')).replace(/\\/g, '/');
      }

      // Determine ID
      let id = docs.id || folderName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      // Cross-reference registry
      const regMatch = registryMap.get(id.toLowerCase()) || registryMap.get(relPath.toLowerCase());
      if (regMatch && regMatch.id) {
        id = regMatch.id;
      }

      // Determine category and subcategory
      const parts = relPath.split('/');
      let category = docs.category || regMatch?.category || (parts[1] || 'gaming');
      let subcategory = docs.subcategory || regMatch?.subcategory || (parts.length > 3 ? parts[2] : 'General');
      
      // Normalize category (e.g. "Dev Lab & Showcase" -> "dev-lab")
      let catNorm = category.toLowerCase().trim();
      if (catNorm.includes('dev') || catNorm.includes('showcase') || catNorm.includes('lab')) catNorm = 'dev-lab';
      else if (catNorm.includes('anim')) catNorm = 'animations';
      else if (catNorm.includes('creat') || catNorm.includes('art')) catNorm = 'creative';
      else if (catNorm.includes('help') || catNorm.includes('util')) catNorm = 'helper';
      else if (catNorm.includes('game') || catNorm.includes('play')) catNorm = 'gaming';

      const title = docs.name || docs.title || regMatch?.title || folderName;
      const description = docs.purpose || docs.overview || docs.description || regMatch?.description || `${title} - Modulares PlayRig`;
      const version = docs.version || regMatch?.version || 'v1.0.0';
      const author = docs.author || regMatch?.author || 'Liath';
      const copyright = docs.copyright || regMatch?.copyright || (author === 'Liath' ? '© GameChiller' : `© ${author}`);
      const icon = regMatch?.icon || 'sparkles';
      const color = regMatch?.color || '#00e5ff';
      const tags = regMatch?.tags || (Array.isArray(docs.features) ? docs.features.slice(0, 8) : [subcategory, 'PlayRig']);
      const featured = regMatch?.featured ? 1 : 0;
      const stars = regMatch?.stars || 0;
      const views = regMatch?.views || 0;
      const forks = regMatch?.forks || 0;
      const thumbnail = thumbPath || regMatch?.thumbnail || null;
      const settings = JSON.stringify({ defaultTheme: 'cyber-cyan' });

      // Check if rig exists in DB
      const [rows] = await pool.query('SELECT id, path, thumbnail FROM rigs WHERE id = ?', [id]);
      if (!rows || rows.length === 0) {
        await pool.query(`
          INSERT INTO rigs (
            id, title, description, category, subcategory, path,
            version, author, copyright, icon, color, tags, status, access,
            original_author, views, stars, forks, featured, thumbnail, settings
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'public', ?, ?, ?, ?, ?, ?, ?)
        `, [
          id, title, description, catNorm, subcategory, relPath,
          version, author, copyright, icon, color, JSON.stringify(tags),
          author, views, stars, forks, featured, thumbnail, settings
        ]);
        newlyRegistered.push(id);
        console.log(`[PlayRig Auto-Discovery] Neues Rig registriert: '${title}' (${id}) -> ${relPath}`);
      } else {
        const existing = rows[0];
        if (existing.path !== relPath || (thumbnail && !existing.thumbnail)) {
          await pool.query('UPDATE rigs SET path = ?, thumbnail = COALESCE(?, thumbnail) WHERE id = ?', [
            relPath, thumbnail, id
          ]);
          updated.push(id);
        }
      }
    } catch (err) {
      console.error(`[PlayRig Auto-Discovery] Fehler bei Rig in ${rigDir}:`, err.message);
    }
  }

  return { scanned: rigFolders.length, newlyRegistered, updated };
}

// User & Auth operations
async function authenticate(username, password) {
  const hash = hashPassword(password);
  const [rows] = await pool.query(
    'SELECT id, username, name, role, status FROM users WHERE username = ? AND password_hash = ?',
    [username, hash]
  );
  if (!rows || rows.length === 0) return null;
  const user = rows[0];
  if (user.status !== 'active') return null;

  const token = 'pr_' + crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, user.id]);
  await logAudit(user.id, user.username, 'LOGIN', 'User logged in successfully');
  return { token, user };
}

async function getUserByToken(token) {
  if (!token) return null;
  const [rows] = await pool.query(`
    SELECT u.id, u.username, u.name, u.role, u.status
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `, [token]);
  return rows[0] || null;
}

async function logout(token) {
  if (!token) return;
  await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
}

async function registerUser(username, name, password, role = 'user') {
  const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  if (exists.length > 0) throw new Error('Username already taken');

  const id = 'u-' + Date.now();
  const hash = hashPassword(password);
  await pool.query(
    'INSERT INTO users (id, username, name, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [id, username, name, hash, role]
  );
  return { id, username, name, role };
}

async function getAllUsers() {
  const [rows] = await pool.query('SELECT id, username, name, role, status, created_at FROM users ORDER BY created_at DESC');
  return rows;
}

// Category operations
async function getCategories() {
  const [rows] = await pool.query('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
  return rows.map(r => ({
    ...r,
    subcategories: typeof r.subcategories === 'string' ? JSON.parse(r.subcategories) : (r.subcategories || [])
  }));
}

async function addCategory(category) {
  const id = category.id || category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await pool.query(`
    INSERT INTO categories (id, name, icon, description, subcategories, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    id,
    category.name,
    category.icon || 'folder',
    category.description || '',
    JSON.stringify(category.subcategories || []),
    category.sort_order || 0
  ]);
  return { id, ...category };
}

// Rig operations
async function getRigs(filters = {}) {
  let query = 'SELECT * FROM rigs WHERE 1=1';
  const params = [];

  if (filters.access) {
    query += ' AND access = ?';
    params.push(filters.access);
  }
  if (filters.category && filters.category !== 'all') {
    query += ' AND category = ?';
    params.push(filters.category);
  }
  if (filters.author) {
    query += ' AND author = ?';
    params.push(filters.author);
  }
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.featured !== undefined) {
    query += ' AND featured = ?';
    params.push(filters.featured ? 1 : 0);
  }
  if (filters.search) {
    query += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }

  if (filters.orderBy === 'stars') {
    query += ' ORDER BY stars DESC, updated_at DESC';
  } else if (filters.orderBy === 'views') {
    query += ' ORDER BY views DESC, updated_at DESC';
  } else if (filters.orderBy === 'newest') {
    query += ' ORDER BY created_at DESC';
  } else {
    query += ' ORDER BY updated_at DESC';
  }

  const [rows] = await pool.query(query, params);
  return rows.map(r => ({
    ...r,
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []),
    settings: typeof r.settings === 'string' ? JSON.parse(r.settings) : (r.settings || {})
  }));
}

async function getRigById(id) {
  const [rows] = await pool.query('SELECT * FROM rigs WHERE id = ?', [id]);
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    ...r,
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []),
    settings: typeof r.settings === 'string' ? JSON.parse(r.settings) : (r.settings || {})
  };
}

async function createRig(data, user) {
  const id = data.id || ('rig-' + Date.now().toString(36));
  const author = data.author || (user ? (user.name || user.username) : 'Community Creator');
  const isLiath = author.toLowerCase() === 'liath' || (user && user.username === 'creator');
  const copyright = data.copyright || (isLiath ? '© GameChiller' : `© ${author}`);
  const path = data.path || `${data.category || 'creative'}/${data.subcategory || 'experiments'}/${data.title.replace(/[^a-zA-Z0-9_-]/g, '_')}/index.html`;

  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, forked_from, settings
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.title,
    data.description || '',
    data.category || 'creative',
    data.subcategory || 'General',
    path,
    data.version || 'v0.0.1',
    author,
    copyright,
    data.icon || 'cube',
    data.color || '#00d2ff',
    JSON.stringify(data.tags || []),
    data.status || 'active',
    data.access || 'public',
    data.original_author || author,
    data.forked_from || null,
    JSON.stringify(data.settings || {})
  ]);

  if (user) {
    await logAudit(user.id, user.username, 'CREATE_RIG', `Created Rig ${id} (${data.title})`);
  }
  return getRigById(id);
}

async function updateRig(id, data, user) {
  const existing = await getRigById(id);
  if (!existing) return null;

  const title = data.title !== undefined ? data.title : existing.title;
  const description = data.description !== undefined ? data.description : existing.description;
  const category = data.category !== undefined ? data.category : existing.category;
  const subcategory = data.subcategory !== undefined ? data.subcategory : existing.subcategory;
  const version = data.version !== undefined ? data.version : existing.version;
  const icon = data.icon !== undefined ? data.icon : existing.icon;
  const color = data.color !== undefined ? data.color : existing.color;
  const tags = data.tags !== undefined ? JSON.stringify(data.tags) : JSON.stringify(existing.tags);
  const status = data.status !== undefined ? data.status : existing.status;
  const access = data.access !== undefined ? data.access : existing.access;
  const featured = data.featured !== undefined ? (data.featured ? 1 : 0) : existing.featured;
  const thumbnail = data.thumbnail !== undefined ? data.thumbnail : (existing.thumbnail || null);
  const author = data.author !== undefined ? data.author : existing.author;
  const copyright = data.copyright !== undefined ? data.copyright : existing.copyright;
  const settings = data.settings !== undefined ? JSON.stringify(data.settings) : JSON.stringify(existing.settings);

  await pool.query(`
    UPDATE rigs SET
      title = ?, description = ?, category = ?, subcategory = ?,
      version = ?, author = ?, copyright = ?, icon = ?, color = ?, tags = ?, status = ?,
      access = ?, featured = ?, thumbnail = ?, settings = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [title, description, category, subcategory, version, author, copyright, icon, color, tags, status, access, featured, thumbnail, settings, id]);

  if (user) {
    await logAudit(user.id, user.username, 'UPDATE_RIG', `Updated Rig ${id}`);
  }
  return getRigById(id);
}

async function deleteRig(id, user) {
  const existing = await getRigById(id);
  if (!existing) return false;

  await pool.query('DELETE FROM rigs WHERE id = ?', [id]);
  if (user) {
    await logAudit(user.id, user.username, 'DELETE_RIG', `Deleted Rig ${id} (${existing.title})`);
  }
  return true;
}

async function forkRig(id, user) {
  const source = await getRigById(id);
  if (!source) return null;

  const newId = `${source.id}-fork-${Date.now().toString(36).slice(-4)}`;
  const author = user ? (user.name || user.username) : 'Community Forker';
  const isLiath = author.toLowerCase() === 'liath' || (user && user.username === 'creator');
  const copyright = isLiath ? '© GameChiller' : `© ${author}`;

  await pool.query(`
    INSERT INTO rigs (
      id, title, description, category, subcategory, path,
      version, author, copyright, icon, color, tags, status, access,
      original_author, forked_from, settings
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    newId,
    `${source.title} (Fork)`,
    source.description,
    source.category,
    source.subcategory,
    source.path,
    'v0.0.1',
    author,
    copyright,
    source.icon,
    source.color,
    JSON.stringify(source.tags || []),
    'active',
    'private',
    source.original_author || source.author,
    source.id,
    JSON.stringify(source.settings || {})
  ]);

  await pool.query('UPDATE rigs SET forks = forks + 1 WHERE id = ?', [id]);
  if (user) {
    await logAudit(user.id, user.username, 'FORK_RIG', `Forked ${source.id} to ${newId}`);
  }
  return getRigById(newId);
}

async function incrementRigStat(id, field) {
  if (!['views', 'stars'].includes(field)) return;
  await pool.query(`UPDATE rigs SET ${field} = ${field} + 1 WHERE id = ?`, [id]);
}

// Audit logging
async function logAudit(userId, username, action, details) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
      [userId || null, username || 'anonymous', action, details || '']
    );
  } catch (e) {
    console.error('[Audit Log] Failed:', e.message);
  }
}

async function getAuditLogs(limit = 100) {
  const [rows] = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?', [limit]);
  return rows;
}

// ==========================================
// CENTRAL STORAGE API HELPERS (GameChiller & Rigs)
// ==========================================
async function getStorageEntry(scope, key, userId = null, rigId = null) {
  if (scope === 'user') {
    if (!userId) return null;
    const [rows] = await pool.query(
      'SELECT data_value, updated_at FROM rig_storage WHERE user_id = ? AND storage_key = ? AND is_global = 0',
      [userId, key]
    );
    return rows[0] || null;
  } else if (scope === 'rig') {
    if (!rigId) return null;
    const [rows] = await pool.query(
      'SELECT data_value, updated_at FROM rig_storage WHERE rig_id = ? AND storage_key = ? AND is_global = 0',
      [rigId, key]
    );
    return rows[0] || null;
  } else if (scope === 'global') {
    const [rows] = await pool.query(
      'SELECT data_value, updated_at FROM rig_storage WHERE storage_key = ? AND is_global = 1',
      [key]
    );
    return rows[0] || null;
  }
  return null;
}

async function setStorageEntry(scope, key, value, userId = null, rigId = null) {
  const serialized = JSON.stringify(value !== undefined ? value : null);
  const entryId = crypto.randomUUID ? crypto.randomUUID() : ('st_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8));

  if (scope === 'user') {
    if (!userId) throw new Error('user_id erforderlich für User-Storage');
    await pool.query(`
      INSERT INTO rig_storage (id, user_id, rig_id, storage_key, data_value, is_global)
      VALUES (?, ?, ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE data_value = VALUES(data_value), updated_at = CURRENT_TIMESTAMP
    `, [entryId, userId, rigId || null, key, serialized]);
  } else if (scope === 'rig') {
    if (!rigId) throw new Error('rig_id erforderlich für Rig-Storage');
    await pool.query(`
      INSERT INTO rig_storage (id, user_id, rig_id, storage_key, data_value, is_global)
      VALUES (?, ?, ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE data_value = VALUES(data_value), updated_at = CURRENT_TIMESTAMP
    `, [entryId, userId || null, rigId, key, serialized]);
  } else if (scope === 'global') {
    await pool.query(`
      INSERT INTO rig_storage (id, user_id, rig_id, storage_key, data_value, is_global)
      VALUES (?, NULL, NULL, ?, ?, 1)
      ON DUPLICATE KEY UPDATE data_value = VALUES(data_value), updated_at = CURRENT_TIMESTAMP
    `, [entryId, key, serialized]);
  }
  return { key, updated: true };
}

async function deleteStorageEntry(scope, key, userId = null, rigId = null) {
  if (scope === 'user') {
    await pool.query('DELETE FROM rig_storage WHERE user_id = ? AND storage_key = ? AND is_global = 0', [userId, key]);
  } else if (scope === 'rig') {
    await pool.query('DELETE FROM rig_storage WHERE rig_id = ? AND storage_key = ? AND is_global = 0', [rigId, key]);
  } else if (scope === 'global') {
    await pool.query('DELETE FROM rig_storage WHERE storage_key = ? AND is_global = 1', [key]);
  }
  return true;
}

async function getClientByApiKey(apiKey) {
  if (!apiKey) return null;
  try {
    const [rows] = await pool.query(
      'SELECT client_id, client_secret, name, scopes, status FROM gamechiller_clients WHERE (client_secret = ? OR client_id = ?) AND status = "active"',
      [apiKey, apiKey]
    );
    if (rows.length === 0) return null;
    const client = rows[0];
    return {
      ...client,
      scopes: typeof client.scopes === 'string' ? JSON.parse(client.scopes) : (client.scopes || [])
    };
  } catch (e) {
    return null;
  }
}

async function updateRigScreenshot(id, screenshotPath) {
  await pool.query('UPDATE rigs SET screenshot = ?, thumbnail = ? WHERE id = ?', [screenshotPath, screenshotPath, id]);
  return getRigById(id);
}

async function updateRigStatus(id, status) {
  if (!['active', 'wip', 'deprecated', 'pending'].includes(status)) {
    throw new Error('Ungültiger Status: ' + status);
  }
  await pool.query('UPDATE rigs SET status = ? WHERE id = ?', [status, id]);
  return getRigById(id);
}

module.exports = {
  init,
  authenticate,
  getClientByApiKey,
  getUserByToken,
  logout,
  registerUser,
  getAllUsers,
  getCategories,
  addCategory,
  getRigs,
  getRigById,
  createRig,
  updateRig,
  deleteRig,
  forkRig,
  incrementRigStat,
  logAudit,
  getAuditLogs,
  getStorageEntry,
  setStorageEntry,
  deleteStorageEntry,
  updateRigScreenshot,
  updateRigStatus,
  syncRigsFromDisk
};
