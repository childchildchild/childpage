const dialog = document.querySelector('#crop-dialog');
const stage = document.querySelector('#crop-stage');
const frame = document.querySelector('#crop-frame');
const preview = document.querySelector('#crop-image');
const ratioSelect = document.querySelector('#crop-ratio');
const zoomInput = document.querySelector('#crop-zoom');
const customWidth = document.querySelector('#crop-custom-width');
const customHeight = document.querySelector('#crop-custom-height');
let current = null;
let drag = null;

function aspect() {
  if (!current) return 1;
  if (ratioSelect.value === 'card') return 1.18;
  if (ratioSelect.value === 'square') return 1;
  if (ratioSelect.value === 'story') return 9 / 16;
  if (ratioSelect.value === 'landscape') return 16 / 9;
  if (ratioSelect.value === 'custom') return Math.max(1, Number(customWidth.value)) / Math.max(1, Number(customHeight.value));
  return current.width / current.height;
}
function draw() {
  if (!current) return;
  const maxWidth = Math.max(100, stage.clientWidth - 24);
  const maxHeight = Math.max(100, stage.clientHeight - 24);
  const ratio = aspect();
  current.frameWidth = Math.min(maxWidth, maxHeight * ratio);
  current.frameHeight = current.frameWidth / ratio;
  frame.style.width = `${current.frameWidth}px`;
  frame.style.height = `${current.frameHeight}px`;
  current.scale = Math.max(current.frameWidth / current.width, current.frameHeight / current.height) * current.zoom;
  const shownWidth = current.width * current.scale;
  const shownHeight = current.height * current.scale;
  const maxX = Math.max(0, (shownWidth - current.frameWidth) / 2);
  const maxY = Math.max(0, (shownHeight - current.frameHeight) / 2);
  current.offsetX = Math.max(-maxX, Math.min(maxX, current.offsetX));
  current.offsetY = Math.max(-maxY, Math.min(maxY, current.offsetY));
  preview.style.width = `${shownWidth}px`;
  preview.style.height = `${shownHeight}px`;
  preview.style.transform = `translate(calc(-50% + ${current.offsetX}px), calc(-50% + ${current.offsetY}px))`;
}
function finish(value) {
  if (!current) return;
  const session = current;
  current = null;
  drag = null;
  dialog.close();
  preview.removeAttribute('src');
  if (session.ownsUrl) URL.revokeObjectURL(session.url);
  session.resolve(value);
}
function toBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
}
async function decodeWithTimeout(image, milliseconds) {
  let timer;
  try {
    await Promise.race([
      image.decode(),
      new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('Фото загружается слишком долго.')), milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}
async function makeCroppedFile() {
  const state = current;
  const sourceWidth = state.frameWidth / state.scale;
  const sourceHeight = state.frameHeight / state.scale;
  const sourceX = Math.max(0, Math.min(state.width - sourceWidth, (state.width - sourceWidth) / 2 - state.offsetX / state.scale));
  const sourceY = Math.max(0, Math.min(state.height - sourceHeight, (state.height - sourceHeight) / 2 - state.offsetY / state.scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Не удалось подготовить фото.');
  let blob;
  for (const [limit, quality] of [[2200, .9], [1700, .8], [1200, .7]]) {
    const scale = Math.min(1, limit / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    context.drawImage(state.image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    blob = await toBlob(canvas, quality);
    if (blob && blob.size <= 2_500_000) break;
  }
  if (!blob || blob.size > 2_500_000) throw new Error('Фото после кадрирования слишком большое.');
  return new File([blob], `photo-${Date.now()}.${blob.type === 'image/webp' ? 'webp' : 'png'}`, { type: blob.type || 'image/png' });
}

export async function cropImage(source, options = {}) {
  if (current) throw new Error('Закройте предыдущее кадрирование.');
  let ownsUrl = source instanceof Blob;
  let url = ownsUrl ? URL.createObjectURL(source) : source;
  const image = new Image();
  if (/^https:\/\//.test(url)) image.crossOrigin = 'anonymous';
  image.src = url;
  try { await decodeWithTimeout(image, /^https:\/\//.test(url) ? 2500 : 8000); }
  catch {
    if (!/^https:\/\//.test(source)) {
      if (ownsUrl) URL.revokeObjectURL(url);
      throw new Error('Не удалось открыть фото для кадрирования. Попробуйте выбрать файл заново.');
    }
    try {
      const response = await fetch('/api/admin?action=image-source', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'image-source', url: source }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось получить фото по ссылке.');
      const bytes = Uint8Array.from(atob(data.base64), character => character.charCodeAt(0));
      url = URL.createObjectURL(new Blob([bytes], { type: data.mime }));
      ownsUrl = true;
      image.removeAttribute('crossorigin');
      image.src = url;
      await decodeWithTimeout(image, 8000);
    } catch (error) {
      if (ownsUrl) URL.revokeObjectURL(url);
      throw new Error(`${error.message} Сохраните фото на устройство и загрузите файлом.`);
    }
  }
  if (!image.naturalWidth || !image.naturalHeight) {
    if (ownsUrl) URL.revokeObjectURL(url);
    throw new Error('Файл не похож на фотографию.');
  }
  return new Promise(resolve => {
    current = { source, url, ownsUrl, image, width: image.naturalWidth, height: image.naturalHeight, frameWidth: 0, frameHeight: 0, scale: 1, zoom: 1, offsetX: 0, offsetY: 0, resolve };
    document.querySelector('#crop-caption').textContent = options.caption || 'Перемещайте фото пальцем. Масштаб меняется ползунком.';
    document.querySelector('#crop-warning').hidden = !(source instanceof File && source.type === 'image/gif') && !String(source).toLowerCase().endsWith('.gif');
    ratioSelect.value = options.ratio || 'original';
    document.querySelector('#crop-custom').hidden = ratioSelect.value !== 'custom';
    zoomInput.value = '1';
    preview.src = url;
    dialog.showModal();
    draw();
  });
}

frame.addEventListener('pointerdown', event => {
  if (!current) return;
  event.preventDefault();
  frame.setPointerCapture(event.pointerId);
  drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: current.offsetX, offsetY: current.offsetY };
});
frame.addEventListener('pointermove', event => {
  if (!current || !drag || drag.pointerId !== event.pointerId) return;
  current.offsetX = drag.offsetX + event.clientX - drag.x;
  current.offsetY = drag.offsetY + event.clientY - drag.y;
  draw();
});
frame.addEventListener('pointerup', () => { drag = null; });
frame.addEventListener('pointercancel', () => { drag = null; });
zoomInput.addEventListener('input', () => { if (current) { current.zoom = Number(zoomInput.value); draw(); } });
ratioSelect.addEventListener('change', () => {
  if (!current) return;
  document.querySelector('#crop-custom').hidden = ratioSelect.value !== 'custom';
  current.zoom = 1; current.offsetX = 0; current.offsetY = 0; zoomInput.value = '1'; draw();
});
for (const input of [customWidth, customHeight]) input.addEventListener('input', draw);
window.addEventListener('resize', draw);
document.querySelector('#crop-close').addEventListener('click', () => finish(null));
document.querySelector('#crop-skip').addEventListener('click', () => finish(current?.source));
document.querySelector('#crop-apply').addEventListener('click', async event => {
  if (!current) return;
  const button = event.currentTarget;
  button.disabled = true;
  try { finish(await makeCroppedFile()); }
  catch (error) { document.querySelector('#crop-caption').textContent = error.message; }
  finally { button.disabled = false; }
});
dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
dialog.addEventListener('click', event => { if (event.target === dialog) finish(null); });
