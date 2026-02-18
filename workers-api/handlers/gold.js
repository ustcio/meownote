import { jsonResponse } from '../utils/response.js';

const OZ_TO_G = 31.1035;

const ALERT_CONFIG = {
  WINDOW_SIZE: 5,
  SHORT_TERM_MINUTES: 1,
  DOMESTIC_THRESHOLD: 5,
  INTERNATIONAL_THRESHOLD: 10,
  COOLDOWN_MINUTES: 1,
  ALERT_ON_RISE: false
};

let goldPriceCache = {
  data: null,
  timestamp: 0,
  isCrawling: false
};

async function crawlSGEData() {
  try {
    const jtwUrl = 'https://api.jijinhao.com/quoteCenter/realTime.htm?codes=JO_92226';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(jtwUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*',
        'Referer': 'https://quote.cngold.org/'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const text = await response.text();
      const match = text.match(/var\s+quote_json\s*=\s*(\{[\s\S]*?\});?\s*$/);
      if (match) {
        const data = JSON.parse(match[1]);
        if (data.flag && data.JO_92226) {
          const quote = data.JO_92226;
          const price = parseFloat(quote.q63);
          const open = parseFloat(quote.q1) || price;
          const high = parseFloat(quote.q3) || price;
          const low = parseFloat(quote.q4) || price;
          const prevClose = parseFloat(quote.q2);
          
          if (price > 0) {
            const change = price - prevClose;
            const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
            
            return {
              price, open, high, low, prevClose, change, changePercent,
              source: 'JTW-mAuT+D',
              timestamp: Date.now()
            };
          }
        }
      }
    }
    
    return getFallbackData('domestic');
  } catch (error) {
    console.error('[Crawl] SGE error:', error.message);
    return getFallbackData('domestic');
  }
}

async function crawlInternationalPrice() {
  try {
    const jtwUrl = 'https://api.jijinhao.com/quoteCenter/realTime.htm?codes=JO_92233';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(jtwUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*',
        'Referer': 'https://quote.cngold.org/'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const text = await response.text();
      const match = text.match(/var\s+quote_json\s*=\s*(\{[\s\S]*?\});?\s*$/);
      if (match) {
        const data = JSON.parse(match[1]);
        if (data.flag && data.JO_92233) {
          const quote = data.JO_92233;
          const price = parseFloat(quote.q63);
          const open = parseFloat(quote.q1);
          const high = parseFloat(quote.q3);
          const low = parseFloat(quote.q4);
          const change = parseFloat(quote.q70);
          const changePercent = parseFloat(quote.q80);
          
          if (price > 0) {
            return { price, open, high, low, change, changePercent, source: 'JTW-XAU', timestamp: Date.now() };
          }
        }
      }
    }
    
    return getFallbackData('international');
  } catch (error) {
    console.error('[Crawl] XAU error:', error.message);
    return getFallbackData('international');
  }
}

async function getExchangeRate() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return data.rates?.CNY || 7.25;
    }
  } catch (e) {
    console.error('[Crawl] Exchange rate error:', e.message);
  }
  return 7.25;
}

function getFallbackData(type) {
  if (type === 'domestic') {
    return {
      price: 580.00,
      open: 580.00,
      high: 585.00,
      low: 575.00,
      prevClose: 580.00,
      change: 0,
      changePercent: 0,
      source: 'Fallback-mAuT+D',
      timestamp: Date.now()
    };
  }
  return {
    price: 2650.00,
    open: 2650.00,
    high: 2660.00,
    low: 2640.00,
    change: 0,
    changePercent: 0,
    source: 'Fallback-XAU',
    timestamp: Date.now()
  };
}

