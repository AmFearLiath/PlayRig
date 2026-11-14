/**
 * PLAYRIG - ENSHROUDED SAVE ENGINE SERVICE
 * Handles save file discovery, zstd decompression, XXHash3 verification,
 * SV2C block parsing, character data extraction, and safe writing with backups.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { compress, decompress } = require('@mongodb-js/zstd');
const { createXXHash3 } = require('hash-wasm');

let xxh3Instance = null;
async function getXXH3() {
  if (!xxh3Instance) {
    xxh3Instance = await createXXHash3();
  }
  return xxh3Instance;
}

async function hash32(buf) {
  const h = await getXXH3();
  h.init();
  h.update(buf);
  return parseInt(h.digest('hex').slice(8), 16) >>> 0;
}

// Data catalogs
let itemsCatalog = null;
let skillsCatalog = null;

function loadCatalogs(rootDir) {
  if (!itemsCatalog) {
    const itemsPath = path.join(rootDir, 'Gaming', 'Enshrouded', 'Save-Editor', 'data', 'items.json');
    if (fs.existsSync(itemsPath)) {
      itemsCatalog = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
    }
  }
  if (!skillsCatalog) {
    const skillsPath = path.join(rootDir, 'Gaming', 'Enshrouded', 'Save-Editor', 'data', 'skills.json');
    if (fs.existsSync(skillsPath)) {
      skillsCatalog = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
    }
  }
}

/** Check if enshrouded.exe is running */
function isGameRunning() {
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq enshrouded.exe" /NH', (err, stdout) => {
      if (err) return resolve(false);
      resolve(stdout.toLowerCase().includes('enshrouded.exe'));
    });
  });
}

/** Scan system for Enshrouded character saves */
async function detectSaves() {
  const candidates = [
    'C:/Program Files (x86)/Steam/userdata',
    'C:/Program Files/Steam/userdata',
    'D:/Steam/userdata',
    'E:/Steam/userdata',
    'F:/Steam/userdata',
    path.join(process.env.USERPROFILE || '', 'Saved Games', 'keen games', 'Enshrouded')
  ];

  const results = [];

  for (const root of candidates) {
    if (!fs.existsSync(root)) continue;
    try {
      const entries = fs.readdirSync(root);
      for (const entry of entries) {
        // Steam user ID directories
        const remoteDir = path.join(root, entry, '1203620', 'remote');
        if (fs.existsSync(remoteDir)) {
          scanDirectory(remoteDir, results);
        }
      }
      // Also scan root directly in case it's the Saved Games folder
      scanDirectory(root, results);
    } catch (e) {
      // Ignore directory access permission errors
    }
  }

  // Parse header summaries for each found file
  const parsedResults = [];
  for (const item of results) {
    try {
      const summary = await readSaveSummary(item.path);
      parsedResults.push({
        ...item,
        name: summary.name || 'Unbekannt',
        level: summary.level || 0,
        xp: summary.xp || 0
      });
    } catch (e) {
      parsedResults.push({
        ...item,
        name: 'Unbekannt',
        level: 0,
        xp: 0
      });
    }
  }

  // Sort by last modified descending
  return parsedResults.sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

function scanDirectory(dir, results) {
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.startsWith('character') && f.endsWith('.ksd')) {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        if (!results.some(r => r.path === full)) {
          results.push({
            file: f,
            path: full,
            size: stat.size,
            modified: stat.mtime
          });
        }
      }
    }
  } catch (e) {}
}

/** Read quick header summary from a .ksd file */
async function readSaveSummary(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.toString('latin1', 0, 4) !== 'SV2C') throw new Error('Kein SV2C Save');

  const dirOff = data.readUInt32LE(0x28) + 40;
  const count = data.readUInt32LE(0x2c);

  let charName = 'Unbekannt';
  let level = 0;
  let xp = 0;

  for (let i = 0; i < count; i++) {
    const e = dirOff + 20 * i;
    const nameRel = data.readUInt32LE(e), nameLen = data.readUInt32LE(e + 4);
    const off = data.readUInt32LE(e + 8), size = data.readUInt32LE(e + 12);
    const name = data.toString('utf8', e + nameRel, e + nameRel + nameLen);
    const raw = data.subarray(off, off + size);

    if (name === 'character_data') {
      const payload = raw[9] === 1 ? await decompress(raw.subarray(14)) : raw.subarray(14);
      const len = payload.readUInt32LE(5);
      charName = payload.toString('utf8', 9, 9 + len);
    }
    if (name === 'player_character') {
      const payload = raw[9] === 1 ? await decompress(raw.subarray(14)) : raw.subarray(14);
      level = payload.readUInt32LE(0x3a);
      xp = payload.readUInt32LE(0x3e);
    }
  }

  return { name: charName, level, xp };
}

