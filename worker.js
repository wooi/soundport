'use strict';
importScripts('./vendor/crypto-js.js', './core.js');
self.onmessage = async ({data: {file}}) => {
  try {
    if (file.size > NcmCore.MAX_FILE_SIZE) throw new Error('单个文件上限为 128 MiB');
    const result = NcmCore.convert(await file.arrayBuffer(), value => self.postMessage({type: 'progress', value}));
    self.postMessage({type: 'done', ...result}, [result.audio.buffer]);
  } catch (e) { self.postMessage({type: 'error', message: e.message || '转换失败，请检查文件'}); }
};
