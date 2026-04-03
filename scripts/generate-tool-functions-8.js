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
  .data-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  .data-table th, .data-table td { padding: var(--space-2) var(--space-3); text-align: left; border-bottom: 1px solid var(--border-primary); }
  .data-table th { background: var(--bg-tertiary); font-weight: var(--font-medium); position: sticky; top: 0; }
  .data-table tr:hover { background: var(--bg-hover); }
  .table-wrapper { max-height: 500px; overflow-y: auto; border: 1px solid var(--border-primary); border-radius: var(--radius-lg); }
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

// 1. RSA加密
generateToolPage('rsa.astro', 'RSA加密解密', '生成RSA密钥对并进行加密解密', `
  <div class="btn-group">
    <button id="generate-btn" class="btn btn-primary">生成密钥对</button>
  </div>
  <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;">
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="public-key">公钥</label>
      <textarea id="public-key" class="form-textarea" placeholder="公钥将在此显示..." readonly></textarea>
    </div>
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="private-key">私钥</label>
      <textarea id="private-key" class="form-textarea" placeholder="私钥将在此显示..." readonly></textarea>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label" for="input-text">输入文本</label>
    <textarea id="input-text" class="form-textarea" placeholder="输入要加密的文本..."></textarea>
  </div>
  <div class="btn-group">
    <button id="encrypt-btn" class="btn btn-primary">加密</button>
    <button id="decrypt-btn" class="btn btn-secondary">解密</button>
    <button id="copy-btn" class="btn btn-secondary">复制结果</button>
  </div>
  <div class="form-group">
    <label class="form-label">结果</label>
    <div id="result" class="result-area">等待操作...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const publicKeyEl = document.getElementById('public-key');
    const privateKeyEl = document.getElementById('private-key');
    const inputText = document.getElementById('input-text');
    const generateBtn = document.getElementById('generate-btn');
    const encryptBtn = document.getElementById('encrypt-btn');
    const decryptBtn = document.getElementById('decrypt-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    let keyPair = null;

    generateBtn.addEventListener('click', async () => {
      try {
        keyPair = await crypto.subtle.generateKey(
          { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
          true, ['encrypt', 'decrypt']
        );

        const pubExport = await crypto.subtle.exportKey('spki', keyPair.publicKey);
        const privExport = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

        const pubB64 = btoa(String.fromCharCode(...new Uint8Array(pubExport)));
        const privB64 = btoa(String.fromCharCode(...new Uint8Array(privExport)));

        publicKeyEl.value = '-----BEGIN PUBLIC KEY-----\\n' + pubB64.match(/.{1,64}/g).join('\\n') + '\\n-----END PUBLIC KEY-----';
        privateKeyEl.value = '-----BEGIN PRIVATE KEY-----\\n' + privB64.match(/.{1,64}/g).join('\\n') + '\\n-----END PRIVATE KEY-----';
        result.textContent = '密钥对生成成功 (RSA-2048)';
      } catch (e) {
        result.textContent = '生成失败: ' + e.message;
      }
    });

    async function importPublicKey(pem) {
      const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\\s/g, '');
      const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return crypto.subtle.importKey('spki', binary, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
    }

    async function importPrivateKey(pem) {
      const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\\s/g, '');
      const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      return crypto.subtle.importKey('pkcs8', binary, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
    }

    encryptBtn.addEventListener('click', async () => {
      if (!keyPair) { result.textContent = '请先生成密钥对'; return; }
      const text = inputText.value;
      if (!text) { result.textContent = '请输入文本'; return; }

      try {
        const encoded = new TextEncoder().encode(text);
        const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, keyPair.publicKey, encoded);
        const encryptedB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
        result.textContent = '加密结果 (Base64):\\n\\n' + encryptedB64;
      } catch (e) {
        result.textContent = '加密失败: ' + e.message;
      }
    });

    decryptBtn.addEventListener('click', async () => {
      if (!keyPair) { result.textContent = '请先生成密钥对'; return; }
      const text = inputText.value.trim();
      if (!text) { result.textContent = '请输入要解密的Base64文本'; return; }

      try {
        const encrypted = Uint8Array.from(atob(text), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, keyPair.privateKey, encrypted);
        result.textContent = '解密结果:\\n\\n' + new TextDecoder().decode(decrypted);
      } catch (e) {
        result.textContent = '解密失败: 数据不匹配或密钥错误';
      }
    });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待操作...') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });
`);