/** Parse SV2C Container from buffer */
async function parseSV2C(buffer, wanted = ['character_data', 'player_character', 'player_knowledge']) {
  if (buffer.toString('latin1', 0, 4) !== 'SV2C') throw new Error('Datei ist kein gültiger SV2C Enshrouded-Spielstand');

  const header = Buffer.from(buffer.subarray(0, 0x30));
  const dirOff = buffer.readUInt32LE(0x28) + 40;
  const count = buffer.readUInt32LE(0x2c);
  const blocks = [];

  for (let i = 0; i < count; i++) {
    const e = dirOff + 20 * i;
    const nameRel = buffer.readUInt32LE(e), nameLen = buffer.readUInt32LE(e + 4);
    const off = buffer.readUInt32LE(e + 8), size = buffer.readUInt32LE(e + 12), h = buffer.readUInt32LE(e + 16);
    const name = buffer.toString('utf8', e + nameRel, e + nameRel + nameLen);
    const raw = Buffer.from(buffer.subarray(off, off + size));

    if (raw.toString('latin1', 0, 4) !== 'S2BH') throw new Error(`Block ${name} hat keine S2BH Signatur`);
    const expectedHash = await hash32(raw);
    if (expectedHash !== h) {
      console.warn(`Hash mismatch in block ${name}: ${expectedHash} vs ${h}`);
    }

    const compressed = raw[9] === 1;
    const head = Buffer.from(raw.subarray(0, 14));
    let payload = null;

    if (wanted.includes(name)) {
      payload = compressed ? await decompress(raw.subarray(14)) : Buffer.from(raw.subarray(14));
    }

    blocks.push({
      name,
      raw,
      head,
      compressed,
      payload,
      size
    });
  }

  return { header, blocks };
}

/** Build SV2C Container buffer */
async function buildSV2C({ header, blocks }) {
  const parts = [Buffer.from(header)];
  let pos = header.length;
  const entries = [];

  for (const b of blocks) {
    let raw = b.raw;
    if (b.changed) {
      const body = b.compressed ? await compress(b.payload, 19) : b.payload;
      raw = Buffer.concat([b.head, body]);
    }
    const h = await hash32(raw);
    entries.push({ off: pos, size: raw.length, hash: h, name: Buffer.from(b.name, 'utf8') });
    parts.push(raw);
    pos += raw.length;
  }

  const pad = (8 - (pos % 8)) % 8;
  parts.push(Buffer.alloc(pad));
  pos += pad;

  const dirOff = pos;
  const dir = Buffer.alloc(20 * entries.length);
  let namePos = 0;

  entries.forEach((e, i) => {
    dir.writeUInt32LE(20 * (entries.length - i) + namePos, 20 * i);
    dir.writeUInt32LE(e.name.length, 20 * i + 4);
    dir.writeUInt32LE(e.off, 20 * i + 8);
    dir.writeUInt32LE(e.size, 20 * i + 12);
    dir.writeUInt32LE(e.hash, 20 * i + 16);
    namePos += e.name.length;
  });

  parts.push(dir, ...entries.map(e => e.name));
  const out = Buffer.concat(parts);

  out.writeUInt32LE(out.length, 0x08);
  out.writeUInt32LE(dirOff - 40, 0x28);
  out.writeUInt32LE(entries.length, 0x2c);

  return out;
}

// Character binary parsing
const KNOWN_FLAGS = 0x01 | 0x02 | 0x04 | 0x08 | 0x10 | 0x20;
const EQUIP_MAX = 24;
const MIN_EQUIP = 4;
const EQUIP_EXTRA_BITS = 4;

function popcount(v) {
  let n = 0;
  for (let i = 0; i < 32; i++) if (v & (1 << i)) n++;
  return n;
}

