import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pagesDir = path.join(__dirname, '../src/pages/kit');

const baseStyle = `
<style>
  .tool-page {
    min-height: 100vh;
    padding: calc(var(--header-total-height) + var(--space-6)) var(--space-4) var(--space-16);
    background: var(--bg-primary);
  }
  .tool-container { max-width: 900px; margin: 0 auto; }
  .tool-header { margin-bottom: var(--space-6); }
  .back-link {
    display: inline-flex; align-items: center; gap: var(--space-2);
    color: var(--text-secondary); text-decoration: none; font-size: var(--text-sm);
    margin-bottom: var(--space-4); transition: color var(--duration-fast) var(--ease-default);
  }
  .back-link:hover { color: var(--text-primary); }
  .tool-title { font-size: var(--text-2xl); font-weight: var(--font-bold); color: var(--text-primary); margin-bottom: var(--space-2); }
  .tool-description { font-size: var(--text-sm); color: var(--text-secondary); }
  .tool-main {
    background: var(--bg-secondary); border: 1px solid var(--border-primary);
    border-radius: var(--radius-xl); padding: var(--space-6); min-height: 400px;
  }
  .tool-content { display: flex; flex-direction: column; gap: var(--space-4); }
  .form-group { display: flex; flex-direction: column; gap: var(--space-2); }
  .form-label { font-size: var(--text-sm); font-weight: var(--font-medium); color: var(--text-primary); }
  .form-input, .form-textarea, .form-select {
    padding: var(--space-3); background: var(--bg-primary); border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg); color: var(--text-primary); font-size: var(--text-sm); font-family: inherit;
  }
  .form-input:focus, .form-textarea:focus, .form-select:focus { outline: none; border-color: var(--color-primary); }
  .form-textarea { min-height: 120px; resize: vertical; font-family: var(--font-mono); }
  .form-select { cursor: pointer; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2);
    padding: var(--space-3) var(--space-4); border: none; border-radius: var(--radius-lg);
    font-size: var(--text-sm); font-weight: var(--font-medium); cursor: pointer;
    transition: all var(--duration-fast) var(--ease-default);
  }
  .btn-primary { background: var(--color-primary); color: #fffdf9; }
  .btn-primary:hover { box-shadow: 0 4px 12px rgba(217, 119, 87, 0.3); }
  .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-primary); }
  .btn-secondary:hover { background: var(--bg-hover); }
  .btn-group { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .result-area {
    padding: var(--space-4); background: var(--bg-primary); border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg); font-family: var(--font-mono); font-size: var(--text-sm);
    white-space: pre-wrap; word-break: break-all; max-height: 400px; overflow-y: auto;
  }
  .checkbox-group { display: flex; flex-wrap: wrap; gap: var(--space-3); }
  .checkbox-group label { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--text-secondary); cursor: pointer; }
  .stats-bar { display: flex; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-4); }
  .stat-item { background: var(--bg-primary); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); }
  .stat-item strong { color: var(--color-primary); }
  .file-upload {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: var(--space-8); border: 2px dashed var(--border-primary); border-radius: var(--radius-xl);
    cursor: pointer; transition: all var(--duration-fast) var(--ease-default);
  }
  .file-upload:hover { border-color: var(--color-primary); background: var(--bg-tertiary); }
  .file-upload input[type="file"] { display: none; }
  .preview-area { text-align: center; }
  .preview-area canvas { max-width: 100%; border: 1px solid var(--border-primary); border-radius: var(--radius-lg); }
  .color-display { width: 100%; height: 60px; border-radius: var(--radius-lg); border: 1px solid var(--border-primary); margin-bottom: var(--space-2); }
  .range-group { display: flex; align-items: center; gap: var(--space-3); }
  .range-group input[type="range"] { flex: 1; }
  .range-group .range-value { min-width: 50px; text-align: right; font-family: var(--font-mono); font-size: var(--text-sm); }
  @media (max-width: 768px) {
    .tool-main { padding: var(--space-4); }
    .btn-group { flex-direction: column; }
    .btn { width: 100%; }
  }
</style>`;

function generateToolPage(filename, title, desc, html, script) {
  const content = `---
import Layout from '@layouts/Layout.astro';

const toolName = '${title}';
const toolDesc = '${desc}';
---

<Layout title={toolName + ' - 工具箱 - Maxwell.Science'} description={toolDesc}>
  <section class="tool-page">
    <div class="tool-container">
      <header class="tool-header">
        <a href="/kit" class="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          返回工具箱
        </a>
        <h1 class="tool-title">{toolName}</h1>
        <p class="tool-description">{toolDesc}</p>
      </header>

      <main class="tool-main">
        <div class="tool-content" id="tool-content">${html}
        </div>
      </main>
    </div>
  </section>
</Layout>
${baseStyle}
<script>${script}
</script>
`;

  const filePath = path.join(pagesDir, filename);
  fs.writeFileSync(filePath, content);
  console.log('Generated: ' + filename);
}

