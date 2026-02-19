# AI 智能分析系统集成部署指南

## 📋 概述

本指南说明如何将每分钟数据提交到AI智能分析系统的功能部署到生产环境。

## 🔄 主要变更

### 1. 定时任务调整
- **之前**: `*/2 * * * *` 每2分钟执行智能分析
- **现在**: `*/1 * * * *` 每分钟执行数据爬取+AI分析提交

### 2. 新增功能
- `submitDataToAIAnalysis()`: 提交数据到AI分析系统
- `buildAIAnalysisPrompt()`: 构建增强版AI分析提示
- `storeAIAnalysisResult()`: 存储AI分析结果
- `sendAITradingSignal()`: 发送AI交易信号通知
- `logAIAnalysisError()`: 记录AI分析错误

### 3. 新增API端点
- `GET /api/gold/ai-analysis`: 获取AI分析结果
- `GET /api/gold/ai-signals`: 获取AI交易信号

## 🚀 部署步骤

### 步骤 1: 验证环境变量

确保以下环境变量已配置：

```bash
# 在 Cloudflare Workers 中配置
wrangler secret put DASHSCOPE_API_KEY    # 通义千问 API Key
wrangler secret put DOUBAO_API_KEY       # 豆包 API Key
wrangler secret put RESEND_API_KEY       # (可选) Resend 邮件 API Key
```

### 步骤 2: 更新 wrangler.toml

确保定时任务配置正确：

```toml
[triggers]
crons = ["*/1 * * * *", "*/5 * * * *", "0 0 * * *"]
```

说明：
- `*/1 * * * *`: 每分钟执行金价爬取和AI分析
- `*/5 * * * *`: 每5分钟执行趋势分析
- `0 0 * * *`: 每日零点清理数据

### 步骤 3: 部署代码

```bash
# 1. 构建项目
npm run build

# 2. 部署到 Cloudflare Workers
wrangler deploy

# 3. 验证部署
wrangler tail
```

### 步骤 4: 验证功能

运行测试脚本：

```bash
node test-ai-integration.js
```

或手动测试API：

```bash
# 测试金价数据接口
curl https://api.ustc.dev/api/gold

# 测试AI分析接口
curl https://api.ustc.dev/api/gold/ai-analysis

# 测试AI信号接口
curl https://api.ustc.dev/api/gold/ai-signals
```

## 📊 数据流

```
每分钟执行:
  ↓
爬取金价数据 (performCrawl)
  ↓
存储到 KV & D1 (storeGoldPriceData)
  ↓
检查价格预警 (checkAndSendTradingAlerts)
  ↓
提交到AI分析 (submitDataToAIAnalysis)
  ↓
  ├─> 获取今日历史数据
  ├─> 获取交易参数
  ├─> 分析市场趋势
  ├─> 调用通义千问 API
  ├─> 调用豆包 API
  ├─> 合并AI结果
  ├─> 存储分析结果
  └─> 发送交易信号通知 (如果有)
```

## 📈 监控指标

### 1. 查看AI分析日志

```bash
# 查看今天的AI分析记录
curl "https://api.ustc.dev/api/gold/ai-analysis?date=$(date +%Y-%m-%d)"
```

### 2. 查看AI交易信号

```bash
# 查看今天的AI交易信号
curl "https://api.ustc.dev/api/gold/ai-signals?date=$(date +%Y-%m-%d)"
```

### 3. 查看Worker日志

```bash
wrangler tail
```

## ⚠️ 注意事项

### 1. API 调用限制
- **通义千问**: 每分钟最多 20 次调用
- **豆包**: 每分钟最多 20 次调用
- 当前配置每分钟调用1次，符合限制

### 2. 数据存储
- AI分析结果存储在 KV 中，保留3天
- 错误日志保留7天
- 最多保留1440条记录（24小时）

### 3. 通知冷却期
- AI交易信号通知有15分钟冷却期
- 避免频繁发送相同信号

### 4. 错误处理
- AI分析失败不会影响主流程
- 错误会被记录到KV中
- 支持自动重试机制

## 🔧 故障排除

### 问题 1: AI分析没有结果

**检查**: 
```bash
curl https://api.ustc.dev/api/gold/ai-analysis
```

**可能原因**:
- API Key 未配置
- 数据点不足（需要至少10个数据点）
- AI服务调用失败

**解决**:
1. 检查环境变量配置
2. 等待几分钟积累数据
3. 查看Worker日志

### 问题 2: 定时任务未执行

**检查**:
```bash
wrangler triggers list
```

**解决**:
```bash
wrangler triggers update
```

### 问题 3: API 响应慢

**优化建议**:
- 检查网络连接
- 考虑启用缓存
- 监控API调用延迟

## 📚 相关文档

- [AI模型调研报告](./gold-analysis-system/AI_MODEL_RESEARCH.md)
- [实施计划](./gold-analysis-system/IMPLEMENTATION_PLAN.md)
- [系统架构说明](./gold-analysis-system/README.md)

## 📞 支持

如有问题，请检查：
1. Worker日志: `wrangler tail`
2. API响应: 使用测试脚本
3. 数据库状态: 检查D1和KV数据

---

*最后更新: 2026-02-19*
*版本: v1.0*
