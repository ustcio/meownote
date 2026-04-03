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
  .search-bar { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
  .search-bar .form-input { flex: 1; }
  .data-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  .data-table th, .data-table td { padding: var(--space-2) var(--space-3); text-align: left; border-bottom: 1px solid var(--border-primary); }
  .data-table th { background: var(--bg-tertiary); font-weight: var(--font-medium); position: sticky; top: 0; }
  .data-table tr:hover { background: var(--bg-hover); }
  .table-wrapper { max-height: 500px; overflow-y: auto; border: 1px solid var(--border-primary); border-radius: var(--radius-lg); }
  .emoji-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: var(--space-2); }
  .emoji-item { display: flex; flex-direction: column; align-items: center; padding: var(--space-2); border-radius: var(--radius-md); cursor: pointer; transition: background var(--duration-fast) var(--ease-default); }
  .emoji-item:hover { background: var(--bg-hover); }
  .emoji-item .emoji { font-size: 1.5rem; }
  .emoji-item .code { font-size: var(--text-xs); color: var(--text-tertiary); font-family: var(--font-mono); }
  .tag-list { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .tag { background: var(--bg-tertiary); border: 1px solid var(--border-primary); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full); font-size: var(--text-xs); }
  .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .calendar-header { text-align: center; font-weight: var(--font-medium); padding: var(--space-2); font-size: var(--text-xs); color: var(--text-secondary); }
  .calendar-day { text-align: center; padding: var(--space-2); border-radius: var(--radius-md); font-size: var(--text-sm); cursor: pointer; }
  .calendar-day:hover { background: var(--bg-hover); }
  .calendar-day.today { background: var(--color-primary); color: #fffdf9; font-weight: var(--font-bold); }
  .calendar-day.other-month { color: var(--text-tertiary); }
  .calendar-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
  .calendar-nav h3 { font-size: var(--text-lg); font-weight: var(--font-semibold); }
  .calendar-nav button { background: none; border: 1px solid var(--border-primary); border-radius: var(--radius-md); padding: var(--space-1) var(--space-3); cursor: pointer; color: var(--text-primary); }
  .calendar-nav button:hover { background: var(--bg-hover); }
  .timezone-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-3); }
  .timezone-card { background: var(--bg-primary); border: 1px solid var(--border-primary); border-radius: var(--radius-lg); padding: var(--space-4); }
  .timezone-card .city { font-weight: var(--font-semibold); margin-bottom: var(--space-1); }
  .timezone-card .time { font-size: var(--text-xl); font-family: var(--font-mono); color: var(--color-primary); }
  .timezone-card .date { font-size: var(--text-xs); color: var(--text-secondary); }
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

// 1. 到期日计算
generateToolPage('due-date.astro', '到期日计算', '计算从今天起若干天后的日期', `
  <div class="form-group">
    <label class="form-label" for="start-date">起始日期</label>
    <input type="date" id="start-date" class="form-input">
  </div>
  <div class="form-group">
    <label class="form-label" for="days">天数</label>
    <input type="number" id="days" class="form-input" placeholder="输入天数（正数=往后，负数=往前）" value="30">
  </div>
  <div class="form-group">
    <label class="form-label">选项</label>
    <div class="checkbox-group">
      <label><input type="checkbox" id="exclude-weekends"> 排除周末</label>
      <label><input type="checkbox" id="include-today" checked> 包含今天</label>
    </div>
  </div>
  <div class="btn-group">
    <button id="calc-btn" class="btn btn-primary">计算</button>
    <button id="copy-btn" class="btn btn-secondary">复制结果</button>
  </div>
  <div class="form-group">
    <label class="form-label">计算结果</label>
    <div id="result" class="result-area">等待输入...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const startDate = document.getElementById('start-date');
    const days = document.getElementById('days');
    const calcBtn = document.getElementById('calc-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');
    const excludeWeekends = document.getElementById('exclude-weekends');
    const includeToday = document.getElementById('include-today');

    startDate.valueAsDate = new Date();

    calcBtn.addEventListener('click', () => {
      const start = new Date(startDate.value);
      let d = parseInt(days.value);
      if (isNaN(d)) { result.textContent = '请输入有效天数'; return; }

      let current = new Date(start);
      if (!includeToday.checked) {
        current.setDate(current.getDate() + (d > 0 ? 1 : -1));
        d = d > 0 ? d - 1 : d + 1;
      }

      const step = d > 0 ? 1 : -1;
      let count = Math.abs(d);

      while (count > 0) {
        current.setDate(current.getDate() + step);
        if (excludeWeekends.checked) {
          const day = current.getDay();
          if (day === 0 || day === 6) continue;
        }
        count--;
      }

      const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
      const output = '到期日期: ' + current.toLocaleDateString('zh-CN') + '\\n' +
                     '星期: ' + weekdays[current.getDay()] + '\\n' +
                     '时间戳: ' + current.getTime();
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

// 2. 相对日期
generateToolPage('relative.astro', '相对日期计算', '计算两个日期之间的天数差', `
  <div style="display:flex;gap:var(--space-4);flex-wrap:wrap;">
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="date1">日期1</label>
      <input type="date" id="date1" class="form-input">
    </div>
    <div class="form-group" style="flex:1;">
      <label class="form-label" for="date2">日期2</label>
      <input type="date" id="date2" class="form-input">
    </div>
  </div>
  <div class="btn-group">
    <button id="calc-btn" class="btn btn-primary">计算差值</button>
    <button id="today-btn" class="btn btn-secondary">设为今天</button>
  </div>
  <div class="form-group">
    <label class="form-label">计算结果</label>
    <div id="result" class="result-area">等待输入...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const date1 = document.getElementById('date1');
    const date2 = document.getElementById('date2');
    const calcBtn = document.getElementById('calc-btn');
    const todayBtn = document.getElementById('today-btn');
    const result = document.getElementById('result');

    date1.valueAsDate = new Date();
    date2.valueAsDate = new Date();

    todayBtn.addEventListener('click', () => {
      date1.valueAsDate = new Date();
      date2.valueAsDate = new Date();
    });

    calcBtn.addEventListener('click', () => {
      const d1 = new Date(date1.value);
      const d2 = new Date(date2.value);
      if (isNaN(d1) || isNaN(d2)) { result.textContent = '请选择有效日期'; return; }

      const diffMs = Math.abs(d2 - d1);
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.abs((d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()));
      const diffYears = Math.abs(d2.getFullYear() - d1.getFullYear());

      result.textContent = '天数差: ' + diffDays + ' 天\\n' +
                           '周数差: ' + diffWeeks + ' 周 ' + (diffDays % 7) + ' 天\\n' +
                           '月数差: ' + diffMonths + ' 个月\\n' +
                           '年数差: ' + diffYears + ' 年\\n' +
                           '小时差: ' + Math.floor(diffMs / (1000 * 60 * 60)) + ' 小时\\n' +
                           '分钟差: ' + Math.floor(diffMs / (1000 * 60)) + ' 分钟\\n' +
                           '秒数差: ' + Math.floor(diffMs / 1000) + ' 秒';
    });
  });
