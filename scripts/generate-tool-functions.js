import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.join(__dirname, '../src/pages/kit');

const toolTemplates = {
  sha: {
    title: 'SHA哈希',
    desc: '计算文本SHA-1/SHA-256/SHA-384/SHA-512哈希值',
    html: `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本</label>
            <textarea id="input-text" class="form-textarea" placeholder="请输入要计算SHA哈希的文本..."></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label" for="sha-type">哈希类型</label>
            <select id="sha-type" class="form-select">
              <option value="SHA-1">SHA-1</option>
              <option value="SHA-256" selected>SHA-256</option>
              <option value="SHA-384">SHA-384</option>
              <option value="SHA-512">SHA-512</option>
            </select>
          </div>
          
          <div class="btn-group">
            <button id="calc-btn" class="btn btn-primary">计算SHA</button>
            <button id="clear-btn" class="btn btn-secondary">清空</button>
            <button id="copy-btn" class="btn btn-secondary">复制结果</button>
          </div>

          <div class="form-group">
            <label class="form-label">SHA结果</label>
            <div id="result" class="result-area">等待计算...</div>
          </div>`,
    script: `
  async function shaHash(text, algorithm) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest(algorithm, data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const shaType = document.getElementById('sha-type');
    const calcBtn = document.getElementById('calc-btn');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    calcBtn.addEventListener('click', async () => {
      const text = inputText.value;
      if (!text) { result.textContent = '请输入文本'; return; }
      try {
        const hash = await shaHash(text, shaType.value);
        result.textContent = hash;
      } catch (e) { result.textContent = '计算失败: ' + e.message; }
    });

    clearBtn.addEventListener('click', () => { inputText.value = ''; result.textContent = '等待计算...'; });

    copyBtn.addEventListener('click', () => {
      const text = result.textContent;
      if (text && text !== '等待计算...' && text !== '请输入文本') {
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyBtn.textContent; copyBtn.textContent = '已复制!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1500);
        });
      }
    });
  });`
  },

  uuid: {
    title: 'UUID生成器',
    desc: '生成和验证UUID',
    html: `
          <div class="form-group">
            <label class="form-label" for="uuid-count">生成数量</label>
            <input type="number" id="uuid-count" class="form-input" value="5" min="1" max="100">
          </div>
          
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" id="uppercase" checked> 大写
            </label>
            <label class="form-label">
              <input type="checkbox" id="no-dashes"> 去除连字符
            </label>
          </div>
          
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成UUID</button>
            <button id="copy-btn" class="btn btn-secondary">复制全部</button>
          </div>

          <div class="form-group">
            <label class="form-label">生成结果</label>
            <div id="result" class="result-area">点击生成按钮...</div>
          </div>`,
    script: `
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const countInput = document.getElementById('uuid-count');
    const uppercase = document.getElementById('uppercase');
    const noDashes = document.getElementById('no-dashes');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    generateBtn.addEventListener('click', () => {
      const count = Math.min(parseInt(countInput.value) || 1, 100);
      const uuids = [];
      for (let i = 0; i < count; i++) {
        let uuid = generateUUID();
        if (uppercase.checked) uuid = uuid.toUpperCase();
        if (noDashes.checked) uuid = uuid.replace(/-/g, '');
        uuids.push(uuid);
      }
      result.textContent = uuids.join('\\n');
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
  });`
  },

  temperature: {
    title: '温度换算',
    desc: '摄氏度、华氏度、开尔文互转',
    html: `
          <div class="form-group">
            <label class="form-label" for="input-value">输入数值</label>
            <input type="number" id="input-value" class="form-input" value="100" step="any">
          </div>
          
          <div class="form-group">
            <label class="form-label" for="from-unit">从</label>
            <select id="from-unit" class="form-select">
              <option value="C" selected>摄氏度 (°C)</option>
              <option value="F">华氏度 (°F)</option>
              <option value="K">开尔文 (K)</option>
            </select>
          </div>
          
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">换算</button>
            <button id="swap-btn" class="btn btn-secondary">交换单位</button>
          </div>

          <div class="form-group">
            <label class="form-label">换算结果</label>
            <div id="result" class="result-area">等待换算...</div>
          </div>`,
    script: `
  document.addEventListener('DOMContentLoaded', () => {
    const inputValue = document.getElementById('input-value');
    const fromUnit = document.getElementById('from-unit');
    const convertBtn = document.getElementById('convert-btn');
    const swapBtn = document.getElementById('swap-btn');
    const result = document.getElementById('result');

    function convert() {
      const val = parseFloat(inputValue.value);
      if (isNaN(val)) { result.textContent = '请输入有效数值'; return; }
      const unit = fromUnit.value;
      let c, f, k;
      if (unit === 'C') { c = val; f = val * 9/5 + 32; k = val + 273.15; }
      else if (unit === 'F') { c = (val - 32) * 5/9; f = val; k = c + 273.15; }
      else { k = val; c = val - 273.15; f = c * 9/5 + 32; }
      result.textContent = \`摄氏度: \${c.toFixed(4)} °C\\n华氏度: \${f.toFixed(4)} °F\\n开尔文: \${k.toFixed(4)} K\`;
    }

    convertBtn.addEventListener('click', convert);
    inputValue.addEventListener('input', convert);
    fromUnit.addEventListener('change', convert);
    
    swapBtn.addEventListener('click', () => {
      const opts = fromUnit.options;
      const current = fromUnit.selectedIndex;
      fromUnit.selectedIndex = (current + 1) % opts.length;
      convert();
    });
    
    convert();
  });`
  },

  randomNumber: {
    title: '随机数生成',
    desc: '生成指定范围的随机数',
    html: `
          <div class="form-group">
            <label class="form-label" for="min-val">最小值</label>
            <input type="number" id="min-val" class="form-input" value="1">
          </div>
          <div class="form-group">
            <label class="form-label" for="max-val">最大值</label>
            <input type="number" id="max-val" class="form-input" value="100">
          </div>
          <div class="form-group">
            <label class="form-label" for="count">生成数量</label>
            <input type="number" id="count" class="form-input" value="10" min="1" max="1000">
          </div>
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" id="allow-duplicate" checked> 允许重复
            </label>
            <label class="form-label">
              <input type="checkbox" id="sort-result"> 排序结果
            </label>
          </div>
          <div class="btn-group">
            <button id="generate-btn" class="btn btn-primary">生成随机数</button>
            <button id="copy-btn" class="btn btn-secondary">复制结果</button>
          </div>
          <div class="form-group">
            <label class="form-label">生成结果</label>
            <div id="result" class="result-area">点击生成按钮...</div>
          </div>`,
    script: `
  document.addEventListener('DOMContentLoaded', () => {
    const minInput = document.getElementById('min-val');
    const maxInput = document.getElementById('max-val');
    const countInput = document.getElementById('count');
    const allowDup = document.getElementById('allow-duplicate');
    const sortResult = document.getElementById('sort-result');
    const generateBtn = document.getElementById('generate-btn');
    const copyBtn = document.getElementById('copy-btn');
    const result = document.getElementById('result');

    generateBtn.addEventListener('click', () => {
      const min = parseInt(minInput.value) || 0;
      const max = parseInt(maxInput.value) || 100;
      const count = Math.min(parseInt(countInput.value) || 1, 1000);
      const nums = [];
      if (!allowDup.checked && count > max - min + 1) {
        result.textContent = '错误: 数量超过可用不重复数字范围'; return;
      }
      while (nums.length < count) {
        const n = Math.floor(Math.random() * (max - min + 1)) + min;
        if (!allowDup.checked && nums.includes(n)) continue;
        nums.push(n);
      }
      if (sortResult.checked) nums.sort((a, b) => a - b);
      result.textContent = nums.join(', ');
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
  });`
  },

  morse: {
    title: '摩尔斯电码',
    desc: '文本与摩尔斯电码互转',
    html: `
          <div class="form-group">
            <label class="form-label" for="input-text">输入文本或摩尔斯电码</label>
            <textarea id="input-text" class="form-textarea" placeholder="输入文本或摩尔斯电码（用空格分隔）..."></textarea>
          </div>
          <div class="btn-group">
            <button id="encode-btn" class="btn btn-primary">编码为摩尔斯</button>
            <button id="decode-btn" class="btn btn-secondary">解码为文本</button>
            <button id="play-btn" class="btn btn-secondary">播放声音</button>
            <button id="clear-btn" class="btn btn-secondary">清空</button>
          </div>
          <div class="form-group">
            <label class="form-label">结果</label>
            <div id="result" class="result-area">等待操作...</div>
          </div>`,
    script: `
  const MORSE_CODE = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
    '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
    '!': '-.-.--', ' ': '/'
  };
  const REVERSE_MORSE = Object.fromEntries(Object.entries(MORSE_CODE).map(([k, v]) => [v, k]));

  function toMorse(text) {
    return text.toUpperCase().split('').map(c => MORSE_CODE[c] || c).join(' ');
  }
  function fromMorse(morse) {
    return morse.split(' ').map(c => REVERSE_MORSE[c] || c).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('input-text');
    const encodeBtn = document.getElementById('encode-btn');
    const decodeBtn = document.getElementById('decode-btn');
    const playBtn = document.getElementById('play-btn');
    const clearBtn = document.getElementById('clear-btn');
    const result = document.getElementById('result');

    encodeBtn.addEventListener('click', () => { result.textContent = toMorse(inputText.value); });
    decodeBtn.addEventListener('click', () => { result.textContent = fromMorse(inputText.value); });
    clearBtn.addEventListener('click', () => { inputText.value = ''; result.textContent = '等待操作...'; });

    playBtn.addEventListener('click', () => {
      const morse = result.textContent || toMorse(inputText.value);
      if (!morse) return;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let time = ctx.currentTime;
      const dotLen = 0.08;
      morse.split('').forEach(symbol => {
        if (symbol === '.' || symbol === '-') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 600;
          gain.gain.value = 0.3;
          osc.start(time);
          osc.stop(time + (symbol === '.' ? dotLen : dotLen * 3));
          time += (symbol === '.' ? dotLen : dotLen * 3) + dotLen;
        } else if (symbol === ' ') { time += dotLen * 3; }
        else if (symbol === '/') { time += dotLen * 7; }
      });
    });
  });`
  },

  bmi: {
    title: 'BMI计算器',
    desc: '计算身体质量指数',
    html: `
          <div class="form-group">
            <label class="form-label" for="height">身高 (cm)</label>
            <input type="number" id="height" class="form-input" value="170" min="50" max="300">
          </div>
          <div class="form-group">
            <label class="form-label" for="weight">体重 (kg)</label>
            <input type="number" id="weight" class="form-input" value="65" min="10" max="500" step="0.1">
          </div>
          <div class="btn-group">
            <button id="calc-btn" class="btn btn-primary">计算BMI</button>
          </div>
          <div class="form-group">
            <label class="form-label">计算结果</label>
            <div id="result" class="result-area">等待计算...</div>
          </div>`,
    script: `
  document.addEventListener('DOMContentLoaded', () => {
    const heightInput = document.getElementById('height');
    const weightInput = document.getElementById('weight');
    const calcBtn = document.getElementById('calc-btn');
    const result = document.getElementById('result');

    calcBtn.addEventListener('click', () => {
      const h = parseFloat(heightInput.value) / 100;
      const w = parseFloat(weightInput.value);
      if (!h || !w || h <= 0 || w <= 0) { result.textContent = '请输入有效数值'; return; }
      const bmi = w / (h * h);
      let category = '';
      if (bmi < 18.5) category = '偏瘦';
      else if (bmi < 24) category = '正常';
      else if (bmi < 28) category = '偏胖';
      else category = '肥胖';
      result.textContent = \`BMI: \${bmi.toFixed(1)}\\n分类: \${category}\\n\\n参考范围:\\n偏瘦: < 18.5\\n正常: 18.5 - 23.9\\n偏胖: 24 - 27.9\\n肥胖: >= 28\`;
    });
  });`
  },

  area: {
    title: '面积换算',
    desc: '平方米、平方千米、公顷、亩等面积单位换算',
    html: `
          <div class="form-group">
            <label class="form-label" for="input-value">输入数值</label>
            <input type="number" id="input-value" class="form-input" value="1" step="any">
          </div>
          <div class="form-group">
            <label class="form-label" for="from-unit">单位</label>
            <select id="from-unit" class="form-select">
              <option value="sqm">平方米 (m²)</option>
              <option value="sqkm">平方千米 (km²)</option>
              <option value="hectare">公顷 (ha)</option>
              <option value="mu" selected>亩</option>
              <option value="sqft">平方英尺 (ft²)</option>
              <option value="acre">英亩 (acre)</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">换算</button>
          </div>
          <div class="form-group">
            <label class="form-label">换算结果</label>
            <div id="result" class="result-area">等待换算...</div>
          </div>`,
    script: `
  const TO_SQM = { sqm: 1, sqkm: 1000000, hectare: 10000, mu: 666.667, sqft: 0.092903, acre: 4046.86 };
  const NAMES = { sqm: '平方米', sqkm: '平方千米', hectare: '公顷', mu: '亩', sqft: '平方英尺', acre: '英亩' };

  document.addEventListener('DOMContentLoaded', () => {
    const inputValue = document.getElementById('input-value');
    const fromUnit = document.getElementById('from-unit');
    const convertBtn = document.getElementById('convert-btn');
    const result = document.getElementById('result');

    function convert() {
      const val = parseFloat(inputValue.value);
      if (isNaN(val)) { result.textContent = '请输入有效数值'; return; }
      const sqm = val * TO_SQM[fromUnit.value];
      const lines = Object.entries(TO_SQM).map(([unit, factor]) => \`\${NAMES[unit]}: \${(sqm / factor).toFixed(6)}\`).join('\\n');
      result.textContent = lines;
    }

    convertBtn.addEventListener('click', convert);
    inputValue.addEventListener('input', convert);
    fromUnit.addEventListener('change', convert);
    convert();
  });`
  },

  volume: {
    title: '体积换算',
    desc: '升、毫升、立方米、加仑等体积单位换算',
    html: `
          <div class="form-group">
            <label class="form-label" for="input-value">输入数值</label>
            <input type="number" id="input-value" class="form-input" value="1" step="any">
          </div>
          <div class="form-group">
            <label class="form-label" for="from-unit">单位</label>
            <select id="from-unit" class="form-select">
              <option value="L" selected>升 (L)</option>
              <option value="mL">毫升 (mL)</option>
              <option value="m3">立方米 (m³)</option>
              <option value="gal">加仑 (gal)</option>
              <option value="floz">液量盎司 (fl oz)</option>
              <option value="cup">杯 (cup)</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">换算</button>
          </div>
          <div class="form-group">
            <label class="form-label">换算结果</label>
            <div id="result" class="result-area">等待换算...</div>
          </div>`,
    script: `
  const TO_L = { L: 1, mL: 0.001, m3: 1000, gal: 3.78541, floz: 0.0295735, cup: 0.236588 };
  const NAMES = { L: '升', mL: '毫升', m3: '立方米', gal: '加仑', floz: '液量盎司', cup: '杯' };

  document.addEventListener('DOMContentLoaded', () => {
    const inputValue = document.getElementById('input-value');
    const fromUnit = document.getElementById('from-unit');
    const convertBtn = document.getElementById('convert-btn');
    const result = document.getElementById('result');

    function convert() {
      const val = parseFloat(inputValue.value);
      if (isNaN(val)) { result.textContent = '请输入有效数值'; return; }
      const liters = val * TO_L[fromUnit.value];
      const lines = Object.entries(TO_L).map(([unit, factor]) => \`\${NAMES[unit]}: \${(liters / factor).toFixed(6)}\`).join('\\n');
      result.textContent = lines;
    }

    convertBtn.addEventListener('click', convert);
    inputValue.addEventListener('input', convert);
    fromUnit.addEventListener('change', convert);
    convert();
  });`
  },

  speed: {
    title: '速度换算',
    desc: '米/秒、千米/时、英里/时、节等速度单位换算',
    html: `
          <div class="form-group">
            <label class="form-label" for="input-value">输入数值</label>
            <input type="number" id="input-value" class="form-input" value="100" step="any">
          </div>
          <div class="form-group">
            <label class="form-label" for="from-unit">单位</label>
            <select id="from-unit" class="form-select">
              <option value="ms">米/秒 (m/s)</option>
              <option value="kmh" selected>千米/时 (km/h)</option>
              <option value="mph">英里/时 (mph)</option>
              <option value="knot">节 (knot)</option>
              <option value="mach">马赫 (Mach)</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">换算</button>
          </div>
          <div class="form-group">
            <label class="form-label">换算结果</label>
            <div id="result" class="result-area">等待换算...</div>
          </div>`,
    script: `
  const TO_MS = { ms: 1, kmh: 0.277778, mph: 0.44704, knot: 0.514444, mach: 343 };
  const NAMES = { ms: '米/秒', kmh: '千米/时', mph: '英里/时', knot: '节', mach: '马赫' };

  document.addEventListener('DOMContentLoaded', () => {
    const inputValue = document.getElementById('input-value');
    const fromUnit = document.getElementById('from-unit');
    const convertBtn = document.getElementById('convert-btn');
    const result = document.getElementById('result');

    function convert() {
      const val = parseFloat(inputValue.value);
      if (isNaN(val)) { result.textContent = '请输入有效数值'; return; }
      const ms = val * TO_MS[fromUnit.value];
      const lines = Object.entries(TO_MS).map(([unit, factor]) => \`\${NAMES[unit]}: \${(ms / factor).toFixed(6)}\`).join('\\n');
      result.textContent = lines;
    }

    convertBtn.addEventListener('click', convert);
    inputValue.addEventListener('input', convert);
    fromUnit.addEventListener('change', convert);
    convert();
  });`
  },

  energy: {
    title: '能量换算',
    desc: '焦耳、千焦、卡路里、千瓦时等能量单位换算',
    html: `
          <div class="form-group">
            <label class="form-label" for="input-value">输入数值</label>
            <input type="number" id="input-value" class="form-input" value="1000" step="any">
          </div>
          <div class="form-group">
            <label class="form-label" for="from-unit">单位</label>
            <select id="from-unit" class="form-select">
              <option value="J">焦耳 (J)</option>
              <option value="kJ" selected>千焦 (kJ)</option>
              <option value="cal">卡路里 (cal)</option>
              <option value="kcal">千卡 (kcal)</option>
              <option value="kWh">千瓦时 (kWh)</option>
              <option value="eV">电子伏特 (eV)</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">换算</button>
          </div>
          <div class="form-group">
            <label class="form-label">换算结果</label>
            <div id="result" class="result-area">等待换算...</div>
          </div>`,
    script: `
  const TO_J = { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, kWh: 3600000, eV: 1.602e-19 };
  const NAMES = { J: '焦耳', kJ: '千焦', cal: '卡路里', kcal: '千卡', kWh: '千瓦时', eV: '电子伏特' };

  document.addEventListener('DOMContentLoaded', () => {
    const inputValue = document.getElementById('input-value');
    const fromUnit = document.getElementById('from-unit');
    const convertBtn = document.getElementById('convert-btn');
    const result = document.getElementById('result');

    function convert() {
      const val = parseFloat(inputValue.value);
      if (isNaN(val)) { result.textContent = '请输入有效数值'; return; }
      const j = val * TO_J[fromUnit.value];
      const lines = Object.entries(TO_J).map(([unit, factor]) => \`\${NAMES[unit]}: \${(j / factor).toExponential(6)}\`).join('\\n');
      result.textContent = lines;
    }

    convertBtn.addEventListener('click', convert);
    inputValue.addEventListener('input', convert);
    fromUnit.addEventListener('change', convert);
    convert();
  });`
  },

  baseConvert: {
    title: '进制转换',
    desc: '二进制、八进制、十进制、十六进制互转',
    html: `
          <div class="form-group">
            <label class="form-label" for="input-value">输入数值</label>
            <input type="text" id="input-value" class="form-input" value="255" placeholder="输入数值...">
          </div>
          <div class="form-group">
            <label class="form-label" for="from-base">进制</label>
            <select id="from-base" class="form-select">
              <option value="2">二进制 (2)</option>
              <option value="8">八进制 (8)</option>
              <option value="10" selected>十进制 (10)</option>
              <option value="16">十六进制 (16)</option>
              <option value="32">三十二进制 (32)</option>
              <option value="36">三十六进制 (36)</option>
            </select>
          </div>
          <div class="btn-group">
            <button id="convert-btn" class="btn btn-primary">转换</button>
          </div>
          <div class="form-group">
            <label class="form-label">转换结果</label>
            <div id="result" class="result-area">等待转换...</div>
          </div>`,
    script: `
  document.addEventListener('DOMContentLoaded', () => {
    const inputValue = document.getElementById('input-value');
    const fromBase = document.getElementById('from-base');
    const convertBtn = document.getElementById('convert-btn');
    const result = document.getElementById('result');

    function convert() {
      const val = inputValue.value.trim();
      const base = parseInt(fromBase.value);
      if (!val) { result.textContent = '请输入数值'; return; }
      try {
        const decimal = parseInt(val, base);
        if (isNaN(decimal)) { result.textContent = '无效的' + base + '进制数值'; return; }
        result.textContent = \`二进制: \${decimal.toString(2)}\\n八进制: \${decimal.toString(8)}\\n十进制: \${decimal.toString(10)}\\n十六进制: \${decimal.toString(16).toUpperCase()}\\n三十二进制: \${decimal.toString(32).toUpperCase()}\\n三十六进制: \${decimal.toString(36).toUpperCase()}\`;
      } catch (e) { result.textContent = '转换失败: ' + e.message; }
    }

    convertBtn.addEventListener('click', convert);
    inputValue.addEventListener('input', convert);
    fromBase.addEventListener('change', convert);
    convert();
  });`
  }
};

