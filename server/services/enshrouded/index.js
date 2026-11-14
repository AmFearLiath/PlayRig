/**
 * PLAYRIG - ENSHROUDED SAVE ENGINE SERVICE
 * Official backend companion service for Enshrouded Character & Save Editor.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { compress, decompress } = require('@mongodb-js/zstd');
const { createXXHash3 } = require('hash-wasm');
const BaseService = require('../base-service');

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

class EnshroudedService extends BaseService {
  constructor() {
    super({
      id: 'enshrouded',
      name: 'Enshrouded Save & Character Engine',
      version: '1.1.0',
      game: 'Enshrouded',
      description: 'Zstandard WASM decompression, XXHash3 verification, SV2C binary container parsing and character editor bridge.',
      capabilities: [
        'steam-save-detection',
        'sv2c-container-parser',
        'sv2c-container-builder',
        'zstd-decompression',
        'xxhash3-checksum',
        'safe-document-backups',
        'game-process-detector',
        'inventory-and-equipment-mod',
        'level-and-xp-booster'
      ]
    });

    this.itemsCatalog = null;
    this.skillsCatalog = null;
    this.rootDir = null;
  }

  async init(context = {}) {
    this.rootDir = context.rootDir || path.resolve(__dirname, '../../..');
    this.loadCatalogs();
    this.status = 'ready';
    return true;
  }

  loadCatalogs() {
    if (!this.itemsCatalog && this.rootDir) {
      const itemsPath = path.join(this.rootDir, 'rigs', 'Gaming', 'Enshrouded', 'Save-Editor', 'data', 'items.json');
      if (fs.existsSync(itemsPath)) {
        this.itemsCatalog = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
      }
    }
    if (!this.skillsCatalog && this.rootDir) {
      const skillsPath = path.join(this.rootDir, 'rigs', 'Gaming', 'Enshrouded', 'Save-Editor', 'data', 'skills.json');
      if (fs.existsSync(skillsPath)) {
        this.skillsCatalog = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
      }
    }
  }

  isGameRunning() {
    return new Promise((resolve) => {
      exec('tasklist /FI "IMAGENAME eq enshrouded.exe" /NH', (err, stdout) => {
        if (err) return resolve(false);
        resolve(stdout.toLowerCase().includes('enshrouded.exe'));
      });
    });
  }

  async detectSaves() {
    const candidates = [
      'C:/Program Files (x86)/Steam/userdata',
      'C:/Program Files/Steam/userdata',
      'D:/Steam/userdata',
      'E:/Steam/userdata',
      process.env.STEAM_PATH ? path.join(process.env.STEAM_PATH, 'userdata') : null
    ].filter(Boolean);

    const saves = [];
    const ENSHROUDED_APP_ID = '1203620';

    for (const steamDir of candidates) {
      if (!fs.existsSync(steamDir)) continue;

      try {
        const users = fs.readdirSync(steamDir);
        for (const user of users) {
          const remoteDir = path.join(steamDir, user, ENSHROUDED_APP_ID, 'remote');
          if (fs.existsSync(remoteDir)) {
            const files = fs.readdirSync(remoteDir);
            for (const file of files) {
              if (/^[a-f0-9]{8}$/i.test(file)) {
                const fullPath = path.join(remoteDir, file);
                try {
                  const stat = fs.statSync(fullPath);
                  let charName = 'Unbekannt';
                  try {
                    const parsed = await this.readAndParseSave(fullPath);
                    if (parsed && parsed.character && parsed.character.name) {
                      charName = parsed.character.name;
                    }
                  } catch (e) {}

                  saves.push({
                    fileName: file,
                    filePath: fullPath,
                    steamId: user,
                    name: charName,
                    modified: stat.mtime,
                    size: stat.size
                  });
                } catch (e) {}
              }
            }
          }
        }
      } catch (e) {}
    }

    return saves;
  }

  createBackup(sourcePath) {
    try {
      const userDocs = process.env.USERPROFILE
        ? path.join(process.env.USERPROFILE, 'Documents')
        : path.join(__dirname, '../../../backups');
      const backupDir = path.join(userDocs, 'Enshrouded-Backups', 'playrig');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseName = path.basename(sourcePath);
      const backupFile = path.join(backupDir, `${baseName}_backup_${timestamp}`);
      fs.copyFileSync(sourcePath, backupFile);
      return backupFile;
    } catch (e) {
      console.error('[Enshrouded Backup Error]', e);
      return null;
    }
  }

  async parseSV2CContainer(compressedBuffer) {
    if (compressedBuffer.length < 12) {
      throw new Error('Datei zu kurz für einen gültigen SV2C-Container');
    }

    const magic = compressedBuffer.toString('utf8', 0, 4);
    if (magic !== 'SV2C') {
      throw new Error(`Ungültige magische Kennung: "${magic}". Erwartet: "SV2C"`);
    }

    const uncompressedSize = compressedBuffer.readUInt32LE(4);
    const compressedSize = compressedBuffer.readUInt32LE(8);
    const expectedHash = compressedBuffer.readUInt32LE(12);

    const actualHash = await hash32(compressedBuffer.subarray(0, 12));
    if (actualHash !== expectedHash) {
      console.warn(`[SV2C Warnung] Header-Prüfsumme weicht ab: ${actualHash} vs ${expectedHash}`);
    }

    const payloadSlice = compressedBuffer.subarray(16, 16 + compressedSize);
    const decompressed = await decompress(payloadSlice);

    if (decompressed.length !== uncompressedSize) {
      console.warn(`[SV2C Warnung] Dekomprimierte Größe (${decompressed.length}) weicht ab von (${uncompressedSize})`);
    }

    const blocks = [];
    let offset = 0;
    while (offset < decompressed.length) {
      if (offset + 4 > decompressed.length) break;
      const nameLen = decompressed.readUInt32LE(offset);
      offset += 4;
      if (offset + nameLen > decompressed.length) break;
      const name = decompressed.toString('utf8', offset, offset + nameLen);
      offset += nameLen;
      if (offset + 4 > decompressed.length) break;
      const payloadLen = decompressed.readUInt32LE(offset);
      offset += 4;
      if (offset + payloadLen > decompressed.length) break;
      const payload = decompressed.subarray(offset, offset + payloadLen);
      offset += payloadLen;
      blocks.push({ name, payload: Buffer.from(payload) });
    }

    return { uncompressedSize, compressedSize, blocks };
  }

  async buildSV2CContainer(blocks) {
    const buffers = [];
    for (const b of blocks) {
      const nameBuf = Buffer.from(b.name, 'utf8');
      const header = Buffer.alloc(4 + nameBuf.length + 4);
      header.writeUInt32LE(nameBuf.length, 0);
      nameBuf.copy(header, 4);
      header.writeUInt32LE(b.payload.length, 4 + nameBuf.length);
      buffers.push(header);
      buffers.push(b.payload);
    }

    const decompressed = Buffer.concat(buffers);
    const uncompressedSize = decompressed.length;
    const compressed = await compress(decompressed, 3);
    const compressedSize = compressed.length;

    const fileHeader = Buffer.alloc(16);
    fileHeader.write('SV2C', 0, 4, 'utf8');
    fileHeader.writeUInt32LE(uncompressedSize, 4);
    fileHeader.writeUInt32LE(compressedSize, 8);

    const checksum = await hash32(fileHeader.subarray(0, 12));
    fileHeader.writeUInt32LE(checksum, 12);

    return Buffer.concat([fileHeader, compressed]);
  }

  parseCharacter(buf, isItem, isSkill, ehEquipavel) {
    let offset = 0;
    const containerState = buf.readUInt8(offset);
    offset += 1;
    const count = buf.readUInt32LE(offset);
    offset += 4;

    const equips = [];
    const backpack = [];
    const skills = [];

    for (let i = 0; i < count; i++) {
      if (offset + 4 > buf.length) break;
      const idLen = buf.readUInt32LE(offset);
      offset += 4;
      const id = buf.toString('utf8', offset, offset + idLen);
      offset += idLen;

      const unknown1 = buf.readUInt32LE(offset);
      offset += 4;
      const type = buf.readUInt8(offset);
      offset += 1;

      if (type === 1) {
        skills.push({ id, type, unknown1 });
      } else if (type === 2) {
        const itemType = buf.readUInt8(offset);
        offset += 1;
        const countOrDurability = buf.readUInt32LE(offset);
        offset += 4;
        const level = buf.readUInt32LE(offset);
        offset += 4;
        const unknown2 = buf.readUInt32LE(offset);
        offset += 4;
        const slot = buf.readUInt32LE(offset);
        offset += 4;

        const itemObj = { id, type, unknown1, itemType, countOrDurability, level, unknown2, slot };

        if (slot >= 0 && slot <= 15) {
          equips.push(itemObj);
        } else {
          backpack.push(itemObj);
        }
      } else {
        const payloadLength = buf.readUInt32LE(offset);
        offset += 4;
        offset += payloadLength;
      }
    }

    return { containerState, equips, backpack, skills };
  }

  serializeCharacter(charModel, isItem, isSkill, ehEquipavel) {
    const buffers = [];
    const allItems = [...(charModel.equips || []), ...(charModel.backpack || [])];
    const totalCount = allItems.length + (charModel.skills ? charModel.skills.length : 0);

    const head = Buffer.alloc(5);
    head.writeUInt8(charModel.containerState ?? 1, 0);
    head.writeUInt32LE(totalCount, 1);
    buffers.push(head);

    for (const item of allItems) {
      const idBuf = Buffer.from(item.id, 'utf8');
      const itemHeader = Buffer.alloc(4 + idBuf.length + 4 + 1 + 1 + 4 + 4 + 4 + 4);
      let o = 0;
      itemHeader.writeUInt32LE(idBuf.length, o); o += 4;
      idBuf.copy(itemHeader, o); o += idBuf.length;
      itemHeader.writeUInt32LE(item.unknown1 ?? 0, o); o += 4;
      itemHeader.writeUInt8(item.type ?? 2, o); o += 1;
      itemHeader.writeUInt8(item.itemType ?? 1, o); o += 1;
      itemHeader.writeUInt32LE(item.countOrDurability ?? 1, o); o += 4;
      itemHeader.writeUInt32LE(item.level ?? 1, o); o += 4;
      itemHeader.writeUInt32LE(item.unknown2 ?? 0, o); o += 4;
      itemHeader.writeUInt32LE(item.slot ?? 0, o); o += 4;
      buffers.push(itemHeader);
    }

    if (charModel.skills) {
      for (const skill of charModel.skills) {
        const idBuf = Buffer.from(skill.id, 'utf8');
        const skillHeader = Buffer.alloc(4 + idBuf.length + 4 + 1);
        let o = 0;
        skillHeader.writeUInt32LE(idBuf.length, o); o += 4;
        idBuf.copy(skillHeader, o); o += idBuf.length;
        skillHeader.writeUInt32LE(skill.unknown1 ?? 0, o); o += 4;
        skillHeader.writeUInt8(skill.type ?? 1, o); o += 1;
        buffers.push(skillHeader);
      }
    }

    return Buffer.concat(buffers);
  }

  async readAndParseSave(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Datei nicht gefunden: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath);
    const parsedContainer = await this.parseSV2CContainer(raw);

    let charName = path.basename(filePath);
    const cdBlock = parsedContainer.blocks.find(b => b.name === 'character_data');
    if (cdBlock && cdBlock.payload && cdBlock.payload.length >= 9) {
      const len = cdBlock.payload.readUInt32LE(5);
      charName = cdBlock.payload.toString('utf8', 9, 9 + len);
    }

    const pcBlock = parsedContainer.blocks.find(b => b.name === 'player_character');
    let characterModel = null;
    if (pcBlock && pcBlock.payload) {
      characterModel = this.parseCharacter(pcBlock.payload);
      characterModel.name = charName;
    }

    return {
      filePath,
      name: charName,
      character: characterModel,
      blocks: parsedContainer.blocks.map(b => ({ name: b.name, size: b.payload.length }))
    };
  }

  async writeAndBuildSave(filePath, modifiedModel) {
    this.createBackup(filePath);
    const raw = fs.readFileSync(filePath);
    const parsedContainer = await this.parseSV2CContainer(raw);

    const pcBlockIndex = parsedContainer.blocks.findIndex(b => b.name === 'player_character');
    if (pcBlockIndex === -1) {
      throw new Error('player_character Block nicht gefunden');
    }

    const newPayload = this.serializeCharacter(modifiedModel);
    parsedContainer.blocks[pcBlockIndex].payload = newPayload;

    const newContainerBuf = await this.buildSV2CContainer(parsedContainer.blocks);
    fs.writeFileSync(filePath, newContainerBuf);
    return { success: true, filePath, bytesWritten: newContainerBuf.length };
  }
}

module.exports = new EnshroudedService();
