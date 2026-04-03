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
  .color-input-group { display: flex; align-items: center; gap: var(--space-3); }
  .color-input-groups input[type="color"] { width: 50px; height: 40px; border: none; border-radius: var(--radius-md); cursor: pointer; }
  .range-group { display: flex; align-items: center; gap: var(--space-3); }
  .range-group input[type="range"] { flex: 1; }
  .range-group .range-value { min-width: 50px; text-align: right; font-family: var(--font-mono); font-size: var(--text-sm); }
  .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-3); }
  .image-grid img { width: 100%; border-radius: var(--radius-md); border: 1px solid var(--border-primary); }
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

// 1. 图片背景色
generateToolPage('image-bg-color.astro', '图片背景色替换', '给透明图片添加背景色', `
  <label class="file-upload" id="drop-zone">
    <input type="file" id="image-input" accept="image/*">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary);margin-bottom:var(--space-3);">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span style="color:var(--text-secondary);font-size:var(--text-sm);">点击或拖拽上传图片（支持PNG透明图）</span>
  </label>
  <div class="form-group">
    <label class="form-label">背景颜色</label>
    <div class="color-input-groups">
      <input type="color" id="bg-color" value="#ffffff">
      <input type="text" id="bg-color-text" class="form-input" value="#ffffff" style="width:120px;">
    </div>
  </div>
  <div class="btn-group">
    <button id="apply-btn" class="btn btn-primary">应用背景色</button>
    <button id="download-btn" class="btn btn-secondary">下载</button>
  </div>
  <div class="preview-area">
    <canvas id="canvas" style="display:none;"></canvas>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const bgColor = document.getElementById('bg-color');
    const bgColorText = document.getElementById('bg-color-text');
    const applyBtn = document.getElementById('apply-btn');
    const downloadBtn = document.getElementById('download-btn');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let originalImage = null;

    bgColor.addEventListener('input', () => { bgColorText.value = bgColor.value; });
    bgColorText.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(bgColorText.value)) bgColor.value = bgColorText.value;
    });

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
      ctx.fillStyle = bgColor.value;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(originalImage, 0, 0);
    });

    downloadBtn.addEventListener('click', () => {
      if (!originalImage) return;
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'with-bg.png'; a.click();
        URL.revokeObjectURL(url);
      });
    });
  });
`);

// 2. 图片多尺寸生成
generateToolPage('image-multi-size.astro', '图片多尺寸生成', '一次性生成多种尺寸的图片', `
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
    <label class="form-label">预设尺寸</label>
    <div class="checkbox-group">
      <label><input type="checkbox" class="size-check" value="1920x1080"> 1920x1080 (Full HD)</label>
      <label><input type="checkbox" class="size-check" value="1280x720" checked> 1280x720 (HD)</label>
      <label><input type="checkbox" class="size-check" value="800x600" checked> 800x600</label>
      <label><input type="checkbox" class="size-check" value="640x480" checked> 640x480</label>
      <label><input type="checkbox" class="size-check" value="320x240"> 320x240</label>
      <label><input type="checkbox" class="size-check" value="200x200" checked> 200x200 (Square)</label>
      <label><input type="checkbox" class="size-check" value="100x100"> 100x100 (Thumbnail)</label>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">自定义尺寸（宽x高，每行一个）</label>
    <textarea id="custom-sizes" class="form-textarea" placeholder="500x300\n400x400" style="min-height:60px;"></textarea>
  </div>
  <div class="btn-group">
    <button id="generate-btn" class="btn btn-primary">生成</button>
    <button id="download-all-btn" class="btn btn-secondary">下载全部</button>
  </div>
  <div id="preview-grid" class="image-grid"></div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const generateBtn = document.getElementById('generate-btn');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const previewGrid = document.getElementById('preview-grid');
    let originalImage = null;
    let generatedCanvases = [];

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

    generateBtn.addEventListener('click', () => {
      if (!originalImage) return;
      previewGrid.innerHTML = '';
      generatedCanvases = [];

      const sizes = [];
      document.querySelectorAll('.size-check:checked').forEach(c => {
        const [w, h] = c.value.split('x').map(Number);
        sizes.push({ w, h, label: c.value });
      });

      const customText = document.getElementById('custom-sizes').value.trim();
      if (customText) {
        customText.split('\\n').forEach(line => {
          const [w, h] = line.trim().split('x').map(Number);
          if (w && h) sizes.push({ w, h, label: line.trim() });
        });
      }

      sizes.forEach(size => {
        const canvas = document.createElement('canvas');
        canvas.width = size.w;
        canvas.height = size.h;
        const ctx = canvas.getContext('2d');

        const scale = Math.max(size.w / originalImage.width, size.h / originalImage.height);
        const x = (size.w - originalImage.width * scale) / 2;
        const y = (size.h - originalImage.height * scale) / 2;
        ctx.drawImage(originalImage, x, y, originalImage.width * scale, originalImage.height * scale);

        generatedCanvases.push({ canvas, label: size.label });

        const wrapper = document.createElement('div');
        wrapper.style.textAlign = 'center';
        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = Math.min(size.w, 150);
        previewCanvas.height = Math.min(size.h, 150);
        previewCanvas.getContext('2d').drawImage(canvas, 0, 0, previewCanvas.width, previewCanvas.height);
        previewCanvas.style.border = '1px solid var(--border-primary)';
        previewCanvas.style.borderRadius = 'var(--radius-md)';
        wrapper.innerHTML = '<div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:var(--space-1);">' + size.label + '</div>';
        wrapper.prepend(previewCanvas);
        previewGrid.appendChild(wrapper);
      });
    });

    downloadAllBtn.addEventListener('click', () => {
      generatedCanvases.forEach(item => {
        item.canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'image-' + item.label.replace('x', '_') + '.png'; a.click();
          URL.revokeObjectURL(url);
        });
      });
    });
  });
`);