// 1. 图片取色器
generateToolPage('image-color-picker.astro', '图片取色器', '从图片中提取颜色值', `
  <label class="file-upload" id="drop-zone">
    <input type="file" id="image-input" accept="image/*">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary);margin-bottom:var(--space-3);">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span style="color:var(--text-secondary);font-size:var(--text-sm);">点击或拖拽上传图片</span>
  </label>
  <div class="preview-area">
    <canvas id="canvas" style="display:none;cursor:crosshair;"></canvas>
  </div>
  <div id="color-info" style="display:none;">
    <div class="color-display" id="color-display"></div>
    <div class="stats-bar">
      <div class="stat-item"><strong>HEX:</strong> <span id="hex"></span></div>
      <div class="stat-item"><strong>RGB:</strong> <span id="rgb"></span></div>
      <div class="stat-item"><strong>HSL:</strong> <span id="hsl"></span></div>
    </div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const colorInfo = document.getElementById('color-info');
    const colorDisplay = document.getElementById('color-display');
    const hex = document.getElementById('hex');
    const rgb = document.getElementById('rgb');
    const hsl = document.getElementById('hsl');

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          canvas.style.display = 'block';
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const r = pixel[0], g = pixel[1], b = pixel[2];

      const hexVal = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
      const rgbVal = 'rgb(' + r + ', ' + g + ', ' + b + ')';

      const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
      const max = Math.max(rNorm, gNorm, bNorm), min = Math.min(rNorm, gNorm, bNorm);
      let h, s, l = (max + min) / 2;
      if (max === min) { h = s = 0; }
      else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
          case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
          case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
        }
      }
      const hslVal = 'hsl(' + Math.round(h * 360) + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%)';

      colorDisplay.style.background = hexVal;
      hex.textContent = hexVal;
      rgb.textContent = rgbVal;
      hsl.textContent = hslVal;
      colorInfo.style.display = 'block';
    });
  });
`);

// 2. 图片水印
generateToolPage('image-watermark.astro', '图片水印', '给图片添加文字或图片水印', `
  <label class="file-upload" id="drop-zone">
    <input type="file" id="image-input" accept="image/*">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary);margin-bottom:var(--space-3);">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span style="color:var(--text-secondary);font-size:var(--text-sm);">点击或拖拽上传原图</span>
  </label>
  <div class="form-group">
    <label class="form-label" for="watermark-text">水印文字</label>
    <input type="text" id="watermark-text" class="form-input" placeholder="输入水印文字" value="Maxwell.Science">
  </div>
  <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;">
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="font-size">字体大小</label>
      <div class="range-group">
        <input type="range" id="font-size" min="12" max="120" value="36">
        <span class="range-value" id="font-size-val">36px</span>
      </div>
    </div>
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="opacity">透明度</label>
      <div class="range-group">
        <input type="range" id="opacity" min="5" max="100" value="30">
        <span class="range-value" id="opacity-val">30%</span>
      </div>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">水印位置</label>
    <div class="checkbox-group">
      <label><input type="radio" name="position" value="center" checked> 居中</label>
      <label><input type="radio" name="position" value="bottom-right"> 右下</label>
      <label><input type="radio" name="position" value="bottom-left"> 左下</label>
      <label><input type="radio" name="position" value="top-right"> 右上</label>
      <label><input type="radio" name="position" value="top-left"> 左上</label>
      <label><input type="radio" name="position" value="tile"> 平铺</label>
    </div>
  </div>
  <div class="btn-group">
    <button id="apply-btn" class="btn btn-primary">添加水印</button>
    <button id="download-btn" class="btn btn-secondary">下载</button>
  </div>
  <div class="preview-area">
    <canvas id="canvas" style="display:none;"></canvas>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const watermarkText = document.getElementById('watermark-text');
    const fontSize = document.getElementById('font-size');
    const opacity = document.getElementById('opacity');
    const applyBtn = document.getElementById('apply-btn');
    const downloadBtn = document.getElementById('download-btn');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let originalImage = null;

    fontSize.addEventListener('input', () => { document.getElementById('font-size-val').textContent = fontSize.value + 'px'; });
    opacity.addEventListener('input', () => { document.getElementById('opacity-val').textContent = opacity.value + '%'; });

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => { originalImage = img; canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0); canvas.style.display = 'block'; };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    applyBtn.addEventListener('click', () => {
      if (!originalImage) return;
      canvas.width = originalImage.width;
      canvas.height = originalImage.height;
      ctx.drawImage(originalImage, 0, 0);

      const size = parseInt(fontSize.value);
      const alpha = parseInt(opacity.value) / 100;
      const position = document.querySelector('input[name="position"]:checked').value;
      ctx.font = 'bold ' + size + 'px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha + ')';
      ctx.strokeStyle = 'rgba(0, 0, 0, ' + alpha + ')';
      ctx.lineWidth = 2;

      const text = watermarkText.value;
      const metrics = ctx.measureText(text);
      const tw = metrics.width;
      const th = size;

      if (position === 'tile') {
        ctx.save();
        ctx.rotate(-Math.PI / 6);
        for (let y = -canvas.height; y < canvas.height * 2; y += th * 3) {
          for (let x = -canvas.width; x < canvas.width * 2; x += tw * 2) {
            ctx.fillText(text, x, y);
            ctx.strokeText(text, x, y);
          }
        }
        ctx.restore();
      } else {
        let x, y;
        const pad = 20;
        switch (position) {
          case 'center': x = (canvas.width - tw) / 2; y = (canvas.height + th) / 2; break;
          case 'bottom-right': x = canvas.width - tw - pad; y = canvas.height - pad; break;
          case 'bottom-left': x = pad; y = canvas.height - pad; break;
          case 'top-right': x = canvas.width - tw - pad; y = pad + th; break;
          case 'top-left': x = pad; y = pad + th; break;
        }
        ctx.fillText(text, x, y);
        ctx.strokeText(text, x, y);
      }
    });

    downloadBtn.addEventListener('click', () => {
      if (!originalImage) return;
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'watermarked.png'; a.click();
        URL.revokeObjectURL(url);
      });
    });
  });
`);

