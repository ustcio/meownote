# 金价预警通知推送逻辑文档

## 📋 概述

本文档详细说明金价预警系统的通知推送逻辑，包括三端（Email、MeoW、飞书）同步推送机制。

---

## 🔄 统一通知系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      统一通知系统                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                            │
│  │  触发事件        │                                            │
│  │  • 价格波动      │                                            │
│  │  • 分析信号      │                                            │
│  │  • 手动测试      │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌───────────────────────────────────────────────────────┐     │
│  │          sendUnifiedNotification()                    │     │
│  │  ┌─────────────────────────────────────────────────┐ │     │
│  │  │  1. 冷却期检查 (30分钟)                          │ │     │
│  │  │  2. 消息格式化                                   │ │     │
│  │  │  3. 并行发送三端通知                              │ │     │
│  │  │  4. 结果记录                                     │ │     │
│  │  │  5. 更新冷却时间                                 │ │     │
│  │  └─────────────────────────────────────────────────┘ │     │
│  └────────┬──────────────────────────────────────────────┘     │
│           │                                                     │
│     ┌─────┴─────┐                                               │
│     │           │                                               │
│     ▼           ▼                                               │
│  ┌──────┐   ┌──────┐   ┌──────┐                                │
│  │Email │   │飞书  │   │MeoW  │                                │
│  │      │   │      │   │      │                                │
│  └──────┘   └──────┘   └──────┘                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 推送触发逻辑

### 1. 价格波动预警推送

**触发条件**:
- 滑动窗口检测：最近10个采集点内，最高价与最低价差值超过阈值
  - 国内黄金阈值：1.5 元/克
  - 国际黄金阈值：5.0 美元/盎司
- 短期波动检测：当前价格与最近30分钟内价格偏差超过阈值

**冷却期**: 30分钟

**推送渠道**: Email + 飞书 + MeoW（同步推送）

**代码位置**:
```javascript
// works.js:3284-3298
if (alerts.length > 0) {
  const result = await sendUnifiedNotification(alerts, env, {
    notificationType: 'price_movement',
    skipCooldown: false
  });
}
```

---

### 2. 智能分析买入信号推送

**触发条件**:
- 每5分钟执行一次趋势分析
- 检测到买入信号（RSI < 30 或 MACD金叉 + 价格触及布林带下轨）
- 国内或国际金价任一满足条件

**冷却期**: 30分钟

**推送渠道**: Email + 飞书 + MeoW（同步推送）

**代码位置**:
```javascript
// works.js:1878-1887
if (shouldNotify) {
  const lastNotifyKey = 'last_analysis_notify';
  const lastNotify = await env.GOLD_PRICE_CACHE.get(lastNotifyKey);
  const now = Date.now();
  const COOLDOWN = 30 * 60 * 1000;
  
  if (!lastNotify || (now - parseInt(lastNotify)) > COOLDOWN) {
    await sendAnalysisNotification(result.analysis, env);
    await env.GOLD_PRICE_CACHE.put(lastNotifyKey, String(now), { expirationTtl: 3600 });
  }
}
```

---

### 3. AI智能分析信号推送

**触发条件**:
- 每分钟执行AI分析
- AI模型（通义千问 + 豆包）给出买入/卖出建议
- 置信度达到一定阈值
- 用户已设置价格预警

**冷却期**: 15分钟

**推送渠道**: Email + 飞书 + MeoW（同步推送）

**代码位置**:
```javascript
// works.js:1783-1809
if (combinedAnalysis.hasValue && combinedAnalysis.signals) {
  const hasActiveAlerts = tradingParams.alerts && tradingParams.alerts.length > 0;
  if (hasActiveAlerts) {
    await sendAITradingSignal(env, combinedAnalysis, crawlResult.domestic?.price, tradingParams);
  }
}
```

---

### 4. 手动测试推送

**触发条件**:
- 调用测试API: `/api/gold/alert/test?type=all`

**冷却期**: 无（skipCooldown: true）

**推送渠道**: Email + 飞书 + MeoW（同步推送）

**代码位置**:
```javascript
// works.js:4592-4608
if (type === 'all') {
  const unifiedResult = await sendUnifiedNotification(testAlerts, env, {
    notificationType: 'test',
    skipCooldown: true
  });
}
```

---

## ⚙️ 统一通知系统配置

### 配置参数

```javascript
const NOTIFICATION_CONFIG = {
  COOLDOWN_MINUTES: 30,  // 冷却时间（分钟）
  MAX_RETRIES: 3,        // 最大重试次数
  RETRY_DELAY: 1000,     // 重试延迟（毫秒）
};
```

### 冷却期逻辑

```
┌─────────────────────────────────────────┐
│           冷却期检查逻辑                 │
├─────────────────────────────────────────┤
│                                         │
│  1. 读取上次通知时间戳                   │
│     Key: notification_cooldown:{type}   │
│                                         │
│  2. 计算时间差                          │
│     elapsed = now - lastNotify          │
│                                         │
│  3. 判断是否在冷却期                     │
│     IF elapsed < 30分钟:                │
│        → 跳过推送                       │
│        → 返回剩余时间                   │
│     ELSE:                               │
│        → 继续推送                       │
│        → 更新冷却时间戳                 │
│                                         │
└─────────────────────────────────────────┘
```

