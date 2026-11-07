/* SoundPort · MIT. Pure parser; shared by the browser worker and Node tests. */
(function (root) {
  'use strict';
  const C = typeof module === 'object' ? require('./vendor/crypto-js.js') : root.CryptoJS;
  const text = new TextDecoder();
  const CORE_KEY = '687A4852416D736F356B496E62617857';
  const META_KEY = '2331346C6A6B5F215C5D2630553C2728';
  const MAX_FILE_SIZE = 128 * 1024 * 1024;
  function aes(bytes, key) {
    if (!bytes.length || bytes.length % 16) throw new Error('加密区长度无效，文件可能不完整');
    const words = C.AES.decrypt({ciphertext: C.lib.WordArray.create(bytes)}, C.enc.Hex.parse(key), {
      mode: C.mode.ECB, padding: C.pad.NoPadding
    });
    const out = new Uint8Array(words.sigBytes);
    for (let i = 0; i < out.length; i++) out[i] = words.words[i >>> 2] >>> (24 - (i % 4) * 8) & 255;
    const pad = out[out.length - 1];
    if (pad < 1 || pad > 16 || !out.subarray(out.length - pad).every(v => v === pad)) {
      throw new Error('无法解开文件密钥：文件损坏或不支持此 NCM 版本');
    }
    return out.subarray(0, out.length - pad);
  }
  function streamKey(key) {
    const box = Uint8Array.from({length: 256}, (_, i) => i);
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (box[i] + j + key[i % key.length]) & 255;
      [box[i], box[j]] = [box[j], box[i]];
    }
    return Uint8Array.from({length: 256}, (_, i) => {
      const k = (i + 1) & 255;
      return box[(box[k] + box[(box[k] + k) & 255]) & 255];
    });
  }
  function detectFormat(b) {
    if (text.decode(b.subarray(0, 4)) === 'fLaC') return 'flac';
    if (text.decode(b.subarray(0, 3)) === 'ID3') return 'mp3';
    // MPEG audio frame sync, valid MPEG version / Layer III / bitrate / sample rate.
    if (b.length >= 4 && b[0] === 255 && (b[1] & 224) === 224 &&
        (b[1] & 24) !== 8 && (b[1] & 6) === 2 &&
        (b[2] >> 4) > 0 && (b[2] >> 4) < 15 && (b[2] & 12) !== 12) return 'mp3';
    throw new Error('解封装后未识别到 MP3 或 FLAC 音频，不生成错误后缀的文件');
  }
  function convert(input, progress = () => {}) {
    const b = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (b.length > MAX_FILE_SIZE) throw new Error('单个文件上限为 128 MiB，请使用更小的文件');
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let p = 0;
    function take(n) {
      if (!Number.isSafeInteger(n) || n < 0 || n > b.length - p) throw new Error('文件被截断或区块长度无效，请重新下载原文件');
      const out = b.subarray(p, p + n); p += n; return out;
    }
    function u32() { const pos = p; take(4); return view.getUint32(pos, true); }
    if (text.decode(take(8)) !== 'CTENFDAM') throw new Error('不是有效的 NCM 文件，请选择 .ncm 音乐文件');
    take(2);
    const keySize = u32();
    if (keySize > 4096) throw new Error('密钥区过大，不支持此文件');
    const keyData = aes(take(keySize).map(v => v ^ 0x64), CORE_KEY);
    if (text.decode(keyData.subarray(0, 17)) !== 'neteasecloudmusic' || keyData.length <= 17) throw new Error('NCM 密钥标识无效');
    const stream = streamKey(keyData.subarray(17));
    const metaSize = u32();
    if (metaSize > 4 * 1024 * 1024) throw new Error('元数据区过大，不支持此文件');
    const metadata = take(metaSize);
    let info = {}, warning = '';
    if (metadata.length) {
      try {
        const raw = text.decode(metadata.map(v => v ^ 0x63));
        if (!raw.startsWith("163 key(Don't modify):")) throw new Error();
        const bin = atob(raw.slice(22));
        const parsed = text.decode(aes(Uint8Array.from(bin, c => c.charCodeAt(0)), META_KEY));
        if (!parsed.startsWith('music:')) throw new Error();
        info = JSON.parse(parsed.slice(6));
        if (!info || typeof info !== 'object' || Array.isArray(info)) throw new Error();
      } catch { info = {}; warning = '元数据无法读取，已按音频内容识别格式'; }
    }
    take(4); // CRC field (container field, not used as an audio integrity guarantee).
    take(1); // Cover version.
    const coverFrameSize = u32(), imageSize = u32();
    if (imageSize > coverFrameSize) throw new Error('封面长度超过预留区，文件可能损坏');
    take(coverFrameSize); // Includes unused padding even when imageSize is zero.
    const audio = Uint8Array.from(take(b.length - p));
    if (!audio.length) throw new Error('文件不包含音频数据');
    for (let i = 0; i < audio.length; i++) {
      audio[i] ^= stream[i & 255];
      if ((i & 0xfffff) === 0) progress(Math.floor(i / audio.length * 100));
    }
    const format = detectFormat(audio);
    if (info.format && info.format !== format) warning = '元数据与音频头不一致，已采用音频实际格式';
    progress(100);
    return {audio, format, bitrate: Number.isFinite(info.bitrate) ? info.bitrate : null, warning};
  }
  const api = {convert, detectFormat, MAX_FILE_SIZE};
  if (typeof module === 'object') module.exports = api;
  else root.NcmCore = api;
})(globalThis);
