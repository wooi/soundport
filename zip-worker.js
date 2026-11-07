importScripts('./zip.js');
self.onmessage = ({data}) => {
  try { self.postMessage({blob: NcmZip.makeZip(data)}); }
  catch (e) { self.postMessage({error: e.message}); }
};
