# 本地仓库 vs GitHub 仓库 文件遍历对照

仓库绑定：本地 `meownote` ↔ [ustcio/meownote](https://github.com/ustcio/meownote)

---

## 一、本地仓库（当前工作区）

**排除**：`.git`、`node_modules`、`dist`、`.wrangler` 后的**源码/资源**文件列表。

### 根目录
| 文件 | 说明 |
|------|------|
| `astro.config.mjs` | Astro 配置 |
| `package.json` | 依赖（仅 Astro） |
| `tsconfig.json` | TS 配置 |
| `wrangler.toml` | Cloudflare Worker 配置（main = works.js） |

### public/
| 路径 | 说明 |
|------|------|
| `public/scripts/app.js` | 前端主逻辑（AGI Era 风格） |
| `public/scripts/webgl-background.js` | WebGL 背景 |

### src/
| 路径 | 说明 |
|------|------|
| `src/components/*.astro` | AboutPage, ChatBotPage, DocsPage, Footer, HomePage, KitPage, Navigation, Overlays, ProfilePage, ResearchPage |
| `src/layouts/Layout.astro` | 主布局 |
| `src/pages/index.astro` | 单页入口 |
| `src/styles/global.css` | 全局样式 |
| **`src/works.js`** | **Worker 主入口（金价/预警/AI 等，未提交到 Git）** |

### src/pages/ 下的“完整版”拷贝（对应 GitHub 根结构）
本地把 **GitHub 上整棵树的等价内容** 放在了 `src/pages/` 下，包括：

- **文档**：`API_INTERFACE_ANALYSIS.md`, `CHANGES.md`, `DEBUG_REPORT.md`, `DEPLOYMENT_VERIFICATION.md`, `PERFORMANCE_OPTIMIZATION_GUIDE.md`, `README.md`, `REPAIR_REPORT.md`
- **配置**：`astro.config.mjs`, `package.json`, `package-lock.json`, `tsconfig.json`, `wrangler.toml`
- **docs/**：金价/AI 审计、优化报告等
- **migrations/**：`001_add_database_indexes.sql`
- **public/**：图标、字体、logo、`lang-redirect.js`、site.webmanifest
- **scripts/**：`download-fonts.sh`
- **src/**：另一套 Astro 结构（layout/Header, Footer, sections/, ui/, **lib/gold-analysis/**（ai-engine, alert-system, api-integration 等）, pages/about|chatbot|kit|trading|zh/ 等）
- **workers/gold-price-crawler/**：独立金价爬虫 Worker（README, package.json, src/index.js, wrangler.toml）
- **works.js**、**wrangler.toml**、**金价预警通知测试.md**、**test-ai-integration.js**

即：**GitHub 根目录的 works.js + docs + workers + 另一套 src 在本地 = `src/pages/` 整棵目录**。

---

## 二、GitHub 仓库（ustcio/meownote main）

**来源**：`GET /repos/ustcio/meownote/git/trees/main?recursive=1`（已排除 .wrangler 的 blob 细节，仅列路径含义）。

### 根目录
| 文件 | 说明 |
|------|------|
| `.gitignore` | Git 忽略规则 |
| `API_INTERFACE_ANALYSIS.md` | API 分析文档 |
| `CHANGES.md` | 变更记录 |
| `DEBUG_REPORT.md` | 调试报告 |
| `DEPLOYMENT_VERIFICATION.md` | 部署验证 |
| `PERFORMANCE_OPTIMIZATION_GUIDE.md` | 性能优化指南 |
| `README.md` | 项目说明 |
| `REPAIR_REPORT.md` | 修复报告 |
| `astro.config.mjs` | Astro 配置 |
| `package.json` / `package-lock.json` | 依赖 |
| `tsconfig.json` | TS 配置 |
| **`works.js`** | **Worker 主入口（金价/预警/AI 等）** |
| `wrangler.toml` | Worker 配置 |
| `test-ai-integration.js` | AI 集成测试 |
| `金价预警通知测试.md` | 金价预警测试说明 |

### docs/
- `GOLD_DATA_AI_AUDIT_REPORT.md`
- `OPTIMIZATION_COMPLETE_REPORT.md`
- `OPTIMIZATION_IMPLEMENTATION_SUMMARY.md`

### migrations/
- `001_add_database_indexes.sql`

### public/
- 图标：android-chrome-*, apple-touch-icon, favicon-*, browserconfig.xml
- 字体：fonts/（Limelight, Poppins）
- `logo.mp4`, `scripts/lang-redirect.js`, `site.webmanifest`

### scripts/
- `download-fonts.sh`

### src/（GitHub 上的前端结构）
- **components/**：layout/(Footer, Header), sections/(CTA, ContributionGraph, Features, Hero, SocialProof, Stats), ui/(AuthModal, Icon, LanguageSwitcher, ThemeToggle)
- **lib/gold-analysis/**：ai-engine.ts, alert-system.ts, api-error-handler.ts, api-integration.ts, backtest-engine.ts, command-system.ts, data-collector.ts, data-validator.ts, index.ts, model-monitor.ts, monitoring.ts, types.ts, user-feedback.ts
- **pages/**：about, chatbot, index, kit(academic, gold), profile, research, trading；**zh/** 下对应中文路由
- **layouts/**：Layout.astro
- **scripts/**：chatbot-new.ts, chatbot.ts, lang-redirect.ts
- **styles/**：chatbot-new.css, chatbot.css, global.css, tokens.css
- **i18n/index.ts**，**env.d.ts**，**utils/index.ts**

### workers/gold-price-crawler/
- `README.md`, `package.json`, `wrangler.toml`, `src/index.js`

---

## 三、主要差异小结

| 项目 | 本地 | GitHub |
|------|------|--------|
| **Worker 入口** | `src/works.js`（未跟踪） | 根目录 `works.js` |
| **wrangler.toml** | 根目录有，main = "works.js" | 根目录，main = "works.js" |
| **前端结构** | 根级为 AGI Era 风格（少量 Page 组件 + public/scripts/app.js） | 根级为 Meow Note 完整站（src/components layout/sections/ui + lib/gold-analysis + 多页面/中英） |
| **“完整版”位置** | 整份等同于 GitHub 的树在 **src/pages/** 下 | 直接位于仓库根 |
| **public/scripts** | `app.js`, `webgl-background.js` | `lang-redirect.js` |
| **.gitignore / README 等** | 根目录缺失 | 根目录存在 |

---

## 四、建议

1. **部署 Worker**：当前 `wrangler.toml` 的 `main = "works.js"` 指向根目录；本地实际入口是 `src/works.js`。部署时需在构建/复制步骤把 `src/works.js` 输出为根目录 `works.js`，或在 wrangler 中配置 `main = "src/works.js"`（若支持）。
2. **与 GitHub 对齐**：若希望本地即“完整 Meow Note”单仓，可考虑以 GitHub 结构为主，把当前根目录的 AGI Era 前端视为一版或迁移到子目录；反之若以当前根目录为主，可把 `src/pages/` 视为从 GitHub 拉来的参考/子项目，并避免重复维护两套。
3. **金价/预警/AI 逻辑**：完整后端与金价、预警、AI 分析在 **works.js**（本地即 `src/works.js`）；前端金价分析相关在 **src/lib/gold-analysis/**（本地在 `src/pages/src/lib/gold-analysis/`）。

如需对某一块做“逐文件对比”或合并策略，可以指定目录（例如只对 `works.js` 或只对 `lib/gold-analysis`）。