function readEntry(p, o, isItem) {
  if (o + 8 > p.length) return null;
  const itemId = p.readUInt32LE(o + 1);
  if (!isItem(itemId)) return null;
  const e = { slot: p[o], itemId, count: p.readUInt16LE(o + 5), flags: p[o + 7] };
  if (e.flags & ~KNOWN_FLAGS) return null;
  let q = o + 8;
  const need = (e.flags & 1 ? 1 : 0) + (e.flags & 2 ? 8 : 0) + (e.flags & 4 ? 8 : 0) + (e.flags & 8 ? 4 : 0) + (e.flags & 0x10 ? 2 : 0) + (e.flags & 0x20 ? 5 : 0);
  if (q + need > p.length) return null;
  if (e.flags & 0x01) { e.level = p[q]; q += 1; }
  if (e.flags & 0x02) { e.durability = p.readUInt32LE(q); e.maxDurability = p.readUInt32LE(q + 4); q += 8; }
  if (e.flags & 0x04) { e.liquid = p.readUInt32LE(q); e.maxLiquid = p.readUInt32LE(q + 4); q += 8; }
  if (e.flags & 0x08) { e.appearance = p.subarray(q, q + 4).toString('hex'); q += 4; }
  if (e.flags & 0x10) { e.maxUpgrades = p[q]; e.upgrades = p[q + 1]; q += 2; }
  if (e.flags & 0x20) { e.socket = p.subarray(q, q + 5).toString('hex'); q += 5; }
  e._end = q;
  return e;
}

function writeEntry(e) {
  let flags = 0;
  if (e.level !== undefined) flags |= 0x01;
  if (e.durability !== undefined) flags |= 0x02;
  if (e.liquid !== undefined) flags |= 0x04;
  if (e.appearance !== undefined) flags |= 0x08;
  if (e.maxUpgrades !== undefined) flags |= 0x10;
  if (e.socket !== undefined) flags |= 0x20;
  const parts = [];
  const h = Buffer.alloc(8);
  h[0] = e.slot; h.writeUInt32LE(e.itemId >>> 0, 1); h.writeUInt16LE(e.count, 5); h[7] = flags;
  parts.push(h);
  if (flags & 0x01) parts.push(Buffer.from([e.level]));
  if (flags & 0x02) { const b = Buffer.alloc(8); b.writeUInt32LE(e.durability, 0); b.writeUInt32LE(e.maxDurability, 4); parts.push(b); }
  if (flags & 0x04) { const b = Buffer.alloc(8); b.writeUInt32LE(e.liquid, 0); b.writeUInt32LE(e.maxLiquid, 4); parts.push(b); }
  if (flags & 0x08) parts.push(Buffer.from(e.appearance, 'hex'));
  if (flags & 0x10) parts.push(Buffer.from([e.maxUpgrades, e.upgrades]));
  if (flags & 0x20) parts.push(Buffer.from(e.socket, 'hex'));
  return Buffer.concat(parts);
}

function parseCharacter(p, isItem, isSkill, ehEquipavel) {
  const level = p.readUInt32LE(0x3a), xp = p.readUInt32LE(0x3e), nSkills = p.readUInt32LE(0x42);
  const skills = [];
  let o = 0x46;
  for (let i = 0; i < nSkills; i++, o += 5) skills.push({ id: p.readUInt32LE(o), level: p[o + 4] });
  if (skills.some(s => !isSkill(s.id))) throw new Error('Unbekannte Skillbaum-Knoten gefunden');
  const skillsEnd = o;

  const findInventory = (from) => {
    for (let s = from + 4; s < p.length; s++) {
      if (p[s - 4] !== 0x05 || p[s - 2] > 8) continue;
      const mc = p[s - 3], ec = p[s - 1];
      let q = s, ok = true;
      for (let k = 0; k < mc + ec && ok; k++) {
        const e = readEntry(p, q, isItem);
        if (e) q = e._end; else ok = false;
      }
      if (ok) return { invStart: s, mainCount: mc, extraCount: ec };
    }
    return null;
  };

  const candidatos = [];
  for (let s = skillsEnd + 4; s < p.length - 8; s++) {
    const list = []; let q = s;
    while (true) {
      const e = readEntry(p, q, isItem);
      if (!e || e.slot >= EQUIP_MAX || e.slot !== list.length) break;
      list.push(e); q = e._end;
    }
    if (list.length < MIN_EQUIP) continue;
    if (ehEquipavel && !list.every(e => ehEquipavel(e.itemId))) continue;
    const found = findInventory(q);
    if (!found) continue;
    const mask = p.readUInt32LE(s - 4);
    const free = p.readUInt16LE(q);
    const bits = popcount(mask);
    if (bits < list.length || bits > list.length + EQUIP_EXTRA_BITS) continue;
    candidatos.push({ equipStart: s, equipment: list, inv: found, mask, free, equipEnd: q });
  }

  if (!candidatos.length) throw new Error('Ausrüstung und Inventar konnten nicht im Savegame lokalisiert werden');
  const { equipStart, equipment, inv, mask, free, equipEnd } = candidatos[0];
  const { invStart, mainCount, extraCount } = inv;
  const main = [], extra = [];
  let q = invStart;
  for (let k = 0; k < mainCount + extraCount; k++) {
    const e = readEntry(p, q, isItem);
    (k < mainCount ? main : extra).push(e);
    q = e._end;
  }
  const clean = l => l.map(({ _end, ...e }) => e);
  return {
    level, xp,
    skills,
    equipment: clean(equipment),
    main: clean(main),
    extra: clean(extra),
    _equipCount: equipment.length,
    _equipMask: mask,
    _equipFree: free,
    _raw: {
      head: Buffer.from(p.subarray(0, 0x3a)),
      mid: Buffer.from(p.subarray(skillsEnd, equipStart)),
      between: Buffer.from(p.subarray(equipEnd, invStart)),
      tail: Buffer.from(p.subarray(q)),
    },
  };
}