// 3. 图片裁剪
generateToolPage('image-cut.astro', '图片裁剪', '裁剪图片指定区域', `
  <label class="file-upload" id="drop-zone">
    <input type="file" id="image-input" accept="image/*">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary);margin-bottom:var(--space-3);">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span style="color:var(--text-secondary);font-size:var(--text-sm);">点击或拖拽上传图片</span>
  </label>
  <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;">
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="cut-x">X 起始</label>
      <input type="number" id="cut-x" class="form-input" value="0" min="0">
    </div>
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="cut-y">Y 起始</label>
      <input type="number" id="cut-y" class="form-input" value="0" min="0">
    </div>
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="cut-w">宽度</label>
      <input type="number" id="cut-w" class="form-input" value="200" min="1">
    </div>
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="cut-h">高度</label>
      <input type="number" id="cut-h" class="form-input" value="200" min="1">
    </div>
  </div>
  <div class="btn-group">
    <button id="cut-btn" class="btn btn-primary">裁剪</button>
    <button id="download-btn" class="btn btn-secondary">下载</button>
  </div>
  <div class="preview-area">
    <canvas id="canvas" style="display:none;"></canvas>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const downloadBtn = document.getElementById('download-btn');
    let originalImage = null;

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          originalImage = img;
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          canvas.style.display = 'block';
          document.getElementById('cut-w').value = Math.floor(img.width / 2);
          document.getElementById('cut-h').value = Math.floor(img.height / 2);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('cut-btn').addEventListener('click', () => {
      if (!originalImage) return;
      const x = parseInt(document.getElementById('cut-x').value);
      const y = parseInt(document.getElementById('cut-y').value);
      const w = parseInt(document.getElementById('cut-w').value);
      const h = parseInt(document.getElementById('cut-h').value);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(originalImage, x, y, w, h, 0, 0, w, h);

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(tempCanvas, 0, 0);
    });

    downloadBtn.addEventListener('click', () => {
      if (!originalImage) return;
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'cropped.png'; a.click();
        URL.revokeObjectURL(url);
      });
    });
  });
`);