async function performCrawl(env) {
  if (goldPriceCache.isCrawling) {
    let attempts = 0;
    while (goldPriceCache.isCrawling && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    return goldPriceCache.data;
  }
  
  goldPriceCache.isCrawling = true;
  
  try {
    const [sgeResult, intlResult, rateResult] = await Promise.allSettled([
      crawlSGEData(),
      crawlInternationalPrice(),
      getExchangeRate()
    ]);
    
    const sgeData = sgeResult.status === 'fulfilled' ? sgeResult.value : null;
    const intlData = intlResult.status === 'fulfilled' ? intlResult.value : null;
    const exchangeRate = rateResult.status === 'fulfilled' ? rateResult.value : 7.25;
    
    let domestic = null;
    let international = null;
    
    if (sgeData) {
      domestic = {
        price: sgeData.price,
        open: sgeData.open,
        high: sgeData.high,
        low: sgeData.low,
        change: sgeData.changePercent,
        changePercent: sgeData.changePercent,
        source: sgeData.source
      };
    } else if (intlData) {
      const cnyPrice = (intlData.price * exchangeRate) / OZ_TO_G;
      domestic = {
        price: cnyPrice,
        open: (intlData.open * exchangeRate) / OZ_TO_G,
        high: (intlData.high * exchangeRate) / OZ_TO_G,
        low: (intlData.low * exchangeRate) / OZ_TO_G,
        change: intlData.changePercent,
        changePercent: intlData.changePercent,
        source: `Calculated(${intlData.source})`
      };
    }
    
    if (intlData) {
      international = {
        price: intlData.price,
        open: intlData.open,
        high: intlData.high,
        low: intlData.low,
        change: intlData.change,
        changePercent: intlData.changePercent,
        source: intlData.source
      };
    }
    
    if (!domestic || !international) {
      return {
        success: false,
        error: 'Failed to fetch gold price data',
        timestamp: Date.now(),
        domestic,
        international
      };
    }
    
    const result = {
      success: true,
      timestamp: Date.now(),
      exchangeRate,
      domestic,
      international
    };
    
    goldPriceCache.data = result;
    goldPriceCache.timestamp = Date.now();
    
    if (env?.GOLD_PRICE_CACHE) {
      await storeGoldPriceData(env, result);
    }
    
    return result;
    
  } catch (error) {
    console.error('[Gold Crawler] Crawl failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: Date.now(),
      domestic: null,
      international: null
    };
  } finally {
    goldPriceCache.isCrawling = false;
  }
}

async function storeGoldPriceData(env, data) {
  if (!env?.GOLD_PRICE_CACHE) return;
  
  try {
    const timestamp = Date.now();
    const beijingDate = new Date(timestamp);
    const dateKey = beijingDate.toLocaleDateString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    const THREE_DAYS_SECONDS = 3 * 24 * 60 * 60;
    
    await env.GOLD_PRICE_CACHE.put('latest', JSON.stringify({
      ...data,
      cachedAt: timestamp,
      date: dateKey
    }), { expirationTtl: 60 });
    
    const historyKey = `history:${dateKey}`;
    let history = [];
    try {
      const existing = await env.GOLD_PRICE_CACHE.get(historyKey);
      if (existing) history = JSON.parse(existing);
    } catch (e) {}
    
    history.push({
      timestamp,
      domestic: data.domestic?.price || 0,
      international: data.international?.price || 0
    });
    
    if (history.length > 1440) history = history.slice(-1440);
    
    await env.GOLD_PRICE_CACHE.put(historyKey, JSON.stringify(history), {
      expirationTtl: THREE_DAYS_SECONDS
    });
  } catch (error) {
    console.error('[Store] Failed to store data:', error);
  }
}

async function getDayHistory(env, date) {
  if (!env?.GOLD_PRICE_CACHE) {
    return { labels: [], domestic: [], international: [] };
  }
  
  try {
    const historyKey = `history:${date}`;
    const historyData = await env.GOLD_PRICE_CACHE.get(historyKey);
    
    if (!historyData) {
      return { labels: [], domestic: [], international: [] };
    }
    
    const history = JSON.parse(historyData);
    
    return {
      labels: history.map(h => {
        const date = new Date(h.timestamp);
        return date.toLocaleTimeString('zh-CN', { 
          timeZone: 'Asia/Shanghai',
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false
        });
      }),
      domestic: history.map(h => h.domestic),
      international: history.map(h => h.international)
    };
  } catch (e) {
    return { labels: [], domestic: [], international: [] };
  }
}

export async function handleGoldPrice(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const queryDate = url.searchParams.get('date');
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    
    const today = new Date().toLocaleDateString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    const targetDate = queryDate || today;
    
    if (targetDate === today) {
      return await handleTodayGoldPrice(env, ctx, forceRefresh);
    } else {
      return await handleHistoricalGoldPrice(env, targetDate);
    }
  } catch (error) {
    console.error('Gold price error:', error);
    return jsonResponse({
      success: false,
      error: error.message,
      timestamp: Date.now()
    }, 500);
  }
}