`);

// 3. 日历
generateToolPage('calendar.astro', '日历', '查看月历，支持切换月份', `
  <div class="calendar-nav">
    <button id="prev-month">&lt; 上月</button>
    <h3 id="month-title"></h3>
    <button id="next-month">下月 &gt;</button>
  </div>
  <div class="calendar-grid" id="calendar-grid"></div>`, `
  let currentYear, currentMonth;
  const today = new Date();

  function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const title = document.getElementById('month-title');
    title.textContent = currentYear + '年' + (currentMonth + 1) + '月';

    const weekdays = ['日','一','二','三','四','五','六'];
    let html = weekdays.map(d => '<div class="calendar-header">' + d + '</div>').join('');

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    for (let i = firstDay - 1; i >= 0; i--) {
      html += '<div class="calendar-day other-month">' + (daysInPrevMonth - i) + '</div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
      html += '<div class="calendar-day' + (isToday ? ' today' : '') + '">' + d + '</div>';
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - totalCells % 7) % 7;
    for (let i = 1; i <= remaining; i++) {
      html += '<div class="calendar-day other-month">' + i + '</div>';
    }

    grid.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', () => {
    currentYear = today.getFullYear();
    currentMonth = today.getMonth();
    renderCalendar();

    document.getElementById('prev-month').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      renderCalendar();
    });
  });
`);

// 4. 世界时间
generateToolPage('world-time.astro', '世界时钟', '查看世界各地当前时间', `
  <div class="timezone-grid" id="timezone-grid"></div>`, `
  const timezones = [
    { city: '北京', tz: 'Asia/Shanghai', flag: '🇨🇳' },
    { city: '东京', tz: 'Asia/Tokyo', flag: '🇯🇵' },
    { city: '首尔', tz: 'Asia/Seoul', flag: '🇰🇷' },
    { city: '新加坡', tz: 'Asia/Singapore', flag: '🇸🇬' },
    { city: '孟买', tz: 'Asia/Kolkata', flag: '🇮🇳' },
    { city: '迪拜', tz: 'Asia/Dubai', flag: '🇦🇪' },
    { city: '莫斯科', tz: 'Europe/Moscow', flag: '🇷🇺' },
    { city: '柏林', tz: 'Europe/Berlin', flag: '🇩🇪' },
    { city: '巴黎', tz: 'Europe/Paris', flag: '🇫🇷' },
    { city: '伦敦', tz: 'Europe/London', flag: '🇬🇧' },
    { city: '纽约', tz: 'America/New_York', flag: '🇺🇸' },
    { city: '洛杉矶', tz: 'America/Los_Angeles', flag: '🇺🇸' },
    { city: '芝加哥', tz: 'America/Chicago', flag: '🇺🇸' },
    { city: '多伦多', tz: 'America/Toronto', flag: '🇨🇦' },
    { city: '圣保罗', tz: 'America/Sao_Paulo', flag: '🇧🇷' },
    { city: '悉尼', tz: 'Australia/Sydney', flag: '🇦🇺' },
    { city: '奥克兰', tz: 'Pacific/Auckland', flag: '🇳🇿' },
    { city: '曼谷', tz: 'Asia/Bangkok', flag: '🇹🇭' },
    { city: '雅加达', tz: 'Asia/Jakarta', flag: '🇮🇩' },
    { city: '开罗', tz: 'Africa/Cairo', flag: '🇪🇬' }
  ];

  function updateTime() {
    const grid = document.getElementById('timezone-grid');
    let html = '';
    const now = new Date();

    timezones.forEach(tz => {
      const timeStr = now.toLocaleTimeString('zh-CN', { timeZone: tz.tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString('zh-CN', { timeZone: tz.tz, weekday: 'short', month: 'short', day: 'numeric' });
      html += '<div class="timezone-card"><div class="city">' + tz.flag + ' ' + tz.city + '</div><div class="time">' + timeStr + '</div><div class="date">' + dateStr + '</div></div>';
    });

    grid.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 1000);
  });