// 4. 图标制作
generateToolPage('icon-maker.astro', '图标制作', '生成常用尺寸的图标文件', `
  <label class="file-upload" id="drop-zone">
    <input type="file" id="image-input" accept="image/*">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary);margin-bottom:var(--space-3);">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span style="color:var(--text-secondary);font-size:var(--text-sm);">点击或拖拽上传图片</span>
  </label>
  <div class="form-group">
    <label class="form-label">选择输出尺寸</label>
    <div class="checkbox-group">
      <label><input type="checkbox" class="size-check" value="16" checked> 16x16</label>
      <label><input type="checkbox" class="size-check" value="32" checked> 32x32</label>
      <label><input type="checkbox" class="size-check" value="48" checked> 48x48</label>
      <label><input type="checkbox" class="size-check" value="64"> 64x64</label>
      <label><input type="checkbox" class="size-check" value="128" checked> 128x128</label>
      <label><input type="checkbox" class="size-check" value="256"> 256x256</label>
      <label><input type="checkbox" class="size-check" value="512"> 512x512</label>
      <label><input type="checkbox" class="size-check" value="1024"> 1024x1024</label>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">圆角</label>
    <div class="range-group">
      <input type="range" id="corner-radius" min="0" max="50" value="0">
      <span class="range-value" id="corner-val">0%</span>
    </div>
  </div>
  <div class="btn-group">
    <button id="generate-btn" class="btn btn-primary">生成图标</button>
    <button id="download-all-btn" class="btn btn-secondary">下载全部</button>
  </div>
  <div id="preview-grid" style="display:flex;flex-wrap:wrap;gap:var(--space-4);"></div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const generateBtn = document.getElementById('generate-btn');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const previewGrid = document.getElementById('preview-grid');
    const cornerRadius = document.getElementById('corner-radius');
    let originalImage = null;
    let generatedCanvases = [];

    cornerRadius.addEventListener('input', () => {
      document.getElementById('corner-val').textContent = cornerRadius.value + '%';
    });

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => { originalImage = img; };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    function drawRoundedRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    generateBtn.addEventListener('click', () => {
      if (!originalImage) return;
      previewGrid.innerHTML = '';
      generatedCanvases = [];

      const sizes = [...document.querySelectorAll('.size-check:checked')].map(c => parseInt(c.value));
      const radius = parseInt(cornerRadius.value) / 100;

      sizes.forEach(size => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        if (radius > 0) {
          const r = size * radius;
          drawRoundedRect(ctx, 0, 0, size, size, r);
          ctx.clip();
        }

        ctx.drawImage(originalImage, 0, 0, size, size);
        generatedCanvases.push({ canvas, size });

        const wrapper = document.createElement('div');
        wrapper.style.textAlign = 'center';
        wrapper.innerHTML = '<canvas width="' + size + '" height="' + size + '" style="border:1px solid var(--border-primary);border-radius:var(--radius-md);"></canvas><div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:var(--space-1);">' + size + 'x' + size + '</div>';
        wrapper.querySelector('canvas').getContext('2d').drawImage(canvas, 0, 0);
        previewGrid.appendChild(wrapper);
      });
    });

    downloadAllBtn.addEventListener('click', () => {
      generatedCanvases.forEach(item => {
        item.canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'icon-' + item.size + 'x' + item.size + '.png'; a.click();
          URL.revokeObjectURL(url);
        });
      });
    });
  });
`);

// 5. 随机数生成
generateToolPage('random-number.astro', '随机数生成', '生成指定范围的随机数', `
  <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;">
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="min-val">最小值</label>
      <input type="number" id="min-val" class="form-input" value="1">
    </div>
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="max-val">最大值</label>
      <input type="number" id="max-val" class="form-input" value="100">
    </div>
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="count">生成数量</label>
      <input type="number" id="count" class="form-input" value="1" min="1" max="1000">
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">选项</label>
    <div class="checkbox-group">
      <label><input type="checkbox" id="allow-decimal"> 允许小数</label>
      <label><input type="checkbox" id="no-duplicates"> 不重复</label>
      <label><input type="checkbox" id="sort-result"> 排序结果</label>
    </div>
  </div>
  <div class="btn-group">
    <button id="generate-btn" class="btn btn-primary">生成</button>
    <button id="copy-btn" class="btn btn-secondary">复制</button>
  </div>
  <div class="form-group">
    <label class="form-label">生成结果</label>
    <div id="result" class="result-area">等待生成...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const minVal = document.getElementById('min-val');
    const maxVal = document.getElementById('max-val');
    const count = document.getElementById('count');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    generateBtn.addEventListener('click', () => {
      const min = parseFloat(minVal.value);
      const max = parseFloat(maxVal.value);
      const n = parseInt(count.value);
      const decimal = document.getElementById('allow-decimal').checked;
      const noDup = document.getElementById('no-duplicates').checked;
      const sort = document.getElementById('sort-result').checked;

      if (isNaN(min) || isNaN(max) || isNaN(n)) { result.textContent = '请输入有效数值'; return; }
      if (noDup && !decimal && (max - min + 1) < n) { result.textContent = '范围内整数不足以生成不重复的' + n + '个数'; return; }

      const numbers = [];
      const used = new Set();

      for (let i = 0; i < n; i++) {
        let num;
        let attempts = 0;
        do {
          num = decimal ? (Math.random() * (max - min) + min) : Math.floor(Math.random() * (max - min + 1) + min);
          if (decimal) num = parseFloat(num.toFixed(2));
          attempts++;
        } while (noDup && used.has(num) && attempts < 1000);

        if (noDup && used.has(num)) break;
        used.add(num);
        numbers.push(num);
      }

      if (sort) numbers.sort((a, b) => a - b);
      result.textContent = numbers.join(', ');
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待生成...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });
`);

