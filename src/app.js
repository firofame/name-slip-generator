const PAGE_W = 1587, PAGE_H = 1123, SLIP_W = 317, SLIP_H = 225;
const COLS = 5, ROWS = 5, MAX_SLIPS = COLS * ROWS;

/* ── State ── */
let slips = [];
let currentPhoto = '';

/* ── DOM refs ── */
const $ = (s) => document.getElementById(s);
const fileInput = $('fileInput');
const photoPreview = $('photoPreview');
const photoImg = $('photoImg');
const nameInput = $('nameInput');
const classInput = $('classInput');
const sectionInput = $('sectionInput');
const rollInput = $('rollInput');
const subjectInput = $('subjectInput');
const schoolInput = $('schoolInput');
const slipList = $('slipList');
const slipCount = $('slipCount');
const clearAllBtn = $('clearAllBtn');
const emptyMsg = $('emptyMsg');
const downloadBtn = $('downloadBtn');
const a3Page = $('a3Page');
const previewContainer = $('previewContainer');

/* ═══════════════════════════════════
   Photo Upload & Crop
   ═══════════════════════════════════ */
const cropModal = $('cropModal');
const cropViewport = $('cropViewport');
const cropCanvas = $('cropCanvas');
const cropFrame = $('cropFrame');
const cropZoom = $('cropZoom');
let cropImg = null;
let cropState = { zoom: 1, panX: 0, panY: 0, dragging: false, lastX: 0, lastY: 0 };

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => openCropper(reader.result);
  reader.readAsDataURL(file);
  e.target.value = '';
});

function openCropper(src) {
  cropImg = new Image();
  cropImg.onload = () => {
    cropState = { zoom: 1, panX: 0, panY: 0, dragging: false, lastX: 0, lastY: 0 };
    cropZoom.value = 100;
    cropModal.classList.add('open');
    drawCrop();
  };
  cropImg.src = src;
}

function getCropFrameRect() {
  const vw = cropViewport.clientWidth, vh = cropViewport.clientHeight;
  const aspect = 3 / 4;
  let fw = Math.min(vw * 0.6, vh * 0.6 * aspect);
  let fh = fw / aspect;
  if (fh > vh * 0.8) { fh = vh * 0.8; fw = fh * aspect; }
  return { x: (vw - fw) / 2, y: (vh - fh) / 2, w: fw, h: fh };
}

function drawCrop() {
  if (!cropImg) return;
  const vw = cropViewport.clientWidth, vh = cropViewport.clientHeight;
  const z = cropState.zoom;

  // Size canvas to fit viewport while respecting zoom
  const imgAspect = cropImg.width / cropImg.height;
  let cw, ch;
  if (imgAspect > vw / vh) {
    ch = vh * z; cw = ch * imgAspect;
  } else {
    cw = vw * z; ch = cw / imgAspect;
  }

  cropCanvas.width = cw;
  cropCanvas.height = ch;
  cropCanvas.style.marginLeft = cropState.panX + 'px';
  cropCanvas.style.marginTop = cropState.panY + 'px';

  const ctx = cropCanvas.getContext('2d');
  ctx.drawImage(cropImg, 0, 0, cw, ch);

  // Position frame
  const f = getCropFrameRect();
  cropFrame.style.left = f.x + 'px';
  cropFrame.style.top = f.y + 'px';
  cropFrame.style.width = f.w + 'px';
  cropFrame.style.height = f.h + 'px';
}

cropZoom.addEventListener('input', () => {
  cropState.zoom = cropZoom.value / 100;
  drawCrop();
});

// Pan via drag
cropViewport.addEventListener('mousedown', (e) => { cropState.dragging = true; cropState.lastX = e.clientX; cropState.lastY = e.clientY; });
window.addEventListener('mousemove', (e) => {
  if (!cropState.dragging) return;
  cropState.panX += e.clientX - cropState.lastX;
  cropState.panY += e.clientY - cropState.lastY;
  cropState.lastX = e.clientX;
  cropState.lastY = e.clientY;
  drawCrop();
});
window.addEventListener('mouseup', () => { cropState.dragging = false; });

// Touch support
cropViewport.addEventListener('touchstart', (e) => { const t = e.touches[0]; cropState.dragging = true; cropState.lastX = t.clientX; cropState.lastY = t.clientY; }, { passive: true });
window.addEventListener('touchmove', (e) => {
  if (!cropState.dragging) return;
  const t = e.touches[0];
  cropState.panX += t.clientX - cropState.lastX;
  cropState.panY += t.clientY - cropState.lastY;
  cropState.lastX = t.clientX;
  cropState.lastY = t.clientY;
  drawCrop();
}, { passive: true });
window.addEventListener('touchend', () => { cropState.dragging = false; });

function closeCropper() { cropModal.classList.remove('open'); cropImg = null; }
$('cropCancelX').onclick = closeCropper;
$('cropCancelBtn').onclick = closeCropper;

$('cropConfirmBtn').addEventListener('click', () => {
  const f = getCropFrameRect();
  // Frame position relative to canvas top-left on screen
  const canvasRect = cropCanvas.getBoundingClientRect();
  const vpRect = cropViewport.getBoundingClientRect();

  const scaleX = cropImg.width / cropCanvas.width;
  const scaleY = cropImg.height / cropCanvas.height;

  const sx = (vpRect.left + f.x - canvasRect.left) * scaleX;
  const sy = (vpRect.top + f.y - canvasRect.top) * scaleY;
  const sw = f.w * scaleX;
  const sh = f.h * scaleY;

  // Draw cropped region to offscreen canvas
  const out = document.createElement('canvas');
  out.width = sw; out.height = sh;
  const ctx = out.getContext('2d');
  ctx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, sw, sh);

  currentPhoto = out.toDataURL('image/jpeg', 0.92);
  photoImg.src = currentPhoto;
  photoPreview.classList.add('has-photo');
  closeCropper();
});

