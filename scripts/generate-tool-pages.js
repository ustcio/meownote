#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// 读取工具分类数据
const toolCategoriesPath = path.join(rootDir, 'src/data/tool-categories.ts');
const content = fs.readFileSync(toolCategoriesPath, 'utf-8');

// 解析工具列表
const toolMatches = content.match(/\{ id: '([^']+)', name: '([^']+)', desc: '([^']+)', path: '([^']+)', status: '([^']+)' \}/g);

if (!toolMatches) {
  console.error('未找到工具数据');
  process.exit(1);
}

const tools = toolMatches.map(match => {
  const [, id, name, desc, toolPath, status] = match.match(/\{ id: '([^']+)', name: '([^']+)', desc: '([^']+)', path: '([^']+)', status: '([^']+)' \}/);
  return { id, name, desc, path: toolPath, status };
});

// 只处理 todo 状态的工具
const todoTools = tools.filter(t => t.status === 'todo');

console.log(`找到 ${todoTools.length} 个待创建的工具页面`);

// 创建工具页面模板
function createToolPage(tool) {
  const filePath = path.join(rootDir, 'src/pages', tool.path + '.astro');
  const dirPath = path.dirname(filePath);

  // 确保目录存在
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // 如果文件已存在，跳过
  if (fs.existsSync(filePath)) {
    console.log(`跳过已存在的工具: ${tool.name}`);
    return false;
  }

  const template = `---
import Layout from '@layouts/Layout.astro';

const toolName = '${tool.name}';
const toolDesc = '${tool.desc}';
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
        <div class="tool-content" id="tool-content">
          <!-- 工具内容区域 -->
          <div class="tool-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>工具开发中，敬请期待...</p>
          </div>
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

  .tool-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: var(--text-tertiary);
    text-align: center;
  }

  .tool-placeholder svg {
    margin-bottom: var(--space-4);
    opacity: 0.5;
  }

  .tool-placeholder p {
    font-size: var(--text-sm);
  }

  /* 通用表单样式 */
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
    border-color: var(--color-accent-blue);
  }

  .form-textarea {
    min-height: 120px;
    resize: vertical;
    font-family: var(--font-mono);
  }

  .form-select {
    cursor: pointer;
  }

  /* 通用按钮样式 */
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
    background: var(--text-primary);
    color: var(--bg-primary);
  }

  .btn-primary:hover {
    opacity: 0.9;
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

  /* 结果区域 */
  .result-area {
    padding: var(--space-4);
    background: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 300px;
    overflow-y: auto;
  }

  /* 文件上传 */
  .file-upload {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    border: 2px dashed var(--border-primary);
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-default);
  }

  .file-upload:hover {
    border-color: var(--border-hover);
    background: var(--bg-tertiary);
  }

  .file-upload input[type="file"] {
    display: none;
  }

  /* 响应式 */
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

<script is:inline>
  // 工具脚本 - 根据需要添加具体功能
  document.addEventListener('DOMContentLoaded', () => {
    console.log('${tool.name} 工具已加载');
  });
</script>
`;

  fs.writeFileSync(filePath, template, 'utf-8');
  console.log(`创建: ${tool.name} (${tool.path})`);
  return true;
}

// 批量创建
let created = 0;
let skipped = 0;

todoTools.forEach(tool => {
  const result = createToolPage(tool);
  if (result) {
    created++;
  } else {
    skipped++;
  }
});

console.log(`\n完成! 创建: ${created}, 跳过: ${skipped}`);
