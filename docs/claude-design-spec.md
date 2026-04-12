# Claude.com Product Page - Design Specification

> 完整设计规范 - 用于复刻 claude.com/product/overview 页面

---

## 1. 页面结构分析

### 1.1 页面组件层级

```
┌─────────────────────────────────────────────────┐
│  NAVIGATION BAR (Sticky)                        │
│  - Logo (Homepage link)                         │
│  - Mega Menu: Products, Features, Models        │
│  - Platform, Solutions, Pricing, Resources      │
│  - Login / Try Claude CTAs                      │
├─────────────────────────────────────────────────┤
│  HERO SECTION                                   │
│  - H1: "Meet your thinking partner"             │
│  - Subtitle: "Tackle any big, bold..."          │
│  - Input prompt box ("How can I help you?")     │
│  - Quick action chips: Write, Learn, Code       │
├─────────────────────────────────────────────────┤
│  NEWS TICKER / LATEST NEWS                      │
│  - Horizontal scrollable news cards             │
│  - "Latest news" label + Next button            │
├─────────────────────────────────────────────────┤
│  FEATURE SECTIONS (Alternating layout)          │
│  - Feature cards with images + text             │
│  - Sticky image + scroll text pattern           │
│  - Grid-based feature showcase                  │
├─────────────────────────────────────────────────┤
│  IMPORT MEMORY BANNER                           │
│  - "Make the switch to Claude..."               │
│  - CTA: "Learn more"                            │
├─────────────────────────────────────────────────┤
│  FOOTER                                         │
│  - Input prompt box                             │
│  - Quick action chips                           │
│  - Link columns: Products, Features, Models...  │
│  - Anthropic logo + copyright                   │
└─────────────────────────────────────────────────┘
```

---

## 2. 设计令牌 (Design Tokens)

### 2.1 颜色系统

#### 主色调
| 名称 | HEX | RGB | 用途 |
|------|-----|-----|------|
| Dark Primary | `#141413` | rgb(20, 20, 19) | 主文本颜色、深色背景 |
| Light Primary | `#faf9f5` | rgb(250, 249, 245) | 浅色背景、主页面背景 |
| Mid Gray | `#b0aea5` | - | 次要文本、边框 |
| Light Gray | `#e8e6dc` | - | 微妙背景、分割线 |
| Warm Gray | `#f0eee6` | - | 卡片背景 |
| Medium Gray | `#87867f` | - | 三级文本 |
| Dark Accent | `#3d3d3a` | - | 按钮文本、强调 |
| Off-white | `#a1a0a0` | - | 占位符文本 |

#### 强调色
| 名称 | HEX | RGB | 用途 |
|------|-----|-----|------|
| Claude Orange | `#d97757` | rgb(217, 119, 87) | 主强调色、CTA 按钮 |
| Warm Beige | `#e3dacc` | rgb(227, 218, 204) | 温暖背景、装饰 |

#### 暗色模式
| 名称 | 值 | 用途 |
|------|-----|------|
| Dark BG | `rgb(19, 19, 20)` | 暗色模式背景 |

### 2.2 字体系统

#### 主字体
| 用途 | 字体 | 回退 |
|------|------|------|
| 主显示/正文 | **Anthropic Sans** | Arial, sans-serif |
| 备选方案 | 使用系统 sans-serif | - |

