# 金价预警与 AI 智能分析 — 分析与优化说明

## 一、原有问题诊断

### 1. 即时波动预警「永远不触发」

- **原因**：定时任务里先执行 `storeGoldPriceData(env, result)`，再执行 `getDayHistory(env, today)`。
- 因此传给 `sendGoldPriceAlert` 的 `history` 已经包含**本分钟刚写入的当前价**。
- `analyzeInstantChange(history.domestic, domestic.price)` 变成「当前价 vs 当前价」→ 变化恒为 0，即时预警逻辑从未生效。

### 2. 窗口/短期波动用到的历史少一个点

- 窗口、短期检测用的是「不含当前点」的 `history`，最近一段区间里缺少最新价，边界情况容易漏报或不准。

### 3. AI 交易信号只打日志、不推送

- `sendAITradingSignal` 里仅 `console.log('[AI Signal] Would send email notification:', message)`，没有调用 Resend/飞书/MeoW，导致 AI 信号从未真正触达用户。

### 4. Cron 冗余

- `wrangler.toml` 中配置了 `*/2 * * * *`，但代码里没有对应分支，走 `default` 再次执行 `scheduledGoldCrawlWithAI`，与 `*/1` 重复且无额外逻辑，造成多余爬取与负载。

---

## 二、已做优化

### 1. 定时任务：先取历史再存库（修复即时预警）

- 在 `scheduledGoldCrawlWithAI` 中，**在调用 `storeGoldPriceData` 之前**先执行：
  - `const historyForAlert = await getDayHistory(env, today);`
- 存库后再用 `historyForAlert` 调用 `sendGoldPriceAlert(result.domestic, result.international, historyForAlert, env)`。
- 这样「即时」逻辑对比的是**上一分钟的价格**与**本分钟当前价**，即时波动预警可以正常触发。

### 2. 波动检测：窗口/短期使用「含当前点」的序列

- 在 `sendGoldPriceAlert` 内构造：
  - `domesticSeries = [...(history?.domestic || []), domestic?.price].filter(...)`
  - `internationalSeries = [...(history?.international || []), international?.price].filter(...)`
- 即时检测仍使用「不含当前点」的 `history`（上一时刻 vs 当前）。
- 窗口、短期检测改为使用 `domesticSeries` / `internationalSeries`，保证最近 N 个点包含最新价，检测更准确。

### 3. AI 交易信号：真实三端推送

- `sendAITradingSignal` 改为调用 `sendMultiChannelNotification(env, { title, emailSubject, emailHtml, feishuContent, meowContent })`。
- 邮件（Resend）、飞书、MeoW 均按现有通道发送，AI 买入/卖出建议能真正推送到用户。

### 4. 移除冗余 Cron

- `wrangler.toml` 的 `crons` 去掉 `*/2 * * * *`，保留：
  - `*/1 * * * *`：每分钟爬取 + 预警检查
  - `*/5 * * * *`：每 5 分钟趋势分析
  - `0 0 * * *`：每日零点清理价格任务

---

## 三、当前逻辑与时效（优化后）

| 环节           | 频率/时机     | 说明 |
|----------------|----------------|------|
| 金价爬取       | 每 1 分钟      | Cron `*/1`，写 KV + D1，更新当日历史。 |
| 预设到价预警   | 每次爬取成功后 | `checkAndSendTradingAlerts(currentPrice)`，到价即发邮件/飞书/MeoW。 |
| 即时波动预警   | 每次爬取成功后 | 对比「上一分钟 vs 当前」，满足 `INSTANT_CHANGE_THRESHOLD`(2 元) 或 `INSTANT_CHANGE_PERCENT`(0.3%) 即触发。 |
| 窗口/短期波动  | 每次爬取成功后 | 使用含当前价的序列，滑动窗口与短期偏差超过阈值即触发。 |
| 冷却           | 即时 15s / 非即时 30s | 由 `ALERT_CONFIG.COOLDOWN_MINUTES` 与 `last_alert` 控制，避免刷屏。 |
| AI 分析        | 每 1 分钟      | 爬取成功后 `submitDataToAIAnalysis`（waitUntil），写入分析结果。 |
| AI 信号推送    | 有买入/卖出建议时 | 调用 `sendAITradingSignal`，2 分钟冷却，三端推送。 |
| 趋势分析       | 每 5 分钟      | `scheduledGoldAnalysis`，独立于每分钟管道。 |

---

## 四、可调参数（按需微调）

- `ALERT_CONFIG`（`src/works.js`）：
  - `INSTANT_CHANGE_THRESHOLD`：即时绝对变化阈值（元/克），当前 2。
  - `INSTANT_CHANGE_PERCENT`：即时相对变化阈值（%），当前 0.3。
  - `COOLDOWN_MINUTES`：波动类预警冷却（分钟），当前 0.5。
- AI 信号冷却在 `sendAITradingSignal` 内 `COOLDOWN = 2 * 60 * 1000`（2 分钟）。

若希望「更敏感」：可适当调低 `INSTANT_CHANGE_THRESHOLD` 或 `INSTANT_CHANGE_PERCENT`；若「太吵」：可提高冷却或阈值。

---

## 五、部署与入口

- Worker 入口为 `works.js`（本地开发为 `src/works.js`）。部署时需保证 wrangler 的 `main` 指向实际入口（例如构建输出根目录的 `works.js` 或配置 `main = "src/works.js"`）。
- 确保环境变量/密钥已配置：`RESEND_API_KEY`、`FEISHU_WEBHOOK`、MeoW 等，否则对应通道不会发送。