`);

// 5. 进制转换
generateToolPage('base-convert.astro', '进制转换', '二进制、八进制、十进制、十六进制互转', `
  <div class="form-group">
    <label class="form-label" for="input-value">输入数值</label>
    <input type="text" id="input-value" class="form-input" placeholder="输入任意进制的数值">
  </div>
  <div class="form-group">
    <label class="form-label" for="input-base">输入进制</label>
    <select id="input-base" class="form-select">
      <option value="2">二进制 (Base 2)</option>
      <option value="8">八进制 (Base 8)</option>
      <option value="10" selected>十进制 (Base 10)</option>
      <option value="16">十六进制 (Base 16)</option>
      <option value="32">Base 32</option>
      <option value="36">Base 36</option>
    </select>
  </div>
  <div class="btn-group">
    <button id="convert-btn" class="btn btn-primary">转换</button>
    <button id="copy-btn" class="btn btn-secondary">复制全部</button>
  </div>
  <div class="form-group">
    <label class="form-label">转换结果</label>
    <div id="result" class="result-area">等待输入...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputValue = document.getElementById('input-value');
    const inputBase = document.getElementById('input-base');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    convertBtn.addEventListener('click', () => {
      const val = inputValue.value.trim();
      const base = parseInt(inputBase.value);
      if (!val) { result.textContent = '请输入数值'; return; }

      try {
        const decimal = parseInt(val, base);
        if (isNaN(decimal)) { result.textContent = '无效的' + base + '进制数值'; return; }

        result.textContent = '二进制 (Base 2):   ' + decimal.toString(2) + '\\n' +
                             '八进制 (Base 8):   ' + decimal.toString(8) + '\\n' +
                             '十进制 (Base 10):  ' + decimal.toString(10) + '\\n' +
                             '十六进制 (Base 16): ' + decimal.toString(16).toUpperCase() + '\\n' +
                             'Base 32:           ' + decimal.toString(32).toUpperCase() + '\\n' +
                             'Base 36:           ' + decimal.toString(36).toUpperCase();
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
  });
`);

// 6. CSS转JS
generateToolPage('css-to-js.astro', 'CSS转JS对象', '将CSS样式转换为JavaScript对象格式', `
  <div class="form-group">
    <label class="form-label" for="input-css">输入CSS</label>
    <textarea id="input-css" class="form-textarea" placeholder="background-color: red;\\nfont-size: 16px;"></textarea>
  </div>
  <div class="form-group">
    <label class="form-label">输出格式</label>
    <div class="checkbox-group">
      <label><input type="radio" name="format" value="camel" checked> camelCase (backgroundColor)</label>
      <label><input type="radio" name="format" value="kebab"> kebab-case (background-color)</label>
    </div>
  </div>
  <div class="btn-group">
    <button id="convert-btn" class="btn btn-primary">转换</button>
    <button id="copy-btn" class="btn btn-secondary">复制</button>
  </div>
  <div class="form-group">
    <label class="form-label">JS对象</label>
    <div id="result" class="result-area">等待输入...</div>
  </div>`, `
  document.addEventListener('DOMContentLoaded', () => {
    const inputCss = document.getElementById('input-css');
    const convertBtn = document.getElementById('convert-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    convertBtn.addEventListener('click', () => {
      const css = inputCss.value.trim();
      if (!css) { result.textContent = '请输入CSS'; return; }

      const format = document.querySelector('input[name="format"]:checked').value;
      const lines = css.split(';').filter(l => l.trim());
      const obj = {};

      lines.forEach(line => {
        const idx = line.indexOf(':');
        if (idx > -1) {
          let key = line.substring(0, idx).trim();
          const value = line.substring(idx + 1).trim();

          if (format === 'camel') {
            key = key.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
          }

          if (value.match(/^\\d+$/)) {
            obj[key] = parseInt(value);
          } else if (value.match(/^\\d+\\.\\d+$/)) {
            obj[key] = parseFloat(value);
          } else {
            obj[key] = value;
          }
        }
      });

      result.textContent = JSON.stringify(obj, null, 2);
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

console.log('\n✅ 第六批工具生成完成');
console.log('Done!');