> 注意：Anthropic Sans 是 Anthropic 的定制字体。复刻时可使用以下替代方案：
> - **推荐替代**: `font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
> - **或**: `font-family: "Helvetica Neue", Helvetica, Arial, sans-serif`

#### 字体大小层级
| 层级 | 大小 (估算) | 用途 |
|------|------------|------|
| H1 Hero | 48-72px | 主标题 "Meet your thinking partner" |
| H2 Section | 32-48px | 区块标题 |
| H3 Card | 20-28px | 卡片标题 |
| Body Large | 16-18px | 正文大 |
| Body | 14-16px | 正文 |
| Caption | 12-14px | 说明文字 |
| Small | 11-12px | 微小文字 |

### 2.3 间距系统

基于 8px 网格系统：
| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4px | 极小间距 |
| sm | 8px | 小间距 |
| md | 16px | 中等间距 |
| lg | 24px | 大间距 |
| xl | 32px | 超大间距 |
| 2xl | 48px | 区块间距 |
| 3xl | 64px | 大区块间距 |
| 4xl | 96px | 页面级间距 |

### 2.4 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| sm | 4px | 小元素圆角 |
| md | 8px | 按钮、输入框 |
| lg | 12px | 卡片圆角 |
| xl | 16px | 大卡片圆角 |
| full | 9999px | 胶囊按钮、标签 |

### 2.5 阴影系统

| 用途 | 值 |
|------|-----|
| Card Shadow | `0 4px 24px rgba(0,0,0,0.05)` |
| Hover Shadow | `0 8px 32px rgba(0,0,0,0.08)` |
| Dropdown Shadow | `0 4px 16px rgba(0,0,0,0.1)` |

---

## 3. 组件设计规范

### 3.1 导航栏 (Navigation)

```css
.navbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: rgba(250, 249, 245, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #e8e6dc;
  padding: 0 24px;
  height: 64px;
}

.nav-link {
  color: #141413;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.15s ease;
}

.nav-link:hover {
  background: #f0eee6;
}

.nav-cta {
  background: #141413;
  color: #faf9f5;
  padding: 8px 16px;
  border-radius: 9999px;
  font-size: 14px;
  font-weight: 500;
}
```

#### Mega Menu
- 多列下拉菜单
- 分类标签 (Products, Features, Models)
- 每个链接右侧有外部链接图标
- 分割线分隔不同类别

### 3.2 Hero 区域

```css
.hero {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 24px;
  text-align: center;
}

.hero h1 {
  font-size: clamp(40px, 6vw, 72px);
  font-weight: 400;
  line-height: 1.1;
  color: #141413;
  letter-spacing: -0.02em;
  margin-bottom: 16px;
}

.hero p {
  font-size: 18-20px;
  color: #87867f;
  max-width: 600px;
  margin: 0 auto 32px;
}
```

#### Prompt 输入框
```css
.prompt-input {
  max-width: 700px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #e8e6dc;
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.05);
}

.prompt-input input {
  border: none;
  outline: none;
  font-size: 16px;
  width: 100%;
  color: #141413;
}

.prompt-input input::placeholder {
  color: #a1a0a0;
}
```

#### Quick Action Chips
```css
.action-chips {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 16px;
}

.chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #f0eee6;
  border-radius: 9999px;
  font-size: 14px;
  color: #141413;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chip:hover {
  background: #e8e6dc;
}

.chip-icon {
  width: 16px;
  height: 16px;
}
```

### 3.3 新闻滚动条 (News Ticker)

```css
.news-ticker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.news-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #87867f;
}

.news-cards {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}

.news-card {
  flex-shrink: 0;
  scroll-snap-align: start;
  padding: 12px 20px;
  background: #f0eee6;
  border-radius: 12px;
  font-size: 14px;
  color: #141413;
}
```

### 3.4 Feature Cards

```css
.feature-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 64px 24px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.feature-card {
  background: #fff;
  border: 1px solid #e8e6dc;
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.feature-card:hover {
  box-shadow: 0 8px 32px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}

.feature-card-image {
  width: 100%;
  aspect-ratio: 16/10;
  object-fit: cover;
}

.feature-card-content {
  padding: 24px;
}

.feature-card h3 {
  font-size: 20px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #141413;
}

.feature-card p {
  font-size: 14px;
  color: #87867f;
  line-height: 1.5;
}
```

### 3.5 Sticky Image + Scroll Text

```css
.sticky-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 64px 24px;
}

.sticky-image {
  position: sticky;
  top: 100px;
  align-self: start;
}