---

## 📨 三端推送详情

### 1. Email 推送

**配置要求**:
- `RESEND_API_KEY` - Resend API密钥

**消息格式**:
- HTML格式邮件
- 包含价格表格和图表
- 深色主题设计
- 包含预警规则说明

**接收邮箱**:
- metanext@foxmail.com

**发送函数**: `sendAlertEmailWithTracking()`

---

### 2. 飞书推送

**配置要求**（二选一）:
- `FEISHU_WEBHOOK` - 飞书Webhook地址
- 或同时配置：
  - `FEISHU_APP_ID`
  - `FEISHU_APP_SECRET`
  - `FEISHU_CHAT_ID`

**消息格式**:
- 交互式卡片消息
- 包含Emoji图标
- 支持Markdown格式

**发送函数**: `sendFeishuAlertWithTracking()`

---

### 3. MeoW 推送

**配置要求**:
- `MEOW_USER_ID` - MeoW用户ID（默认：5bf48882）

**消息格式**:
- 纯文本消息
- 包含标题和链接

**发送函数**: `sendMeoWAlertWithTracking()`

---

## 🔄 同步推送机制

### 并行发送

```javascript
// 使用 Promise.allSettled 并行发送
const results = await Promise.allSettled([
  sendAlertEmailWithTracking(alerts, env, messageContent),
  sendFeishuAlertWithTracking(alerts, env, messageContent),
  sendMeoWAlertWithTracking(alerts, env, messageContent)
]);
```

### 错误处理

- 任一渠道失败不影响其他渠道
- 错误会被记录到日志
- 返回每个渠道的独立结果

### 结果格式

```json
{
  "success": true,
  "results": {
    "email": {
      "channel": "email",
      "success": true
    },
    "feishu": {
      "channel": "feishu",
      "success": true,
      "method": "webhook"
    },
    "meow": {
      "channel": "meow",
      "success": true
    }
  },
  "timestamp": 1771470883239
}
```

---

## 📊 通知历史记录

### 记录内容

```javascript
{
  timestamp: Date.now(),
  type: 'price_alert',  // 通知类型
  alertCount: 2,        // 预警数量
  results: {
    email: { success: true },
    feishu: { success: true, method: 'webhook' },
    meow: { success: true }
  }
}
```

### 存储位置

- **KV Key**: `notification_history:{YYYY-MM-DD}`
- **保留时间**: 7天
- **最大记录数**: 100条/天

### 查询API

```javascript
// 获取今日通知历史
const history = await getNotificationHistory(env);

// 获取指定日期通知历史
const history = await getNotificationHistory(env, '2026-02-19');
```

---

## 🧪 测试方法

### 测试所有渠道

```bash
curl "https://api.moonsun.ai/api/gold/alert/test?type=all"
```

### 测试单个渠道

```bash
# 测试Email
curl "https://api.moonsun.ai/api/gold/alert/test?type=email"

# 测试飞书
curl "https://api.moonsun.ai/api/gold/alert/test?type=feishu"

# 测试MeoW
curl "https://api.moonsun.ai/api/gold/alert/test?type=meow"
```

---

## ⚠️ 常见问题

### 1. 为什么只收到部分通知？

**可能原因**:
- 某渠道的API密钥未配置
- 某渠道的服务暂时不可用
- 检查日志查看具体错误

**排查方法**:
```bash
# 查看Worker日志
npx wrangler tail
```

### 2. 通知频率太高？

**解决方案**:
- 调整 `NOTIFICATION_CONFIG.COOLDOWN_MINUTES`
- 修改价格波动阈值
- 关闭某些类型的通知

### 3. 如何临时禁用某个渠道？

**方法**:
- 删除对应的环境变量
- 或设置无效的配置值

---

## 🔧 配置检查清单

### 必需配置

- [ ] `RESEND_API_KEY` - Email通知
- [ ] `FEISHU_WEBHOOK` 或 (`FEISHU_APP_ID` + `FEISHU_APP_SECRET` + `FEISHU_CHAT_ID`) - 飞书通知
- [ ] `MEOW_USER_ID` - MeoW通知（可选，有默认值）

### 验证配置

```bash
# 检查配置状态
curl "https://api.moonsun.ai/api/gold/alert/test?type=all"
```

---

## 📈 监控指标

### 推送成功率

```
推送成功率 = 成功推送次数 / 总推送次数 × 100%
```

### 各渠道延迟

- Email: ~1-3秒
- 飞书: ~500ms-1秒
- MeoW: ~300ms-800ms

---

## 📝 更新日志

### 2026-02-19
- ✅ 修复三端不同步推送问题
- ✅ 实现统一通知系统
- ✅ 添加通知历史记录功能
- ✅ 优化冷却期逻辑

---

**文档版本**: v1.0  
**最后更新**: 2026-02-19