$('photoRemoveBtn').addEventListener('click', () => {
  currentPhoto = '';
  photoImg.src = '';
  photoPreview.classList.remove('has-photo');
});

/* ═══════════════════════════════════
   Slip CRUD
   ═══════════════════════════════════ */
function uid() { return Math.random().toString(36).slice(2, 9); }

$('addBtn').addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) return alert('Please enter a name');
  slips.push({
    id: uid(), image: currentPhoto, name,
    className: classInput.value.trim(), section: sectionInput.value.trim(),
    roll: rollInput.value.trim(), subject: subjectInput.value.trim(),
    school: schoolInput.value.trim()
  });
  currentPhoto = '';
  photoImg.src = '';
  photoPreview.classList.remove('has-photo');
  nameInput.value = '';
  rollInput.value = '';
  subjectInput.value = '';
  render();
});

$('fillBtn').addEventListener('click', () => {
  if (!slips.length) return alert('Add at least one slip first.');
  const base = slips[0];
  slips = Array.from({ length: MAX_SLIPS }, () => ({ ...base, id: uid() }));
  render();
});

clearAllBtn.addEventListener('click', () => { slips = []; render(); });

function removeSlip(id) { slips = slips.filter(s => s.id !== id); render(); }
function dupSlip(id) {
  const s = slips.find(s => s.id === id);
  if (s) { slips.push({ ...s, id: uid() }); render(); }
}

/* ═══════════════════════════════════
   Rendering
   ═══════════════════════════════════ */
function renderSlipHTML(s) {
  const classSection = [s.className, s.section ? `(${s.section})` : ''].filter(Boolean).join(' ');
  const photoHTML = s.image
    ? `<img src="${s.image}" alt="">`
    : `<div class="slip-photo-empty"><span>PHOTO</span></div>`;

  return `
    <div class="slip">
      <div class="slip-inner">
        <div class="slip-photo">${photoHTML}</div>
        <div class="field-row"><span class="field-label">NAME:</span><div class="field-value-line"><span class="field-value">${s.name}</span></div></div>
        <div class="field-row split">
          <div class="field-row" style="flex:1"><span class="field-label">CLASS:</span><div class="field-value-line"><span class="field-value">${classSection}</span></div></div>
          <div class="field-row" style="width:60px"><span class="field-label">ROLL:</span><div class="field-value-line"><span class="field-value">${s.roll}</span></div></div>
        </div>
        <div class="field-row"><span class="field-label">SUBJECT:</span><div class="field-value-line"><span class="field-value">${s.subject}</span></div></div>
        <div class="field-row"><span class="field-label">SCHOOL:</span><div class="field-value-line"><span class="field-value">${s.school}</span></div></div>
      </div>
    </div>`;
}

function render() {
  // A3 preview
  a3Page.innerHTML = slips.map(renderSlipHTML).join('');
  updateScale();

  // Sidebar list
  slipCount.textContent = `(${slips.length})`;
  clearAllBtn.classList.toggle('visible', slips.length > 0);
  downloadBtn.disabled = slips.length === 0;

  if (!slips.length) {
    slipList.innerHTML = '<p class="empty-msg">No slips added yet.</p>';
    return;
  }

  slipList.innerHTML = slips.map(s => {
    const thumb = s.image ? `<img src="${s.image}" alt="">` : 'No Img';
    const meta = [s.className && `C: ${s.className}`, s.section && `S: ${s.section}`, s.subject && `[${s.subject}]`].filter(Boolean).join(' ');
    return `
      <div class="slip-item">
        <div class="slip-item-info">
          <div class="slip-item-thumb">${thumb}</div>
          <div>
            <div class="slip-item-name">${s.name || '(No Name)'}</div>
            <div class="slip-item-meta">${meta}</div>
          </div>
        </div>
        <div class="slip-item-actions">
          <button class="dup-btn" onclick="dupSlip('${s.id}')" title="Duplicate">+</button>
          <button class="del-btn" onclick="removeSlip('${s.id}')" title="Remove">×</button>
        </div>
      </div>`;
  }).join('');
}

/* ── Preview Scaling ── */
function updateScale() {
  const containerW = previewContainer.clientWidth - 64;
  const scale = Math.min(1, containerW / PAGE_W);
  a3Page.style.transform = `scale(${scale})`;
  a3Page.style.marginBottom = `${(PAGE_H * scale) - PAGE_H}px`;
}
window.addEventListener('resize', updateScale);
updateScale();

/* ═══════════════════════════════════
   Image Download
   ═══════════════════════════════════ */
downloadBtn.addEventListener('click', async () => {
  if (!slips.length) return;
  downloadBtn.disabled = true;
  downloadBtn.textContent = '⏳ Generating Image…';

  try {
    const prevTransform = a3Page.style.transform;
    a3Page.style.transform = 'none';

    const imgData = await htmlToImage.toJpeg(a3Page, {
      quality: 0.95,
      backgroundColor: '#ffffff',
      width: PAGE_W,
      height: PAGE_H,
      pixelRatio: 2,
    });

    a3Page.style.transform = prevTransform;

    const link = document.createElement('a');
    link.download = 'A3-Name-Slips.jpg';
    link.href = imgData;
    link.click();
  } catch (err) {
    console.error(err);
    alert('Failed to generate image.');
  } finally {
    downloadBtn.disabled = slips.length === 0;
    downloadBtn.textContent = '⬇ Download A3 Image';
  }
});

/* ── Expose globals for inline onclick handlers ── */
window.removeSlip = removeSlip;
window.dupSlip = dupSlip;

/* ── Initial render ── */
render();
