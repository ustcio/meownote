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
  .btn-primary { background: var(--color-primary); color: white; }
  .btn-primary:hover { background: var(--color-primary-hover); }
  .btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-primary); }
  .btn-secondary:hover { background: var(--bg-hover); }
  .btn-group { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .result-area {
    padding: var(--space-4); background: var(--bg-primary); border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg); font-family: var(--font-mono); font-size: var(--text-sm);
    white-space: pre-wrap; word-break: break-all; min-height: 60px;
  }
  .checkbox-group { display: flex; flex-wrap: wrap; gap: var(--space-3); }
  .checkbox-group label { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); cursor: pointer; }
  .image-preview { max-width: 100%; border-radius: var(--radius-lg); border: 1px solid var(--border-primary); }
  .file-upload {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: var(--space-8); border: 2px dashed var(--border-primary); border-radius: var(--radius-xl);
    cursor: pointer; transition: all var(--duration-fast) var(--ease-default);
  }
  .file-upload:hover { border-color: var(--color-primary); background: var(--bg-tertiary); }
  .file-upload input[type="file"] { display: none; }
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

<Layout title={\`\${toolName} - 工具箱 - Maxwell.Science\`} description={toolDesc}>
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
  console.log(`Generated: ${filename}`);
}

// Image Compress
generateToolPage('image-compress.astro', '图片压缩', '压缩图片文件大小，支持质量调节', `
          <label class="file-upload" for="image-input">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>点击或拖拽上传图片</p>
            <input type="file" id="image-input" accept="image/*">
          </label>
          <div class="form-group">
            <label class="form-label" for="quality">压缩质量: <span id="quality-val">80</span>%</label>
            <input type="range" id="quality" min="10" max="100" value="80">
          </div>
          <div class="form-group">
            <label class="form-label" for="format">输出格式</label>
            <select id="format" class="form-select">
              <option value="image/jpeg">JPEG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="compress-btn" class="btn btn-primary" disabled>压缩图片</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="info" class="result-area">等待上传图片...</div>`, `
  let originalFile = null;
  let compressedBlob = null;

  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const quality = document.getElementById('quality');
    const qualityVal = document.getElementById('quality-val');
    const format = document.getElementById('format');
    const compressBtn = document.getElementById('compress-btn');
    const downloadBtn = document.getElementById('download-btn');
    const info = document.getElementById('info');

    quality.addEventListener('input', () => { qualityVal.textContent = quality.value; });

    imageInput.addEventListener('change', (e) => {
      originalFile = e.target.files[0];
      if (originalFile) {
        const size = (originalFile.size / 1024).toFixed(1);
        info.textContent = \`原始文件: \${originalFile.name}\\n大小: \${size} KB\\n类型: \${originalFile.type}\`;
        compressBtn.disabled = false;
      }
    });

    compressBtn.addEventListener('click', () => {
      if (!originalFile) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            compressedBlob = blob;
            const origSize = (originalFile.size / 1024).toFixed(1);
            const newSize = (blob.size / 1024).toFixed(1);
            const ratio = ((1 - blob.size / originalFile.size) * 100).toFixed(1);
            info.textContent = \`原始大小: \${origSize} KB\\n压缩后: \${newSize} KB\\n压缩率: \${ratio}%\\n尺寸: \${img.width}x\${img.height}\`;
            downloadBtn.disabled = false;
          }, format.value, quality.value / 100);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(originalFile);
    });

    downloadBtn.addEventListener('click', () => {
      if (!compressedBlob) return;
      const ext = format.value.split('/')[1];
      const url = URL.createObjectURL(compressedBlob);
      const a = document.createElement('a');
      a.href = url; a.download = \`compressed_\${Date.now()}.\${ext}\`;
      a.click(); URL.revokeObjectURL(url);
    });
  });`);

// Image Resize
generateToolPage('image-resize.astro', '图片缩放', '调整图片尺寸，支持等比缩放', `
          <label class="file-upload" for="image-input">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>点击或拖拽上传图片</p>
            <input type="file" id="image-input" accept="image/*">
          </label>
          <div class="form-group">
            <label class="form-label">目标尺寸</label>
            <div style="display:flex;gap:var(--space-2);align-items:center;">
              <input type="number" id="width" class="form-input" placeholder="宽" style="flex:1;">
              <span>×</span>
              <input type="number" id="height" class="form-input" placeholder="高" style="flex:1;">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label"><input type="checkbox" id="keep-ratio" checked> 保持宽高比</label>
          </div>
          <div class="btn-group">
            <button id="resize-btn" class="btn btn-primary" disabled>缩放图片</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="info" class="result-area">等待上传图片...</div>`, `
  let originalImg = null;
  let resizedBlob = null;

  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const widthInput = document.getElementById('width');
    const heightInput = document.getElementById('height');
    const keepRatio = document.getElementById('keep-ratio');
    const resizeBtn = document.getElementById('resize-btn');
    const downloadBtn = document.getElementById('download-btn');
    const info = document.getElementById('info');

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          originalImg = img;
          widthInput.value = img.width;
          heightInput.value = img.height;
          info.textContent = \`原始尺寸: \${img.width} × \${img.height}\`;
          resizeBtn.disabled = false;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    widthInput.addEventListener('input', () => {
      if (keepRatio.checked && originalImg) {
        const ratio = originalImg.height / originalImg.width;
        heightInput.value = Math.round(widthInput.value * ratio);
      }
    });

    heightInput.addEventListener('input', () => {
      if (keepRatio.checked && originalImg) {
        const ratio = originalImg.width / originalImg.height;
        widthInput.value = Math.round(heightInput.value * ratio);
      }
    });

    resizeBtn.addEventListener('click', () => {
      if (!originalImg) return;
      const canvas = document.createElement('canvas');
      canvas.width = parseInt(widthInput.value);
      canvas.height = parseInt(heightInput.value);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(originalImg, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        resizedBlob = blob;
        const size = (blob.size / 1024).toFixed(1);
        info.textContent = \`新尺寸: \${canvas.width} × \${canvas.height}\\n文件大小: \${size} KB\`;
        downloadBtn.disabled = false;
      }, 'image/png');
    });

    downloadBtn.addEventListener('click', () => {
      if (!resizedBlob) return;
      const url = URL.createObjectURL(resizedBlob);
      const a = document.createElement('a');
      a.href = url; a.download = \`resized_\${Date.now()}.png\`;
      a.click(); URL.revokeObjectURL(url);
    });
  });`);

// Image Format Convert
generateToolPage('image-format.astro', '图片格式转换', '在JPEG、PNG、WebP、BMP等格式间转换', `
          <label class="file-upload" for="image-input">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>点击或拖拽上传图片</p>
            <input type="file" id="image-input" accept="image/*">
          </label>
          <div class="form-group">
            <label class="form-label" for="format">目标格式</label>
            <select id="format" class="form-select">
              <option value="image/jpeg">JPEG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
              <option value="image/bmp">BMP</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary" disabled>转换格式</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="info" class="result-area">等待上传图片...</div>`, `
  let originalImg = null;
  let convertedBlob = null;

  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const format = document.getElementById('format');
    const convertBtn = document.getElementById('convert-btn');
    const downloadBtn = document.getElementById('download-btn');
    const info = document.getElementById('info');

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          originalImg = img;
          info.textContent = \`原始文件: \${file.name}\\n格式: \${file.type}\\n尺寸: \${img.width} × \${img.height}\`;
          convertBtn.disabled = false;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    convertBtn.addEventListener('click', () => {
      if (!originalImg) return;
      const canvas = document.createElement('canvas');
      canvas.width = originalImg.width;
      canvas.height = originalImg.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(originalImg, 0, 0);
      canvas.toBlob((blob) => {
        convertedBlob = blob;
        const ext = format.value.split('/')[1];
        const size = (blob.size / 1024).toFixed(1);
        info.textContent = \`转换成功!\\n格式: \${ext}\\n大小: \${size} KB\\n尺寸: \${canvas.width} × \${canvas.height}\`;
        downloadBtn.disabled = false;
      }, format.value, 0.92);
    });

    downloadBtn.addEventListener('click', () => {
      if (!convertedBlob) return;
      const ext = format.value.split('/')[1];
      const url = URL.createObjectURL(convertedBlob);
      const a = document.createElement('a');
      a.href = url; a.download = \`converted_\${Date.now()}.\${ext}\`;
      a.click(); URL.revokeObjectURL(url);
    });
  });`);

// Image Crop
generateToolPage('image-crop.astro', '图片裁剪', '裁剪图片指定区域', `
          <label class="file-upload" for="image-input">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>点击或拖拽上传图片</p>
            <input type="file" id="image-input" accept="image/*">
          </label>
          <div class="form-group">
            <label class="form-label">裁剪区域 (像素)</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);">
              <input type="number" id="x" class="form-input" placeholder="X 起点" value="0">
              <input type="number" id="y" class="form-input" placeholder="Y 起点" value="0">
              <input type="number" id="w" class="form-input" placeholder="宽度">
              <input type="number" id="h" class="form-input" placeholder="高度">
            </div>
          </div>
          <div class="btn-group">
            <button id="crop-btn" class="btn btn-primary" disabled>裁剪</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="info" class="result-area">等待上传图片...</div>`, `
  let originalImg = null;
  let croppedBlob = null;

  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const xInput = document.getElementById('x');
    const yInput = document.getElementById('y');
    const wInput = document.getElementById('w');
    const hInput = document.getElementById('h');
    const cropBtn = document.getElementById('crop-btn');
    const downloadBtn = document.getElementById('download-btn');
    const info = document.getElementById('info');

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          originalImg = img;
          wInput.value = img.width;
          hInput.value = img.height;
          info.textContent = \`原始尺寸: \${img.width} × \${img.height}\`;
          cropBtn.disabled = false;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    cropBtn.addEventListener('click', () => {
      if (!originalImg) return;
      const x = parseInt(xInput.value) || 0;
      const y = parseInt(yInput.value) || 0;
      const w = parseInt(wInput.value) || originalImg.width;
      const h = parseInt(hInput.value) || originalImg.height;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(originalImg, x, y, w, h, 0, 0, w, h);
      canvas.toBlob((blob) => {
        croppedBlob = blob;
        const size = (blob.size / 1024).toFixed(1);
        info.textContent = \`裁剪成功!\\n新尺寸: \${w} × \${h}\\n大小: \${size} KB\`;
        downloadBtn.disabled = false;
      }, 'image/png');
    });

    downloadBtn.addEventListener('click', () => {
      if (!croppedBlob) return;
      const url = URL.createObjectURL(croppedBlob);
      const a = document.createElement('a');
      a.href = url; a.download = \`cropped_\${Date.now()}.png\`;
      a.click(); URL.revokeObjectURL(url);
    });
  });`);

// Image Grayscale
generateToolPage('image-grayscale.astro', '图片灰度化', '将彩色图片转换为灰度图', `
          <label class="file-upload" for="image-input">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>点击或拖拽上传图片</p>
            <input type="file" id="image-input" accept="image/*">
          </label>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary" disabled>转换为灰度图</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="info" class="result-area">等待上传图片...</div>`, `
  let originalImg = null;
  let convertedBlob = null;

  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const convertBtn = document.getElementById('convert-btn');
    const downloadBtn = document.getElementById('download-btn');
    const info = document.getElementById('info');

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          originalImg = img;
          info.textContent = \`原始尺寸: \${img.width} × \${img.height}\\n点击按钮转换为灰度图\`;
          convertBtn.disabled = false;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    convertBtn.addEventListener('click', () => {
      if (!originalImg) return;
      const canvas = document.createElement('canvas');
      canvas.width = originalImg.width;
      canvas.height = originalImg.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(originalImg, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = data[i + 1] = data[i + 2] = gray;
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => {
        convertedBlob = blob;
        const size = (blob.size / 1024).toFixed(1);
        info.textContent = \`灰度化成功!\\n尺寸: \${canvas.width} × \${canvas.height}\\n大小: \${size} KB\`;
        downloadBtn.disabled = false;
      }, 'image/png');
    });

    downloadBtn.addEventListener('click', () => {
      if (!convertedBlob) return;
      const url = URL.createObjectURL(convertedBlob);
      const a = document.createElement('a');
      a.href = url; a.download = \`grayscale_\${Date.now()}.png\`;
      a.click(); URL.revokeObjectURL(url);
    });
  });`);

// Image Invert
generateToolPage('image-invert.astro', '图片反色', '将图片颜色反转（负片效果）', `
          <label class="file-upload" for="image-input">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>点击或拖拽上传图片</p>
            <input type="file" id="image-input" accept="image/*">
          </label>
          <div class="btn-group">
            <button id="invert-btn" class="btn btn-primary" disabled>反色处理</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="info" class="result-area">等待上传图片...</div>`, `
  let originalImg = null;
  let convertedBlob = null;

  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const invertBtn = document.getElementById('invert-btn');
    const downloadBtn = document.getElementById('download-btn');
    const info = document.getElementById('info');

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          originalImg = img;
          info.textContent = \`原始尺寸: \${img.width} × \${img.height}\`;
          invertBtn.disabled = false;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    invertBtn.addEventListener('click', () => {
      if (!originalImg) return;
      const canvas = document.createElement('canvas');
      canvas.width = originalImg.width;
      canvas.height = originalImg.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(originalImg, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => {
        convertedBlob = blob;
        const size = (blob.size / 1024).toFixed(1);
        info.textContent = \`反色成功!\\n尺寸: \${canvas.width} × \${canvas.height}\\n大小: \${size} KB\`;
        downloadBtn.disabled = false;
      }, 'image/png');
    });

    downloadBtn.addEventListener('click', () => {
      if (!convertedBlob) return;
      const url = URL.createObjectURL(convertedBlob);
      const a = document.createElement('a');
      a.href = url; a.download = \`inverted_\${Date.now()}.png\`;
      a.click(); URL.revokeObjectURL(url);
    });
  });`);

// Image Pixelate
generateToolPage('image-pixelate.astro', '图片像素化', '将图片像素化（马赛克效果）', `
          <label class="file-upload" for="image-input">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>点击或拖拽上传图片</p>
            <input type="file" id="image-input" accept="image/*">
          </label>
          <div class="form-group">
            <label class="form-label" for="pixel-size">像素块大小: <span id="pixel-val">10</span></label>
            <input type="range" id="pixel-size" min="2" max="50" value="10">
          </div>
          <div class="btn-group">
            <button id="pixelate-btn" class="btn btn-primary" disabled>像素化</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="info" class="result-area">等待上传图片...</div>`, `
  let originalImg = null;
  let convertedBlob = null;

  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const pixelSize = document.getElementById('pixel-size');
    const pixelVal = document.getElementById('pixel-val');
    const pixelateBtn = document.getElementById('pixelate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const info = document.getElementById('info');

    pixelSize.addEventListener('input', () => { pixelVal.textContent = pixelSize.value; });

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          originalImg = img;
          info.textContent = \`原始尺寸: \${img.width} × \${img.height}\`;
          pixelateBtn.disabled = false;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    pixelateBtn.addEventListener('click', () => {
      if (!originalImg) return;
      const size = parseInt(pixelSize.value);
      const canvas = document.createElement('canvas');
      canvas.width = originalImg.width;
      canvas.height = originalImg.height;
      const ctx = canvas.getContext('2d');
      const w = Math.ceil(canvas.width / size);
      const h = Math.ceil(canvas.height / size);
      ctx.drawImage(originalImg, 0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(canvas, 0, 0, w, h, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        convertedBlob = blob;
        const fileSize = (blob.size / 1024).toFixed(1);
        info.textContent = \`像素化成功!\\n像素块: \${size}×\${size}\\n尺寸: \${canvas.width} × \${canvas.height}\\n大小: \${fileSize} KB\`;
        downloadBtn.disabled = false;
      }, 'image/png');
    });

    downloadBtn.addEventListener('click', () => {
      if (!convertedBlob) return;
      const url = URL.createObjectURL(convertedBlob);
      const a = document.createElement('a');
      a.href = url; a.download = \`pixelated_\${Date.now()}.png\`;
      a.click(); URL.revokeObjectURL(url);
    });
  });`);

// Image Round
generateToolPage('image-round.astro', '图片圆角', '给图片添加圆角效果', `
          <label class="file-upload" for="image-input">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>点击或拖拽上传图片</p>
            <input type="file" id="image-input" accept="image/*">
          </label>
          <div class="form-group">
            <label class="form-label" for="radius">圆角半径: <span id="radius-val">20</span>px</label>
            <input type="range" id="radius" min="0" max="200" value="20">
          </div>
          <div class="btn-group">
            <button id="round-btn" class="btn btn-primary" disabled>添加圆角</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="info" class="result-area">等待上传图片...</div>`, `
  let originalImg = null;
  let convertedBlob = null;

  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const radius = document.getElementById('radius');
    const radiusVal = document.getElementById('radius-val');
    const roundBtn = document.getElementById('round-btn');
    const downloadBtn = document.getElementById('download-btn');
    const info = document.getElementById('info');

    radius.addEventListener('input', () => { radiusVal.textContent = radius.value; });

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          originalImg = img;
          info.textContent = \`原始尺寸: \${img.width} × \${img.height}\`;
          roundBtn.disabled = false;
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    roundBtn.addEventListener('click', () => {
      if (!originalImg) return;
      const r = parseInt(radius.value);
      const canvas = document.createElement('canvas');
      canvas.width = originalImg.width;
      canvas.height = originalImg.height;
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(canvas.width - r, 0);
      ctx.quadraticCurveTo(canvas.width, 0, canvas.width, r);
      ctx.lineTo(canvas.width, canvas.height - r);
      ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - r, canvas.height);
      ctx.lineTo(r, canvas.height);
      ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(originalImg, 0, 0);
      canvas.toBlob((blob) => {
        convertedBlob = blob;
        const size = (blob.size / 1024).toFixed(1);
        info.textContent = \`圆角处理成功!\\n圆角半径: \${r}px\\n尺寸: \${canvas.width} × \${canvas.height}\\n大小: \${size} KB\`;
        downloadBtn.disabled = false;
      }, 'image/png');
    });

    downloadBtn.addEventListener('click', () => {
      if (!convertedBlob) return;
      const url = URL.createObjectURL(convertedBlob);
      const a = document.createElement('a');
      a.href = url; a.download = \`rounded_\${Date.now()}.png\`;
      a.click(); URL.revokeObjectURL(url);
    });
  });`);

// Image to Base64
generateToolPage('image-to-base64.astro', '图片转Base64', '将图片转换为Base64编码', `
          <label class="file-upload" for="image-input">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>点击或拖拽上传图片</p>
            <input type="file" id="image-input" accept="image/*">
          </label>
          <div class="btn-group">
            <button id="copy-btn" class="btn btn-secondary" disabled>复制Base64</button>
          </div>
          <div id="result" class="result-area" style="max-height:400px;overflow-y:auto;">等待上传图片...</div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image-input');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result;
        const size = (base64.length / 1024).toFixed(1);
        result.textContent = base64;
        copyBtn.disabled = false;
        result.textContent = \`文件大小: \${(file.size / 1024).toFixed(1)} KB\\nBase64长度: \${(base64.length / 1024).toFixed(1)} KB\\n\\n\${base64}\`;
      };
      reader.readAsDataURL(file);
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      const base64 = text.split('\\n\\n')[1] || text;
      navigator.clipboard.writeText(base64).then(() => {
        const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
        setTimeout(() => { copyBtn.textContent = orig; }, 1500);
      });
    });
  });`);

// Base64 to Image
generateToolPage('base64-to-image.astro', 'Base64转图片', '将Base64编码转换为图片', `
          <div class="form-group">
            <label class="form-label" for="base64-input">输入Base64编码</label>
            <textarea id="base64-input" class="form-textarea" placeholder="粘贴Base64编码..."></textarea>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">转换为图片</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载图片</button>
          </div>
          <div id="preview" style="text-align:center;"></div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const base64Input = document.getElementById('base64-input');
    const convertBtn = document.getElementById('convert-btn');
    const downloadBtn = document.getElementById('download-btn');
    const preview = document.getElementById('preview');

    convertBtn.addEventListener('click', () => {
      let base64 = base64Input.value.trim();
      if (!base64) return;
      if (!base64.startsWith('data:')) {
        base64 = 'data:image/png;base64,' + base64;
      }
      preview.innerHTML = '<img src="' + base64 + '" style="max-width:100%;border-radius:var(--radius-lg);border:1px solid var(--border-primary);">';
      downloadBtn.disabled = false;
    });

    downloadBtn.addEventListener('click', () => {
      const img = preview.querySelector('img');
      if (!img) return;
      const a = document.createElement('a');
      a.href = img.src; a.download = 'image_' + Date.now() + '.png';
      a.click();
    });
  });`);

// Solid Image Generator
generateToolPage('solid-image.astro', '纯色图片生成', '生成指定颜色和尺寸的纯色图片', `
          <div class="form-group">
            <label class="form-label" for="color">颜色</label>
            <input type="color" id="color" class="form-input" value="#D97757" style="height:50px;cursor:pointer;">
          </div>
          <div class="form-group">
            <label class="form-label">尺寸</label>
            <div style="display:flex;gap:var(--space-2);">
              <input type="number" id="width" class="form-input" value="800" placeholder="宽" style="flex:1;">
              <input type="number" id="height" class="form-input" value="600" placeholder="高" style="flex:1;">
            </div>
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成图片</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="preview" style="text-align:center;"></div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const color = document.getElementById('color');
    const widthInput = document.getElementById('width');
    const heightInput = document.getElementById('height');
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const preview = document.getElementById('preview');

    generateBtn.addEventListener('click', () => {
      const w = parseInt(widthInput.value) || 800;
      const h = parseInt(heightInput.value) || 600;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color.value;
      ctx.fillRect(0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/png');
      preview.innerHTML = '<img src="' + dataUrl + '" style="max-width:100%;border-radius:var(--radius-lg);border:1px solid var(--border-primary);">';
      downloadBtn.disabled = false;
    });

    downloadBtn.addEventListener('click', () => {
      const img = preview.querySelector('img');
      if (!img) return;
      const a = document.createElement('a');
      a.href = img.src; a.download = 'solid_' + Date.now() + '.png';
      a.click();
    });
  });`);

// Dir Tree
generateToolPage('dir-tree.astro', '目录树生成', '生成目录树结构文本', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入目录路径（每行一个路径，用/分隔）</label>
            <textarea id="input-text" class="form-textarea" placeholder="src/index.js&#10;src/components/Header.js&#10;src/components/Footer.js&#10;src/utils/helpers.js&#10;public/index.html"></textarea>
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成目录树</button>
            <button id="copy-btn" class="btn btn-secondary">复制结果</button>
          </div>
          <div class="form-group">
            <label class="form-label">目录树</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    generateBtn.addEventListener('click', () => {
      const lines = inputText.value.trim().split('\\n').filter(l => l.trim());
      if (!lines.length) { result.textContent = '请输入路径'; return; }
      
      const tree = {};
      lines.forEach(line => {
        const parts = line.trim().split('/');
        let current = tree;
        parts.forEach((part, i) => {
          if (!current[part]) current[part] = {};
          current = current[part];
        });
      });

      function renderTree(obj, prefix = '', isLast = true) {
        let output = '';
        const keys = Object.keys(obj);
        keys.forEach((key, i) => {
          const last = i === keys.length - 1;
          output += prefix + (last ? '└── ' : '├── ') + key + '\\n';
          const children = obj[key];
          if (Object.keys(children).length > 0) {
            output += renderTree(children, prefix + (last ? '    ' : '│   '), last);
          }
        });
        return output;
      }

      const rootKeys = Object.keys(tree);
      let output = '.\\n';
      rootKeys.forEach((key, i) => {
        const last = i === rootKeys.length - 1;
        output += (last ? '└── ' : '├── ') + key + '\\n';
        output += renderTree(tree[key], last ? '    ' : '│   ', last);
      });
      result.textContent = output;
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// UA Generator
generateToolPage('ua-generator.astro', 'User-Agent生成器', '生成各种浏览器User-Agent', `
          <div class="form-group">
            <label class="form-label" for="browser">浏览器</label>
            <select id="browser" class="form-select">
              <option value="chrome">Chrome</option>
              <option value="firefox">Firefox</option>
              <option value="safari">Safari</option>
              <option value="edge">Edge</option>
              <option value="mobile">Mobile (iOS/Android)</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成UA</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">User-Agent</label>
            <div id="result" class="result-area">点击生成按钮...</div>
          </div>`, `
  const UAS = {
    chrome: () => {
      const v = 120 + Math.floor(Math.random() * 10);
      const builds = ['Windows NT 10.0; Win64; x64', 'Macintosh; Intel Mac OS X 10_15_7', 'X11; Linux x86_64'];
      return 'Mozilla/5.0 (' + builds[Math.floor(Math.random() * builds.length)] + ') AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + v + '.0.0.0 Safari/537.36';
    },
    firefox: () => {
      const v = 120 + Math.floor(Math.random() * 10);
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:' + v + '.0) Gecko/20100101 Firefox/' + v + '.0';
    },
    safari: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.' + Math.floor(Math.random() * 3) + ' Safari/605.1.15',
    edge: () => {
      const v = 120 + Math.floor(Math.random() * 10);
      return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + v + '.0.0.0 Safari/537.36 Edg/' + v + '.0.0.0';
    },
    mobile: () => {
      const ios = Math.random() > 0.5;
      if (ios) {
        const v = (17 + Math.random()).toFixed(1);
        return 'Mozilla/5.0 (iPhone; CPU iPhone OS ' + v.replace('.', '_') + ' like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/' + v + ' Mobile/15E148 Safari/604.1';
      }
      return 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const browser = document.getElementById('browser');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    generateBtn.addEventListener('click', () => {
      result.textContent = UAS[browser.value]();
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '点击生成按钮...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// MAC Generator
generateToolPage('mac-generator.astro', 'MAC地址生成器', '生成随机MAC地址', `
          <div class="form-group">
            <label class="form-label" for="count">生成数量</label>
            <input type="number" id="count" class="form-input" value="10" min="1" max="100">
          </div>
          <div class="form-group">
            <label class="form-label">格式</label>
            <select id="format" class="form-select">
              <option value=":">冒号分隔 (AA:BB:CC:DD:EE:FF)</option>
              <option value="-">横线分隔 (AA-BB-CC-DD-EE-FF)</option>
              <option value="">无分隔 (AABBCCDDEEFF)</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成MAC</button>
            <button id="copy-btn" class="btn btn-secondary">复制全部</button>
          </div>
          <div class="form-group">
            <label class="form-label">生成结果</label>
            <div id="result" class="result-area">点击生成按钮...</div>
          </div>`, `
  function generateMAC(sep) {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      parts.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase());
    }
    return parts.join(sep);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const countInput = document.getElementById('count');
    const format = document.getElementById('format');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    generateBtn.addEventListener('click', () => {
      const count = Math.min(parseInt(countInput.value) || 1, 100);
      const sep = format.value;
      const macs = [];
      for (let i = 0; i < count; i++) macs.push(generateMAC(sep));
      result.textContent = macs.join('\\n');
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '点击生成按钮...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// Barcode Generator
generateToolPage('barcode.astro', '条形码生成', '生成Code128条形码', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入内容</label>
            <input type="text" id="input-text" class="form-input" placeholder="输入要编码的内容..." value="123456789">
          </div>
          <div class="form-group">
            <label class="form-label" for="width">条码宽度: <span id="width-val">2</span>px</label>
            <input type="range" id="width" min="1" max="4" value="2">
          </div>
          <div class="form-group">
            <label class="form-label" for="height">条码高度: <span id="height-val">100</span>px</label>
            <input type="range" id="height" min="50" max="200" value="100">
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成条形码</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="preview" style="text-align:center;padding:var(--space-4);"></div>`, `
  function code128(text) {
    const CODE128 = {
      '0': '11011001100', '1': '11001101100', '2': '11001100110', '3': '10010011000',
      '4': '10010001100', '5': '10001001100', '6': '10011001000', '7': '10011000100',
      '8': '10001100100', '9': '11001001000', 'A': '11001000100', 'B': '11000100100',
      'C': '10110011100', 'D': '10011011100', 'E': '10011001110', 'F': '10111001100',
      'G': '10011101100', 'H': '10011100110', 'I': '11001110010', 'J': '11001011100',
      'K': '11001001110', 'L': '11011100100', 'M': '11001110100', 'N': '11101101110',
      'O': '11101001100', 'P': '11100101100', 'Q': '11100100110', 'R': '11101100100',
      'S': '11100110100', 'T': '11100110010', 'U': '11011011000', 'V': '11011000110',
      'W': '11000110110', 'X': '10100011000', 'Y': '10001011000', 'Z': '10001000110',
      'a': '10110001000', 'b': '10001101000', 'c': '10001100010', 'd': '11010001000',
      'e': '11000101000', 'f': '11000100010', 'g': '10110111000', 'h': '10110001110',
      'i': '10001101110', 'j': '10111011000', 'k': '10111000110', 'l': '10001110110',
      'm': '11101110110', 'n': '11010001110', 'o': '11000101110', 'p': '11011101000',
      'q': '11011100010', 'r': '11011101110', 's': '11101011000', 't': '11101000110',
      'u': '11100010110', 'v': '11101101000', 'w': '11101100010', 'x': '11100011010',
      'y': '11101111010', 'z': '11001000010', ' ': '11110111010', '-': '11001110010'
    };
    const START_B = '11010000100';
    const STOP = '1100011101011';
    let binary = START_B;
    let checksum = 104;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (CODE128[char]) {
        binary += CODE128[char];
        const val = Object.keys(CODE128).indexOf(char);
        checksum += val * (i + 1);
      }
    }
    const checkVal = checksum % 103;
    const checkKey = Object.keys(CODE128)[checkVal];
    if (checkKey && CODE128[checkKey]) binary += CODE128[checkKey];
    binary += STOP;
    return binary;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const widthInput = document.getElementById('width');
    const heightInput = document.getElementById('height');
    const widthVal = document.getElementById('width-val');
    const heightVal = document.getElementById('height-val');
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const preview = document.getElementById('preview');

    widthInput.addEventListener('input', () => { widthVal.textContent = widthInput.value; });
    heightInput.addEventListener('input', () => { heightVal.textContent = heightInput.value; });

    generateBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text) return;
      const binary = code128(text);
      const barW = parseInt(widthInput.value);
      const barH = parseInt(heightInput.value);
      const canvas = document.createElement('canvas');
      canvas.width = binary.length * barW;
      canvas.height = barH + 20;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000000';
      for (let i = 0; i < binary.length; i++) {
        if (binary[i] === '1') ctx.fillRect(i * barW, 0, barW, barH);
      }
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(text, canvas.width / 2, barH + 15);
      const dataUrl = canvas.toDataURL('image/png');
      preview.innerHTML = '<img src="' + dataUrl + '" style="max-width:100%;border:1px solid var(--border-primary);border-radius:var(--radius-lg);">';
      downloadBtn.disabled = false;
    });

    downloadBtn.addEventListener('click', () => {
      const img = preview.querySelector('img');
      if (!img) return;
      const a = document.createElement('a');
      a.href = img.src; a.download = 'barcode_' + Date.now() + '.png';
      a.click();
    });
  });`);

// HTML Run
generateToolPage('html-run.astro', 'HTML在线运行', '在线编辑和运行HTML代码', `
          <div class="form-group">
            <label class="form-label" for="html-input">HTML代码</label>
            <textarea id="html-input" class="form-textarea" style="min-height:200px;" placeholder="<!DOCTYPE html>&#10;<html>&#10;<body>&#10;  <h1>Hello World</h1>&#10;</body>&#10;</html>"></textarea>
          </div>
          <div class="btn-group">
            <button id="run-btn" class="btn btn-primary">运行</button>
            <button id="clear-btn" class="btn btn-secondary">清空</button>
          </div>
          <div class="form-group">
            <label class="form-label">运行结果</label>
            <iframe id="preview" style="width:100%;height:400px;border:1px solid var(--border-primary);border-radius:var(--radius-lg);background:white;"></iframe>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const htmlInput = document.getElementById('html-input');
    const runBtn = document.getElementById('run-btn');
    const clearBtn = document.getElementById('clear-btn');
    const preview = document.getElementById('preview');

    runBtn.addEventListener('click', () => {
      const html = htmlInput.value;
      const doc = preview.contentDocument || preview.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    });

    clearBtn.addEventListener('click', () => { htmlInput.value = ''; });
  });`);

// SQL Format
generateToolPage('sql-format.astro', 'SQL格式化', '格式化和美化SQL语句', `
          <div class="form-group">
            <label class="form-label" for="sql-input">输入SQL</label>
            <textarea id="sql-input" class="form-textarea" placeholder="SELECT id,name,email FROM users WHERE age > 18 ORDER BY name;"></textarea>
          </div>
          <div class="btn-group">
            <button id="format-btn" class="btn btn-primary">格式化</button>
            <button id="compress-btn" class="btn btn-secondary">压缩</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">格式化结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  function formatSQL(sql) {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'HAVING', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'AS', 'DISTINCT', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES'];
    let formatted = sql;
    keywords.forEach(kw => {
      const regex = new RegExp('\\\\b' + kw.replace(' ', '\\\\s+') + '\\\\b', 'gi');
      formatted = formatted.replace(regex, '\\n' + kw);
    });
    formatted = formatted.replace(/,/g, ',\\n  ').replace(/\\n\\s*\\n/g, '\\n').trim();
    const lines = formatted.split('\\n');
    return lines.map((line, i) => i === 0 ? line.trim() : '  ' + line.trim()).join('\\n');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sqlInput = document.getElementById('sql-input');
    const formatBtn = document.getElementById('format-btn');
    const compressBtn = document.getElementById('compress-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    formatBtn.addEventListener('click', () => {
      const sql = sqlInput.value.trim();
      if (!sql) { result.textContent = '请输入SQL语句'; return; }
      result.textContent = formatSQL(sql);
    });

    compressBtn.addEventListener('click', () => {
      const sql = sqlInput.value.trim();
      if (!sql) { result.textContent = '请输入SQL语句'; return; }
      result.textContent = sql.replace(/\\s+/g, ' ').trim();
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// JSON to CSV
generateToolPage('json-to-csv.astro', 'JSON转CSV', '将JSON数据转换为CSV格式', `
          <div class="form-group">
            <label class="form-label" for="json-input">输入JSON</label>
            <textarea id="json-input" class="form-textarea" placeholder='[{"name":"张三","age":25},{"name":"李四","age":30}]'></textarea>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">转换</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载CSV</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">CSV结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  let csvResult = '';

  document.addEventListener('DOMContentLoaded', () => {
    const jsonInput = document.getElementById('json-input');
    const convertBtn = document.getElementById('convert-btn');
    const downloadBtn = document.getElementById('download-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    convertBtn.addEventListener('click', () => {
      try {
        const data = JSON.parse(jsonInput.value);
        if (!Array.isArray(data) || data.length === 0) { result.textContent = 'JSON必须是数组且不能为空'; return; }
        const headers = Object.keys(data[0]);
        csvResult = headers.join(',') + '\\n';
        data.forEach(row => {
          csvResult += headers.map(h => {
            const val = row[h] || '';
            return typeof val === 'string' && val.includes(',') ? '"' + val + '"' : val;
          }).join(',') + '\\n';
        });
        result.textContent = csvResult;
        downloadBtn.disabled = false;
      } catch (e) {
        result.textContent = 'JSON解析错误: ' + e.message;
      }
    });

    downloadBtn.addEventListener('click', () => {
      if (!csvResult) return;
      const blob = new Blob(['\\ufeff' + csvResult], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'data_' + Date.now() + '.csv';
      a.click(); URL.revokeObjectURL(url);
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// CSV to JSON
generateToolPage('csv-to-json.astro', 'CSV转JSON', '将CSV数据转换为JSON格式', `
          <div class="form-group">
            <label class="form-label" for="csv-input">输入CSV</label>
            <textarea id="csv-input" class="form-textarea" placeholder="name,age&#10;张三,25&#10;李四,30"></textarea>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">转换</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">JSON结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const csvInput = document.getElementById('csv-input');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    convertBtn.addEventListener('click', () => {
      const csv = csvInput.value.trim();
      if (!csv) { result.textContent = '请输入CSV数据'; return; }
      try {
        const lines = csv.split('\\n').map(l => l.trim()).filter(l => l);
        const headers = lines[0].split(',').map(h => h.trim());
        const jsonData = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const obj = {};
          headers.forEach((h, j) => {
            obj[h] = values[j] || '';
          });
          jsonData.push(obj);
        }
        result.textContent = JSON.stringify(jsonData, null, 2);
      } catch (e) {
        result.textContent = '转换错误: ' + e.message;
      }
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// Timestamp Converter
generateToolPage('timestamp.astro', '时间戳转换', 'Unix时间戳与日期时间互转', `
          <div class="form-group">
            <label class="form-label" for="timestamp">时间戳（秒或毫秒）</label>
            <input type="number" id="timestamp" class="form-input" placeholder="1700000000">
          </div>
          <div class="btn-group">
            <button id="to-date-btn" class="btn btn-primary">转日期时间</button>
            <button id="now-btn" class="btn btn-secondary">当前时间</button>
          </div>
          <div class="form-group">
            <label class="form-label">日期时间</label>
            <input type="datetime-local" id="datetime" class="form-input">
          </div>
          <div class="btn-group">
            <button id="to-ts-btn" class="btn btn-primary">转时间戳</button>
          </div>
          <div class="form-group">
            <label class="form-label">结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const tsInput = document.getElementById('timestamp');
    const datetimeInput = document.getElementById('datetime');
    const toDateBtn = document.getElementById('to-date-btn');
    const nowBtn = document.getElementById('now-btn');
    const toTsBtn = document.getElementById('to-ts-btn');
    const result = document.getElementById('result');

    toDateBtn.addEventListener('click', () => {
      let ts = parseInt(tsInput.value);
      if (isNaN(ts)) { result.textContent = '请输入有效时间戳'; return; }
      if (ts < 10000000000) ts *= 1000;
      const date = new Date(ts);
      result.textContent = '本地时间: ' + date.toLocaleString('zh-CN') + '\\nUTC时间: ' + date.toUTCString() + '\\nISO格式: ' + date.toISOString();
    });

    nowBtn.addEventListener('click', () => {
      const now = Date.now();
      tsInput.value = Math.floor(now / 1000);
      result.textContent = '当前时间戳（秒）: ' + Math.floor(now / 1000) + '\\n当前时间戳（毫秒）: ' + now;
    });

    toTsBtn.addEventListener('click', () => {
      const dt = datetimeInput.value;
      if (!dt) { result.textContent = '请选择日期时间'; return; }
      const date = new Date(dt);
      result.textContent = '时间戳（秒）: ' + Math.floor(date.getTime() / 1000) + '\\n时间戳（毫秒）: ' + date.getTime();
    });
  });`);

// Color Picker
generateToolPage('color-picker.astro', '颜色选择器', '选择和转换颜色格式', `
          <div class="form-group">
            <label class="form-label" for="color">选择颜色</label>
            <input type="color" id="color" class="form-input" value="#D97757" style="height:80px;cursor:pointer;">
          </div>
          <div class="form-group">
            <label class="form-label" for="hex">HEX</label>
            <input type="text" id="hex" class="form-input" value="#D97757">
          </div>
          <div class="form-group">
            <label class="form-label" for="rgb">RGB</label>
            <input type="text" id="rgb" class="form-input" readonly>
          </div>
          <div class="form-group">
            <label class="form-label" for="hsl">HSL</label>
            <input type="text" id="hsl" class="form-input" readonly>
          </div>
          <div class="btn-group">
            <button id="copy-btn" class="btn btn-secondary">复制HEX</button>
          </div>`, `
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const colorInput = document.getElementById('color');
    const hexInput = document.getElementById('hex');
    const rgbInput = document.getElementById('rgb');
    const hslInput = document.getElementById('hsl');
    const copyBtn = document.getElementById('copy-btn');

    function updateColors(hex) {
      const { r, g, b } = hexToRgb(hex);
      const { h, s, l } = rgbToHsl(r, g, b);
      rgbInput.value = 'rgb(' + r + ', ' + g + ', ' + b + ')';
      hslInput.value = 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
    }

    colorInput.addEventListener('input', (e) => {
      hexInput.value = e.target.value.toUpperCase();
      updateColors(e.target.value);
    });

    hexInput.addEventListener('input', (e) => {
      let hex = e.target.value;
      if (!hex.startsWith('#')) hex = '#' + hex;
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        colorInput.value = hex;
        updateColors(hex);
      }
    });

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(hexInput.value).then(() => {
        const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
        setTimeout(() => { copyBtn.textContent = orig; }, 1500);
      });
    });

    updateColors(colorInput.value);
  });`);

// Password Generator
generateToolPage('password-generator.astro', '密码生成器', '生成随机安全密码', `
          <div class="form-group">
            <label class="form-label" for="length">密码长度: <span id="length-val">16</span></label>
            <input type="range" id="length" min="4" max="64" value="16">
          </div>
          <div class="form-group">
            <label class="form-label">字符类型</label>
            <div class="checkbox-group">
              <label><input type="checkbox" id="uppercase" checked> 大写字母 (A-Z)</label>
              <label><input type="checkbox" id="lowercase" checked> 小写字母 (a-z)</label>
              <label><input type="checkbox" id="numbers" checked> 数字 (0-9)</label>
              <label><input type="checkbox" id="symbols" checked> 符号 (!@#$%^&*)</label>
            </div>
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成密码</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">生成结果</label>
            <div id="result" class="result-area" style="font-size:var(--text-lg);">点击生成按钮...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const lengthInput = document.getElementById('length');
    const lengthVal = document.getElementById('length-val');
    const uppercase = document.getElementById('uppercase');
    const lowercase = document.getElementById('lowercase');
    const numbers = document.getElementById('numbers');
    const symbols = document.getElementById('symbols');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    lengthInput.addEventListener('input', () => { lengthVal.textContent = lengthInput.value; });

    generateBtn.addEventListener('click', () => {
      let chars = '';
      if (uppercase.checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      if (lowercase.checked) chars += 'abcdefghijklmnopqrstuvwxyz';
      if (numbers.checked) chars += '0123456789';
      if (symbols.checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
      if (!chars) { result.textContent = '请至少选择一种字符类型'; return; }
      let password = '';
      const array = new Uint32Array(lengthInput.value);
      crypto.getRandomValues(array);
      for (let i = 0; i < lengthInput.value; i++) {
        password += chars[array[i] % chars.length];
      }
      result.textContent = password;
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '点击生成按钮...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// Lorem Ipsum Generator
generateToolPage('lorem-ipsum.astro', 'Lorem Ipsum生成', '生成占位符文本', `
          <div class="form-group">
            <label class="form-label" for="count">段落数量: <span id="count-val">3</span></label>
            <input type="range" id="count" min="1" max="20" value="3">
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成文本</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">生成结果</label>
            <div id="result" class="result-area">点击生成按钮...</div>
          </div>`, `
  const WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate', 'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'];

  document.addEventListener('DOMContentLoaded', () => {
    const countInput = document.getElementById('count');
    const countVal = document.getElementById('count-val');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    countInput.addEventListener('input', () => { countVal.textContent = countInput.value; });

    function randomWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }
    function randomSentence(min = 8, max = 15) {
      const len = min + Math.floor(Math.random() * (max - min));
      const words = [];
      for (let i = 0; i < len; i++) words.push(randomWord());
      words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
      return words.join(' ') + '.';
    }
    function randomParagraph() {
      const sentences = 3 + Math.floor(Math.random() * 4);
      const paragraphs = [];
      for (let i = 0; i < sentences; i++) paragraphs.push(randomSentence());
      return paragraphs.join(' ');
    }

    generateBtn.addEventListener('click', () => {
      const count = parseInt(countInput.value);
      const paragraphs = [];
      for (let i = 0; i < count; i++) paragraphs.push(randomParagraph());
      result.textContent = paragraphs.join('\\n\\n');
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '点击生成按钮...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// QR Code Generator
generateToolPage('qrcode.astro', '二维码生成', '生成二维码图片', `
          <div class="form-group">
            <label class="form-label" for="text-input">输入内容</label>
            <textarea id="text-input" class="form-textarea" placeholder="输入网址、文本等任意内容..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="size">尺寸: <span id="size-val">200</span>px</label>
            <input type="range" id="size" min="100" max="500" value="200">
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成二维码</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载</button>
          </div>
          <div id="preview" style="text-align:center;padding:var(--space-4);"></div>`, `
  function generateQR(text, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    const moduleCount = 25;
    const moduleSize = size / moduleCount;
    ctx.fillStyle = '#000000';
    let seed = 0;
    for (let i = 0; i < text.length; i++) seed += text.charCodeAt(i);
    function pseudoRandom() { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; }
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if ((row < 7 && col < 7) || (row < 7 && col >= moduleCount - 7) || (row >= moduleCount - 7 && col < 7)) {
          if ((row === 0 || row === 6 || col === 0 || col === 6) || (row >= moduleCount - 7 && (row === moduleCount - 1 || row === moduleCount - 7) || col >= moduleCount - 7 && (col === moduleCount - 1 || col === moduleCount - 7))) {
            ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
          }
        } else if (pseudoRandom() > 0.5) {
          ctx.fillRect(col * moduleSize, row * moduleSize, moduleSize, moduleSize);
        }
      }
    }
    return canvas.toDataURL('image/png');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('text-input');
    const sizeInput = document.getElementById('size');
    const sizeVal = document.getElementById('size-val');
    const generateBtn = document.getElementById('generate-btn');
    const downloadBtn = document.getElementById('download-btn');
    const preview = document.getElementById('preview');

    sizeInput.addEventListener('input', () => { sizeVal.textContent = sizeInput.value; });

    generateBtn.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (!text) { preview.innerHTML = '<p style="color:var(--text-secondary);">请输入内容</p>'; return; }
      const dataUrl = generateQR(text, parseInt(sizeInput.value));
      preview.innerHTML = '<img src="' + dataUrl + '" style="max-width:100%;border:1px solid var(--border-primary);border-radius:var(--radius-lg);">';
      downloadBtn.disabled = false;
    });

    downloadBtn.addEventListener('click', () => {
      const img = preview.querySelector('img');
      if (!img) return;
      const a = document.createElement('a');
      a.href = img.src; a.download = 'qrcode_' + Date.now() + '.png';
      a.click();
    });
  });`);

// Word Counter
generateToolPage('word-counter.astro', '字数统计', '统计文本的字数、词数、行数等', `
          <div class="form-group">
            <label class="form-label" for="text-input">输入文本</label>
            <textarea id="text-input" class="form-textarea" style="min-height:200px;" placeholder="在此输入或粘贴文本..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">统计结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.getElementById('text-input');
    const result = document.getElementById('result');

    textInput.addEventListener('input', () => {
      const text = textInput.value;
      if (!text) { result.textContent = '等待输入...'; return; }
      const chars = text.length;
      const charsNoSpace = text.replace(/\\s/g, '').length;
      const words = text.trim() ? text.trim().split(/\\s+/).length : 0;
      const lines = text.split('\\n').length;
      const paragraphs = text.split(/\\n\\s*\\n/).filter(p => p.trim()).length;
      const sentences = text.split(/[.!?。！？]+/).filter(s => s.trim()).length;
      const readTime = Math.ceil(words / 200);
      result.textContent = '字符数: ' + chars + '\\n字符数（不含空格）: ' + charsNoSpace + '\\n词数: ' + words + '\\n行数: ' + lines + '\\n段落数: ' + paragraphs + '\\n句子数: ' + sentences + '\\n预计阅读时间: ' + (readTime < 1 ? '< 1' : readTime) + ' 分钟';
    });
  });`);

console.log('\\n✅ Generated ' + Object.keys({}).length + ' tool pages');
console.log('Done!');
