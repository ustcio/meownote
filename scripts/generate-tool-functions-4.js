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
  .tag-list { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .tag { background: var(--bg-tertiary); border: 1px solid var(--border-primary); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full); font-size: var(--text-xs); }
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

// 1. 关键词过滤
generateToolPage('keyword-filter.astro', '关键词过滤', '过滤文本中的敏感词或关键词', `
  <div class="form-group">
    <label class="form-label" for="input-text">输入文本</label>
    <textarea id="input-text" class="form-textarea" placeholder="输入要过滤的文本..."></textarea>
  </div>
  <div class="form-group">
    <label class="form-label" for="keywords">关键词列表（每行一个）</label>
    <textarea id="keywords" class="form-textarea" placeholder="敏感词1\n敏感词2\n敏感词3" style="min-height:80px;"></textarea>
  </div>
  <div class="form-group">
    <label class="form-label">替换方式</label>
    <div class="checkbox-group">
      <label><input type="radio" name="replace-mode" value="asterisk" checked> 用 * 替换</label>
      <label><input type="radio" name="replace-mode" value="remove"> 直接删除</label>
      <label><input type="radio" name="replace-mode" value="custom"> 自定义替换</label>
    </div>
  </div>
  <div class="form-group" id="custom-replace-group" style="display:none;">
    <label class="form-label" for="custom-replace">自定义替换文本</label>
    <input type="text" id="custom-replace" class="form-input" placeholder="输入替换内容">
  </div>
  <div class="btn-group">
    <button id="filter-btn" class="btn btn-primary">过滤</button>
    <button id="copy-btn" class="btn btn-secondary">复制结果</button>
  </div>
  <div class="form-group">
    <label class="form-label">过滤结果</label>
    <div id="result" class="result-area">等待输入...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const keywords = document.getElementById('keywords');
    const filterBtn = document.getElementById('filter-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');
    const customGroup = document.getElementById('custom-replace-group');
    const customReplace = document.getElementById('custom-replace');

    document.querySelectorAll('input[name="replace-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        customGroup.style.display = e.target.value === 'custom' ? 'flex' : 'none';
      });
    });

    filterBtn.addEventListener('click', () => {
      const text = inputText.value;
      const kwList = keywords.value.split('\\n').filter(k => k.trim());
      if (!text || kwList.length === 0) { result.textContent = '请输入文本和关键词'; return; }

      const mode = document.querySelector('input[name="replace-mode"]:checked').value;
      let filtered = text;
      let count = 0;

      kwList.forEach(kw => {
        const regex = new RegExp(kw.trim(), 'gi');
        const matches = text.match(regex);
        if (matches) count += matches.length;

        if (mode === 'asterisk') {
          filtered = filtered.replace(regex, '*'.repeat(kw.trim().length));
        } else if (mode === 'remove') {
          filtered = filtered.replace(regex, '');
        } else {
          filtered = filtered.replace(regex, customReplace.value || '');
        }
      });

      result.textContent = '过滤了 ' + count + ' 个关键词\\n\\n' + filtered;
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...' && text !== '请输入文本和关键词') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });
`);

// 2. 英文文本处理
generateToolPage('english-text.astro', '英文文本处理', '英文文本大小写转换、驼峰命名等', `
  <div class="form-group">
    <label class="form-label" for="input-text">输入英文文本</label>
    <textarea id="input-text" class="form-textarea" placeholder="Enter your text here..."></textarea>
  </div>
  <div class="btn-group">
    <button class="btn btn-secondary" data-mode="upper">UPPERCASE</button>
    <button class="btn btn-secondary" data-mode="lower">lowercase</button>
    <button class="btn btn-secondary" data-mode="title">Title Case</button>
    <button class="btn btn-secondary" data-mode="sentence">Sentence case</button>
    <button class="btn btn-secondary" data-mode="camel">camelCase</button>
    <button class="btn btn-secondary" data-mode="snake">snake_case</button>
    <button class="btn btn-secondary" data-mode="kebab">kebab-case</button>
    <button class="btn btn-secondary" data-mode="toggle">tOGGLE</button>
  </div>
  <div class="form-group">
    <label class="form-label">转换结果</label>
    <div id="result" class="result-area">等待输入...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const result = document.getElementById('result');

    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = inputText.value;
        if (!text) { result.textContent = '请输入文本'; return; }
        const mode = btn.dataset.mode;
        let output = '';

        switch(mode) {
          case 'upper': output = text.toUpperCase(); break;
          case 'lower': output = text.toLowerCase(); break;
          case 'title': output = text.replace(/\\w\\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()); break;
          case 'sentence': output = text.toLowerCase().replace(/(^\\s*|[.!?]\\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase()); break;
          case 'camel': output = text.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, c) => c.toUpperCase()); break;
          case 'snake': output = text.toLowerCase().replace(/\\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''); break;
          case 'kebab': output = text.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, ''); break;
          case 'toggle': output = text.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''); break;
        }
        result.textContent = output;
      });
    });
  });
`);