// 3. 图片转链接
generateToolPage('image-to-link.astro', '图片转Base64链接', '将图片转换为Base64 Data URL', `
  <label class="file-upload" id="drop-zone">
    <input type="file" id="image-input" accept="image/*">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary);margin-bottom:var(--space-3);">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span style="color:var(--text-secondary);font-size:var(--text-sm);">点击或拖拽上传图片</span>
  </label>
  <div class="btn-group">
    <button id="copy-btn" class="btn btn-secondary">复制Base64</button>
    <button id="copy-html-btn" class="btn btn-secondary">复制HTML img标签</button>
    <button id="copy-css-btn" class="btn btn-secondary">复制CSS background</button>
  </div>
  <div class="form-group">
    <label class="form-label">Base64 Data URL</label>
    <div id="result" class="result-area" style="max-height:200px;">等待上传...</div>
  </div>
  <div class="form-group">
    <label class="form-label">预览</label>
    <div id="preview" style="text-align:center;"></div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const result = document.getElementById('result');
    const preview = document.getElementById('preview');
    const copyBtn = document.getElementById('copy-btn');
    const copyHtmlBtn = document.getElementById('copy-html-btn');
    const copyCssBtn = document.getElementById('copy-css-btn');
    let dataUrl = '';

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        dataUrl = event.target.result;
        result.textContent = dataUrl;
        preview.innerHTML = '<img src="' + dataUrl + '" style="max-width:100%;max-height:300px;border-radius:var(--radius-lg);border:1px solid var(--border-primary);">';
      };
      reader.readAsDataURL(file);
    });

    copyBtn.addEventListener('click', () => {
      if (dataUrl) {
        navigator.clipboard.writeText(dataUrl).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });

    copyHtmlBtn.addEventListener('click', () => {
      if (dataUrl) {
        const html = '<img src="' + dataUrl + '" alt="image">';
        navigator.clipboard.writeText(html).then(() => {
          const orig = copyHtmlBtn.textContent; copyHtmlBtn.textContent = '已复制!';
          setTimeout(() => { copyHtmlBtn.textContent = orig; }, 1500);
        });
      }
    });

    copyCssBtn.addEventListener('click', () => {
      if (dataUrl) {
        const css = 'background-image: url("' + dataUrl + '");';
        navigator.clipboard.writeText(css).then(() => {
          const orig = copyCssBtn.textContent; copyCssBtn.textContent = '已复制!';
          setTimeout(() => { copyCssBtn.textContent = orig; }, 1500);
        });
      }
    });
  });
`);