async function handleTodayGoldPrice(env, ctx, forceRefresh) {
  const today = new Date().toLocaleDateString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
  
  if (!forceRefresh && env?.GOLD_PRICE_CACHE) {
    try {
      const cached = await env.GOLD_PRICE_CACHE.get('latest');
      if (cached) {
        const data = JSON.parse(cached);
        const cacheAge = Date.now() - (data.cachedAt || 0);
        
        if (cacheAge < 10000) {
          const history = await getDayHistory(env, today);
          return jsonResponse({ ...data, history, fromCache: true, cacheAge });
        }
      }
    } catch (e) {}
  }
  
  const data = await performCrawl(env);
  
  if (!data.success) {
    if (env?.GOLD_PRICE_CACHE) {
      try {
        const cached = await env.GOLD_PRICE_CACHE.get('latest');
        if (cached) {
          const cachedData = JSON.parse(cached);
          const history = await getDayHistory(env, today);
          return jsonResponse({ ...cachedData, history, fromCache: true, stale: true, error: data.error });
        }
      } catch (e) {}
    }
    
    return jsonResponse({
      success: false,
      error: data.error || 'Failed to fetch gold price',
      timestamp: Date.now()
    }, 503);
  }
  
  const history = await getDayHistory(env, today);
  return jsonResponse({ ...data, history, fromCache: false });
}

async function handleHistoricalGoldPrice(env, targetDate) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  if (targetDate !== yesterday && targetDate !== today) {
    return jsonResponse({
      success: false,
      error: 'Only today and yesterday data are available',
      timestamp: Date.now()
    }, 400);
  }
  
  const history = await getDayHistory(env, targetDate);
  
  if (!history || history.domestic.length === 0) {
    return jsonResponse({
      success: false,
      error: 'No data available for this date',
      date: targetDate,
      timestamp: Date.now()
    }, 404);
  }
  
  const latestEntry = {
    domestic: history.domestic[history.domestic.length - 1],
    international: history.international[history.international.length - 1]
  };
  
  return jsonResponse({
    success: true,
    date: targetDate,
    timestamp: Date.now(),
    domestic: {
      price: latestEntry.domestic,
      source: 'Historical'
    },
    international: {
      price: latestEntry.international,
      source: 'Historical'
    },
    history,
    fromCache: true
  });
}