// 3. 字数统计
generateToolPage('word-count.astro', '字数统计', '统计文本的字数、词数、行数等', `
  <div class="form-group">
    <label class="form-label" for="input-text">输入文本</label>
    <textarea id="input-text" class="form-textarea" placeholder="输入要统计的文本..." style="min-height:200px;"></textarea>
  </div>
  <div class="stats-bar" id="stats">
    <div class="stat-item"><strong>字符数:</strong> <span id="chars">0</span></div>
    <div class="stat-item"><strong>字符数(无空格):</strong> <span id="chars-no-space">0</span></div>
    <div class="stat-item"><strong>词数(英文):</strong> <span id="words">0</span></div>
    <div class="stat-item"><strong>行数:</strong> <span id="lines">0</span></div>
    <div class="stat-item"><strong>段落数:</strong> <span id="paragraphs">0</span></div>
    <div class="stat-item"><strong>中文字数:</strong> <span id="chinese">0</span></div>
    <div class="stat-item"><strong>阅读时间:</strong> <span id="read-time">0秒</span></div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const chars = document.getElementById('chars');
    const charsNoSpace = document.getElementById('chars-no-space');
    const words = document.getElementById('words');
    const lines = document.getElementById('lines');
    const paragraphs = document.getElementById('paragraphs');
    const chinese = document.getElementById('chinese');
    const readTime = document.getElementById('read-time');

    inputText.addEventListener('input', () => {
      const text = inputText.value;
      chars.textContent = text.length;
      charsNoSpace.textContent = text.replace(/\\s/g, '').length;
      words.textContent = text.trim() ? text.trim().split(/\\s+/).length : 0;
      lines.textContent = text ? text.split('\\n').length : 0;
      paragraphs.textContent = text.trim() ? text.trim().split(/\\n\\s*\\n/).filter(p => p.trim()).length : 0;
      chinese.textContent = (text.match(/[\\u4e00-\\u9fa5]/g) || []).length;

      const wordCount = text.trim() ? text.trim().split(/\\s+/).length : 0;
      const minutes = Math.ceil(wordCount / 200);
      readTime.textContent = minutes < 1 ? '少于1分钟' : minutes + '分钟';
    });
  });
`);

// 4. URL提取
generateToolPage('url-extract.astro', 'URL提取', '从文本中提取所有URL链接', `
  <div class="form-group">
    <label class="form-label" for="input-text">输入文本</label>
    <textarea id="input-text" class="form-textarea" placeholder="粘贴包含URL的文本..."></textarea>
  </div>
  <div class="form-group">
    <label class="form-label">选项</label>
    <div class="checkbox-group">
      <label><input type="checkbox" id="unique" checked> 去重</label>
      <label><input type="checkbox" id="sort"> 排序</label>
    </div>
  </div>
  <div class="btn-group">
    <button id="extract-btn" class="btn btn-primary">提取URL</button>
    <button id="copy-btn" class="btn btn-secondary">复制结果</button>
  </div>
  <div class="form-group">
    <label class="form-label">提取结果 (<span id="count">0</span> 个)</label>
    <div id="result" class="result-area">等待输入...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const extractBtn = document.getElementById('extract-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');
    const count = document.getElementById('count');
    const unique = document.getElementById('unique');
    const sort = document.getElementById('sort');

    extractBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text) { result.textContent = '请输入文本'; return; }

      const urlRegex = /https?:\\/\\/[^\\s<>"{}|\\\\^\`\\[\\]]+/gi;
      let urls = text.match(urlRegex) || [];

      if (unique.checked) urls = [...new Set(urls)];
      if (sort.checked) urls.sort();

      count.textContent = urls.length;
      result.textContent = urls.length > 0 ? urls.join('\\n') : '未找到URL';
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...' && text !== '未找到URL') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });
`);

// 5. IP提取
generateToolPage('ip-extract.astro', 'IP地址提取', '从文本中提取IPv4和IPv6地址', `
  <div class="form-group">
    <label class="form-label" for="input-text">输入文本</label>
    <textarea id="input-text" class="form-textarea" placeholder="粘贴包含IP地址的文本..."></textarea>
  </div>
  <div class="form-group">
    <label class="form-label">IP类型</label>
    <div class="checkbox-group">
      <label><input type="checkbox" id="ipv4" checked> IPv4</label>
      <label><input type="checkbox" id="ipv6" checked> IPv6</label>
      <label><input type="checkbox" id="unique" checked> 去重</label>
    </div>
  </div>
  <div class="btn-group">
    <button id="extract-btn" class="btn btn-primary">提取IP</button>
    <button id="copy-btn" class="btn btn-secondary">复制结果</button>
  </div>
  <div class="form-group">
    <label class="form-label">提取结果 (<span id="count">0</span> 个)</label>
    <div id="result" class="result-area">等待输入...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const extractBtn = document.getElementById('extract-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');
    const count = document.getElementById('count');

    extractBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text) { result.textContent = '请输入文本'; return; }

      const ipv4 = document.getElementById('ipv4').checked;
      const ipv6 = document.getElementById('ipv6').checked;
      const unique = document.getElementById('unique').checked;
      let ips = [];

      if (ipv4) {
        const ipv4Regex = /\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b/g;
        ips = ips.concat(text.match(ipv4Regex) || []);
      }
      if (ipv6) {
        const ipv6Regex = /\\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\\b/g;
        ips = ips.concat(text.match(ipv6Regex) || []);
      }

      if (unique) ips = [...new Set(ips)];
      count.textContent = ips.length;
      result.textContent = ips.length > 0 ? ips.join('\\n') : '未找到IP地址';
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...' && text !== '未找到IP地址') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });
`);

