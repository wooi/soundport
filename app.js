'use strict';
const $ = id => document.getElementById(id);
const items = [];
let active = null, zipper = null, zipBusy = false, nextId = 1;
const MAX_FILE = 128 * 1024 * 1024, MAX_BATCH = 256 * 1024 * 1024;
const size = n => `${(n / 1024 / 1024).toFixed(1)} MiB`;
function notice(message) { $('notice').textContent = message; $('notice').hidden = !message; }
function outputName(name, format) {
  const stem = name.replace(/\.ncm$/i, '').replace(/[\\/\x00-\x1f<>:"|?*]/g, '_').replace(/[ .]+$/g, '') || 'audio';
  return `${stem}.${format}`;
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function updateSummary() {
  const done = items.filter(i => i.state === 'done').length;
  const pending = items.filter(i => i.state === 'queued' || i.state === 'running').length;
  const failed = items.filter(i => i.state === 'error').length;
  $('count').textContent = items.length;
  $('empty').hidden = !!items.length;
  $('clear').disabled = !items.length && !zipBusy;
  $('zip').disabled = !done || !!pending || zipBusy;
  $('zip').textContent = zipBusy ? '正在打包…' : '打包下载 ZIP';
  $('summary').textContent = !items.length ? '选择文件后自动开始转换' :
    `已完成 ${done} / ${items.length}${pending ? ` · ${pending} 首处理中` : ''}${failed ? ` · ${failed} 首失败` : ''}`;
}
function updateRow(item) {
  item.row.dataset.state = item.state;
  item.meta.textContent = `${size(item.size)} · ${item.message}`;
  item.button.textContent = ({queued: '移除', running: '取消', done: `下载 ${item.format?.toUpperCase()}`, error: '移除'})[item.state];
  updateSummary();
}
function remove(item) {
  if (active?.item === item) { active.worker.terminate(); active = null; }
  const pos = items.indexOf(item);
  if (pos >= 0) items.splice(pos, 1);
  item.row.remove(); item.file = null; item.audio = null; item.blob = null;
  updateSummary(); pump();
}
function add(files) {
  const errors = [];
  let total = items.reduce((sum, i) => sum + i.size, 0);
  for (const file of files) {
    if (!/\.ncm$/i.test(file.name)) { errors.push(`${file.name}：请选择 .ncm 文件`); continue; }
    if (file.size > MAX_FILE || !file.size) { errors.push(`${file.name}：文件为空或超过 128 MiB`); continue; }
    if (items.length >= 100 || total + file.size > MAX_BATCH) { errors.push('本批已达数量或大小上限，请先下载并清空列表'); break; }
    if (items.some(i => i.name === file.name && i.size === file.size && i.modified === file.lastModified)) continue;
    total += file.size;
    const item = {id: nextId++, file, name: file.name, size: file.size, modified: file.lastModified, state: 'queued', message: '等待转换'};
    item.row = document.createElement('li'); item.row.className = 'file-row';
    const info = document.createElement('div'), title = document.createElement('span');
    title.className = 'file-name'; title.textContent = file.name;
    item.meta = document.createElement('span'); item.meta.className = 'file-meta';
    info.append(title, item.meta); item.button = document.createElement('button');
    item.button.addEventListener('click', () => {
      if (item.state === 'done') download(item.blob, item.outputName); else remove(item);
    });
    item.row.append(info, item.button); $('list').append(item.row); items.push(item); updateRow(item);
  }
  notice(errors.join('；')); updateSummary(); pump();
}
function pump() {
  if (active) return;
  const item = items.find(i => i.state === 'queued');
  if (!item) return;
  item.state = 'running'; item.message = '正在读取文件…'; updateRow(item);
  let worker;
  function fail(message) {
    worker?.terminate(); active = null; item.file = null; item.state = 'error'; item.message = message;
    updateRow(item); pump();
  }
  try {
    worker = new Worker('./worker.js'); active = {worker, item};
    worker.onmessage = ({data}) => {
      if (data.type === 'progress') { item.message = `正在转换 ${data.value}%`; updateRow(item); return; }
      if (data.type === 'error') { fail(data.message); return; }
      if (data.type !== 'done') return;
      item.state = 'done'; item.format = data.format; item.audio = data.audio;
      item.outputName = outputName(item.name, data.format);
      item.blob = new Blob([data.audio], {type: data.format === 'mp3' ? 'audio/mpeg' : 'audio/flac'});
      item.message = `${data.format.toUpperCase()}${data.bitrate ? ` · ${Math.round(data.bitrate / 1000)} kbps` : ''} · 已完成${data.warning ? ` · ${data.warning}` : ''}`;
      item.file = null; worker.terminate(); active = null; updateRow(item); pump();
    };
    worker.onerror = () => fail('后台线程无法启动，请通过 localhost 或 HTTPS 打开网页');
    worker.postMessage({file: item.file});
  } catch { fail('无法启动转换，请通过 localhost 或 HTTPS 打开网页'); }
}
$('files').addEventListener('change', e => { add(e.target.files); e.target.value = ''; });
const zone = $('dropzone');
let depth = 0;
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => { e.preventDefault(); depth = 0; zone.classList.remove('dragging'); });
zone.addEventListener('dragenter', e => { e.preventDefault(); depth++; zone.classList.add('dragging'); });
zone.addEventListener('dragleave', () => { if (--depth <= 0) zone.classList.remove('dragging'); });
zone.addEventListener('drop', e => { e.preventDefault(); add(e.dataTransfer.files); });
$('clear').addEventListener('click', () => {
  active?.worker.terminate(); active = null; zipper?.terminate(); zipper = null; zipBusy = false;
  items.length = 0; $('list').replaceChildren(); notice(''); updateSummary();
});
$('zip').addEventListener('click', () => {
  const done = items.filter(i => i.state === 'done');
  if (!done.length || zipBusy) return;
  zipBusy = true; updateSummary();
  const names = new Set();
  const files = done.map(item => {
    let name = item.outputName, n = 2;
    while (names.has(name.toLowerCase())) name = item.outputName.replace(/\.(mp3|flac)$/, ` (${n++}).$1`);
    names.add(name.toLowerCase()); return {name, bytes: item.audio};
  });
  function finish(error) { zipper?.terminate(); zipper = null; zipBusy = false; if (error) notice(error); updateSummary(); }
  try {
    zipper = new Worker('./zip-worker.js');
    zipper.onmessage = ({data}) => {
      if (data.error) { finish(data.error); return; }
      download(data.blob, 'soundport.zip'); finish();
    };
    zipper.onerror = () => finish('打包失败，请逐首下载或分成更小批次');
    zipper.postMessage(files);
  } catch { finish('无法启动打包线程，请逐首下载'); }
});
if (location.protocol === 'file:') notice('请使用本地 HTTP 服务打开此项目，或部署至 GitHub Pages；直接双击文件无法启动后台转换。');