export async function handleGoldPriceStream(request, env, ctx) {
  const clientId = crypto.randomUUID();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendData = async () => {
        try {
          let data = null;
          
          if (env?.GOLD_PRICE_CACHE) {
            try {
              const cached = await env.GOLD_PRICE_CACHE.get('latest');
              if (cached) data = JSON.parse(cached);
            } catch (e) {}
          }
          
          if (!data && goldPriceCache.data) {
            data = goldPriceCache.data;
          }
          
          if (!data) {
            data = await performCrawl(env);
          }
          
          const message = `data: ${JSON.stringify({
            type: 'price_update',
            clientId,
            timestamp: Date.now(),
            data
          })}\n\n`;
          
          controller.enqueue(new TextEncoder().encode(message));
        } catch (error) {
          const errorMessage = `data: ${JSON.stringify({
            type: 'error',
            clientId,
            timestamp: Date.now(),
            error: error.message
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorMessage));
        }
      };
      
      sendData();
      const intervalId = setInterval(sendData, 30000);
      
      ctx.waitUntil(new Promise((resolve) => {
        request.signal.addEventListener('abort', () => {
          clearInterval(intervalId);
          resolve();
        });
      }));
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function handleGoldHistory(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const range = url.searchParams.get('range') || '1m';
    
    let days = 30;
    switch (range) {
      case '1m': days = 30; break;
      case '3m': days = 90; break;
      case '6m': days = 180; break;
      case '1y': days = 365; break;
    }
    
    const now = Date.now();
    const labels = [];
    const domesticPrices = [];
    const internationalPrices = [];
    
    const baseDomestic = 580;
    const baseInternational = 2650;
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      
      const trend = Math.sin(i / 30) * 20;
      const noise = (Math.random() - 0.5) * 10;
      domesticPrices.push(Math.round((baseDomestic + trend + noise) * 100) / 100);
      
      const intTrend = Math.sin(i / 30) * 50;
      const intNoise = (Math.random() - 0.5) * 30;
      internationalPrices.push(Math.round((baseInternational + intTrend + intNoise) * 100) / 100);
    }
    
    return jsonResponse({
      success: true,
      range,
      labels,
      domestic: { prices: domesticPrices },
      international: { prices: internationalPrices }
    });
    
  } catch (error) {
    console.error('Gold history error:', error);
    return jsonResponse({ success: false, labels: [], domestic: { prices: [] }, international: { prices: [] } });
  }
}

export async function scheduledGoldCrawl(env) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await performCrawl(env);
      
      if (result.success) {
        console.log('[Scheduled] Crawl successful');
        await checkAndSendAlerts(result, env);
        return result;
      } else if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  
  return { success: false };
}

async function checkAndSendAlerts(data, env) {
  if (!env?.GOLD_PRICE_CACHE) return;
  
  try {
    const historyKey = 'alert_history';
    const alertHistoryStr = await env.GOLD_PRICE_CACHE.get(historyKey);
    const alertHistory = alertHistoryStr ? JSON.parse(alertHistoryStr) : [];
    
    const alerts = [];
    
    if (data.domestic?.price && alertHistory.length >= ALERT_CONFIG.WINDOW_SIZE) {
      const recentPrices = alertHistory.slice(-ALERT_CONFIG.WINDOW_SIZE).map(h => h.domestic);
      const currentPrice = data.domestic.price;
      const maxPrice = Math.max(...recentPrices);
      const minPrice = Math.min(...recentPrices);
      const range = maxPrice - minPrice;
      
      if (range >= ALERT_CONFIG.DOMESTIC_THRESHOLD) {
        const direction = currentPrice <= minPrice ? 'down' : (currentPrice >= maxPrice ? 'up' : 'volatile');
        
        if (direction === 'down' || (direction === 'up' && ALERT_CONFIG.ALERT_ON_RISE) || direction === 'volatile') {
          alerts.push({
            type: 'window',
            name: '国内金价 (mAuT+D)',
            current: currentPrice.toFixed(2),
            max: maxPrice.toFixed(2),
            min: minPrice.toFixed(2),
            range: range.toFixed(2),
            unit: '元/克',
            direction
          });
        }
      }
    }
    
    if (data.international?.price && alertHistory.length >= ALERT_CONFIG.WINDOW_SIZE) {
      const recentPrices = alertHistory.slice(-ALERT_CONFIG.WINDOW_SIZE).map(h => h.international);
      const currentPrice = data.international.price;
      const maxPrice = Math.max(...recentPrices);
      const minPrice = Math.min(...recentPrices);
      const range = maxPrice - minPrice;
      
      if (range >= ALERT_CONFIG.INTERNATIONAL_THRESHOLD) {
        const direction = currentPrice <= minPrice ? 'down' : (currentPrice >= maxPrice ? 'up' : 'volatile');
        
        if (direction === 'down' || (direction === 'up' && ALERT_CONFIG.ALERT_ON_RISE) || direction === 'volatile') {
          alerts.push({
            type: 'window',
            name: '国际金价 (XAU)',
            current: currentPrice.toFixed(2),
            max: maxPrice.toFixed(2),
            min: minPrice.toFixed(2),
            range: range.toFixed(2),
            unit: '美元/盎司',
            direction
          });
        }
      }
    }
    
    alertHistory.push({
      timestamp: Date.now(),
      domestic: data.domestic?.price || 0,
      international: data.international?.price || 0
    });
    
    const trimmedHistory = alertHistory.slice(-100);
    await env.GOLD_PRICE_CACHE.put(historyKey, JSON.stringify(trimmedHistory), { expirationTtl: 86400 });
    
    if (alerts.length > 0) {
      const lastAlertStr = await env.GOLD_PRICE_CACHE.get('last_alert_time');
      const lastAlertTime = lastAlertStr ? parseInt(lastAlertStr) : 0;
      const cooldownMs = ALERT_CONFIG.COOLDOWN_MINUTES * 60 * 1000;
      
      if (Date.now() - lastAlertTime > cooldownMs) {
        await sendAlertEmail(alerts, env);
        await sendFeishuAlert(alerts, env);
        await env.GOLD_PRICE_CACHE.put('last_alert_time', String(Date.now()), { expirationTtl: 3600 });
      }
    }
  } catch (error) {
    console.error('[Gold Alert] Check error:', error);
  }
}

async function sendAlertEmail(alerts, env) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;
  
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const alertEmoji = hasDownward ? '🚨' : (hasVolatile ? '⚡' : '📈');
  const alertTitle = hasDownward ? '金价暴跌预警' : (hasVolatile ? '金价剧烈波动' : '金价快速上涨');
  
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AGI Era <noreply@agiera.net>',
        to: ['metanext@foxmail.com'],
        subject: `${alertEmoji} ${alertTitle} - ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        html: generateAlertEmail(alerts, alertEmoji, alertTitle)
      })
    });
    console.log('[Gold Alert] Email sent');
  } catch (error) {
    console.error('[Gold Alert] Email error:', error);
  }
}

