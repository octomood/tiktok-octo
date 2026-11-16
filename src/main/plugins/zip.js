'use strict';

const zlib = require('node:zlib');

/**
 * Минимальный ZIP-читатель и писатель.
 *
 * Пакет плагина — обычный ZIP. Нам нужны только deflate/store, UTF-8 имена,
 * проверка CRC и защита от zip-бомб / path traversal. Полноценный unzip с
 * symlink'ами, ZIP64 и шифрованием здесь не нужен и только расширяет
 * поверхность атаки.
 */

const LIMITS = {
  entries: 200,
  entryBytes: 8 * 1024 * 1024,
  totalBytes: 24 * 1024 * 1024,
  ratio: 300,
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer) {
  const minimum = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function decodeName(buffer) {
  try {
    return buffer.toString('utf8');
  } catch {
    return '';
  }
}

/** Единое правило для имён внутри пакета. */
function isSafeName(name) {
  if (!name || name.length > 240) return false;
  if (name.includes('\0') || name.includes('\\')) return false;
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) return false;
  const segments = name.split('/');
  return !segments.some((segment) => segment === '' || segment === '.' || segment === '..');
}

function normalizeName(name) {
  return name.replace(/^\.\//, '');
}

/**
 * Читает ZIP в Map<путь, Buffer>.
 * @param {Buffer} buffer
 * @param {Partial<typeof LIMITS>} limits
 */
function readZip(buffer, limits = {}) {
  const max = { ...LIMITS, ...limits };
  if (!Buffer.isBuffer(buffer)) throw new Error('ZIP: ожидается Buffer');
  if (buffer.length < 22) throw new Error('ZIP: файл слишком короткий');

  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) throw new Error('ZIP: не найден центральный каталог');

  const disk = buffer.readUInt16LE(eocd + 4);
  const total = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);

  if (disk !== 0) throw new Error('ZIP: многотомные архивы не поддерживаются');
  if (total === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error('ZIP: ZIP64 не поддерживается');
  }
  if (total > max.entries) throw new Error(`ZIP: больше ${max.entries} файлов`);
  if (centralOffset + centralSize > buffer.length) throw new Error('ZIP: каталог выходит за файл');

  const files = new Map();
  let totalBytes = 0;
  let pointer = centralOffset;

  for (let index = 0; index < total; index += 1) {
    if (pointer + 46 > buffer.length) throw new Error('ZIP: каталог повреждён');
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error('ZIP: плохая запись каталога');

    const flags = buffer.readUInt16LE(pointer + 8);
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const uncompressedSize = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const externalAttrs = buffer.readUInt32LE(pointer + 38);
    const localOffset = buffer.readUInt32LE(pointer + 42);

    if (flags & 0x0001) throw new Error('ZIP: зашифрованные файлы не поддерживаются');
    if (method !== 0 && method !== 8) throw new Error('ZIP: поддерживается только store и deflate');
    if (pointer + 46 + nameLength + extraLength + commentLength > buffer.length) {
      throw new Error('ZIP: каталог выходит за файл');
    }

    const rawName = buffer.subarray(pointer + 46, pointer + 46 + nameLength);
    const name = normalizeName(decodeName(rawName));
    if (!isSafeName(name)) throw new Error('ZIP: недопустимый путь внутри пакета');

    const mode = externalAttrs >>> 16;
    if ((mode & 0xf000) === 0xa000) throw new Error('ZIP: символические ссылки запрещены');

    pointer += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/')) continue;
    if (files.has(name)) throw new Error(`ZIP: файл «${name}» повторяется`);

    if (uncompressedSize > max.entryBytes) {
      throw new Error(`ZIP: файл «${name}» больше ${max.entryBytes} байт`);
    }
    if (compressedSize > buffer.length || localOffset + 30 > buffer.length) {
      throw new Error('ZIP: данные выходят за файл');
    }
    if (compressedSize > 0 && uncompressedSize / compressedSize > max.ratio) {
      throw new Error(`ZIP: подозрительная степень сжатия у «${name}»`);
    }

    const local = localOffset;
    if (buffer.readUInt32LE(local) !== 0x04034b50) {
      throw new Error('ZIP: плохой локальный заголовок');
    }
    const localNameLength = buffer.readUInt16LE(local + 26);
    const localExtraLength = buffer.readUInt16LE(local + 28);
    if (local + 30 + localNameLength + localExtraLength > buffer.length) {
      throw new Error('ZIP: локальный заголовок выходит за файл');
    }
    const dataStart = local + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) throw new Error('ZIP: данные выходят за файл');

    const compressed = buffer.subarray(dataStart, dataEnd);
    let data;
    try {
      data =
        method === 0
          ? Buffer.from(compressed)
          : zlib.inflateRawSync(compressed, { maxOutputLength: max.entryBytes });
    } catch {
      throw new Error(`ZIP: не удалось распаковать «${name}»`);
    }

    if (data.length !== uncompressedSize) throw new Error(`ZIP: неверный размер «${name}»`);
    const expectedCrc = buffer.readUInt32LE(
      pointer - 46 - nameLength - extraLength - commentLength + 16,
    );
    if (crc32(data) !== expectedCrc) throw new Error(`ZIP: неверная контрольная сумма «${name}»`);

    totalBytes += data.length;
    if (totalBytes > max.totalBytes) throw new Error('ZIP: распакованный пакет слишком большой');
    files.set(name, data);
  }

  if (files.size === 0) throw new Error('ZIP: пакет пуст');
  return files;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      Math.floor(date.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

/**
 * Собирает ZIP. Порядок файлов и дата фиксированы, чтобы одинаковый набор
 * исходников давал одинаковый SHA-256 (это важно для подписей и каталога).
 * @param {Array<{name: string, data: Buffer|string}>|Map<string, Buffer|string>} entries
 */
function createZip(entries, { date = new Date('2020-01-01T00:00:00Z') } = {}) {
  const list = [
    ...(entries instanceof Map ? entries.entries() : entries.map((item) => [item.name, item.data])),
  ]
    .map(([name, data]) => {
      const clean = normalizeName(String(name));
      if (!isSafeName(clean)) throw new Error(`ZIP: недопустимый путь «${name}»`);
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
      return { name: clean, data: buffer };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  if (!list.length) throw new Error('ZIP: нечего упаковывать');
  if (list.length > LIMITS.entries) throw new Error('ZIP: слишком много файлов');

  const { time, date: dosDate } = dosDateTime(date);
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of list) {
    const name = Buffer.from(entry.name, 'utf8');
    const compressed = zlib.deflateRawSync(entry.data, { level: 9 });
    const checksum = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(list.length, 8);
  end.writeUInt16LE(list.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

module.exports = { readZip, createZip, crc32, isSafeName };
