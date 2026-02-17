# Gold Price Crawler Worker

Cloudflare Worker 用于爬取上海黄金交易所(SGE)和国际金价数据，每分钟更新一次。

## 功能

- **国内金价**: 从上海黄金交易所爬取 Au99.99 实时价格
- **国际金价**: 从 CoinGecko API 获取国际金价
- **实时汇率**: 获取 USD/CNY 实时汇率
- **定时更新**: 每分钟自动爬取并缓存数据
- **历史数据**: 存储24小时历史价格用于图表展示

## API 端点

### 获取最新金价
```
GET /api/gold
```

响应示例:
```json
{
  "success": true,
  "timestamp": 1704067200000,
  "exchangeRate": 7.25,
  "domestic": {
    "price": 480.50,
    "open": 479.00,
    "high": 481.20,
    "low": 478.50,
    "change": 1.20,
    "changePercent": 0.25
  },
  "international": {
    "price": 2050.00,
    "open": 2045.00,
    "high": 2055.00,
    "low": 2040.00,
    "change": 10.00,
    "changePercent": 0.49
  }
}
```

### 获取历史数据
```
GET /api/gold/history?range=1d
```

参数:
- `range`: 时间范围 (`1d`, `1m`, `3m`, `6m`, `1y`)

### 手动触发爬取
```
GET /api/crawl
```

## 部署步骤

### 1. 安装 Wrangler
```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare
```bash
wrangler login
```

### 3. 创建 KV 命名空间
```bash
# 生产环境
wrangler kv:namespace create "GOLD_PRICE_CACHE"

# 开发环境
wrangler kv:namespace create "GOLD_PRICE_CACHE" --env development
```

### 4. 更新 wrangler.toml
将创建的 KV namespace ID 更新到 `wrangler.toml` 文件中。

### 5. 部署
```bash
# 开发环境
wrangler deploy --env development

# 生产环境
wrangler deploy
```

## 配置定时触发器

在 Cloudflare Dashboard 中:
1. 进入 Worker 详情页
2. 点击 "Triggers" 标签
3. 添加 Cron Trigger: `* * * * *` (每分钟)

## 数据来源

- **上海黄金交易所**: https://www.sge.com.cn/graph/DelayMakretData
- **国际金价**: CoinGecko API (Tether Gold)
- **汇率**: exchangerate-api.com

## 注意事项

1. SGE API 可能有访问限制，如无法访问会降级使用国际金价计算
2. 免费版 CoinGecko API 有速率限制（10-30 次/分钟）
3. 汇率数据每小时更新一次缓存
4. 历史数据保留最近 1440 条（24小时）

## 监控

查看日志:
```bash
wrangler tail
```
