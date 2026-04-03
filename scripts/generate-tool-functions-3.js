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

// Text Diff
generateToolPage('text-diff.astro', '文本对比', '对比两段文本的差异', `
          <div class="form-group">
            <label class="form-label" for="text1">原文本</label>
            <textarea id="text1" class="form-textarea" placeholder="输入原始文本..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="text2">修改后文本</label>
            <textarea id="text2" class="form-textarea" placeholder="输入修改后的文本..."></textarea>
          </div>
          <div class="btn-group">
            <button id="diff-btn" class="btn btn-primary">对比差异</button>
            <button id="clear-btn" class="btn btn-secondary">清空</button>
          </div>
          <div class="form-group">
            <label class="form-label">对比结果</label>
            <div id="result" class="result-area" style="min-height:100px;">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const text1 = document.getElementById('text1');
    const text2 = document.getElementById('text2');
    const diffBtn = document.getElementById('diff-btn');
    const clearBtn = document.getElementById('clear-btn');
    const result = document.getElementById('result');

    diffBtn.addEventListener('click', () => {
      const t1 = text1.value.split('\\n');
      const t2 = text2.value.split('\\n');
      let output = '';
      const maxLen = Math.max(t1.length, t2.length);
      let added = 0, removed = 0, unchanged = 0;
      
      for (let i = 0; i < maxLen; i++) {
        const line1 = t1[i] || '';
        const line2 = t2[i] || '';
        if (line1 === line2) {
          output += '  ' + line1 + '\\n';
          unchanged++;
        } else {
          if (line1) { output += '- ' + line1 + '\\n'; removed++; }
          if (line2) { output += '+ ' + line2 + '\\n'; added++; }
        }
      }
      output = '\\n统计: ' + unchanged + ' 行未变, +' + added + ' 行新增, -' + removed + ' 行删除\\n\\n' + output;
      result.textContent = output;
    });

    clearBtn.addEventListener('click', () => {
      text1.value = ''; text2.value = ''; result.textContent = '等待输入...';
    });
  });`);

// Text Replace
generateToolPage('text-replace.astro', '文本替换', '查找并替换文本内容', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入要处理的文本..."></textarea>
          </div>
          <div style="display:flex;gap:var(--space-2);">
            <div class="form-group" style="flex:1;">
              <label class="form-label" for="find-text">查找</label>
              <input type="text" id="find-text" class="form-input" placeholder="要查找的内容">
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label" for="replace-text">替换为</label>
              <input type="text" id="replace-text" class="form-input" placeholder="替换后的内容">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">选项</label>
            <div class="checkbox-group">
              <label><input type="checkbox" id="case-sensitive"> 区分大小写</label>
              <label><input type="checkbox" id="use-regex"> 使用正则表达式</label>
            </div>
          </div>
          <div class="btn-group">
            <button id="replace-btn" class="btn btn-primary">替换全部</button>
            <button id="copy-btn" class="btn btn-secondary">复制结果</button>
          </div>
          <div class="form-group">
            <label class="form-label">替换结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const findText = document.getElementById('find-text');
    const replaceText = document.getElementById('replace-text');
    const caseSensitive = document.getElementById('case-sensitive');
    const useRegex = document.getElementById('use-regex');
    const replaceBtn = document.getElementById('replace-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    replaceBtn.addEventListener('click', () => {
      const text = inputText.value;
      const find = findText.value;
      const replace = replaceText.value;
      if (!text || !find) { result.textContent = '请输入文本和查找内容'; return; }
      try {
        let regex;
        if (useRegex.checked) {
          regex = new RegExp(find, caseSensitive.checked ? 'g' : 'gi');
        } else {
          function escapeRegex(str) {
            const chars = ['.', '*', '+', '?', '^', '(', ')', '|', '[', ']', '\\\\', '\x7b', '\x7d'];
            let result = '';
            for (let i = 0; i < str.length; i++) {
              if (chars.includes(str[i])) result += '\\\\';
              result += str[i];
            }
            return result;
          }
          regex = new RegExp(escapeRegex(find), caseSensitive.checked ? 'g' : 'gi');
        }
        const newText = text.replace(regex, replace);
        const count = (text.match(regex) || []).length;
        result.textContent = '替换了 ' + count + ' 处\\n\\n' + newText;
      } catch (e) {
        result.textContent = '错误: ' + e.message;
      }
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...') {
        const actualText = text.split('\\n\\n').slice(1).join('\\n\\n') || text;
        navigator.clipboard.writeText(actualText).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// Text Dedup
generateToolPage('text-dedup.astro', '文本去重', '去除文本中的重复行', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入包含重复行的文本..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">选项</label>
            <div class="checkbox-group">
              <label><input type="checkbox" id="keep-order" checked> 保持原始顺序</label>
              <label><input type="checkbox" id="ignore-case"> 忽略大小写</label>
              <label><input type="checkbox" id="trim-lines" checked> 去除首尾空格</label>
            </div>
          </div>
          <div class="btn-group">
            <button id="dedup-btn" class="btn btn-primary">去重</button>
            <button id="copy-btn" class="btn btn-secondary">复制结果</button>
          </div>
          <div class="form-group">
            <label class="form-label">去重结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const keepOrder = document.getElementById('keep-order');
    const ignoreCase = document.getElementById('ignore-case');
    const trimLines = document.getElementById('trim-lines');
    const dedupBtn = document.getElementById('dedup-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    dedupBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text.trim()) { result.textContent = '请输入文本'; return; }
      let lines = text.split('\\n');
      const originalCount = lines.length;
      if (trimLines.checked) lines = lines.map(l => l.trim());
      const seen = new Set();
      const unique = [];
      lines.forEach(line => {
        const key = ignoreCase.checked ? line.toLowerCase() : line;
        if (key && !seen.has(key)) { seen.add(key); unique.push(line); }
      });
      const removed = originalCount - unique.length;
      result.textContent = '原始行数: ' + originalCount + '\\n去重后: ' + unique.length + ' 行\\n移除: ' + removed + ' 行\\n\\n' + unique.join('\\n');
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...') {
        const actualText = text.split('\\n\\n').slice(1).join('\\n\\n') || text;
        navigator.clipboard.writeText(actualText).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// Link Extract
generateToolPage('link-extract.astro', '链接提取', '从文本中提取URL链接', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="粘贴包含链接的文本..."></textarea>
          </div>
          <div class="btn-group">
            <button id="extract-btn" class="btn btn-primary">提取链接</button>
            <button id="copy-btn" class="btn btn-secondary">复制全部</button>
          </div>
          <div class="form-group">
            <label class="form-label">提取结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const extractBtn = document.getElementById('extract-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    extractBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text.trim()) { result.textContent = '请输入文本'; return; }
      const urlRegex = /https?:\\/\\/[^\\s<>"')\\]}]+/gi;
      const urls = text.match(urlRegex) || [];
      const uniqueUrls = [...new Set(urls)];
      if (uniqueUrls.length === 0) { result.textContent = '未找到链接'; return; }
      result.textContent = '共找到 ' + uniqueUrls.length + ' 个链接:\\n\\n' + uniqueUrls.join('\\n');
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待输入...') {
        const actualText = text.split('\\n\\n').slice(1).join('\\n\\n') || text;
        navigator.clipboard.writeText(actualText).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// Number Extract
generateToolPage('number-extract.astro', '数字提取', '从文本中提取所有数字', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入包含数字的文本..."></textarea>
          </div>
          <div class="btn-group">
            <button id="extract-btn" class="btn btn-primary">提取数字</button>
            <button id="copy-btn" class="btn btn-secondary">复制结果</button>
          </div>
          <div class="form-group">
            <label class="form-label">提取结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const extractBtn = document.getElementById('extract-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    extractBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text.trim()) { result.textContent = '请输入文本'; return; }
      const numbers = text.match(/-?\\d+\\.?\\d*/g) || [];
      if (numbers.length === 0) { result.textContent = '未找到数字'; return; }
      const sum = numbers.reduce((a, b) => a + parseFloat(b), 0);
      const avg = sum / numbers.length;
      const min = Math.min(...numbers.map(Number));
      const max = Math.max(...numbers.map(Number));
      result.textContent = '共找到 ' + numbers.length + ' 个数字:\\n\\n' + numbers.join(', ') + '\\n\\n统计:\\n总和: ' + sum.toFixed(2) + '\\n平均: ' + avg.toFixed(2) + '\\n最小: ' + min + '\\n最大: ' + max;
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

// Text Blank Lines
generateToolPage('text-blank-lines.astro', '空行处理', '删除或添加文本中的空行', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入要处理的文本..."></textarea>
          </div>
          <div class="btn-group">
            <button id="remove-all-btn" class="btn btn-primary">删除所有空行</button>
            <button id="remove-extra-btn" class="btn btn-secondary">删除多余空行</button>
            <button id="add-btn" class="btn btn-secondary">段落间加空行</button>
          </div>
          <div class="form-group">
            <label class="form-label">处理结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const removeAllBtn = document.getElementById('remove-all-btn');
    const removeExtraBtn = document.getElementById('remove-extra-btn');
    const addBtn = document.getElementById('add-btn');
    const result = document.getElementById('result');

    removeAllBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text.trim()) { result.textContent = '请输入文本'; return; }
      result.textContent = text.split('\\n').filter(l => l.trim()).join('\\n');
    });

    removeExtraBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text.trim()) { result.textContent = '请输入文本'; return; }
      result.textContent = text.replace(/\\n{3,}/g, '\\n\\n');
    });

    addBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text.trim()) { result.textContent = '请输入文本'; return; }
      result.textContent = text.split('\\n').filter(l => l.trim()).join('\\n\\n');
    });
  });`);

// Text to List
generateToolPage('text-to-list.astro', '文本转列表', '将文本转换为列表格式', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本（每行一个项目）</label>
            <textarea id="input-text" class="form-textarea" placeholder="苹果&#10;香蕉&#10;橙子"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">列表类型</label>
            <select id="list-type" class="form-select">
              <option value="ul">无序列表 (-)</option>
              <option value="ol">有序列表 (1.)</option>
              <option value="checkbox">复选框列表 (- [ ])</option>
              <option value="html-ul">HTML无序列表</option>
              <option value="html-ol">HTML有序列表</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">转换</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">列表结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const listType = document.getElementById('list-type');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    convertBtn.addEventListener('click', () => {
      const lines = inputText.value.split('\\n').filter(l => l.trim());
      if (lines.length === 0) { result.textContent = '请输入文本'; return; }
      let output = '';
      switch (listType.value) {
        case 'ul': output = lines.map(l => '- ' + l.trim()).join('\\n'); break;
        case 'ol': output = lines.map((l, i) => (i + 1) + '. ' + l.trim()).join('\\n'); break;
        case 'checkbox': output = lines.map(l => '- [ ] ' + l.trim()).join('\\n'); break;
        case 'html-ul': output = '<ul>\\n' + lines.map(l => '  <li>' + l.trim() + '</li>').join('\\n') + '\\n</ul>'; break;
        case 'html-ol': output = '<ol>\\n' + lines.map((l, i) => '  <li>' + l.trim() + '</li>').join('\\n') + '\\n</ol>'; break;
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
  });`);