function generateAlertEmail(alerts, alertEmoji, alertTitle) {
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0b; color: #fafafa;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: ${hasDownward ? '#ef4444' : (hasVolatile ? '#f59e0b' : '#22c55e')}; margin: 0;">${alertEmoji} ${alertTitle}</h1>
        <p style="color: #71717a; margin-top: 5px;">实时金价智能监控</p>
      </div>
      ${alerts.map(alert => `
        <div style="background: #18181b; padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
          <h3 style="color: #fafafa; margin: 0 0 16px 0;">${alert.name}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #71717a;">当前价格</td><td style="padding: 6px 0; color: #fafafa; text-align: right; font-weight: bold;">${alert.current} ${alert.unit}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">最高价</td><td style="padding: 6px 0; color: #22c55e; text-align: right;">${alert.max} ${alert.unit}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">最低价</td><td style="padding: 6px 0; color: #ef4444; text-align: right;">${alert.min} ${alert.unit}</td></tr>
            <tr><td style="padding: 6px 0; color: #71717a;">波动幅度</td><td style="padding: 6px 0; color: ${alert.direction === 'down' ? '#ef4444' : '#22c55e'}; text-align: right; font-weight: bold;">${alert.range} ${alert.unit}</td></tr>
          </table>
        </div>
      `).join('')}
      <div style="text-align: center; margin: 24px 0;">
        <a href="https://agiera.net/kit/gold" style="display: inline-block; background: linear-gradient(135deg, #00d4ff, #0099cc); color: #000; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">查看实时金价</a>
      </div>
    </div>
  `;
}

async function sendFeishuAlert(alerts, env) {
  const FEISHU_WEBHOOK = env.FEISHU_WEBHOOK;
  const FEISHU_APP_ID = env.FEISHU_APP_ID;
  const FEISHU_APP_SECRET = env.FEISHU_APP_SECRET;
  const FEISHU_CHAT_ID = env.FEISHU_CHAT_ID;
  
  if (FEISHU_WEBHOOK) {
    await sendFeishuWebhook(FEISHU_WEBHOOK, alerts);
    return;
  }
  
  if (FEISHU_APP_ID && FEISHU_APP_SECRET && FEISHU_CHAT_ID) {
    await sendFeishuAppMessage(FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_CHAT_ID, alerts);
    return;
  }
  
  console.log('[Gold Alert] No Feishu configuration found');
}

async function sendFeishuWebhook(webhookUrl, alerts) {
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const alertEmoji = hasDownward ? '🚨' : (hasVolatile ? '⚡' : '📈');
  const alertTitle = hasDownward ? '金价暴跌预警' : (hasVolatile ? '金价剧烈波动' : '金价快速上涨');
  
  let content = `**${alertEmoji} ${alertTitle}**\n`;
  content += `> 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
  
  for (const alert of alerts) {
    content += `**${alert.name}**\n`;
    content += `当前: ${alert.current} ${alert.unit}\n`;
    content += `最高: ${alert.max} | 最低: ${alert.min}\n`;
    content += `波动: **${alert.range} ${alert.unit}**\n\n`;
  }
  
  content += `[查看详情](https://agiera.net/kit/gold)`;
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: `${alertEmoji} ${alertTitle}` },
            template: hasDownward ? 'red' : (hasVolatile ? 'orange' : 'green')
          },
          elements: [
            { tag: 'markdown', content: content }
          ]
        }
      })
    });
    
    const result = await response.json();
    if (result.code === 0 || result.StatusCode === 0) {
      console.log('[Gold Alert] Feishu webhook sent successfully');
    } else {
      console.error('[Gold Alert] Feishu webhook failed:', JSON.stringify(result));
    }
  } catch (error) {
    console.error('[Gold Alert] Feishu webhook error:', error);
  }
}