function bitsAcesos(mask) {
  const out = [];
  for (let i = 0; i < 32; i++) if (mask & (1 << i)) out.push(i);
  return out;
}

function ajustaEquipamento(mask, free, tirados) {
  const bits = bitsAcesos(mask);
  let nova = mask;
  for (const k of tirados) {
    if (bits[k] === undefined) throw new Error(`Ausrüstungsslot für Item ${k} unbekannt`);
    nova &= ~(1 << bits[k]);
  }
  return { mask: nova >>> 0, free: free + tirados.length };
}

function buildCharacter(c) {
  const r = c._raw;
  const top = Buffer.alloc(12);
  top.writeUInt32LE(c.level, 0); top.writeUInt32LE(c.xp, 4); top.writeUInt32LE(c.skills.length, 8);
  const skills = Buffer.alloc(5 * c.skills.length);
  c.skills.forEach((s, i) => { skills.writeUInt32LE(s.id >>> 0, 5 * i); skills[5 * i + 4] = s.level; });
  if (c.equipment.length > c._equipCount) throw new Error('Ausrüstungsliste überschreitet verfügbare Slots');
  if (c.main.length > 255 || c.extra.length > 255) throw new Error('Zu viele Items im Container');

  const mid = Buffer.from(r.mid);
  const between = Buffer.from(r.between);
  const ficam = [...c.equipment].sort((a, b) => a.slot - b.slot);
  const tirados = [];
  for (let k = 0; k < c._equipCount; k++) if (!ficam.some(e => e.slot === k)) tirados.push(k);
  if (tirados.length) {
    if (mid.length < 4 || between.length < 2) throw new Error('Ausrüstungsmaske fehlt im Speicherstand');
    const { mask, free } = ajustaEquipamento(c._equipMask, c._equipFree, tirados);
    mid.writeUInt32LE(mask, mid.length - 4);
    between.writeUInt16LE(free, 0);
  }
  const equip = ficam.map((e, i) => writeEntry({ ...e, slot: i }));

  between[between.length - 3] = c.main.length;
  between[between.length - 1] = c.extra.length;
  return Buffer.concat([
    r.head, top, skills, mid,
    ...equip, between,
    ...c.main.map(writeEntry), ...c.extra.map(writeEntry),
    r.tail,
  ]);
}

/** Knowledge binary parsing */
function parseKnowledge(payload) {
  const p = Buffer.from(payload);
  const containerState = p.readUInt32LE(0);
  const n = p.readUInt32LE(4);
  const entries = [];
  for (let i = 0; i < n; i++) {
    entries.push({
      id: p.readUInt32LE(8 + i * 4),
      value: p.readUInt32LE(8 + n * 4 + i * 4)
    });
  }
  return { containerState, entries };
}

function buildKnowledge({ containerState = 1, entries = [] }) {
  const n = entries.length;
  const p = Buffer.alloc(8 + 8 * n);
  p.writeUInt32LE(containerState >>> 0, 0);
  p.writeUInt32LE(n, 4);
  entries.forEach((e, i) => {
    p.writeUInt32LE(e.id >>> 0, 8 + i * 4);
    p.writeUInt32LE(e.value >>> 0, 8 + n * 4 + i * 4);
  });
  return p;
}

/** Make timestamped backup before writing */
function createBackup(originalPath) {
  const backupDir = path.join(process.env.USERPROFILE || '.', 'Documents', 'Enshrouded-Backups', 'playrig');
  fs.mkdirSync(backupDir, { recursive: true });
  const filename = path.basename(originalPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `${path.parse(filename).name}_backup_${timestamp}.ksd`);
  fs.copyFileSync(originalPath, backupPath);
  return backupPath;
}

module.exports = {
  loadCatalogs,
  isGameRunning,
  detectSaves,
  parseSV2C,
  buildSV2C,
  parseCharacter,
  buildCharacter,
  parseKnowledge,
  buildKnowledge,
  createBackup
};