// Naming Convention
generateToolPage('naming-convention.astro', '命名转换', '转换变量命名风格', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入要转换的变量名或文本..."></textarea>
          </div>
          <div class="btn-group">
            <button id="camel-btn" class="btn btn-primary">camelCase</button>
            <button id="snake-btn" class="btn btn-secondary">snake_case</button>
            <button id="kebab-btn" class="btn btn-secondary">kebab-case</button>
            <button id="pascal-btn" class="btn btn-secondary">PascalCase</button>
            <button id="upper-btn" class="btn btn-secondary">UPPER_CASE</button>
          </div>
          <div class="form-group">
            <label class="form-label">转换结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  function toWords(str) { return str.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').trim().toLowerCase(); }
  
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const result = document.getElementById('result');

    function convert(type) {
      const text = inputText.value.trim();
      if (!text) { result.textContent = '请输入文本'; return; }
      const words = toWords(text).split(/\\s+/);
      let output = '';
      switch (type) {
        case 'camel': output = words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''); break;
        case 'snake': output = words.join('_'); break;
        case 'kebab': output = words.join('-'); break;
        case 'pascal': output = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(''); break;
        case 'upper': output = words.join('_').toUpperCase(); break;
      }
      result.textContent = output;
    }

    document.getElementById('camel-btn').addEventListener('click', () => convert('camel'));
    document.getElementById('snake-btn').addEventListener('click', () => convert('snake'));
    document.getElementById('kebab-btn').addEventListener('click', () => convert('kebab'));
    document.getElementById('pascal-btn').addEventListener('click', () => convert('pascal'));
    document.getElementById('upper-btn').addEventListener('click', () => convert('upper'));
  });`);

// Binary Text
generateToolPage('binary-text.astro', '二进制转换', '文本与二进制互转', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本或二进制</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入文本或二进制字符串..."></textarea>
          </div>
          <div class="btn-group">
            <button id="to-binary-btn" class="btn btn-primary">转二进制</button>
            <button id="to-text-btn" class="btn btn-secondary">转文本</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">转换结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const toBinaryBtn = document.getElementById('to-binary-btn');
    const toTextBtn = document.getElementById('to-text-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    toBinaryBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text) { result.textContent = '请输入文本'; return; }
      const binary = text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
      result.textContent = binary;
    });

    toTextBtn.addEventListener('click', () => {
      const binary = inputText.value.trim();
      if (!binary) { result.textContent = '请输入二进制'; return; }
      try {
        const text = binary.split(/\\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join('');
        result.textContent = text;
      } catch (e) {
        result.textContent = '转换错误: 无效的二进制格式';
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

// Unicode Tool
generateToolPage('unicode.astro', 'Unicode工具', '文本与Unicode编码互转', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入要转换的文本..."></textarea>
          </div>
          <div class="btn-group">
            <button id="encode-btn" class="btn btn-primary">编码为Unicode</button>
            <button id="decode-btn" class="btn btn-secondary">解码Unicode</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">转换结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const encodeBtn = document.getElementById('encode-btn');
    const decodeBtn = document.getElementById('decode-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    encodeBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text) { result.textContent = '请输入文本'; return; }
      const unicode = text.split('').map(c => '\\\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
      result.textContent = unicode;
    });

    decodeBtn.addEventListener('click', () => {
      const unicode = inputText.value;
      if (!unicode) { result.textContent = '请输入Unicode编码'; return; }
      try {
        const text = unicode.replace(/\\\\u([0-9a-fA-F]{4})/g, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
        result.textContent = text;
      } catch (e) {
        result.textContent = '解码错误: 无效的Unicode格式';
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

// Word Frequency
generateToolPage('word-frequency.astro', '词频统计', '统计文本中单词出现频率', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" style="min-height:150px;" placeholder="输入要分析的文本..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="top-n">显示前 N 个</label>
            <input type="number" id="top-n" class="form-input" value="20" min="1" max="100">
          </div>
          <div class="btn-group">
            <button id="analyze-btn" class="btn btn-primary">分析词频</button>
            <button id="copy-btn" class="btn btn-secondary">复制结果</button>
          </div>
          <div class="form-group">
            <label class="form-label">词频结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const topN = document.getElementById('top-n');
    const analyzeBtn = document.getElementById('analyze-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    analyzeBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text.trim()) { result.textContent = '请输入文本'; return; }
      const words = text.toLowerCase().match(/[a-zA-Z\\u4e00-\\u9fa5]+/g) || [];
      const freq = {};
      words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
      const top = sorted.slice(0, parseInt(topN.value) || 20);
      const maxCount = top.length > 0 ? top[0][1] : 1;
      let output = '总词数: ' + words.length + '\\n唯一词数: ' + Object.keys(freq).length + '\\n\\n';
      output += '排名  单词'.padEnd(25) + '次数  频率\\n';
      output += '-'.repeat(50) + '\\n';
      top.forEach(([word, count], i) => {
        const pct = ((count / words.length) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round((count / maxCount) * 20));
        output += (i + 1).toString().padStart(4) + '  ' + word.padEnd(20) + count.toString().padStart(4) + '  ' + pct.padStart(5) + '%  ' + bar + '\\n';
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

// Punctuation
generateToolPage('punctuation.astro', '标点符号', '全角半角标点转换', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入包含标点的文本..."></textarea>
          </div>
          <div class="btn-group">
            <button id="to-full-btn" class="btn btn-primary">转全角</button>
            <button id="to-half-btn" class="btn btn-secondary">转半角</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">转换结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const toFullBtn = document.getElementById('to-full-btn');
    const toHalfBtn = document.getElementById('to-half-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    toFullBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text) { result.textContent = '请输入文本'; return; }
      const full = text.replace(/[\\u0020-\\u007e]/g, c => {
        if (c === ' ') return '\\u3000';
        const code = c.charCodeAt(0);
        if (code >= 33 && code <= 126) return String.fromCharCode(code + 0xfee0);
        return c;
      });
      result.textContent = full;
    });

    toHalfBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text) { result.textContent = '请输入文本'; return; }
      const half = text.replace(/[\\u3000\\uff01-\\uff5e]/g, c => {
        if (c === '\\u3000') return ' ';
        return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
      });
      result.textContent = half;
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

// Text Prefix Suffix
generateToolPage('text-prefix-suffix.astro', '文本前后缀', '批量添加前后缀', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本（每行一个）</label>
            <textarea id="input-text" class="form-textarea" placeholder="第一行&#10;第二行&#10;第三行"></textarea>
          </div>
          <div style="display:flex;gap:var(--space-2);">
            <div class="form-group" style="flex:1;">
              <label class="form-label" for="prefix">前缀</label>
              <input type="text" id="prefix" class="form-input" placeholder="每行前面添加的内容">
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label" for="suffix">后缀</label>
              <input type="text" id="suffix" class="form-input" placeholder="每行后面添加的内容">
            </div>
          </div>
          <div class="btn-group">
            <button id="add-btn" class="btn btn-primary">添加前后缀</button>
            <button id="copy-btn" class="btn btn-secondary">复制结果</button>
          </div>
          <div class="form-group">
            <label class="form-label">处理结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const prefix = document.getElementById('prefix');
    const suffix = document.getElementById('suffix');
    const addBtn = document.getElementById('add-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    addBtn.addEventListener('click', () => {
      const lines = inputText.value.split('\\n').filter(l => l.trim());
      if (lines.length === 0) { result.textContent = '请输入文本'; return; }
      const p = prefix.value || '';
      const s = suffix.value || '';
      result.textContent = lines.map(l => p + l.trim() + s).join('\\n');
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

// HTML Strip
generateToolPage('html-strip.astro', 'HTML清理', '清除HTML标签保留纯文本', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入HTML</label>
            <textarea id="input-text" class="form-textarea" placeholder="<p>Hello <b>World</b></p>"></textarea>
          </div>
          <div class="btn-group">
            <button id="strip-btn" class="btn btn-primary">清除HTML</button>
            <button id="decode-btn" class="btn btn-secondary">解码HTML实体</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">纯文本结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const stripBtn = document.getElementById('strip-btn');
    const decodeBtn = document.getElementById('decode-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    stripBtn.addEventListener('click', () => {
      const html = inputText.value;
      if (!html.trim()) { result.textContent = '请输入HTML'; return; }
      const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
      result.textContent = text;
    });

    decodeBtn.addEventListener('click', () => {
      const html = inputText.value;
      if (!html.trim()) { result.textContent = '请输入HTML'; return; }
      const textarea = document.createElement('textarea');
      textarea.innerHTML = html;
      result.textContent = textarea.value;
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

// XML Format
generateToolPage('xml-format.astro', 'XML格式化', '格式化和验证XML文档', `
          <div class="form-group">
            <label class="form-label" for="xml-input">输入XML</label>
            <textarea id="xml-input" class="form-textarea" placeholder="<root><item>value</item></root>"></textarea>
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
  document.addEventListener('DOMContentLoaded', () => {
    const xmlInput = document.getElementById('xml-input');
    const formatBtn = document.getElementById('format-btn');
    const compressBtn = document.getElementById('compress-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    formatBtn.addEventListener('click', () => {
      let xml = xmlInput.value.trim();
      if (!xml) { result.textContent = '请输入XML'; return; }
      try {
        let formatted = '';
        let indent = 0;
        const tab = '  ';
        const cleaned = xml.replace(/>\s*</g, '><');
        cleaned.split(/(<[^>]+>)/g).filter(s => s.trim()).forEach(node => {
          if (node.match(/^<\//)) indent--;
          formatted += tab.repeat(Math.max(0, indent)) + node + '\n';
          if (node.match(/^<[^\/]/) && !node.match(/\/>$/) && !node.match(/^<!--/)) indent++;
        });
        result.textContent = formatted.trim();
      } catch (e) {
        result.textContent = 'XML格式错误: ' + e.message;
      }
    });

    compressBtn.addEventListener('click', () => {
      const xml = xmlInput.value.trim();
      if (!xml) { result.textContent = '请输入XML'; return; }
      result.textContent = xml.replace(/\\s+/g, ' ').replace(/\\s*>\\s*/g, '>').trim();
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

// SCSS to CSS
generateToolPage('scss-to-css.astro', 'SCSS转CSS', '将SCSS/SASS转换为CSS', `
          <div class="form-group">
            <label class="form-label" for="scss-input">输入SCSS</label>
            <textarea id="scss-input" class="form-textarea" placeholder=".container {&#10;  .header {&#10;    color: red;&#10;  }&#10;}"></textarea>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">转换为CSS</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">CSS结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const scssInput = document.getElementById('scss-input');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    convertBtn.addEventListener('click', () => {
      const scss = scssInput.value;
      if (!scss.trim()) { result.textContent = '请输入SCSS'; return; }
      try {
        let css = '';
        const lines = scss.split('\\n');
        const stack = [];
        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('//')) return;
          const match = trimmed.match(/^([^{]+)\\s*\\{(.*)$/);
          if (match) {
            const selector = match[1].trim();
            const parent = stack.length > 0 ? stack[stack.length - 1] + ' ' : '';
            stack.push(parent + selector);
            const props = match[2].trim();
            if (props && !props.endsWith('}')) {
              css += stack.join(' ') + ' {\\n  ' + props.replace(/;/g, ';\\n  ') + '\\n}\\n\\n';
            }
          } else if (trimmed === '}') {
            stack.pop();
          } else if (trimmed.endsWith('}')) {
            const content = trimmed.replace(/\\s*\\}\\s*$/, '');
            if (stack.length > 0) {
              css += stack.join(' ') + ' {\\n  ' + content.replace(/;/g, ';\\n  ') + '\\n}\\n\\n';
            }
          }
        });
        result.textContent = css.trim() || '转换完成（简单嵌套支持）';
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

// JSON Merge
generateToolPage('json-merge.astro', 'JSON合并', '合并多个JSON对象', `
          <div class="form-group">
            <label class="form-label" for="json1">JSON对象1</label>
            <textarea id="json1" class="form-textarea" placeholder='{"name": "test"}'></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="json2">JSON对象2</label>
            <textarea id="json2" class="form-textarea" placeholder='{"age": 25}'></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">合并方式</label>
            <select id="merge-type" class="form-select">
              <option value="shallow">浅合并</option>
              <option value="deep">深合并</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="merge-btn" class="btn btn-primary">合并JSON</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">合并结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const json1 = document.getElementById('json1');
    const json2 = document.getElementById('json2');
    const mergeType = document.getElementById('merge-type');
    const mergeBtn = document.getElementById('merge-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    function deepMerge(target, source) {
      const output = Object.assign({}, target);
      Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          output[key] = deepMerge(output[key] || {}, source[key]);
        } else {
          output[key] = source[key];
        }
      });
      return output;
    }

    mergeBtn.addEventListener('click', () => {
      try {
        const obj1 = JSON.parse(json1.value);
        const obj2 = JSON.parse(json2.value);
        let merged;
        if (mergeType.value === 'deep') {
          merged = deepMerge(obj1, obj2);
        } else {
          merged = { ...obj1, ...obj2 };
        }
        result.textContent = JSON.stringify(merged, null, 2);
      } catch (e) {
        result.textContent = 'JSON解析错误: ' + e.message;
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

// JSON Field Extract
generateToolPage('json-field-extract.astro', 'JSON字段提取', '从JSON中提取指定字段', `
          <div class="form-group">
            <label class="form-label" for="json-input">输入JSON</label>
            <textarea id="json-input" class="form-textarea" placeholder='[{"name":"张三","age":25,"city":"北京"},{"name":"李四","age":30,"city":"上海"}]'></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="fields">字段名（逗号分隔）</label>
            <input type="text" id="fields" class="form-input" placeholder="name,city">
          </div>
          <div class="btn-group">
            <button id="extract-btn" class="btn btn-primary">提取字段</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">提取结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const jsonInput = document.getElementById('json-input');
    const fields = document.getElementById('fields');
    const extractBtn = document.getElementById('extract-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    extractBtn.addEventListener('click', () => {
      try {
        const data = JSON.parse(jsonInput.value);
        const fieldList = fields.value.split(',').map(f => f.trim()).filter(f => f);
        if (fieldList.length === 0) { result.textContent = '请输入字段名'; return; }
        const arr = Array.isArray(data) ? data : [data];
        const extracted = arr.map(item => {
          const obj = {};
          fieldList.forEach(f => { if (item[f] !== undefined) obj[f] = item[f]; });
          return obj;
        });
        result.textContent = JSON.stringify(extracted, null, 2);
      } catch (e) {
        result.textContent = 'JSON解析错误: ' + e.message;
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

// AES Encryption
generateToolPage('aes.astro', 'AES加密解密', 'AES对称加密和解密', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入要加密或解密的文本..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="password">密钥</label>
            <input type="text" id="password" class="form-input" placeholder="输入加密密钥">
          </div>
          <div class="btn-group">
            <button id="encrypt-btn" class="btn btn-primary">加密</button>
            <button id="decrypt-btn" class="btn btn-secondary">解密</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const password = document.getElementById('password');
    const encryptBtn = document.getElementById('encrypt-btn');
    const decryptBtn = document.getElementById('decrypt-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    encryptBtn.addEventListener('click', async () => {
      const text = inputText.value;
      const pwd = password.value;
      if (!text || !pwd) { result.textContent = '请输入文本和密钥'; return; }
      try {
        const enc = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(pwd, salt);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt); combined.set(iv, salt.length); combined.set(new Uint8Array(encrypted), salt.length + iv.length);
        result.textContent = btoa(String.fromCharCode(...combined));
      } catch (e) {
        result.textContent = '加密错误: ' + e.message;
      }
    });

    decryptBtn.addEventListener('click', async () => {
      const text = inputText.value;
      const pwd = password.value;
      if (!text || !pwd) { result.textContent = '请输入密文和密钥'; return; }
      try {
        const combined = new Uint8Array(atob(text).split('').map(c => c.charCodeAt(0)));
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const encrypted = combined.slice(28);
        const key = await deriveKey(pwd, salt);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
        result.textContent = new TextDecoder().decode(decrypted);
      } catch (e) {
        result.textContent = '解密错误: 密钥错误或密文损坏';
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

// RC4 Encryption
generateToolPage('rc4.astro', 'RC4加密', 'RC4流加密算法', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入要加密或解密的文本..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="key">密钥</label>
            <input type="text" id="key" class="form-input" placeholder="输入密钥">
          </div>
          <div class="btn-group">
            <button id="encrypt-btn" class="btn btn-primary">加密</button>
            <button id="decrypt-btn" class="btn btn-secondary">解密</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  function rc4(key, text) {
    let s = [], j = 0, output = '';
    for (let i = 0; i < 256; i++) s[i] = i;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
      [s[i], s[j]] = [s[j], s[i]];
    }
    let i = 0; j = 0;
    for (let x = 0; x < text.length; x++) {
      i = (i + 1) % 256; j = (j + s[i]) % 256;
      [s[i], s[j]] = [s[j], s[i]];
      output += String.fromCharCode(text.charCodeAt(x) ^ s[(s[i] + s[j]) % 256]);
    }
    return output;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const key = document.getElementById('key');
    const encryptBtn = document.getElementById('encrypt-btn');
    const decryptBtn = document.getElementById('decrypt-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    encryptBtn.addEventListener('click', () => {
      const text = inputText.value;
      const k = key.value;
      if (!text || !k) { result.textContent = '请输入文本和密钥'; return; }
      const encrypted = rc4(k, text);
      result.textContent = btoa(encrypted);
    });

    decryptBtn.addEventListener('click', () => {
      const text = inputText.value;
      const k = key.value;
      if (!text || !k) { result.textContent = '请输入密文和密钥'; return; }
      try {
        const decrypted = rc4(k, atob(text));
        result.textContent = decrypted;
      } catch (e) {
        result.textContent = '解密错误: 无效的Base64';
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

// Crontab Generator
generateToolPage('crontab.astro', 'Crontab生成', '生成Cron表达式', `
          <div class="form-group">
            <label class="form-label">执行频率</label>
            <select id="frequency" class="form-select">
              <option value="custom">自定义</option>
              <option value="every-minute">每分钟</option>
              <option value="every-5min">每5分钟</option>
              <option value="every-hour">每小时</option>
              <option value="daily">每天</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-2);">
            <div class="form-group"><label class="form-label">分钟</label><input type="text" id="minute" class="form-input" value="0"></div>
            <div class="form-group"><label class="form-label">小时</label><input type="text" id="hour" class="form-input" value="0"></div>
            <div class="form-group"><label class="form-label">日</label><input type="text" id="day" class="form-input" value="*"></div>
            <div class="form-group"><label class="form-label">月</label><input type="text" id="month" class="form-input" value="*"></div>
            <div class="form-group"><label class="form-label">星期</label><input type="text" id="weekday" class="form-input" value="*"></div>
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成表达式</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">Cron表达式</label>
            <div id="result" class="result-area" style="font-size:var(--text-lg);">点击生成按钮...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const frequency = document.getElementById('frequency');
    const minute = document.getElementById('minute');
    const hour = document.getElementById('hour');
    const day = document.getElementById('day');
    const month = document.getElementById('month');
    const weekday = document.getElementById('weekday');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    frequency.addEventListener('change', () => {
      switch (frequency.value) {
        case 'every-minute': minute.value = '*'; hour.value = '*'; day.value = '*'; month.value = '*'; weekday.value = '*'; break;
        case 'every-5min': minute.value = '*/5'; hour.value = '*'; day.value = '*'; month.value = '*'; weekday.value = '*'; break;
        case 'every-hour': minute.value = '0'; hour.value = '*'; day.value = '*'; month.value = '*'; weekday.value = '*'; break;
        case 'daily': minute.value = '0'; hour.value = '0'; day.value = '*'; month.value = '*'; weekday.value = '*'; break;
        case 'weekly': minute.value = '0'; hour.value = '0'; day.value = '*'; month.value = '*'; weekday.value = '0'; break;
        case 'monthly': minute.value = '0'; hour.value = '0'; day.value = '1'; month.value = '*'; weekday.value = '*'; break;
      }
    });

    generateBtn.addEventListener('click', () => {
      const cron = minute.value + ' ' + hour.value + ' ' + day.value + ' ' + month.value + ' ' + weekday.value;
      const desc = {
        'every-minute': '每分钟执行', 'every-5min': '每5分钟执行', 'every-hour': '每小时执行',
        'daily': '每天午夜执行', 'weekly': '每周日午夜执行', 'monthly': '每月1日午夜执行'
      };
      result.textContent = cron + '\\n\\n说明: ' + (desc[frequency.value] || '自定义时间');
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '点击生成按钮...') {
        navigator.clipboard.writeText(text.split('\\n')[0]).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// Currency Converter
generateToolPage('currency.astro', '货币转换', '常见货币汇率换算', `
          <div style="display:flex;gap:var(--space-2);align-items:flex-end;">
            <div class="form-group" style="flex:1;">
              <label class="form-label" for="amount">金额</label>
              <input type="number" id="amount" class="form-input" value="100" min="0">
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label" for="from">从</label>
              <select id="from" class="form-select">
                <option value="USD">USD 美元</option>
                <option value="CNY" selected>CNY 人民币</option>
                <option value="EUR">EUR 欧元</option>
                <option value="GBP">GBP 英镑</option>
                <option value="JPY">JPY 日元</option>
                <option value="HKD">HKD 港币</option>
                <option value="KRW">KRW 韩元</option>
                <option value="TWD">TWD 台币</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;">
              <label class="form-label" for="to">到</label>
              <select id="to" class="form-select">
                <option value="USD" selected>USD 美元</option>
                <option value="CNY">CNY 人民币</option>
                <option value="EUR">EUR 欧元</option>
                <option value="GBP">GBP 英镑</option>
                <option value="JPY">JPY 日元</option>
                <option value="HKD">HKD 港币</option>
                <option value="KRW">KRW 韩元</option>
                <option value="TWD">TWD 台币</option>
              </select>
            </div>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">转换</button>
            <button id="swap-btn" class="btn btn-secondary">交换</button>
          </div>
          <div class="form-group">
            <label class="form-label">转换结果</label>
            <div id="result" class="result-area" style="font-size:var(--text-lg);">点击转换按钮...</div>
          </div>`, `
  const RATES = {
    USD: 1, CNY: 7.24, EUR: 0.92, GBP: 0.79, JPY: 149.50, HKD: 7.82, KRW: 1320, TWD: 31.5
  };

  document.addEventListener('DOMContentLoaded', () => {
    const amount = document.getElementById('amount');
    const from = document.getElementById('from');
    const to = document.getElementById('to');
    const convertBtn = document.getElementById('convert-btn');
    const swapBtn = document.getElementById('swap-btn');
    const result = document.getElementById('result');

    function convert() {
      const amt = parseFloat(amount.value) || 0;
      const fromRate = RATES[from.value];
      const toRate = RATES[to.value];
      const converted = (amt / fromRate) * toRate;
      result.textContent = amt + ' ' + from.value + ' = ' + converted.toFixed(2) + ' ' + to.value + '\\n汇率: 1 ' + from.value + ' = ' + (toRate / fromRate).toFixed(4) + ' ' + to.value;
    }

    convertBtn.addEventListener('click', convert);
    swapBtn.addEventListener('click', () => {
      const temp = from.value;
      from.value = to.value;
      to.value = temp;
      convert();
    });
  });`);

// Invisible Chars
generateToolPage('invisible-chars.astro', '不可见字符', '检测和清除不可见字符', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="粘贴可能包含不可见字符的文本..."></textarea>
          </div>
          <div class="btn-group">
            <button id="detect-btn" class="btn btn-primary">检测</button>
            <button id="clean-btn" class="btn btn-secondary">清除</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const detectBtn = document.getElementById('detect-btn');
    const cleanBtn = document.getElementById('clean-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    detectBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text) { result.textContent = '请输入文本'; return; }
      const invisible = [];
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if ((code >= 0 && code <= 31) || code === 127 || (code >= 128 && code <= 159) || code === 160 || code === 8203 || code === 8204 || code === 8205 || code === 65279) {
          invisible.push({ pos: i, code: 'U+' + code.toString(16).toUpperCase().padStart(4, '0'), char: text[i] });
        }
      }
      if (invisible.length === 0) {
        result.textContent = '未检测到不可见字符';
      } else {
        result.textContent = '检测到 ' + invisible.length + ' 个不可见字符:\\n\\n位置  Unicode  名称\\n' + invisible.map(c => c.pos.toString().padStart(4) + '  ' + c.code + '    ' + c.char).join('\\n');
      }
    });

    cleanBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text) { result.textContent = '请输入文本'; return; }
      const cleaned = text.replace(/[\\x00-\\x1F\\x7F\\x80-\\x9F\\xA0\\u200B-\\u200D\\uFEFF]/g, '');
      result.textContent = '已清除不可见字符\\n\\n' + cleaned;
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

// Datetime Format
generateToolPage('datetime-format.astro', '日期时间格式化', '格式化日期时间显示', `
          <div class="form-group">
            <label class="form-label" for="date-input">选择日期时间</label>
            <input type="datetime-local" id="date-input" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">格式模板</label>
            <select id="format" class="form-select">
              <option value="YYYY-MM-DD HH:mm:ss">YYYY-MM-DD HH:mm:ss</option>
              <option value="YYYY/MM/DD HH:mm">YYYY/MM/DD HH:mm</option>
              <option value="MM/DD/YYYY hh:mm A">MM/DD/YYYY hh:mm A</option>
              <option value="DD-MM-YYYY">DD-MM-YYYY</option>
              <option value="YYYY年MM月DD日">YYYY年MM月DD日</option>
              <option value="relative">相对时间</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="format-btn" class="btn btn-primary">格式化</button>
            <button id="now-btn" class="btn btn-secondary">当前时间</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">格式化结果</label>
            <div id="result" class="result-area" style="font-size:var(--text-lg);">选择日期并格式化...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('date-input');
    const format = document.getElementById('format');
    const formatBtn = document.getElementById('format-btn');
    const nowBtn = document.getElementById('now-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    function formatDate(date, fmt) {
      const pad = (n, l = 2) => n.toString().padStart(l, '0');
      const map = {
        'YYYY': date.getFullYear(), 'MM': pad(date.getMonth() + 1), 'DD': pad(date.getDate()),
        'HH': pad(date.getHours()), 'mm': pad(date.getMinutes()), 'ss': pad(date.getSeconds()),
        'hh': pad(date.getHours() % 12 || 12), 'A': date.getHours() >= 12 ? 'PM' : 'AM'
      };
      return fmt.replace(/YYYY|MM|DD|HH|mm|ss|hh|A/g, m => map[m]);
    }

    function relativeTime(date) {
      const now = new Date();
      const diff = now - date;
      const absDiff = Math.abs(diff);
      const seconds = Math.floor(absDiff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const months = Math.floor(days / 30);
      const years = Math.floor(days / 365);
      const prefix = diff > 0 ? '' : '';
      if (years > 0) return prefix + years + '年前';
      if (months > 0) return prefix + months + '个月前';
      if (days > 0) return prefix + days + '天前';
      if (hours > 0) return prefix + hours + '小时前';
      if (minutes > 0) return prefix + minutes + '分钟前';
      return '刚刚';
    }

    formatBtn.addEventListener('click', () => {
      const date = new Date(dateInput.value);
      if (isNaN(date.getTime())) { result.textContent = '请选择有效日期'; return; }
      if (format.value === 'relative') {
        result.textContent = relativeTime(date);
      } else {
        result.textContent = formatDate(date, format.value);
      }
    });

    nowBtn.addEventListener('click', () => {
      const now = new Date();
      dateInput.value = now.toISOString().slice(0, 16);
      result.textContent = formatDate(now, format.value === 'relative' ? 'YYYY-MM-DD HH:mm:ss' : format.value);
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '选择日期并格式化...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`);

// Markdown Editor
generateToolPage('markdown-editor.astro', 'Markdown编辑器', '在线编辑和预览Markdown', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);">
            <div class="form-group">
              <label class="form-label">Markdown 输入</label>
              <textarea id="md-input" class="form-textarea" style="min-height:400px;" placeholder="# 标题&#10;&#10;**粗体** *斜体*&#10;&#10;- 列表项1&#10;- 列表项2&#10;&#10;\`代码\`"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">预览</label>
              <div id="preview" style="padding:var(--space-4);background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);min-height:400px;overflow-y:auto;"></div>
            </div>
          </div>`, `
  function mdToHtml(md) {
    return md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
      .replace(/\`(.+?)\`/g, '<code>$1</code>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\\/li>\\n?)+/g, '<ul>$&</ul>')
      .replace(/\\n\\n/g, '</p><p>')
      .replace(/^/g, '<p>')
      .replace(/$/g, '</p>');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const mdInput = document.getElementById('md-input');
    const preview = document.getElementById('preview');

    mdInput.addEventListener('input', () => {
      preview.innerHTML = mdToHtml(mdInput.value);
    });
  });`);

// Regex Library
generateToolPage('regex-library.astro', '正则表达式库', '常用正则表达式参考', `
          <div class="form-group">
            <label class="form-label" for="test-input">测试文本</label>
            <input type="text" id="test-input" class="form-input" placeholder="输入要测试的文本...">
          </div>
          <div class="form-group">
            <label class="form-label">常用正则</label>
            <div id="regex-list" style="display:flex;flex-direction:column;gap:var(--space-2);"></div>
          </div>`, `
  const REGEXES = [
    { name: '邮箱', pattern: /^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$/ },
    { name: '手机号', pattern: /^1[3-9]\\d{9}$/ },
    { name: 'URL', pattern: /^https?:\\/\\/.+/ },
    { name: 'IP地址', pattern: /^(\\d{1,3}\\.){3}\\d{1,3}$/ },
    { name: '身份证号', pattern: /^\\d{17}[\\dXx]$/ },
    { name: '日期(YYYY-MM-DD)', pattern: /^\\d{4}-\\d{2}-\\d{2}$/ },
    { name: '时间(HH:mm)', pattern: /^\\d{2}:\\d{2}$/ },
    { name: '邮政编码', pattern: /^\\d{6}$/ },
    { name: '纯数字', pattern: /^\\d+$/ },
    { name: '纯字母', pattern: /^[a-zA-Z]+$/ },
    { name: '中文', pattern: /^[\\u4e00-\\u9fa5]+$/ },
    { name: '密码强度(8位含大小写数字)', pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$/ }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    const testInput = document.getElementById('test-input');
    const regexList = document.getElementById('regex-list');

    function render() {
      const text = testInput.value;
      regexList.innerHTML = REGEXES.map(r => {
        const match = text ? r.pattern.test(text) : null;
        const status = match === null ? '' : (match ? '✅ 匹配' : '❌ 不匹配');
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-2);background:var(--bg-primary);border-radius:var(--radius-md);"><span><strong>' + r.name + '</strong><br><code style="font-size:var(--text-xs);">' + r.pattern.source + '</code></span><span style="color:' + (match === true ? 'var(--color-success)' : match === false ? 'var(--color-error)' : 'var(--text-secondary)') + '">' + status + '</span></div>';
      }).join('');
    }

    testInput.addEventListener('input', render);
    render();
  });`);

// Screen Record
generateToolPage('screen-record.astro', '屏幕录制', '录制屏幕视频', `
          <div style="text-align:center;padding:var(--space-8);">
            <video id="preview" autoplay muted style="max-width:100%;border-radius:var(--radius-xl);border:1px solid var(--border-primary);background:#000;"></video>
            <div class="btn-group" style="justify-content:center;margin-top:var(--space-4);">
              <button id="start-btn" class="btn btn-primary">开始录制</button>
              <button id="stop-btn" class="btn btn-secondary" disabled>停止录制</button>
              <button id="download-btn" class="btn btn-secondary" disabled>下载视频</button>
            </div>
            <div id="status" style="margin-top:var(--space-4);color:var(--text-secondary);">点击开始录制</div>
          </div>`, `
  let mediaRecorder = null;
  let chunks = [];
  let stream = null;

  document.addEventListener('DOMContentLoaded', () => {
    const preview = document.getElementById('preview');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const downloadBtn = document.getElementById('download-btn');
    const status = document.getElementById('status');

    startBtn.addEventListener('click', async () => {
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        preview.srcObject = stream;
        mediaRecorder = new MediaRecorder(stream);
        chunks = [];
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          preview.srcObject = null;
          preview.src = URL.createObjectURL(blob);
          downloadBtn.disabled = false;
          status.textContent = '录制完成! 大小: ' + (blob.size / 1024 / 1024).toFixed(2) + ' MB';
        };
        mediaRecorder.start();
        startBtn.disabled = true;
        stopBtn.disabled = false;
        status.textContent = '录制中...';
      } catch (e) {
        status.textContent = '录制失败: ' + e.message;
      }
    });

    stopBtn.addEventListener('click', () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        stream.getTracks().forEach(t => t.stop());
      }
      startBtn.disabled = false;
      stopBtn.disabled = true;
    });

    downloadBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = preview.src; a.download = 'recording_' + Date.now() + '.webm';
      a.click();
    });
  });`);

// SVG Preview
generateToolPage('svg-preview.astro', 'SVG预览', '预览和编辑SVG代码', `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);">
            <div class="form-group">
              <label class="form-label" for="svg-input">SVG代码</label>
              <textarea id="svg-input" class="form-textarea" style="min-height:400px;" placeholder='<svg width="100" height="100">&#10;  <circle cx="50" cy="50" r="40" fill="#D97757"/>&#10;</svg>'></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">预览</label>
              <div id="preview" style="padding:var(--space-4);background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);min-height:400px;display:flex;align-items:center;justify-content:center;"></div>
            </div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const svgInput = document.getElementById('svg-input');
    const preview = document.getElementById('preview');

    svgInput.addEventListener('input', () => {
      preview.innerHTML = svgInput.value;
    });
  });`);

// Rich Editor
generateToolPage('rich-editor.astro', '富文本编辑器', '在线富文本编辑', `
          <div class="btn-group" style="margin-bottom:var(--space-4);">
            <button class="btn btn-secondary" onclick="document.execCommand('bold')"><b>B</b></button>
            <button class="btn btn-secondary" onclick="document.execCommand('italic')"><i>I</i></button>
            <button class="btn btn-secondary" onclick="document.execCommand('underline')"><u>U</u></button>
            <button class="btn btn-secondary" onclick="document.execCommand('strikeThrough')"><s>S</s></button>
            <button class="btn btn-secondary" onclick="document.execCommand('insertUnorderedList')">• 列表</button>
            <button class="btn btn-secondary" onclick="document.execCommand('insertOrderedList')">1. 列表</button>
            <button class="btn btn-secondary" onclick="document.execCommand('justifyLeft')">左对齐</button>
            <button class="btn btn-secondary" onclick="document.execCommand('justifyCenter')">居中</button>
            <button class="btn btn-secondary" onclick="document.execCommand('justifyRight')">右对齐</button>
          </div>
          <div id="editor" contenteditable="true" style="min-height:400px;padding:var(--space-4);background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);"></div>
          <div class="btn-group" style="margin-top:var(--space-4);">
            <button id="html-btn" class="btn btn-primary">查看HTML</button>
            <button id="copy-btn" class="btn btn-secondary">复制HTML</button>
          </div>
          <div id="html-output" class="result-area" style="display:none;margin-top:var(--space-4);"></div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const htmlBtn = document.getElementById('html-btn');
    const copyBtn = document.getElementById('copy-btn');
    const htmlOutput = document.getElementById('html-output');

    htmlBtn.addEventListener('click', () => {
      htmlOutput.style.display = htmlOutput.style.display === 'none' ? 'block' : 'none';
      htmlOutput.textContent = editor.innerHTML;
    });

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(editor.innerHTML).then(() => {
        const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
        setTimeout(() => { copyBtn.textContent = orig; }, 1500);
      });
    });
  });`);

// Browser Fingerprint
generateToolPage('browser-fingerprint.astro', '浏览器指纹', '查看浏览器设备信息', `
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成指纹</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div id="result" class="result-area">点击生成按钮...</div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    generateBtn.addEventListener('click', () => {
      const info = {
        'User-Agent': navigator.userAgent,
        '语言': navigator.language,
        '屏幕分辨率': screen.width + 'x' + screen.height,
        '颜色深度': screen.colorDepth + '位',
        '像素比': window.devicePixelRatio,
        '时区': Intl.DateTimeFormat().resolvedOptions().timeZone,
        '时区偏移': new Date().getTimezoneOffset() + '分钟',
        '平台': navigator.platform,
        'CPU核心': navigator.hardwareConcurrency || '未知',
        '内存': navigator.deviceMemory ? navigator.deviceMemory + 'GB' : '未知',
        'Cookie启用': navigator.cookieEnabled,
        'Do Not Track': navigator.doNotTrack || '未设置',
        'WebGL': (() => { try { const c = document.createElement('canvas'); const gl = c.getContext('webgl'); return gl ? gl.getParameter(gl.RENDERER) : '不支持'; } catch(e) { return '错误'; } })(),
        '触摸支持': navigator.maxTouchPoints > 0 ? '是 (' + navigator.maxTouchPoints + '点)' : '否'
      };
      result.textContent = Object.entries(info).map(([k, v]) => k + ': ' + v).join('\\n');
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

// ID Card
generateToolPage('id-card.astro', '身份证工具', '身份证号码验证和信息提取', `
          <div class="form-group">
            <label class="form-label" for="id-input">身份证号码</label>
            <input type="text" id="id-input" class="form-input" placeholder="输入18位身份证号码" maxlength="18">
          </div>
          <div class="btn-group">
            <button id="verify-btn" class="btn btn-primary">验证并提取</button>
          </div>
          <div class="form-group">
            <label class="form-label">提取结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const idInput = document.getElementById('id-input');
    const verifyBtn = document.getElementById('verify-btn');
    const result = document.getElementById('result');

    verifyBtn.addEventListener('click', () => {
      const id = idInput.value.trim();
      if (!/^\\d{17}[\\dXx]$/.test(id)) { result.textContent = '无效的身份证号码格式'; return; }
      const birthYear = parseInt(id.substring(6, 10));
      const birthMonth = parseInt(id.substring(10, 12));
      const birthDay = parseInt(id.substring(12, 14));
      const gender = parseInt(id.charAt(16)) % 2 === 0 ? '女' : '男';
      const age = new Date().getFullYear() - birthYear;
      const provinces = {'11':'北京','12':'天津','13':'河北','14':'山西','15':'内蒙古','21':'辽宁','22':'吉林','23':'黑龙江','31':'上海','32':'江苏','33':'浙江','34':'安徽','35':'福建','36':'江西','37':'山东','41':'河南','42':'湖北','43':'湖南','44':'广东','45':'广西','46':'海南','50':'重庆','51':'四川','52':'贵州','53':'云南','54':'西藏','61':'陕西','62':'甘肃','63':'青海','64':'宁夏','65':'新疆'};
      const province = provinces[id.substring(0, 2)] || '未知';
      result.textContent = '省份: ' + province + '\\n出生日期: ' + birthYear + '-' + birthMonth.toString().padStart(2, '0') + '-' + birthDay.toString().padStart(2, '0') + '\\n年龄: ' + age + '岁\\n性别: ' + gender + '\\n校验码: ' + id.charAt(17).toUpperCase();
    });
  });`);

// Credit Card
generateToolPage('credit-card.astro', '信用卡工具', '信用卡号码验证', `
          <div class="form-group">
            <label class="form-label" for="card-input">信用卡号</label>
            <input type="text" id="card-input" class="form-input" placeholder="输入信用卡号" maxlength="19">
          </div>
          <div class="btn-group">
            <button id="verify-btn" class="btn btn-primary">验证</button>
          </div>
          <div class="form-group">
            <label class="form-label">验证结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const cardInput = document.getElementById('card-input');
    const verifyBtn = document.getElementById('verify-btn');
    const result = document.getElementById('result');

    function luhnCheck(num) {
      let sum = 0, alt = false;
      for (let i = num.length - 1; i >= 0; i--) {
        let n = parseInt(num[i], 10);
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n; alt = !alt;
      }
      return sum % 10 === 0;
    }

    verifyBtn.addEventListener('click', () => {
      const card = cardInput.value.replace(/\\s/g, '');
      if (!/^\\d{13,19}$/.test(card)) { result.textContent = '无效的卡号格式'; return; }
      const valid = luhnCheck(card);
      let type = '未知';
      if (/^4/.test(card)) type = 'Visa';
      else if (/^5[1-5]/.test(card)) type = 'MasterCard';
      else if (/^3[47]/.test(card)) type = 'American Express';
      else if (/^6(?:011|5)/.test(card)) type = 'Discover';
      result.textContent = '卡类型: ' + type + '\\nLuhn校验: ' + (valid ? '✅ 有效' : '❌ 无效') + '\\n卡号长度: ' + card.length + '位';
    });
  });`);

// Meta Generator
generateToolPage('meta-generator.astro', 'Meta标签生成', '生成网页Meta标签', `
          <div class="form-group">
            <label class="form-label" for="title">页面标题</label>
            <input type="text" id="title" class="form-input" placeholder="My Website">
          </div>
          <div class="form-group">
            <label class="form-label" for="description">页面描述</label>
            <textarea id="description" class="form-textarea" placeholder="A brief description of the page..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="keywords">关键词（逗号分隔）</label>
            <input type="text" id="keywords" class="form-input" placeholder="web, design, development">
          </div>
          <div class="form-group">
            <label class="form-label" for="author">作者</label>
            <input type="text" id="author" class="form-input" placeholder="Author Name">
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成Meta标签</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">生成的HTML</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const title = document.getElementById('title');
    const description = document.getElementById('description');
    const keywords = document.getElementById('keywords');
    const author = document.getElementById('author');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    generateBtn.addEventListener('click', () => {
      let html = '';
      if (title.value) html += '<title>' + title.value + '</title>\\n';
      if (title.value) html += '<meta property="og:title" content="' + title.value + '">\\n';
      if (description.value) html += '<meta name="description" content="' + description.value + '">\\n';
      if (description.value) html += '<meta property="og:description" content="' + description.value + '">\\n';
      if (keywords.value) html += '<meta name="keywords" content="' + keywords.value + '">\\n';
      if (author.value) html += '<meta name="author" content="' + author.value + '">\\n';
      html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\\n';
      html += '<meta charset="UTF-8">\\n';
      html += '<meta property="og:type" content="website">';
      result.textContent = html;
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

// Link to Hyperlink
generateToolPage('link-to-hyperlink.astro', '链接转超链接', '将纯文本链接转换为HTML超链接', `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="访问 https://example.com 或 http://test.com/page"></textarea>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">转换</button>
            <button id="copy-btn" class="btn btn-secondary">复制HTML</button>
          </div>
          <div class="form-group">
            <label class="form-label">转换结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    convertBtn.addEventListener('click', () => {
      const text = inputText.value;
      if (!text.trim()) { result.textContent = '请输入文本'; return; }
      const html = text.replace(/(https?:\\/\\/[^\\s<>"')\\]}]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
      result.textContent = html;
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

// HTML Remove Tags
generateToolPage('html-remove-tags.astro', 'HTML标签删除', '选择性删除HTML标签', `
          <div class="form-group">
            <label class="form-label" for="html-input">输入HTML</label>
            <textarea id="html-input" class="form-textarea" placeholder="<div><p>Hello <span>World</span></p></div>"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="tags-to-remove">要删除的标签（逗号分隔）</label>
            <input type="text" id="tags-to-remove" class="form-input" placeholder="span,div">
          </div>
          <div class="btn-group">
            <button id="remove-btn" class="btn btn-primary">删除标签</button>
            <button id="copy-btn" class="btn btn-secondary">复制</button>
          </div>
          <div class="form-group">
            <label class="form-label">处理结果</label>
            <div id="result" class="result-area">等待输入...</div>
          </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const htmlInput = document.getElementById('html-input');
    const tagsToRemove = document.getElementById('tags-to-remove');
    const removeBtn = document.getElementById('remove-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    removeBtn.addEventListener('click', () => {
      let html = htmlInput.value;
      const tags = tagsToRemove.value.split(',').map(t => t.trim()).filter(t => t);
      if (!html || tags.length === 0) { result.textContent = '请输入HTML和要删除的标签'; return; }
      tags.forEach(tag => {
        html = html.replace(new RegExp('<' + tag + '[^>]*>(.*?)</' + tag + '>', 'gis'), '$1');
        html = html.replace(new RegExp('<' + tag + '[^>]*/?>', 'gi'), '');
      });
      result.textContent = html;
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

// File Base64
generateToolPage('file-base64.astro', '文件Base64', '文件与Base64互转', `
          <label class="file-upload" for="file-input" style="display:flex;flex-direction:column;align-items:center;padding:var(--space-8);border:2px dashed var(--border-primary);border-radius:var(--radius-xl);cursor:pointer;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            <p>选择文件</p>
            <input type="file" id="file-input" style="display:none;">
          </label>
          <div class="btn-group">
            <button id="copy-btn" class="btn btn-secondary" disabled>复制Base64</button>
            <button id="download-btn" class="btn btn-secondary" disabled>下载文件</button>
          </div>
          <div id="result" class="result-area" style="max-height:300px;overflow-y:auto;">等待选择文件...</div>`, `
  let base64Result = '';
  let fileName = '';

  document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const result = document.getElementById('result');

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      fileName = file.name;
      const reader = new FileReader();
      reader.onload = (ev) => {
        base64Result = ev.target.result;
        const size = (base64Result.length / 1024).toFixed(1);
        result.textContent = '文件: ' + file.name + '\\n类型: ' + file.type + '\\n大小: ' + (file.size / 1024).toFixed(1) + ' KB\\nBase64长度: ' + size + ' KB\\n\\n' + base64Result;
        copyBtn.disabled = false;
        downloadBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    });

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(base64Result).then(() => {
        const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
        setTimeout(() => { copyBtn.textContent = orig; }, 1500);
      });
    });

    downloadBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = base64Result; a.download = fileName;
      a.click();
    });
  });`);

console.log('\\n✅ 第三批工具生成完成');
console.log('Done!');