// 4. 二维码解析
generateToolPage('qrcode-parse.astro', '二维码解析', '解析二维码图片内容', `
  <label class="file-upload" id="drop-zone">
    <input type="file" id="image-input" accept="image/*">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary);margin-bottom:var(--space-3);">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span style="color:var(--text-secondary);font-size:var(--text-sm);">点击或拖拽上传二维码图片</span>
  </label>
  <div class="preview-area">
    <canvas id="canvas" style="display:none;max-width:300px;"></canvas>
  </div>
  <div class="form-group">
    <label class="form-label">解析结果</label>
    <div id="result" class="result-area">等待上传...</div>
  </div>
  <div class="btn-group">
    <button id="copy-btn" class="btn btn-secondary">复制结果</button>
    <button id="open-btn" class="btn btn-primary" style="display:none;">打开链接</button>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const result = document.getElementById('result');
    const copyBtn = document.getElementById('copy-btn');
    const openBtn = document.getElementById('open-btn');

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
          decodeQR(canvas);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    function decodeQR(canvas) {
      result.textContent = '正在解析...\\n\\n注意：纯浏览器端二维码解析需要引入jsQR库。\\n当前版本仅显示图片信息。\\n\\n图片尺寸: ' + canvas.width + 'x' + canvas.height;
    }

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待上传...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });
`);

// 5. 二维码修复（简单版）
generateToolPage('qrcode-fix.astro', '二维码修复', '增强二维码对比度便于识别', `
  <label class="file-upload" id="drop-zone">
    <input type="file" id="image-input" accept="image/*">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary);margin-bottom:var(--space-3);">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span style="color:var(--text-secondary);font-size:var(--text-sm);">点击或拖拽上传模糊的二维码</span>
  </label>
  <div class="form-group">
    <label class="form-label">增强选项</label>
    <div class="checkbox-group">
      <label><input type="checkbox" id="sharpen" checked> 锐化</label>
      <label><input type="checkbox" id="contrast" checked> 增强对比度</label>
      <label><input type="checkbox" id="threshold"> 二值化</label>
      <label><input type="checkbox" id="upscale" checked> 放大2x</label>
    </div>
  </div>
  <div class="btn-group">
    <button id="fix-btn" class="btn btn-primary">修复</button>
    <button id="download-btn" class="btn btn-secondary">下载</button>
  </div>
  <div class="preview-area">
    <canvas id="canvas" style="display:none;max-width:400px;"></canvas>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const fixBtn = document.getElementById('fix-btn');
    const downloadBtn = document.getElementById('download-btn');
    let originalImage = null;

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

    fixBtn.addEventListener('click', () => {
      if (!originalImage) return;
      const upscale = document.getElementById('upscale').checked;
      const w = upscale ? originalImage.width * 2 : originalImage.width;
      const h = upscale ? originalImage.height * 2 : originalImage.height;

      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(originalImage, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      const doContrast = document.getElementById('contrast').checked;
      const doThreshold = document.getElementById('threshold').checked;

      for (let i = 0; i < data.length; i += 4) {
        if (doContrast) {
          const factor = 1.5;
          data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
          data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
          data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
        }
        if (doThreshold) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const val = avg > 128 ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = val;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    });

    downloadBtn.addEventListener('click', () => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'fixed-qr.png'; a.click();
        URL.revokeObjectURL(url);
      });
    });
  });
`);

