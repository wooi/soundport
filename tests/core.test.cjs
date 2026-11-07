const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createCipheriv} = require('node:crypto');
const {convert, detectFormat} = require('../core.js');
const {crc32, makeZip} = require('../zip.js');
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }
function encrypt(b, key) { const c = createCipheriv('aes-128-ecb', Buffer.from(key, 'hex'), null); return Buffer.concat([c.update(b), c.final()]); }
function fixture({audio = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(4097, 42)]), meta = {format: 'mp3', bitrate: 320000}, badMeta = false, image = Buffer.alloc(97, 5)} = {}) {
  const key = Buffer.from('test-stream-key-123456789');
  const keyBlock = encrypt(Buffer.concat([Buffer.from('neteasecloudmusic'), key]), '687a4852416d736f356b496e62617857').map(v => v ^ 0x64);
  const metadata = meta === null ? Buffer.alloc(0) : Buffer.from("163 key(Don't modify):" + encrypt(Buffer.from('music:' + JSON.stringify(meta)), '2331346c6a6b5f215c5d2630553c2728').toString('base64')).map(v => v ^ 0x63);
  if (badMeta) metadata.fill(0);
  // Independent direct stream calculation, rather than the decoder's precomputed lookup.
  const box = Array.from({length: 256}, (_, n) => n);
  let j = 0;
  for (let i = 0; i < 256; i++) { j = (j + box[i] + key[i % key.length]) % 256; [box[i], box[j]] = [box[j], box[i]]; }
  const encrypted = Buffer.from(audio);
  for (let p = 0; p < audio.length; p++) { const i = (p + 1) % 256; encrypted[p] ^= box[(box[i] + box[(box[i] + i) % 256]) % 256]; }
  return {audio, file: Buffer.concat([Buffer.from('CTENFDAM'), Buffer.alloc(2), u32(keyBlock.length), keyBlock, u32(metadata.length), metadata, Buffer.alloc(5), u32(image.length + 128), u32(image.length), image, Buffer.alloc(128), encrypted])};
}
test('MP3 payload preserved byte for byte across stream cycles and padded image', () => {
  const {file, audio} = fixture(); const original = Buffer.from(file); const r = convert(file);
  assert.deepEqual(file, original, "input buffer must remain unchanged");
  assert.deepEqual(Buffer.from(r.audio), audio); assert.equal(r.format, 'mp3'); assert.equal(r.bitrate, 320000);
});
test('FLAC takes precedence over incorrect metadata', () => {
  const {file, audio} = fixture({audio: Buffer.concat([Buffer.from('fLaC'), Buffer.alloc(256)])});
  const r = convert(file); assert.equal(r.format, 'flac'); assert.ok(r.warning); assert.deepEqual(Buffer.from(r.audio), audio);
});
test('missing and corrupt metadata do not destroy recoverable audio', () => {
  for (const option of [{meta: null}, {badMeta: true}]) {
    const {file, audio} = fixture(option); assert.deepEqual(Buffer.from(convert(file).audio), audio);
  }
});
test('every truncated container header fails cleanly', () => {
  const {file, audio} = fixture();
  for (let i = 0; i <= file.length - audio.length; i++) assert.throws(() => convert(file.subarray(0, i)));
});
test('invalid magic, excessive lengths, corrupt key and unknown audio fail', () => {
  assert.throws(() => convert(Buffer.alloc(64)));
  const {file} = fixture(); const huge = Buffer.from(file); huge.writeUInt32LE(0xffffffff, 10); assert.throws(() => convert(huge));
  const corrupt = Buffer.from(file); corrupt[14] ^= 1; assert.throws(() => convert(corrupt));
  assert.throws(() => convert(fixture({audio: Buffer.alloc(1024)}).file));
});
test('raw MPEG Layer III accepted; AAC sync rejected', () => {
  assert.equal(detectFormat(Uint8Array.from([255,251,144,0])), 'mp3');
  assert.throws(() => detectFormat(Uint8Array.from([255,241,80,0])));
});
test('CRC32 standard vector and ZIP UTF-8 headers and offsets', async () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  const blob = makeZip([{name: '测试.mp3', bytes: Buffer.from('123456789')}, {name: 'a.flac', bytes: Buffer.from('fLaC')}]);
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x04034b50); assert.equal(bytes.readUInt16LE(6), 0x800);
  assert.equal(bytes.readUInt32LE(14), 0xcbf43926);
  assert.equal(bytes.readUInt16LE(bytes.length - 12), 2);
  const center = bytes.readUInt32LE(bytes.length - 6); assert.equal(bytes.readUInt32LE(center), 0x02014b50);
  assert.equal(bytes.readUInt32LE(center + 42), 0);
});
module.exports = {fixture};