async function sendFeishuAppMessage(appId, appSecret, chatId, alerts) {
  try {
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.code !== 0) {
      console.error('[Gold Alert] Feishu auth failed:', tokenData.msg);
      return;
    }
    
    const accessToken = tokenData.tenant_access_token;
    
    const hasDownward = alerts.some(a => a.direction === 'down');
    const hasVolatile = alerts.some(a => a.direction === 'volatile');
    const alertEmoji = hasDownward ? '🚨' : (hasVolatile ? '⚡' : '📈');
    const alertTitle = hasDownward ? '金价暴跌预警' : (hasVolatile ? '金价剧烈波动' : '金价快速上涨');
    
    const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    const contentElements = [
      [{ tag: 'text', text: `时间：${timeStr}` }],
      [{ tag: 'text', text: '' }]
    ];
    
    for (const alert of alerts) {
      contentElements.push([{ tag: 'text', text: `${alert.name}` }]);
      contentElements.push([{ tag: 'text', text: `当前价格: ${alert.current} ${alert.unit}` }]);
      contentElements.push([{ tag: 'text', text: `最高: ${alert.max} | 最低: ${alert.min}` }]);
      contentElements.push([{ tag: 'text', text: `波动幅度: ${alert.range} ${alert.unit}` }]);
      contentElements.push([{ tag: 'text', text: '' }]);
    }
    
    contentElements.push([{ tag: 'a', text: '查看详情', href: 'https://agiera.net/kit/gold' }]);
    
    const messageResponse = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: 'post',
        content: JSON.stringify({
          zh_cn: {
            title: `${alertEmoji} ${alertTitle}`,
            content: contentElements
          }
        })
      })
    });
    
    const messageData = await messageResponse.json();
    
    if (messageData.code === 0) {
      console.log('[Gold Alert] Feishu app message sent successfully');
    } else {
      console.error('[Gold Alert] Feishu message failed:', messageData.msg);
    }
  } catch (error) {
    console.error('[Gold Alert] Feishu app error:', error);
  }
}

export async function handleGoldAlertTest(request, env, ctx) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'webhook';
  
  const testAlerts = [
    {
      type: 'window',
      name: '国内金价 (mAuT+D)',
      current: '678.50',
      max: '680.20',
      min: '675.30',
      range: '4.90',
      unit: '元/克',
      direction: 'down'
    },
    {
      type: 'window',
      name: '国际金价 (XAU)',
      current: '2890.50',
      max: '2895.00',
      min: '2880.00',
      range: '15.00',
      unit: '美元/盎司',
      direction: 'down'
    }
  ];
  
  try {
    if (type === 'email') {
      await sendAlertEmail(testAlerts, env);
      return jsonResponse({ success: true, message: 'Email alert test sent' });
    }
    
    if (type === 'feishu' || type === 'webhook') {
      await sendFeishuAlert(testAlerts, env);
      return jsonResponse({ success: true, message: 'Feishu alert test sent' });
    }
    
    if (type === 'all') {
      await sendAlertEmail(testAlerts, env);
      await sendFeishuAlert(testAlerts, env);
      return jsonResponse({ success: true, message: 'All alerts test sent' });
    }
    
    return jsonResponse({ 
      success: false, 
      error: 'Invalid type. Use: email, feishu, webhook, or all',
      usage: '/api/gold/alert/test?type=email|feishu|webhook|all'
    }, 400);
    
  } catch (error) {
    console.error('[Gold Alert Test] Error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}
