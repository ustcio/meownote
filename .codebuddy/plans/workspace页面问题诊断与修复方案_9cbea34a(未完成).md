---
name: workspace页面问题诊断与修复方案
overview: 全面分析meownote网站的前后端交互逻辑，诊断workspace页面布局杂乱和功能失效的根本原因，并制定详细的解决方案。核心问题：API端点缺失导致CRUD功能完全失效。
todos:
  - id: create-workspace-types
    content: 创建workspace类型定义文件（types.ts），定义WorkspaceFile、SortOptions等核心数据类型
    status: pending
  - id: implement-storage-adapter
    content: 实现StorageAdapter本地存储适配器，支持CRUD操作和数据序列化
    status: pending
    dependencies:
      - create-workspace-types
  - id: create-workspace-service
    content: 创建WorkspaceService业务逻辑层，统一封装数据操作和错误处理
    status: pending
    dependencies:
      - create-workspace-types
  - id: refactor-workspace-index
    content: 重构workspace/index.astro页面，将API调用替换为WorkspaceService
    status: pending
    dependencies:
      - create-workspace-service
  - id: refactor-workspace-edit
    content: 重构workspace/edit.astro页面，适配新的数据服务层
    status: pending
    dependencies:
      - create-workspace-service
  - id: add-unified-api-config
    content: 重构config/index.ts，统一API配置管理，消除硬编码
    status: pending
  - id: test-workspace-functionality
    content: 测试workspace完整功能（创建、编辑、删除、搜索、排序）
    status: pending
    dependencies:
      - refactor-workspace-index
      - refactor-workspace-edit
  - id: config-astro-adapter
    content: 配置Astro适配器（可选），为后续服务端API路由做准备
    status: pending
    dependencies:
      - test-workspace-functionality
---

## 产品概述

meownote是一个基于Astro框架的个人工作空间网站，提供笔记管理、文件上传、AI聊天、黄金交易分析等功能。核心模块workspace页面旨在提供个人笔记和文件的创建、编辑、删除和搜索功能。

## 核心功能问题诊断

### 问题1：API层完全缺失（根本原因）

- **现象**：workspace页面调用 `/api/workspace`、`/api/workspace/{id}` 等REST API时全部返回404
- **根因**：
- Astro项目未配置 `output: 'hybrid'` 或 `output: 'server'`
- 缺少任何适配器（adapter）配置
- 不存在 `src/pages/api/` 目录
- 外部API `api.ustc.dev` 不存在workspace相关端点

### 问题2：前端代码与后端断裂

- **前端实现**：workspace/index.astro 完整实现了fetch调用逻辑（GET/POST/PUT/DELETE）
- **后端实现**：完全不存在
- **后果**：所有CRUD操作失败，loading状态卡死，界面显示异常

### 问题3：状态管理架构不完整

- **现有机制**：使用localStorage的secureStorage封装管理auth token
- **缺失机制**：workspace数据（笔记、文件）没有持久化存储

### 问题4：多处硬编码API地址

- 至少15处硬编码 `https://api.ustc.dev`
- 缺乏统一的API配置管理

## 功能要求

1. 实现workspace页面的完整CRUD功能（创建、读取、更新、删除笔记）
2. 支持文件上传和管理
3. 实现笔记搜索和排序功能
4. 提供数据持久化存储
5. 确保前后端通信正常

## 技术栈选择

### 当前技术栈

- **前端框架**：Astro 6.x（静态站点生成器）
- **编程语言**：TypeScript
- **样式系统**：CSS变量主题系统 + Anthropic风格设计
- **状态存储**：localStorage（客户端）

### 问题分析

Astro默认是静态站点生成模式（`output: 'static'`），不支持服务端API路由。要实现真正的API端点，需要：

1. 配置 `output: 'hybrid'` 或 `output: 'server'`
2. 添加适配器（如 `@astrojs/node`、`@astrojs/cloudflare` 等）
3. 创建 `src/pages/api/` 目录下的API路由文件

### 推荐技术方案

#### 方案A：混合渲染 + Node适配器（推荐）

- **优点**：保留静态生成优势，支持部分页面服务端渲染
- **适配器**：`@astrojs/node`（支持standalone和docker模式）
- **适用场景**：自建服务器部署

#### 方案B：客户端本地存储方案（快速修复）

- **优点**：无需修改Astro配置，立即可用
- **实现**：使用localStorage存储workspace数据
- **适用场景**：单用户个人使用，无需多设备同步

#### 方案C：CloudBase云函数（完整方案）

- **优点**：可扩展的serverless后端
- **依赖**：CloudBase SDK和云函数
- **状态**：integration已配置但未连接

## 实施策略

采用分阶段实施方案：

1. **第一阶段**：使用localStorage实现客户端存储，让功能立即可用
2. **第二阶段**：配置Astro适配器，创建服务端API路由
3. **第三阶段**：优化状态管理，添加错误处理和边界情况处理

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Workspace  │  │  Edit Page  │  │  Auth Modal     │ │
│  │  Index      │  │             │  │                 │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                  │          │
│  ┌──────▼────────────────▼──────────────────▼────────┐ │
│  │              WorkspaceService                      │ │
│  │  - loadFiles() / createNote() / updateNote()      │ │
│  │  - deleteNote() / searchFiles() / sortFiles()     │ │
│  └──────────────────────┬───────────────────────────┘ │
└─────────────────────────┼─────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────┐
│                    Data Layer                          │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  StorageAdapter   │  │    APIAdapter             │  │
│  │  (localStorage)   │  │    (fetch /api/workspace) │  │
│  └──────────────────┘  └──────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

## 目录结构

```
src/
├── lib/
│   └── workspace/
│       ├── types.ts          # [NEW] Workspace数据类型定义
│       ├── storage.ts         # [NEW] localStorage适配器
│       ├── api-adapter.ts     # [NEW] API适配器（可选）
│       └── service.ts         # [NEW] Workspace业务逻辑服务
├── pages/
│   ├── workspace/
│   │   ├── index.astro        # [MODIFY] 重构API调用逻辑
│   │   └── edit.astro         # [MODIFY] 重构API调用逻辑
│   └── api/                   # [NEW] API路由（后续阶段）
│       └── workspace/
│           ├── index.ts       # GET list / POST create
│           └── [id].ts         # GET / PUT / DELETE single
└── config/
    └── index.ts               # [MODIFY] 添加workspace配置
```

## 关键代码结构

### Workspace数据类型

```typescript
interface WorkspaceFile {
  id: string;
  title: string;
  content: string;
  type: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}
```

### StorageAdapter接口

```typescript
interface IStorageAdapter {
  getAll(): Promise<WorkspaceFile[]>;
  getById(id: string): Promise<WorkspaceFile | null>;
  create(file: Omit<WorkspaceFile, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkspaceFile>;
  update(id: string, data: Partial<WorkspaceFile>): Promise<WorkspaceFile>;
  delete(id: string): Promise<boolean>;
}
```

## Agent Extensions

### SubAgent

- **code-explorer**
- 用途：搜索和分析workspace相关的代码模式
- 预期结果：确认所有需要重构的文件位置和依赖关系