function generateToolPage(filename, template) {
  const content = `---
import Layout from '@layouts/Layout.astro';

const toolName = '${template.title}';
const toolDesc = '${template.desc}';
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
        <div class="tool-content" id="tool-content">${template.html}
        </div>
      </main>
    </div>
  </section>
</Layout>

<style>
  .tool-page {
    min-height: 100vh;
    padding: calc(var(--header-total-height) + var(--space-6)) var(--space-4) var(--space-16);
    background: var(--bg-primary);
  }

  .tool-container {
    max-width: 900px;
    margin: 0 auto;
  }

  .tool-header {
    margin-bottom: var(--space-6);
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-secondary);
    text-decoration: none;
    font-size: var(--text-sm);
    margin-bottom: var(--space-4);
    transition: color var(--duration-fast) var(--ease-default);
  }

  .back-link:hover {
    color: var(--text-primary);
  }

  .tool-title {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .tool-description {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .tool-main {
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    min-height: 400px;
  }

  .tool-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .form-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }

  .form-input,
  .form-textarea,
  .form-select {
    padding: var(--space-3);
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: inherit;
  }

  .form-input:focus,
  .form-textarea:focus,
  .form-select:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .form-textarea {
    min-height: 120px;
    resize: vertical;
    font-family: var(--font-mono);
  }

  .form-select {
    cursor: pointer;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-default);
  }

  .btn-primary {
    background: var(--color-primary);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
  }

  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
  }

  .btn-secondary:hover {
    background: var(--bg-hover);
  }

  .btn-group {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .result-area {
    padding: var(--space-4);
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    white-space: pre-wrap;
    word-break: break-all;
    min-height: 60px;
  }

  @media (max-width: 768px) {
    .tool-main {
      padding: var(--space-4);
    }

    .btn-group {
      flex-direction: column;
    }

    .btn {
      width: 100%;
    }
  }
</style>

<script>${template.script}
</script>
`;

  const filePath = path.join(pagesDir, filename);
  fs.writeFileSync(filePath, content);
  console.log(`Generated: ${filename}`);
}

// Generate all tool pages
Object.entries(toolTemplates).forEach(([name, template]) => {
  generateToolPage(`${name}.astro`, template);
});

console.log('\\nDone! Generated ' + Object.keys(toolTemplates).length + ' tool pages.');
