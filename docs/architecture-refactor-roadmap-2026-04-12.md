# Maxwell.Science 架构整理清单与重构路线图

## 本次已识别的问题

- 设计 token 与页面样式命名脱节，存在未定义变量被直接引用的情况。
- 布局层分叉为“营销页 Layout”与“页面自行输出完整 HTML”两套模式。
- overlay 直接操作 `document.body.style.overflow`，多个弹层并发时容易互相覆盖。
- 页面初始化策略不统一，部分脚本只绑定 `DOMContentLoaded`，不兼容 Astro 的后续局部导航能力。
- 重交互页面以“大单文件 + 长脚本 + 长样式”为主，复用边界不清晰。

## 架构整理清单

- 统一设计系统入口
- 收拢布局层级
- 统一 overlay 与 body scroll lock
- 统一页面脚本初始化约定
- 为大页面建立容器层与行为层拆分边界
- 补齐组件级基础设施

## 具体重构路线图

### 阶段 1：基础设施收口

- 建立 `BaseLayout` 作为 head、theme、visit tracking、全局 chrome 的唯一入口。
- 将现有 `Layout` 转为 `SiteLayout` 包装层，保留兼容导出。
- 新增 `AppLayout` 用于聊天页、未来全屏工具页。
- 补齐设计 token 缺口，禁止页面继续内生新 token 名。
- 引入统一的 body scroll lock API，替代直接写 `document.body.style.overflow`。
- 将全站脚本初始化约定统一为“可重复执行且兼容 `astro:page-load`”。

### 阶段 2：共享交互组件抽象

- 抽出 `AppModal`、`AppDropdown`、`AppToast`、`SectionHeader`、`EmptyState`。
- 将 `profile`、`workspace`、`auth` 中重复出现的弹窗/按钮/状态块迁移到共享组件。
- 为页面级 DOM 控制脚本抽出 `lib/ui` 层工具函数。

### 阶段 3：页面容器拆分

- `workspace/index` 拆成 shell、toolbar、grid、modal、controller。
- `workspace/edit` 拆成 editor shell、toolbar、status、preview、controller。
- `ClaudeChat` 拆成 shell、sidebar、message list、composer、chat controller。

### 阶段 4：数据与交互层整理

- 将直接散落在页面中的 `fetch` 包装到统一 API client。
- 统一错误态、空态、加载态的渲染接口。
- 对周期轮询类功能增加清理逻辑，避免重复计时器。

## 本轮已直接落地

- 新增 `BaseLayout` / `SiteLayout` / `AppLayout`
- `chatbot` 改为使用 `AppLayout`
- 补齐一批缺失 token 与语义别名
- 为后续 overlay 收口建立统一全局 scroll lock API
- 明确后续重构阶段顺序，便于继续推进
