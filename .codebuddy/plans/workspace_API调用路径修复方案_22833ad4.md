---
name: workspace API调用路径修复方案
overview: 修复workspace页面的API调用问题。核心发现：works.js已实现完整的/api/workspace REST API，但前端使用相对路径导致跨域/路径错误。解决方案：将相对路径改为绝对路径 https://api.moonsun.ai/api/workspace。
todos:
  - id: add-workspace-config
    content: 在 src/config/index.ts 中添加 WORKSPACE_API 配置常量
    status: completed
  - id: fix-workspace-index-apis
    content: 修复 src/pages/workspace/index.astro 的5处相对路径API调用
    status: completed
    dependencies:
      - add-workspace-config
  - id: fix-workspace-edit-apis
    content: 修复 src/pages/workspace/edit.astro 的3处相对路径API调用
    status: completed
    dependencies:
      - add-workspace-config
  - id: test-workspace-crud
    content: 测试workspace完整CRUD功能（创建、编辑、删除、搜索、排序）
    status: completed
    dependencies:
      - fix-workspace-index-apis
      - fix-workspace-edit-apis
---

## 问题诊断

### 根本原因

前端workspace页面使用**相对路径** `/api/workspace`，但Cloudflare Worker API部署在 `https://api.moonsun.ai`。

- 静态站点：`https://ustc.dev`
- API Worker：`https://api.moonsun.ai`
- 相对路径错误调用：`https://ustc.dev/api/workspace`（不存在 → 404）

### works.js API实现（已完整）

```javascript
'/api/workspace': { handler: handleWorkspace, pattern: /^\/api\/workspace(\/[^/]+)?$/ }
```

支持：

- GET `/api/workspace` → 列出文件
- POST `/api/workspace` → 创建文件
- GET `/api/workspace/{id}` → 获取单个文件
- PUT `/api/workspace/{id}` → 更新文件
- DELETE `/api/workspace/{id}` → 删除文件

## 核心功能

1. 修复workspace/index.astro的5处相对路径API调用
2. 修复workspace/edit.astro的3处相对路径API调用
3. 建立统一的API配置管理，消除硬编码
4. 确保CRUD功能（创建、读取、更新、删除、搜索、排序）正常工作

## 技术栈

- **前端框架**：Astro 6.x + TypeScript
- **后端服务**：Cloudflare Worker (works.js) + D1 Database
- **API端点**：https://api.moonsun.ai

## 解决方案

### 问题分析

静态站点和API Worker部署在不同域名，需要使用**绝对路径**而非相对路径。

### 修复方案

1. **创建统一的API配置**：在 `src/config/index.ts` 中添加workspace API配置
2. **重构API调用**：将相对路径 `/api/workspace` 替换为 `${API_BASE}/api/workspace`
3. **提取公共函数**：将fetch逻辑封装到可复用的模块中

### 架构设计

```
src/pages/workspace/index.astro  ──┐
                                   ├──► API_BASE = 'https://api.moonsun.ai'
src/pages/workspace/edit.astro   ──┘        │
                                           ▼
                                    Cloudflare Worker (works.js)
                                           │
                                           ▼
                                    D1 Database (workspace_files)
```

### 目录结构

```
src/
├── config/
│   └── index.ts          # [MODIFY] 添加 WORKSPACE_API 配置
├── pages/workspace/
│   ├── index.astro       # [MODIFY] 修复5处API调用
│   └── edit.astro        # [MODIFY] 修复3处API调用
```

### 关键修改

#### 1. config/index.ts 添加配置

```typescript
workspace: {
  apiBase: 'https://api.moonsun.ai',
  endpoint: '/api/workspace',
},
```

#### 2. workspace/index.astro 修改

- 第965行：`fetch('/api/workspace?...' )` → `fetch('${API_BASE}/api/workspace?...')`
- 第1108行：`fetch('/api/workspace/${id}', { method: 'DELETE' })`
- 第1129行：`fetch('/api/workspace', { method: 'POST', ... })`
- 第1175行：`fetch('/api/workspace', { method: 'POST', ... })`

#### 3. workspace/edit.astro 修改

- 第639行：`fetch('/api/workspace/${fileId}')`
- 第771行：`fetch('/api/workspace/${fileId}', { method: 'PUT', ... })`
- 第840行：`fetch('/api/workspace/${fileId}', { method: 'DELETE', ... })`