// 6. GIF拆分
generateToolPage('gif-split.astro', 'GIF拆分', '将GIF动图拆分为单帧图片', `
  <label class="file-upload" id="drop-zone">
    <input type="file" id="gif-input" accept="image/gif">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary);margin-bottom:var(--space-3);">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span style="color:var(--text-secondary);font-size:var(--text-sm);">点击或拖拽上传GIF动图</span>
  </label>
  <div class="btn-group">
    <button id="split-btn" class="btn btn-primary">拆分帧</button>
    <button id="download-all-btn" class="btn btn-secondary">下载全部帧</button>
  </div>
  <div id="frames-grid" class="image-grid"></div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const gifInput = document.getElementById('gif-input');
    const splitBtn = document.getElementById('split-btn');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const framesGrid = document.getElementById('frames-grid');
    let frames = [];

    gifInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          framesGrid.innerHTML = '<div class="preview-area"><img src="' + event.target.result + '" style="max-width:300px;border-radius:var(--radius-lg);border:1px solid var(--border-primary);"></div><p style="text-align:center;color:var(--text-secondary);font-size:var(--text-sm);margin-top:var(--space-2);">GIF尺寸: ' + img.width + 'x' + img.height + '<br>点击"拆分帧"提取所有帧</p>';
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    splitBtn.addEventListener('click', () => {
      const file = gifInput.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          framesGrid.innerHTML = '';
          frames = [];

          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const wrapper = document.createElement('div');
          wrapper.style.textAlign = 'center';
          const preview = document.createElement('canvas');
          preview.width = Math.min(img.width, 150);
          preview.height = Math.min(img.height, 150);
          preview.getContext('2d').drawImage(canvas, 0, 0, preview.width, preview.height);
          preview.style.border = '1px solid var(--border-primary)';
          preview.style.borderRadius = 'var(--radius-md)';
          wrapper.innerHTML = '<div style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:var(--space-1);">帧 1</div>';
          wrapper.prepend(preview);
          framesGrid.appendChild(wrapper);
          frames.push(canvas);

          result.textContent = '注意：纯浏览器端GIF帧提取需要gif.js库。\\n当前显示GIF首帧。\\n\\n建议使用在线工具或桌面软件进行完整GIF拆分。';
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    downloadAllBtn.addEventListener('click', () => {
      frames.forEach((canvas, idx) => {
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'frame-' + (idx + 1) + '.png'; a.click();
          URL.revokeObjectURL(url);
        });
      });
    });
  });
`);

// 7. 图片拼接
generateToolPage('image-stitch.astro', '图片拼接', '将多张图片水平或垂直拼接', `
  <label class="file-upload" id="drop-zone">
    <input type="file" id="image-input" accept="image/*" multiple>
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-tertiary);margin-bottom:var(--space-3);">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    <span style="color:var(--text-secondary);font-size:var(--text-sm);">点击或拖拽上传多张图片（可多选）</span>
  </label>
  <div class="form-group">
    <label class="form-label">拼接方向</label>
    <div class="checkbox-group">
      <label><input type="radio" name="direction" value="horizontal" checked> 水平拼接</label>
      <label><input type="radio" name="direction" value="vertical"> 垂直拼接</label>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">间距（像素）</label>
    <input type="number" id="spacing" class="form-input" value="0" min="0" max="100">
  </div>
  <div class="form-group">
    <label class="form-label">背景颜色</label>
    <input type="color" id="bg-color" value="#ffffff">
  </div>
  <div class="btn-group">
    <button id="stitch-btn" class="btn btn-primary">拼接</button>
    <button id="download-btn" class="btn btn-secondary">下载</button>
  </div>
  <div class="preview-area">
    <canvas id="canvas" style="display:none;max-width:100%;"></canvas>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const stitchBtn = document.getElementById('stitch-btn');
    const downloadBtn = document.getElementById('download-btn');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let images = [];

    imageInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      images = [];
      let loaded = 0;

      files.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            images[idx] = img;
            loaded++;
            if (loaded === files.length) {
              canvas.style.display = 'none';
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    });

    stitchBtn.addEventListener('click', () => {
      if (images.length < 2) return;

      const direction = document.querySelector('input[name="direction"]:checked').value;
      const spacing = parseInt(document.getElementById('spacing').value) || 0;
      const bgColor = document.getElementById('bg-color').value;

      if (direction === 'horizontal') {
        const totalWidth = images.reduce((sum, img) => sum + img.width, 0) + spacing * (images.length - 1);
        const maxHeight = Math.max(...images.map(img => img.height));
        canvas.width = totalWidth;
        canvas.height = maxHeight;

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let x = 0;
        images.forEach(img => {
          ctx.drawImage(img, x, (maxHeight - img.height) / 2);
          x += img.width + spacing;
        });
      } else {
        const maxWidth = Math.max(...images.map(img => img.width));
        const totalHeight = images.reduce((sum, img) => sum + img.height, 0) + spacing * (images.length - 1);
        canvas.width = maxWidth;
        canvas.height = totalHeight;

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let y = 0;
        images.forEach(img => {
          ctx.drawImage(img, (maxWidth - img.width) / 2, y);
          y += img.height + spacing;
        });
      }

      canvas.style.display = 'block';
    });

    downloadBtn.addEventListener('click', () => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'stitched.png'; a.click();
        URL.revokeObjectURL(url);
      });
    });
  });
`);

console.log('\n✅ 第九批工具生成完成');
console.log('Done!');