// 6. UA生成器
generateToolPage('ua-generator-adv.astro', 'User-Agent生成器', '生成各种浏览器和设备的User-Agent', `
  <div class="form-group">
    <label class="form-label">浏览器类型</label>
    <div class="checkbox-group">
      <label><input type="checkbox" class="browser-check" value="chrome" checked> Chrome</label>
      <label><input type="checkbox" class="browser-check" value="firefox" checked> Firefox</label>
      <label><input type="checkbox" class="browser-check" value="safari"> Safari</label>
      <label><input type="checkbox" class="browser-check" value="edge"> Edge</label>
      <label><input type="checkbox" class="browser-check" value="mobile"> 移动端</label>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label" for="ua-count">生成数量</label>
    <input type="number" id="ua-count" class="form-input" value="5" min="1" max="50">
  </div>
  <div class="btn-group">
    <button id="generate-btn" class="btn btn-primary">生成</button>
    <button id="copy-btn" class="btn btn-secondary">复制全部</button>
  </div>
  <div class="form-group">
    <label class="form-label">生成结果</label>
    <div id="result" class="result-area">等待生成...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');
    const uaCount = document.getElementById('ua-count');

    const chromeVersions = ['120.0.6099.130', '121.0.6167.85', '122.0.6261.69', '123.0.6312.58'];
    const firefoxVersions = ['121.0', '122.0', '123.0', '124.0'];
    const safariVersions = ['605.1.15', '604.1', '602.1'];
    const edgeVersions = ['120.0.2210.91', '121.0.2277.83', '122.0.2365.52'];
    const winPlatforms = ['Windows NT 10.0; Win64; x64', 'Windows NT 10.0; WOW64'];
    const macPlatforms = ['Macintosh; Intel Mac OS X 10_15_7', 'Macintosh; Intel Mac OS X 14_2_1'];
    const linuxPlatforms = ['X11; Linux x86_64', 'X11; Ubuntu; Linux x86_64'];
    const mobilePlatforms = ['Linux; Android 14; Pixel 8', 'Linux; Android 13; SM-S918B', 'iPhone; CPU iPhone OS 17_2 like Mac OS X'];

    function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function generateUA(type) {
      const platform = type === 'mobile' ? rand(mobilePlatforms) : rand([...winPlatforms, ...macPlatforms, ...linuxPlatforms]);
      const isMobile = type === 'mobile';

      switch (type) {
        case 'chrome':
          return 'Mozilla/5.0 (' + platform + ') AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + rand(chromeVersions) + ' Safari/537.36';
        case 'firefox':
          return 'Mozilla/5.0 (' + platform + '; rv:' + rand(firefoxVersions) + ') Gecko/20100101 Firefox/' + rand(firefoxVersions);
        case 'safari':
          return 'Mozilla/5.0 (' + (isMobile ? rand(mobilePlatforms) : 'Macintosh; Intel Mac OS X 10_15_7') + ') AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/' + rand(safariVersions);
        case 'edge':
          return 'Mozilla/5.0 (' + platform + ') AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + rand(chromeVersions) + ' Safari/537.36 Edg/' + rand(edgeVersions);
        case 'mobile':
          return 'Mozilla/5.0 (' + rand(mobilePlatforms) + ') AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + rand(chromeVersions) + ' Mobile Safari/537.36';
        default:
          return '';
      }
    }

    generateBtn.addEventListener('click', () => {
      const browsers = [...document.querySelectorAll('.browser-check:checked')].map(c => c.value);
      if (browsers.length === 0) { result.textContent = '请选择至少一种浏览器'; return; }

      const count = parseInt(uaCount.value) || 5;
      const uas = [];

      for (let i = 0; i < count; i++) {
        uas.push(generateUA(rand(browsers)));
      }

      result.textContent = uas.join('\\n\\n');
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待生成...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });
`);

console.log('\n✅ 第七批工具生成完成');
console.log('Done!');