// 6. 表格转CSV
generateToolPage('table-to-csv.astro', '表格转CSV', '将HTML表格或制表符分隔数据转为CSV', `
  <div class="form-group">
    <label class="form-label" for="input-text">输入表格数据（制表符分隔或HTML表格）</label>
    <textarea id="input-text" class="form-textarea" placeholder="Name\tAge\tCity\nJohn\t25\tNew York" style="min-height:150px;"></textarea>
  </div>
  <div class="form-group">
    <label class="form-label">分隔符</label>
    <div class="checkbox-group">
      <label><input type="radio" name="delimiter" value="tab" checked> 制表符</label>
      <label><input type="radio" name="delimiter" value="comma"> 逗号</label>
      <label><input type="radio" name="delimiter" value="html"> HTML表格</label>
    </div>
  </div>
  <div class="btn-group">
    <button id="convert-btn" class="btn btn-primary">转换为CSV</button>
    <button id="copy-btn" class="btn btn-secondary">复制</button>
    <button id="download-btn" class="btn btn-secondary">下载CSV</button>
  </div>
  <div class="form-group">
    <label class="form-label">CSV结果</label>
    <div id="result" class="result-area">等待输入...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const result = document.getElementById('result');

    convertBtn.addEventListener('click', () => {
      const text = inputText.value.trim();
      if (!text) { result.textContent = '请输入数据'; return; }

      const delimiter = document.querySelector('input[name="delimiter"]:checked').value;
      let csv = '';

      if (delimiter === 'html') {
        const temp = document.createElement('div');
        temp.innerHTML = text;
        const rows = temp.querySelectorAll('tr');
        const data = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td, th');
          const rowData = [];
          cells.forEach(cell => {
            let val = cell.textContent.trim();
            if (val.includes(',') || val.includes('"') || val.includes('\\n')) {
              val = '"' + val.replace(/"/g, '""') + '"';
            }
            rowData.push(val);
          });
          data.push(rowData.join(','));
        });
        csv = data.join('\\n');
      } else {
        const sep = delimiter === 'tab' ? '\\t' : ',';
        const lines = text.split('\\n');
        csv = lines.map(line => {
          const cells = line.split(sep);
          return cells.map(cell => {
            let val = cell.trim();
            if (val.includes(',') || val.includes('"') || val.includes('\\n')) {
              val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
          }).join(',');
        }).join('\\n');
      }

      result.textContent = csv;
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

    downloadBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...') {
        const blob = new Blob(['\\ufeff' + text], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'data.csv'; a.click();
        URL.revokeObjectURL(url);
      }
    });
  });
`);

// 7. Cookie转JSON
generateToolPage('cookie-to-json.astro', 'Cookie转JSON', '将Cookie字符串转换为JSON格式', `
  <div class="form-group">
    <label class="form-label" for="input-text">输入Cookie字符串</label>
    <textarea id="input-text" class="form-textarea" placeholder="name=value; name2=value2; name3=value3"></textarea>
  </div>
  <div class="form-group">
    <label class="form-label">输出格式</label>
    <div class="checkbox-group">
      <label><input type="radio" name="format" value="pretty" checked> 格式化JSON</label>
      <label><input type="radio" name="format" value="compact"> 紧凑JSON</label>
      <label><input type="radio" name="format" value="array"> 数组格式</label>
    </div>
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
    const inputText = document.getElementById('input-text');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    convertBtn.addEventListener('click', () => {
      const text = inputText.value.trim();
      if (!text) { result.textContent = '请输入Cookie'; return; }

      const format = document.querySelector('input[name="format"]:checked').value;
      const pairs = text.split(';').map(p => p.trim()).filter(p => p);
      const cookies = {};
      const arr = [];

      pairs.forEach(pair => {
        const idx = pair.indexOf('=');
        if (idx > -1) {
          const key = pair.substring(0, idx).trim();
          const value = pair.substring(idx + 1).trim();
          cookies[key] = value;
          arr.push({ name: key, value: value });
        }
      });

      let output;
      if (format === 'pretty') {
        output = JSON.stringify(cookies, null, 2);
      } else if (format === 'compact') {
        output = JSON.stringify(cookies);
      } else {
        output = JSON.stringify(arr, null, 2);
      }

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
  });
`);

console.log('\n✅ 第四批工具生成完成');
console.log('Done!');
