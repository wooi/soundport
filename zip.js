/* Small ZIP32 STORE writer. No compression: audio is already compressed. MIT. */
(function (root) {
  'use strict';
  const table = Uint32Array.from({length: 256}, (_, n) => {
    for (let i = 0; i < 8; i++) n = (n & 1) ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const b of bytes) crc = table[(crc ^ b) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function makeZip(files) {
    if (files.length > 65535) throw new Error('ZIP 文件数量超出限制');
    const parts = [], central = [];
    let offset = 0, centralSize = 0;
    for (const file of files) {
      const name = new TextEncoder().encode(file.name), size = file.bytes.length;
      if (name.length > 65535 || offset + size > 0xffffffff) throw new Error('ZIP 大小超出限制');
      const crc = crc32(file.bytes);
      const local = new Uint8Array(30 + name.length), v = new DataView(local.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x800, true);
      v.setUint16(12, 33, true); // 1980-01-01, deterministic archive
      v.setUint32(14, crc, true); v.setUint32(18, size, true); v.setUint32(22, size, true);
      v.setUint16(26, name.length, true); local.set(name, 30);
      parts.push(local, file.bytes);
      const entry = new Uint8Array(46 + name.length), c = new DataView(entry.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
      c.setUint16(8, 0x800, true); c.setUint16(14, 33, true); c.setUint32(16, crc, true);
      c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true); entry.set(name, 46);
      central.push(entry); centralSize += entry.length; offset += local.length + size;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], {type: 'application/zip'});
  }
  if (typeof module === 'object') module.exports = {makeZip, crc32};
  else root.NcmZip = {makeZip, crc32};
})(globalThis);