// 2. Excel转JSON (CSV转JSON)
generateToolPage('excel-to-json.astro', 'CSV转JSON', '将CSV格式数据转换为JSON', `
  <div class="form-group">
    <label class="form-label" for="input-csv">输入CSV数据</label>
    <textarea id="input-csv" class="form-textarea" placeholder="name,age,city\\nJohn,25,New York\\nJane,30,London"></textarea>
  </div>
  <div class="form-group">
    <label class="form-label">分隔符</label>
    <div class="checkbox-group">
      <label><input type="radio" name="delimiter" value="," checked> 逗号</label>
      <label><input type="radio" name="delimiter" value=";"> 分号</label>
      <label><input type="radio" name="delimiter" value="\\t"> 制表符</label>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">输出格式</label>
    <div class="checkbox-group">
      <label><input type="radio" name="format" value="array" checked> 对象数组</label>
      <label><input type="radio" name="format" value="object"> 键值对象</label>
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
    const inputCsv = document.getElementById('input-csv');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    function parseCSVLine(line, delimiter) {
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
          if (char === '"') {
            if (line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = false; }
          } else { current += char; }
        } else {
          if (char === '"') { inQuotes = true; }
          else if (char === delimiter) { result.push(current.trim()); current = ''; }
          else { current += char; }
        }
      }
      result.push(current.trim());
      return result;
    }

    convertBtn.addEventListener('click', () => {
      const csv = inputCsv.value.trim();
      if (!csv) { result.textContent = '请输入CSV数据'; return; }

      const delimiter = document.querySelector('input[name="delimiter"]:checked').value === '\\t' ? '\\t' : document.querySelector('input[name="delimiter"]:checked').value;
      const format = document.querySelector('input[name="format"]:checked').value;

      const lines = csv.split('\\n').filter(l => l.trim());
      if (lines.length < 2) { result.textContent = 'CSV至少需要标题行和一行数据'; return; }

      const headers = parseCSVLine(lines[0], delimiter);
      const data = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], delimiter);
        const row = {};
        headers.forEach((h, idx) => {
          let val = values[idx] || '';
          if (!isNaN(val) && val !== '') val = Number(val);
          row[h] = val;
        });
        data.push(row);
      }

      let output;
      if (format === 'array') {
        output = JSON.stringify(data, null, 2);
      } else {
        const obj = {};
        data.forEach(row => {
          const key = row[headers[0]] || data.indexOf(row);
          obj[key] = row;
        });
        output = JSON.stringify(obj, null, 2);
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

// 3. JSON转Excel (JSON转CSV)
generateToolPage('json-to-excel.astro', 'JSON转CSV', '将JSON数据转换为CSV格式', `
  <div class="form-group">
    <label class="form-label" for="input-json">输入JSON数据</label>
    <textarea id="input-json" class="form-textarea" placeholder='[{"name":"John","age":25},{"name":"Jane","age":30}]'></textarea>
  </div>
  <div class="form-group">
    <label class="form-label">分隔符</label>
    <div class="checkbox-group">
      <label><input type="radio" name="delimiter" value="," checked> 逗号</label>
      <label><input type="radio" name="delimiter" value=";"> 分号</label>
      <label><input type="radio" name="delimiter" value="\\t"> 制表符</label>
    </div>
  </div>
  <div class="btn-group">
    <button id="convert-btn" class="btn btn-primary">转换</button>
    <button id="copy-btn" class="btn btn-secondary">复制</button>
    <button id="download-btn" class="btn btn-secondary">下载CSV</button>
  </div>
  <div class="form-group">
    <label class="form-label">CSV结果</label>
    <div id="result" class="result-area">等待输入...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputJson = document.getElementById('input-json');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const result = document.getElementById('result');

    function escapeCSV(val) {
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    convertBtn.addEventListener('click', () => {
      const json = inputJson.value.trim();
      if (!json) { result.textContent = '请输入JSON数据'; return; }

      try {
        let data = JSON.parse(json);
        if (!Array.isArray(data)) {
          if (typeof data === 'object') data = [data];
          else { result.textContent = 'JSON必须是数组或对象'; return; }
        }
        if (data.length === 0) { result.textContent = 'JSON数组为空'; return; }

        const delimiter = document.querySelector('input[name="delimiter"]:checked').value === '\\t' ? '\\t' : document.querySelector('input[name="delimiter"]:checked').value;
        const headers = [...new Set(data.flatMap(obj => Object.keys(obj)))];

        const csvLines = [headers.join(delimiter)];
        data.forEach(row => {
          const values = headers.map(h => escapeCSV(row[h] !== undefined ? row[h] : ''));
          csvLines.push(values.join(delimiter));
        });

        result.textContent = csvLines.join('\\n');
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

// 4. 天干地支
generateToolPage('heavenly-stems.astro', '天干地支查询', '查询年份对应的天干地支生肖', `
  <div class="form-group">
    <label class="form-label" for="year-input">输入年份</label>
    <input type="number" id="year-input" class="form-input" value="2024" min="1" max="9999">
  </div>
  <div class="btn-group">
    <button id="query-btn" class="btn btn-primary">查询</button>
  </div>
  <div class="form-group">
    <label class="form-label">查询结果</label>
    <div id="result" class="result-area">等待查询...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const yearInput = document.getElementById('year-input');
    const queryBtn = document.getElementById('query-btn');
    const result = document.getElementById('result');

    const tianGan = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
    const diZhi = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    const shengXiao = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    const wuXing = ['木','木','火','火','土','土','金','金','水','水'];

    queryBtn.addEventListener('click', () => {
      const year = parseInt(yearInput.value);
      if (isNaN(year)) { result.textContent = '请输入有效年份'; return; }

      const ganIdx = (year - 4) % 10;
      const zhiIdx = (year - 4) % 12;
      const gan = tianGan[ganIdx];
      const zhi = diZhi[zhiIdx];
      const sx = shengXiao[zhiIdx];
      const wx = wuXing[ganIdx];

      result.textContent = '年份: ' + year + '\\n' +
                           '天干: ' + gan + '\\n' +
                           '地支: ' + zhi + '\\n' +
                           '干支: ' + gan + zhi + '\\n' +
                           '生肖: ' + sx + '\\n' +
                           '五行: ' + wx;
    });
  });
`);

// 5. 朝代查询
generateToolPage('dynasty.astro', '中国朝代查询', '查询中国历史朝代时间线', `
  <div class="search-bar">
    <input type="text" id="search" class="form-input" placeholder="搜索朝代名称...">
  </div>
  <div class="table-wrapper">
    <table class="data-table" id="data-table">
      <thead>
        <tr><th>朝代</th><th>起始年份</th><th>结束年份</th><th>持续时间</th><th>开国君主</th></tr>
      </thead>
      <tbody id="table-body"></tbody>
    </table>
  </div>`, `
  const dynasties = [
    ['夏','约前2070','约前1600','约470年','禹'],
    ['商','约前1600','约前1046','约554年','汤'],
    ['西周','前1046','前771','275年','周武王'],
    ['东周(春秋)','前770','前476','294年','周平王'],
    ['东周(战国)','前475','前221','254年','-'],
    ['秦','前221','前207','14年','秦始皇'],
    ['西汉','前202','公元8年','210年','刘邦'],
    ['新','8','23','15年','王莽'],
    ['东汉','25','220','195年','刘秀'],
    ['三国','220','280','60年','-'],
    ['西晋','265','316','51年','司马炎'],
    ['东晋','317','420','103年','司马睿'],
    ['南北朝','420','589','169年','-'],
    ['隋','581','618','37年','杨坚'],
    ['唐','618','907','289年','李渊'],
    ['五代十国','907','979','72年','-'],
    ['北宋','960','1127','167年','赵匡胤'],
    ['南宋','1127','1279','152年','赵构'],
    ['元','1271','1368','97年','忽必烈'],
    ['明','1368','1644','276年','朱元璋'],
    ['清','1644','1912','268年','皇太极']
  ];

  function renderTable(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = data.map(d => '<tr><td>' + d[0] + '</td><td>' + d[1] + '</td><td>' + d[2] + '</td><td>' + d[3] + '</td><td>' + d[4] + '</td></tr>').join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderTable(dynasties);
    document.getElementById('search').addEventListener('input', (e) => {
      const q = e.target.value;
      const filtered = dynasties.filter(d => d.some(v => v.includes(q)));
      renderTable(filtered);
    });
  });
`);

// 6. 历史时期
generateToolPage('period.astro', '历史时期对照', '中西方历史时期对照表', `
  <div class="search-bar">
    <input type="text" id="search" class="form-input" placeholder="搜索时期...">
  </div>
  <div class="table-wrapper">
    <table class="data-table" id="data-table">
      <thead>
        <tr><th>时期</th><th>时间范围</th><th>中国对应</th><th>特征</th></tr>
      </thead>
      <tbody id="table-body"></tbody>
    </table>
  </div>`, `
  const periods = [
    ['上古时期','约前3000-前500','夏商周','文明起源'],
    ['古典时代','前800-前200','春秋战国-秦','哲学繁荣'],
    ['希腊化时代','前323-前31','西汉','文化融合'],
    ['罗马帝国','前27-476','西汉-南北朝','帝国扩张'],
    ['中世纪早期','500-1000','南北朝-北宋','封建制度'],
    ['中世纪盛期','1000-1300','北宋-元','城市兴起'],
    ['文艺复兴','1300-1600','元-明','人文主义'],
    ['大航海时代','1400-1700','明-清','全球探索'],
    ['启蒙时代','1685-1815','清','理性主义'],
    ['工业革命','1760-1840','清','机械化生产'],
    ['维多利亚时代','1837-1901','清','帝国巅峰'],
    ['一战时期','1914-1918','民国','世界大战'],
    ['二战时期','1939-1945','民国','反法西斯'],
    ['冷战时期','1947-1991','新中国','两极格局'],
    ['信息时代','1990-至今','改革开放','数字化']
  ];

  function renderTable(data) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = data.map(d => '<tr><td>' + d[0] + '</td><td>' + d[1] + '</td><td>' + d[2] + '</td><td>' + d[3] + '</td></tr>').join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderTable(periods);
    document.getElementById('search').addEventListener('input', (e) => {
      const q = e.target.value;
      const filtered = periods.filter(d => d.some(v => v.includes(q)));
      renderTable(filtered);
    });
  });
`);

console.log('\n✅ 第八批工具生成完成');
console.log('Done!');