.scroll-text {
  /* 内容随滚动 */
}
```

### 3.6 CTA Banner

```css
.cta-banner {
  background: #f0eee6;
  border-radius: 16px;
  padding: 32px 40px;
  max-width: 1200px;
  margin: 64px auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cta-banner h2 {
  font-size: 24px;
  font-weight: 500;
  color: #141413;
  margin-bottom: 8px;
}

.cta-banner p {
  font-size: 16px;
  color: #87867f;
}

.cta-link {
  color: #d97757;
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.cta-link:hover {
  text-decoration: underline;
}
```

### 3.7 Footer

```css
.footer {
  background: #faf9f5;
  border-top: 1px solid #e8e6dc;
  padding: 64px 24px 32px;
}

.footer-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

.footer-column h4 {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #87867f;
  margin-bottom: 16px;
}

.footer-column a {
  display: block;
  color: #141413;
  font-size: 14px;
  text-decoration: none;
  padding: 4px 0;
}

.footer-column a:hover {
  color: #d97757;
}

.footer-bottom {
  max-width: 1200px;
  margin: 48px auto 0;
  padding-top: 24px;
  border-top: 1px solid #e8e6dc;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-copyright {
  font-size: 12px;
  color: #87867f;
}
```

---

## 4. 动画与交互

### 4.1 过渡效果

```css
/* 标准过渡 */
.transition-standard {
  transition: all 0.15s ease;
}

/* 平滑过渡 */
.transition-smooth {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 弹性过渡 */
.transition-bounce {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 4.2 Hover 效果

| 元素 | 效果 |
|------|------|
| 链接 | 颜色变化 + 下划线 |
| 按钮 | 背景色变深 + 轻微缩放 |
| 卡片 | 阴影加深 + 上移 2px |
| Chip | 背景色变化 |
| 导航项 | 背景高亮 |

### 4.3 页面加载动画

- Hero 文字：淡入 + 上移 (staggered)
- 卡片：依次淡入
- 图片：懒加载 + 淡入

---

## 5. 响应式断点

| 断点 | 宽度 | 用途 |
|------|------|------|
| Mobile | < 768px | 单列布局 |
| Tablet | 768px - 1024px | 双列布局 |
| Desktop | > 1024px | 完整布局 |

### 5.1 移动端适配

```css
@media (max-width: 768px) {
  .hero h1 {
    font-size: 32px;
  }
  
  .feature-grid {
    grid-template-columns: 1fr;
  }
  
  .footer-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .sticky-section {
    grid-template-columns: 1fr;
  }
  
  .sticky-image {
    position: relative;
  }
}
```

---

## 6. 页面截图

完整页面截图已保存至: `/tmp/claude-hero.png`

---

## 7. 资源链接

### 7.1 抓取的数据
- 完整 HTML: `/tmp/claude-overview-full.json` (1.9MB)
- 页面快照: `/tmp/claude-snapshot.yaml`
- 页面截图: `/tmp/claude-hero.png`

### 7.2 页面内链接
所有内部链接已提取，共 47+ 个链接，包括：
- 产品页面 (Claude, Claude Code, Claude Cowork)
- 功能页面 (Chrome, Slack, Excel, PowerPoint, Word, Skills)
- 模型页面 (Opus, Sonnet, Haiku)
- 定价页面 (Pro, Max, Team, Enterprise)
- 解决方案页面 (Agents, Coding, Security, etc.)

---

## 8. 复刻检查清单

- [ ] 导航栏 (Sticky + Mega Menu)
- [ ] Hero 区域 (H1 + Prompt Input + Action Chips)
- [ ] 新闻滚动条
- [ ] Feature Cards 网格
- [ ] Sticky Image + Scroll Text 布局
- [ ] CTA Banner
- [ ] Footer (多列链接 + Prompt Input)
- [ ] 响应式适配 (Mobile/Tablet/Desktop)
- [ ] 动画与过渡效果
- [ ] 颜色系统实现
- [ ] 字体系统实现
- [ ] 间距系统实现

---

*生成时间: 2026-04-12*
*数据来源: claude.com/product/overview*
