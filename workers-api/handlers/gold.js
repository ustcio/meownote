import { jsonResponse } from '../utils/response.js';

const OZ_TO_G = 31.1035;

const GOLD_ANALYSIS_CONFIG = {
  ALERT_CONFIG: {
    WINDOW_SIZE: 5,
    DOMESTIC_THRESHOLD: 5,
    INTERNATIONAL_THRESHOLD: 10,
    COOLDOWN_MINUTES: 30,
    ALERT_ON_RISE: false,
    MAX_ALERTS_PER_DAY: 20
  },
  TECHNICAL_CONFIG: {
    RSI_PERIOD: 14,
    RSI_OVERSOLD: 30,
    RSI_OVERBOUGHT: 70,
    RSI_EXTREME_OVERSOLD: 20,
    RSI_EXTREME_OVERBOUGHT: 80,
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,
    BOLLINGER_PERIOD: 20,
    BOLLINGER_STD: 2,
    SMA_PERIODS: [5, 10, 20, 50],
    EMA_PERIODS: [12, 26],
    MIN_DATA_POINTS: 15,
    SUPPORT_RESISTANCE_LOOKBACK: 20
  },
  SCORING_CONFIG: {
    RSI_WEIGHT: 2.0,
    MACD_WEIGHT: 1.5,
    BOLLINGER_WEIGHT: 1.5,
    TREND_WEIGHT: 1.0,
    PRICE_CHANGE_WEIGHT: 1.0,
    SUPPORT_RESISTANCE_WEIGHT: 1.5,
    VOLUME_WEIGHT: 0.5,
    STRONG_BUY_THRESHOLD: 5.0,
    BUY_THRESHOLD: 3.0,
    HOLD_THRESHOLD: 1.5
  },
  CRAWL_CONFIG: {
    TIMEOUT_MS: 8000,
    MAX_RETRIES: 3,
    RETRY_DELAY_BASE: 1000,
    CACHE_TTL_SECONDS: 120
  }
};

let goldPriceCache = {
  data: null,
  timestamp: 0,
  isCrawling: false
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = GOLD_ANALYSIS_CONFIG.CRAWL_CONFIG.TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(url, options = {}, maxRetries = GOLD_ANALYSIS_CONFIG.CRAWL_CONFIG.MAX_RETRIES) {
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const delay = attempt > 0 ? GOLD_ANALYSIS_CONFIG.CRAWL_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt - 1) : 0;
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const response = await fetchWithTimeout(url, {
        ...options,
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'application/json, text/javascript, */*',
          'Referer': 'https://quote.cngold.org/',
          ...options.headers
        }
      });
      
      if (response.ok) {
        return response;
      }
      
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      console.error(`[Crawl] Attempt ${attempt + 1} failed:`, error.message);
    }
  }
  
  throw lastError;
}

async function crawlSGEData(env) {
  try {
    const jtwUrl = 'https://api.jijinhao.com/quoteCenter/realTime.htm?codes=JO_92226';
    
    const response = await fetchWithRetry(jtwUrl);
    const text = await response.text();
    
    const match = text.match(/var\s+quote_json\s*=\s*(\{[\s\S]*?\});?\s*$/);
    if (!match) {
      throw new Error('Invalid response format');
    }
    
    const data = JSON.parse(match[1]);
    if (!data.flag || !data.JO_92226) {
      throw new Error('No valid data in response');
    }
    
    const quote = data.JO_92226;
    const price = parseFloat(quote.q63);
    const open = parseFloat(quote.q1) || price;
    const high = parseFloat(quote.q3) || price;
    const low = parseFloat(quote.q4) || price;
    const prevClose = parseFloat(quote.q2);
    const volume = parseFloat(quote.q60) || 0;
    
    if (price <= 0) {
      throw new Error('Invalid price value');
    }
    
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    
    return {
      price,
      open,
      high,
      low,
      prevClose,
      change,
      changePercent,
      volume,
      source: 'JTW-mAuT+D',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[Crawl] SGE error:', error.message);
    return await getDynamicFallback(env, 'domestic');
  }
}

async function crawlInternationalPrice(env) {
  try {
    const jtwUrl = 'https://api.jijinhao.com/quoteCenter/realTime.htm?codes=JO_92233';
    
    const response = await fetchWithRetry(jtwUrl);
    const text = await response.text();
    
    const match = text.match(/var\s+quote_json\s*=\s*(\{[\s\S]*?\});?\s*$/);
    if (!match) {
      throw new Error('Invalid response format');
    }
    
    const data = JSON.parse(match[1]);
    if (!data.flag || !data.JO_92233) {
      throw new Error('No valid data in response');
    }
    
    const quote = data.JO_92233;
    const price = parseFloat(quote.q63);
    const open = parseFloat(quote.q1) || price;
    const high = parseFloat(quote.q3) || price;
    const low = parseFloat(quote.q4) || price;
    const change = parseFloat(quote.q70) || 0;
    const changePercent = parseFloat(quote.q80) || 0;
    
    if (price <= 0) {
      throw new Error('Invalid price value');
    }
    
    return {
      price,
      open,
      high,
      low,
      change,
      changePercent,
      source: 'JTW-XAU',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[Crawl] XAU error:', error.message);
    return await getDynamicFallback(env, 'international');
  }
}

async function getExchangeRate() {
  try {
    const response = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD', {}, 3000);
    
    if (response.ok) {
      const data = await response.json();
      return data.rates?.CNY || 7.25;
    }
  } catch (e) {
    console.error('[Crawl] Exchange rate error:', e.message);
  }
  return 7.25;
}

async function getDynamicFallback(env, type) {
  if (env?.GOLD_PRICE_CACHE) {
    try {
      const cached = await env.GOLD_PRICE_CACHE.get('latest');
      if (cached) {
        const data = JSON.parse(cached);
        const cacheAge = Date.now() - (data.cachedAt || 0);
        
        if (cacheAge < 3600000 && data[type]) {
          return {
            ...data[type],
            source: `Cached-${data[type].source}`,
            timestamp: Date.now()
          };
        }
      }
    } catch (e) {
      console.error('[Fallback] Cache read error:', e.message);
    }
  }
  
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
    while (goldPriceCache.isCrawling && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    return goldPriceCache.data;
  }
  
  goldPriceCache.isCrawling = true;
  
  try {
    const [sgeResult, intlResult, rateResult] = await Promise.allSettled([
      crawlSGEData(env),
      crawlInternationalPrice(env),
      getExchangeRate()
    ]);
    
    const sgeData = sgeResult.status === 'fulfilled' ? sgeResult.value : null;
    const intlData = intlResult.status === 'fulfilled' ? intlResult.value : null;
    const exchangeRate = rateResult.status === 'fulfilled' ? rateResult.value : 7.25;
    
    let domestic = null;
    let international = null;
    
    if (sgeData && sgeData.source !== 'Fallback-mAuT+D') {
      domestic = {
        price: sgeData.price,
        open: sgeData.open,
        high: sgeData.high,
        low: sgeData.low,
        change: sgeData.changePercent,
        changePercent: sgeData.changePercent,
        volume: sgeData.volume,
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
        source: sgeData ? sgeData.source : `Calculated(${intlData.source})`
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
    }), { expirationTtl: GOLD_ANALYSIS_CONFIG.CRAWL_CONFIG.CACHE_TTL_SECONDS });
    
    const historyKey = `history:${dateKey}`;
    let history = [];
    try {
      const existing = await env.GOLD_PRICE_CACHE.get(historyKey);
      if (existing) history = JSON.parse(existing);
    } catch (e) {}
    
    history.push({
      timestamp,
      domestic: data.domestic?.price || 0,
      international: data.international?.price || 0,
      domesticChange: data.domestic?.changePercent || 0,
      internationalChange: data.international?.changePercent || 0
    });
    
    if (history.length > 1440) history = history.slice(-1440);
    
    await env.GOLD_PRICE_CACHE.put(historyKey, JSON.stringify(history), {
      expirationTtl: THREE_DAYS_SECONDS
    });
    
    const statsKey = `stats:${dateKey}`;
    let existingStats = {};
    try {
      const existing = await env.GOLD_PRICE_CACHE.get(statsKey);
      if (existing) existingStats = JSON.parse(existing);
    } catch (e) {}
    
    const stats = {
      lastUpdate: timestamp,
      updateCount: (existingStats.updateCount || 0) + 1,
      domesticOpen: existingStats.domesticOpen || data.domestic?.open || data.domestic?.price || 0,
      domesticHigh: Math.max(existingStats.domesticHigh || 0, data.domestic?.high || data.domestic?.price || 0),
      domesticLow: existingStats.domesticLow ? Math.min(existingStats.domesticLow, data.domestic?.low || data.domestic?.price || Infinity) : (data.domestic?.low || data.domestic?.price || 0),
      domesticChange: data.domestic?.changePercent || 0,
      internationalOpen: existingStats.internationalOpen || data.international?.open || data.international?.price || 0,
      internationalHigh: Math.max(existingStats.internationalHigh || 0, data.international?.high || data.international?.price || 0),
      internationalLow: existingStats.internationalLow ? Math.min(existingStats.internationalLow, data.international?.low || data.international?.price || Infinity) : (data.international?.low || data.international?.price || 0),
      internationalChange: data.international?.changePercent || 0,
      source: data.domestic?.source || 'Unknown'
    };
    
    await env.GOLD_PRICE_CACHE.put(statsKey, JSON.stringify(stats), {
      expirationTtl: THREE_DAYS_SECONDS
    });
    
  } catch (error) {
    console.error('[Store] Failed to store data:', error);
  }
}

async function getDayHistory(env, date) {
  if (!env?.GOLD_PRICE_CACHE) {
    return { labels: [], domestic: [], international: [], timestamps: [] };
  }
  
  try {
    const historyKey = `history:${date}`;
    const historyData = await env.GOLD_PRICE_CACHE.get(historyKey);
    
    if (!historyData) {
      return { labels: [], domestic: [], international: [], timestamps: [] };
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
      international: history.map(h => h.international),
      timestamps: history.map(h => h.timestamp)
    };
  } catch (e) {
    return { labels: [], domestic: [], international: [], timestamps: [] };
  }
}

function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(prices, period) {
  if (prices.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  return ema;
}

function calculateRSI(prices, period = GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG.RSI_PERIOD) {
  if (prices.length < period + 1) return null;
  
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices) {
  const config = GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG;
  if (prices.length < config.MACD_SLOW) return null;
  
  const ema12 = calculateEMA(prices, config.MACD_FAST);
  const ema26 = calculateEMA(prices, config.MACD_SLOW);
  const macd = ema12 - ema26;
  
  const recentPrices = prices.slice(-35);
  const macdLine = [];
  const multiplier12 = 2 / 13;
  const multiplier26 = 2 / 27;
  
  let e12 = recentPrices.slice(0, config.MACD_FAST).reduce((a, b) => a + b, 0) / config.MACD_FAST;
  let e26 = recentPrices.slice(0, config.MACD_SLOW).reduce((a, b) => a + b, 0) / config.MACD_SLOW;
  
  for (let i = config.MACD_SLOW; i < recentPrices.length; i++) {
    e12 = (recentPrices[i] - e12) * multiplier12 + e12;
    e26 = (recentPrices[i] - e26) * multiplier26 + e26;
    macdLine.push(e12 - e26);
  }
  
  const signal = macdLine.length >= config.MACD_SIGNAL ? calculateEMA(macdLine, config.MACD_SIGNAL) : macd;
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

function calculateBollingerBands(prices, period = GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG.BOLLINGER_PERIOD, stdDev = GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG.BOLLINGER_STD) {
  if (prices.length < period) return null;
  
  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    middle: sma,
    upper: sma + stdDev * std,
    lower: sma - stdDev * std,
    bandwidth: (2 * stdDev * std) / sma * 100,
    percentB: (slice[slice.length - 1] - (sma - stdDev * std)) / (2 * stdDev * std)
  };
}

function findSupportResistance(prices, lookback = GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG.SUPPORT_RESISTANCE_LOOKBACK) {
  if (prices.length < lookback) return { support: [], resistance: [] };
  
  const recentPrices = prices.slice(-lookback);
  const support = [];
  const resistance = [];
  
  for (let i = 2; i < recentPrices.length - 2; i++) {
    const current = recentPrices[i];
    const isLocalMin = current < recentPrices[i - 1] && current < recentPrices[i - 2] &&
                       current < recentPrices[i + 1] && current < recentPrices[i + 2];
    const isLocalMax = current > recentPrices[i - 1] && current > recentPrices[i - 2] &&
                       current > recentPrices[i + 1] && current > recentPrices[i + 2];
    
    if (isLocalMin) support.push(current);
    if (isLocalMax) resistance.push(current);
  }
  
  return {
    support: support.sort((a, b) => b - a).slice(0, 3),
    resistance: resistance.sort((a, b) => a - b).slice(0, 3)
  };
}

function analyzePriceTrend(prices) {
  if (prices.length < 5) return { trend: 'unknown', strength: 0, momentum: 0 };
  
  const recent = prices.slice(-5);
  const changes = [];
  for (let i = 1; i < recent.length; i++) {
    changes.push((recent[i] - recent[i - 1]) / recent[i - 1] * 100);
  }
  
  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  const momentum = changes[changes.length - 1];
  const trend = avgChange > 0.1 ? 'up' : avgChange < -0.1 ? 'down' : 'sideways';
  
  return {
    trend,
    strength: Math.abs(avgChange),
    avgChange: avgChange.toFixed(3),
    momentum: momentum.toFixed(3)
  };
}

function calculateVolatility(prices, period = 20) {
  if (prices.length < period) return null;
  
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
  
  return {
    standardDeviation: Math.sqrt(variance),
    coefficient: (Math.sqrt(variance) / mean) * 100
  };
}

function generateTradingSignal(analysis) {
  const config = GOLD_ANALYSIS_CONFIG.SCORING_CONFIG;
  const techConfig = GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG;
  const signals = [];
  let buyScore = 0;
  let sellScore = 0;
  let confidence = 0;
  
  if (analysis.rsi !== null) {
    if (analysis.rsi < techConfig.RSI_EXTREME_OVERSOLD) {
      signals.push({ indicator: 'RSI', signal: '极度超卖', action: 'buy', strength: 3, value: analysis.rsi.toFixed(2), description: 'RSI低于20，强烈买入信号' });
      buyScore += config.RSI_WEIGHT * 1.5;
      confidence += 2;
    } else if (analysis.rsi < techConfig.RSI_OVERSOLD) {
      signals.push({ indicator: 'RSI', signal: '超卖', action: 'buy', strength: 2, value: analysis.rsi.toFixed(2), description: 'RSI低于30，买入信号' });
      buyScore += config.RSI_WEIGHT;
      confidence += 1;
    } else if (analysis.rsi > techConfig.RSI_EXTREME_OVERBOUGHT) {
      signals.push({ indicator: 'RSI', signal: '极度超买', action: 'sell', strength: 3, value: analysis.rsi.toFixed(2), description: 'RSI高于80，强烈卖出信号' });
      sellScore += config.RSI_WEIGHT * 1.5;
      confidence += 2;
    } else if (analysis.rsi > techConfig.RSI_OVERBOUGHT) {
      signals.push({ indicator: 'RSI', signal: '超买', action: 'sell', strength: 2, value: analysis.rsi.toFixed(2), description: 'RSI高于70，卖出信号' });
      sellScore += config.RSI_WEIGHT;
      confidence += 1;
    } else {
      signals.push({ indicator: 'RSI', signal: '中性', action: 'hold', strength: 0, value: analysis.rsi.toFixed(2), description: 'RSI在正常范围内' });
    }
  }
  
  if (analysis.macd) {
    const histogramTrend = analysis.macd.histogramTrend || 0;
    if (analysis.macd.histogram > 0 && analysis.macd.macd > analysis.macd.signal) {
      const strength = histogramTrend > 0 ? 2 : 1.5;
      signals.push({ indicator: 'MACD', signal: '金叉', action: 'buy', strength, value: analysis.macd.histogram.toFixed(4), description: histogramTrend > 0 ? '金叉且柱状图上升，买入信号增强' : 'MACD金叉，买入信号' });
      buyScore += config.MACD_WEIGHT * (strength / 1.5);
      confidence += 1;
    } else if (analysis.macd.histogram < 0 && analysis.macd.macd < analysis.macd.signal) {
      const strength = histogramTrend < 0 ? 2 : 1.5;
      signals.push({ indicator: 'MACD', signal: '死叉', action: 'sell', strength, value: analysis.macd.histogram.toFixed(4), description: histogramTrend < 0 ? '死叉且柱状图下降，卖出信号增强' : 'MACD死叉，卖出信号' });
      sellScore += config.MACD_WEIGHT * (strength / 1.5);
      confidence += 1;
    }
  }
  
  if (analysis.bollinger) {
    const currentPrice = analysis.currentPrice;
    const { lower, upper, percentB } = analysis.bollinger;
    
    if (currentPrice <= lower * 1.005) {
      signals.push({ indicator: 'Bollinger', signal: '触及下轨', action: 'buy', strength: 2, value: currentPrice.toFixed(2), description: '价格触及布林带下轨，可能反弹' });
      buyScore += config.BOLLINGER_WEIGHT;
      confidence += 1;
    } else if (currentPrice >= upper * 0.995) {
      signals.push({ indicator: 'Bollinger', signal: '触及上轨', action: 'sell', strength: 2, value: currentPrice.toFixed(2), description: '价格触及布林带上轨，可能回调' });
      sellScore += config.BOLLINGER_WEIGHT;
      confidence += 1;
    }
    
    if (percentB !== undefined) {
      if (percentB < 0) {
        signals.push({ indicator: 'Bollinger %B', signal: '超卖区域', action: 'buy', strength: 1.5, value: (percentB * 100).toFixed(2) + '%', description: '%B小于0，价格在下轨下方' });
        buyScore += config.BOLLINGER_WEIGHT * 0.5;
      } else if (percentB > 1) {
        signals.push({ indicator: 'Bollinger %B', signal: '超买区域', action: 'sell', strength: 1.5, value: (percentB * 100).toFixed(2) + '%', description: '%B大于1，价格在上轨上方' });
        sellScore += config.BOLLINGER_WEIGHT * 0.5;
      }
    }
  }
  
  if (analysis.supportResistance) {
    const { support, resistance } = analysis.supportResistance;
    const currentPrice = analysis.currentPrice;
    
    for (const s of support) {
      const distance = ((currentPrice - s) / s) * 100;
      if (distance > -2 && distance <= 0) {
        signals.push({ indicator: '支撑位', signal: '接近支撑', action: 'buy', strength: 1.5, value: s.toFixed(2), description: `价格接近支撑位 ${s.toFixed(2)}` });
        buyScore += config.SUPPORT_RESISTANCE_WEIGHT;
        confidence += 0.5;
      }
    }
    
    for (const r of resistance) {
      const distance = ((r - currentPrice) / currentPrice) * 100;
      if (distance > 0 && distance < 2) {
        signals.push({ indicator: '阻力位', signal: '接近阻力', action: 'sell', strength: 1.5, value: r.toFixed(2), description: `价格接近阻力位 ${r.toFixed(2)}` });
        sellScore += config.SUPPORT_RESISTANCE_WEIGHT;
        confidence += 0.5;
      }
    }
  }
  
  if (analysis.trend) {
    if (analysis.trend.trend === 'down' && analysis.trend.strength > 0.2) {
      signals.push({ indicator: 'Trend', signal: '下跌趋势', action: 'watch', strength: 1, value: analysis.trend.avgChange + '%', description: `下跌趋势，强度 ${analysis.trend.strength.toFixed(2)}%` });
      if (analysis.trend.momentum < -0.1) {
        buyScore += config.TREND_WEIGHT * 0.5;
      }
    } else if (analysis.trend.trend === 'up' && analysis.trend.strength > 0.2) {
      signals.push({ indicator: 'Trend', signal: '上涨趋势', action: 'hold', strength: 1, value: analysis.trend.avgChange + '%', description: `上涨趋势，强度 ${analysis.trend.strength.toFixed(2)}%` });
    }
  }
  
  if (analysis.priceChange !== null) {
    if (analysis.priceChange < -GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG.PRICE_CHANGE_THRESHOLD * 2) {
      signals.push({ indicator: 'PriceChange', signal: '大幅下跌', action: 'buy', strength: 2, value: analysis.priceChange.toFixed(2) + '%', description: '价格大幅下跌，可能存在买入机会' });
      buyScore += config.PRICE_CHANGE_WEIGHT * 1.5;
      confidence += 0.5;
    } else if (analysis.priceChange < -GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG.PRICE_CHANGE_THRESHOLD) {
      signals.push({ indicator: 'PriceChange', signal: '价格下跌', action: 'buy', strength: 1, value: analysis.priceChange.toFixed(2) + '%', description: '价格下跌，关注买入机会' });
      buyScore += config.PRICE_CHANGE_WEIGHT;
    } else if (analysis.priceChange > GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG.PRICE_CHANGE_THRESHOLD * 2) {
      signals.push({ indicator: 'PriceChange', signal: '大幅上涨', action: 'watch', strength: 2, value: analysis.priceChange.toFixed(2) + '%', description: '价格大幅上涨，注意风险' });
      sellScore += config.PRICE_CHANGE_WEIGHT * 1.5;
    }
  }
  
  if (analysis.volatility) {
    if (analysis.volatility.coefficient > 2) {
      signals.push({ indicator: 'Volatility', signal: '高波动', action: 'caution', strength: 1, value: analysis.volatility.coefficient.toFixed(2) + '%', description: '市场波动较大，谨慎操作' });
      confidence -= 0.5;
    }
  }
  
  const totalScore = buyScore + sellScore;
  const netScore = buyScore - sellScore;
  
  let recommendation, riskLevel;
  if (buyScore >= config.STRONG_BUY_THRESHOLD && buyScore > sellScore * 1.5) {
    recommendation = '强烈买入';
    riskLevel = 'low';
  } else if (buyScore >= config.BUY_THRESHOLD && buyScore > sellScore) {
    recommendation = '建议买入';
    riskLevel = 'low';
  } else if (sellScore >= config.STRONG_BUY_THRESHOLD && sellScore > buyScore * 1.5) {
    recommendation = '建议卖出';
    riskLevel = 'high';
  } else if (sellScore >= config.BUY_THRESHOLD && sellScore > buyScore) {
    recommendation = '谨慎持有';
    riskLevel = 'medium';
  } else {
    recommendation = '观望';
    riskLevel = 'medium';
  }
  
  const normalizedConfidence = Math.min(Math.max(confidence / 5, 0), 1);
  
  return {
    signals,
    buyScore: buyScore.toFixed(2),
    sellScore: sellScore.toFixed(2),
    netScore: netScore.toFixed(2),
    recommendation,
    riskLevel,
    confidence: (normalizedConfidence * 100).toFixed(0) + '%',
    isBuySignal: buyScore >= config.BUY_THRESHOLD && buyScore > sellScore,
    isStrongSignal: Math.abs(netScore) >= config.STRONG_BUY_THRESHOLD
  };
}

async function performGoldAnalysis(env) {
  console.log('[Gold Analysis] Starting comprehensive analysis...');
  
  const today = new Date().toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
  const historyKey = `history:${today}`;
  
  if (!env?.GOLD_PRICE_CACHE) {
    return { success: false, error: 'KV cache not available' };
  }
  
  const historyData = await env.GOLD_PRICE_CACHE.get(historyKey);
  if (!historyData) {
    return { success: false, error: 'No history data available for today' };
  }
  
  const history = JSON.parse(historyData);
  if (history.length < GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG.MIN_DATA_POINTS) {
    return { success: false, error: `Insufficient data points: ${history.length}/${GOLD_ANALYSIS_CONFIG.TECHNICAL_CONFIG.MIN_DATA_POINTS}` };
  }
  
  const domesticPrices = history.map(h => h.domestic).filter(p => p > 0);
  const internationalPrices = history.map(h => h.international).filter(p => p > 0);
  
  const latestData = history[history.length - 1];
  const previousData = history.length > 1 ? history[history.length - 2] : latestData;
  
  const domesticMACD = calculateMACD(domesticPrices);
  if (domesticMACD && domesticPrices.length > 30) {
    const recentHistograms = [];
    const recentPrices = domesticPrices.slice(-35);
    const multiplier12 = 2 / 13;
    const multiplier26 = 2 / 27;
    let e12 = recentPrices.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
    let e26 = recentPrices.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
    
    for (let i = 26; i < recentPrices.length; i++) {
      e12 = (recentPrices[i] - e12) * multiplier12 + e12;
      e26 = (recentPrices[i] - e26) * multiplier26 + e26;
      recentHistograms.push(e12 - e26);
    }
    
    if (recentHistograms.length >= 2) {
      domesticMACD.histogramTrend = recentHistograms[recentHistograms.length - 1] - recentHistograms[recentHistograms.length - 2];
    }
  }
  
  const domesticAnalysis = {
    currentPrice: latestData.domestic,
    previousPrice: previousData.domestic,
    priceChange: previousData.domestic > 0 ? ((latestData.domestic - previousData.domestic) / previousData.domestic * 100) : 0,
    high: Math.max(...domesticPrices),
    low: Math.min(...domesticPrices),
    rsi: calculateRSI(domesticPrices),
    macd: domesticMACD,
    bollinger: calculateBollingerBands(domesticPrices),
    trend: analyzePriceTrend(domesticPrices),
    volatility: calculateVolatility(domesticPrices),
    supportResistance: findSupportResistance(domesticPrices),
    sma: {
      sma5: calculateSMA(domesticPrices, 5),
      sma10: calculateSMA(domesticPrices, 10),
      sma20: calculateSMA(domesticPrices, 20)
    },
    ema: {
      ema12: calculateEMA(domesticPrices, 12),
      ema26: calculateEMA(domesticPrices, 26)
    }
  };
  
  const internationalMACD = calculateMACD(internationalPrices);
  const internationalAnalysis = {
    currentPrice: latestData.international,
    previousPrice: previousData.international,
    priceChange: previousData.international > 0 ? ((latestData.international - previousData.international) / previousData.international * 100) : 0,
    high: Math.max(...internationalPrices),
    low: Math.min(...internationalPrices),
    rsi: calculateRSI(internationalPrices),
    macd: internationalMACD,
    bollinger: calculateBollingerBands(internationalPrices),
    trend: analyzePriceTrend(internationalPrices),
    volatility: calculateVolatility(internationalPrices),
    supportResistance: findSupportResistance(internationalPrices)
  };
  
  const domesticSignal = generateTradingSignal(domesticAnalysis);
  const internationalSignal = generateTradingSignal(internationalAnalysis);
  
  const overallBuyScore = (parseFloat(domesticSignal.buyScore) + parseFloat(internationalSignal.buyScore)) / 2;
  const overallSellScore = (parseFloat(domesticSignal.sellScore) + parseFloat(internationalSignal.sellScore)) / 2;
  
  let overallRecommendation;
  if (domesticSignal.isBuySignal || internationalSignal.isBuySignal) {
    if (domesticSignal.isStrongSignal || internationalSignal.isStrongSignal) {
      overallRecommendation = '强烈建议关注';
    } else {
      overallRecommendation = '建议关注';
    }
  } else {
    overallRecommendation = '观望';
  }
  
  const analysisResult = {
    timestamp: Date.now(),
    date: today,
    dataPoints: history.length,
    domestic: {
      ...domesticAnalysis,
      signal: domesticSignal
    },
    international: {
      ...internationalAnalysis,
      signal: internationalSignal
    },
    overallRecommendation,
    overallScores: {
      buy: overallBuyScore.toFixed(2),
      sell: overallSellScore.toFixed(2),
      net: (overallBuyScore - overallSellScore).toFixed(2)
    },
    marketCondition: assessMarketCondition(domesticAnalysis, internationalAnalysis)
  };
  
  console.log('[Gold Analysis] Analysis completed:', JSON.stringify({
    domesticRSI: domesticAnalysis.rsi?.toFixed(2),
    domesticRecommendation: domesticSignal.recommendation,
    internationalRSI: internationalAnalysis.rsi?.toFixed(2),
    internationalRecommendation: internationalSignal.recommendation,
    overallRecommendation
  }));
  
  return { success: true, analysis: analysisResult };
}

function assessMarketCondition(domestic, international) {
  const conditions = [];
  
  if (domestic.rsi !== null && international.rsi !== null) {
    const avgRSI = (domestic.rsi + international.rsi) / 2;
    if (avgRSI < 30) {
      conditions.push({ type: 'oversold', severity: 'high', message: '市场处于超卖状态' });
    } else if (avgRSI > 70) {
      conditions.push({ type: 'overbought', severity: 'high', message: '市场处于超买状态' });
    }
  }
  
  if (domestic.volatility && domestic.volatility.coefficient > 1.5) {
    conditions.push({ type: 'volatile', severity: 'medium', message: '市场波动较大' });
  }
  
  if (domestic.trend && international.trend) {
    if (domestic.trend.trend === 'down' && international.trend.trend === 'down') {
      conditions.push({ type: 'downtrend', severity: 'medium', message: '国内外金价均呈下跌趋势' });
    } else if (domestic.trend.trend === 'up' && international.trend.trend === 'up') {
      conditions.push({ type: 'uptrend', severity: 'low', message: '国内外金价均呈上涨趋势' });
    }
  }
  
  return conditions;
}

export async function handleGoldPrice(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const queryDate = url.searchParams.get('date');
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const includeAnalysis = url.searchParams.get('analysis') === 'true';
    
    const today = new Date().toLocaleDateString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    const targetDate = queryDate || today;
    
    if (targetDate === today) {
      return await handleTodayGoldPrice(env, ctx, forceRefresh, includeAnalysis);
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

async function handleTodayGoldPrice(env, ctx, forceRefresh, includeAnalysis) {
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
          const response = { ...data, history, fromCache: true, cacheAge };
          
          if (includeAnalysis) {
            const analysisResult = await performGoldAnalysis(env);
            if (analysisResult.success) {
              response.analysis = analysisResult.analysis;
            }
          }
          
          return jsonResponse(response);
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
  const response = { ...data, history, fromCache: false };
  
  if (includeAnalysis) {
    const analysisResult = await performGoldAnalysis(env);
    if (analysisResult.success) {
      response.analysis = analysisResult.analysis;
    }
  }
  
  return jsonResponse(response);
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
    const config = GOLD_ANALYSIS_CONFIG.ALERT_CONFIG;
    
    if (data.domestic?.price && alertHistory.length >= config.WINDOW_SIZE) {
      const recentPrices = alertHistory.slice(-config.WINDOW_SIZE).map(h => h.domestic);
      const currentPrice = data.domestic.price;
      const maxPrice = Math.max(...recentPrices);
      const minPrice = Math.min(...recentPrices);
      const range = maxPrice - minPrice;
      
      if (range >= config.DOMESTIC_THRESHOLD) {
        const direction = currentPrice <= minPrice ? 'down' : (currentPrice >= maxPrice ? 'up' : 'volatile');
        
        if (direction === 'down' || (direction === 'up' && config.ALERT_ON_RISE) || direction === 'volatile') {
          alerts.push({
            type: 'window',
            name: '国内金价 (mAuT+D)',
            current: currentPrice.toFixed(2),
            max: maxPrice.toFixed(2),
            min: minPrice.toFixed(2),
            range: range.toFixed(2),
            unit: '元/克',
            direction,
            severity: range >= config.DOMESTIC_THRESHOLD * 2 ? 'high' : 'medium'
          });
        }
      }
    }
    
    if (data.international?.price && alertHistory.length >= config.WINDOW_SIZE) {
      const recentPrices = alertHistory.slice(-config.WINDOW_SIZE).map(h => h.international);
      const currentPrice = data.international.price;
      const maxPrice = Math.max(...recentPrices);
      const minPrice = Math.min(...recentPrices);
      const range = maxPrice - minPrice;
      
      if (range >= config.INTERNATIONAL_THRESHOLD) {
        const direction = currentPrice <= minPrice ? 'down' : (currentPrice >= maxPrice ? 'up' : 'volatile');
        
        if (direction === 'down' || (direction === 'up' && config.ALERT_ON_RISE) || direction === 'volatile') {
          alerts.push({
            type: 'window',
            name: '国际金价 (XAU)',
            current: currentPrice.toFixed(2),
            max: maxPrice.toFixed(2),
            min: minPrice.toFixed(2),
            range: range.toFixed(2),
            unit: '美元/盎司',
            direction,
            severity: range >= config.INTERNATIONAL_THRESHOLD * 2 ? 'high' : 'medium'
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
      const cooldownMs = config.COOLDOWN_MINUTES * 60 * 1000;
      
      const todayAlertCountStr = await env.GOLD_PRICE_CACHE.get('daily_alert_count');
      const todayAlertCount = todayAlertCountStr ? parseInt(todayAlertCountStr) : 0;
      
      if (Date.now() - lastAlertTime > cooldownMs && todayAlertCount < config.MAX_ALERTS_PER_DAY) {
        const analysisResult = await performGoldAnalysis(env);
        let enhancedAlerts = [...alerts];
        
        if (analysisResult.success) {
          if (analysisResult.analysis.domestic.signal.isBuySignal) {
            enhancedAlerts.push({
              type: 'analysis',
              name: '智能分析建议',
              recommendation: analysisResult.analysis.overallRecommendation,
              buyScore: analysisResult.analysis.domestic.signal.buyScore,
              signals: analysisResult.analysis.domestic.signal.signals.slice(0, 3),
              direction: 'analysis',
              severity: 'info'
            });
          }
        }
        
        await sendAlertEmail(enhancedAlerts, env, analysisResult.success ? analysisResult.analysis : null);
        await sendFeishuAlert(enhancedAlerts, env);
        await sendMeoWAlert(enhancedAlerts, env);
        
        await env.GOLD_PRICE_CACHE.put('last_alert_time', String(Date.now()), { expirationTtl: 3600 });
        await env.GOLD_PRICE_CACHE.put('daily_alert_count', String(todayAlertCount + 1), { expirationTtl: 86400 });
      }
    }
  } catch (error) {
    console.error('[Gold Alert] Check error:', error);
  }
}

async function sendAlertEmail(alerts, env, analysis = null) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return;
  
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const hasHighSeverity = alerts.some(a => a.severity === 'high');
  
  let alertEmoji, alertTitle;
  if (hasHighSeverity && hasDownward) {
    alertEmoji = '🚨';
    alertTitle = '金价大幅下跌预警';
  } else if (hasDownward) {
    alertEmoji = '📉';
    alertTitle = '金价下跌提醒';
  } else if (hasVolatile) {
    alertEmoji = '⚡';
    alertTitle = '金价剧烈波动';
  } else {
    alertEmoji = '📈';
    alertTitle = '金价快速上涨';
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AGI Era <noreply@ustc.dev>',
        to: ['metanext@foxmail.com'],
        subject: `${alertEmoji} ${alertTitle} - ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
        html: generateEnhancedAlertEmail(alerts, alertEmoji, alertTitle, analysis)
      })
    });
    
    if (response.ok) {
      console.log('[Gold Alert] Email sent successfully');
    } else {
      const error = await response.text();
      console.error('[Gold Alert] Email failed:', error);
      await queueFailedNotification(env, { type: 'email', alerts, analysis, error });
    }
  } catch (error) {
    console.error('[Gold Alert] Email error:', error);
    await queueFailedNotification(env, { type: 'email', alerts, analysis, error: error.message });
  }
}

async function queueFailedNotification(env, notification) {
  if (!env?.GOLD_PRICE_CACHE) return;
  
  try {
    const queueKey = 'failed_notifications';
    const existing = await env.GOLD_PRICE_CACHE.get(queueKey);
    const queue = existing ? JSON.parse(existing) : [];
    
    queue.push({
      ...notification,
      timestamp: Date.now(),
      retries: 0
    });
    
    if (queue.length > 50) queue.splice(0, queue.length - 50);
    
    await env.GOLD_PRICE_CACHE.put(queueKey, JSON.stringify(queue), { expirationTtl: 86400 });
  } catch (e) {
    console.error('[Queue] Failed to queue notification:', e);
  }
}

function generateEnhancedAlertEmail(alerts, alertEmoji, alertTitle, analysis) {
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const hasHighSeverity = alerts.some(a => a.severity === 'high');
  
  const headerColor = hasHighSeverity ? '#ef4444' : (hasDownward ? '#f59e0b' : '#22c55e');
  
  let analysisSection = '';
  if (analysis) {
    analysisSection = `
      <div style="background: #18181b; padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
        <h3 style="color: #00d4ff; margin: 0 0 16px 0;">📊 智能分析建议</h3>
        <p style="color: #fafafa; font-size: 16px; margin: 0 0 12px 0;">
          <strong>综合建议：${analysis.overallRecommendation}</strong>
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #71717a;">买入评分</td>
            <td style="padding: 6px 0; color: #22c55e; text-align: right; font-weight: bold;">${analysis.overallScores.buy}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #71717a;">卖出评分</td>
            <td style="padding: 6px 0; color: #ef4444; text-align: right;">${analysis.overallScores.sell}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #71717a;">RSI (国内)</td>
            <td style="padding: 6px 0; color: #fafafa; text-align: right;">${analysis.domestic.rsi?.toFixed(2) || 'N/A'}</td>
          </tr>
        </table>
        ${analysis.domestic.signal.signals.slice(0, 3).map(s => `
          <div style="margin-top: 12px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px;">
            <span style="color: #71717a; font-size: 12px;">${s.indicator}</span>
            <span style="color: ${s.action === 'buy' ? '#22c55e' : s.action === 'sell' ? '#ef4444' : '#71717a'}; margin-left: 8px;">${s.signal}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0b; color: #fafafa;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: ${headerColor}; margin: 0;">${alertEmoji} ${alertTitle}</h1>
        <p style="color: #71717a; margin-top: 5px;">实时金价智能监控系统</p>
        <p style="color: #71717a; font-size: 12px; margin-top: 8px;">${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
      </div>
      
      ${analysisSection}
      
      ${alerts.filter(a => a.type === 'window').map(alert => `
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
        <a href="https://ustc.dev/kit/gold/" style="display: inline-block; background: linear-gradient(135deg, #00d4ff, #0099cc); color: #000; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">查看实时金价</a>
      </div>
      
      <div style="margin-top: 20px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; font-size: 13px;">
        <p style="color: #71717a; margin: 0 0 8px 0;"><strong>预警规则：</strong></p>
        <ul style="color: #a1a1aa; margin: 0; padding-left: 20px;">
          <li>国内黄金阈值：${GOLD_ANALYSIS_CONFIG.ALERT_CONFIG.DOMESTIC_THRESHOLD} 元/克</li>
          <li>国际黄金阈值：${GOLD_ANALYSIS_CONFIG.ALERT_CONFIG.INTERNATIONAL_THRESHOLD} 美元/盎司</li>
          <li>通知冷却时间：${GOLD_ANALYSIS_CONFIG.ALERT_CONFIG.COOLDOWN_MINUTES} 分钟</li>
        </ul>
      </div>
      
      <p style="text-align: center; color: #71717a; font-size: 12px; margin-top: 24px;">
        此邮件由系统自动发送 | 仅供投资参考，不构成投资建议
      </p>
    </div>
  `;
}

async function sendFeishuAlert(alerts, env) {
  const FEISHU_WEBHOOK = env.FEISHU_WEBHOOK;
  const FEISHU_APP_ID = env.FEISHU_APP_ID;
  const FEISHU_APP_SECRET = env.FEISHU_APP_SECRET;
  const FEISHU_CHAT_ID = env.FEISHU_CHAT_ID;
  
  if (FEISHU_WEBHOOK) {
    return await sendFeishuWebhook(FEISHU_WEBHOOK, alerts, env);
  }
  
  if (FEISHU_APP_ID && FEISHU_APP_SECRET && FEISHU_CHAT_ID) {
    return await sendFeishuAppMessage(FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_CHAT_ID, alerts);
  }
  
  return { method: 'none', error: 'No Feishu configuration found' };
}

async function sendFeishuWebhook(webhookUrl, alerts, env) {
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const hasHighSeverity = alerts.some(a => a.severity === 'high');
  
  let alertEmoji, alertTitle;
  if (hasHighSeverity && hasDownward) {
    alertEmoji = '🚨';
    alertTitle = '金价大幅下跌预警';
  } else if (hasDownward) {
    alertEmoji = '📉';
    alertTitle = '金价下跌提醒';
  } else if (hasVolatile) {
    alertEmoji = '⚡';
    alertTitle = '金价剧烈波动';
  } else {
    alertEmoji = '📈';
    alertTitle = '金价快速上涨';
  }
  
  let content = `**${alertEmoji} ${alertTitle}**\n`;
  content += `> 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
  
  for (const alert of alerts) {
    if (alert.type === 'window') {
      content += `**${alert.name}**\n`;
      content += `当前: ${alert.current} ${alert.unit}\n`;
      content += `最高: ${alert.max} | 最低: ${alert.min}\n`;
      content += `波动: **${alert.range} ${alert.unit}**\n\n`;
    } else if (alert.type === 'analysis') {
      content += `**📊 智能分析**\n`;
      content += `建议: ${alert.recommendation}\n`;
      content += `买入评分: ${alert.buyScore}\n\n`;
    }
  }
  
  content += `[查看详情](https://ustc.dev/kit/gold/)`;
  
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
      return { success: true, response: result };
    } else {
      console.error('[Gold Alert] Feishu webhook failed:', JSON.stringify(result));
      await queueFailedNotification(env, { type: 'feishu', alerts, error: result });
      return { success: false, error: result };
    }
  } catch (error) {
    console.error('[Gold Alert] Feishu webhook error:', error);
    await queueFailedNotification(env, { type: 'feishu', alerts, error: error.message });
    return { success: false, error: error.message };
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
      return { success: false, error: tokenData.msg, stage: 'auth' };
    }
    
    const accessToken = tokenData.tenant_access_token;
    
    const hasDownward = alerts.some(a => a.direction === 'down');
    const hasVolatile = alerts.some(a => a.direction === 'volatile');
    const hasHighSeverity = alerts.some(a => a.severity === 'high');
    
    let alertEmoji = hasHighSeverity && hasDownward ? '🚨' : hasDownward ? '📉' : hasVolatile ? '⚡' : '📈';
    let alertTitle = hasHighSeverity && hasDownward ? '金价大幅下跌预警' : hasDownward ? '金价下跌提醒' : hasVolatile ? '金价剧烈波动' : '金价快速上涨';
    
    const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    const contentElements = [
      [{ tag: 'text', text: `时间：${timeStr}` }],
      [{ tag: 'text', text: '' }]
    ];
    
    for (const alert of alerts) {
      if (alert.type === 'window') {
        contentElements.push([{ tag: 'text', text: `${alert.name}` }]);
        contentElements.push([{ tag: 'text', text: `当前价格: ${alert.current} ${alert.unit}` }]);
        contentElements.push([{ tag: 'text', text: `最高: ${alert.max} | 最低: ${alert.min}` }]);
        contentElements.push([{ tag: 'text', text: `波动幅度: ${alert.range} ${alert.unit}` }]);
        contentElements.push([{ tag: 'text', text: '' }]);
      } else if (alert.type === 'analysis') {
        contentElements.push([{ tag: 'text', text: `📊 智能分析建议` }]);
        contentElements.push([{ tag: 'text', text: `建议: ${alert.recommendation}` }]);
        contentElements.push([{ tag: 'text', text: '' }]);
      }
    }
    
    contentElements.push([{ tag: 'a', text: '查看详情', href: 'https://ustc.dev/kit/gold/' }]);
    
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
      return { success: true, response: messageData };
    } else {
      console.error('[Gold Alert] Feishu message failed:', messageData.msg);
      return { success: false, error: messageData.msg, stage: 'message' };
    }
  } catch (error) {
    console.error('[Gold Alert] Feishu app error:', error);
    return { success: false, error: error.message, stage: 'exception' };
  }
}

async function sendMeoWAlert(alerts, env) {
  const MEOW_USER_ID = env.MEOW_USER_ID || '5bf48882';
  
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const hasHighSeverity = alerts.some(a => a.severity === 'high');
  
  let alertEmoji = hasHighSeverity && hasDownward ? '🚨' : hasDownward ? '📉' : hasVolatile ? '⚡' : '📈';
  let alertTitle = hasHighSeverity && hasDownward ? '金价大幅下跌预警' : hasDownward ? '金价下跌提醒' : hasVolatile ? '金价剧烈波动' : '金价快速上涨';
  
  let msgContent = `时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  
  for (const alert of alerts) {
    if (alert.type === 'window') {
      msgContent += `${alert.name}: ${alert.current} ${alert.unit} (波动${alert.range})\n`;
    } else if (alert.type === 'analysis') {
      msgContent += `智能分析: ${alert.recommendation}\n`;
    }
  }
  
  const meowUrl = `https://api.chuckfang.com/${MEOW_USER_ID}`;
  
  try {
    const response = await fetch(meowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${alertEmoji}${alertTitle}`,
        msg: msgContent.trim(),
        url: 'https://ustc.dev/kit/gold/'
      })
    });
    const result = await response.json();
    
    if (result.status === 200) {
      console.log('[Gold Alert] MeoW notification sent successfully');
      return { success: true, response: result };
    } else {
      console.error('[Gold Alert] MeoW notification failed:', result.msg);
      await queueFailedNotification(env, { type: 'meow', alerts, error: result.msg });
      return { success: false, error: result.msg };
    }
  } catch (error) {
    console.error('[Gold Alert] MeoW error:', error);
    await queueFailedNotification(env, { type: 'meow', alerts, error: error.message });
    return { success: false, error: error.message };
  }
}

export async function handleGoldAlertTest(request, env, ctx) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'feishu';
  
  const testAlerts = [
    {
      type: 'window',
      name: '国内金价 (mAuT+D)',
      current: '678.50',
      max: '680.20',
      min: '675.30',
      range: '4.90',
      unit: '元/克',
      direction: 'down',
      severity: 'medium'
    },
    {
      type: 'window',
      name: '国际金价 (XAU)',
      current: '2890.50',
      max: '2895.00',
      min: '2880.00',
      range: '15.00',
      unit: '美元/盎司',
      direction: 'down',
      severity: 'high'
    },
    {
      type: 'analysis',
      name: '智能分析建议',
      recommendation: '建议关注',
      buyScore: '3.50',
      direction: 'analysis',
      severity: 'info'
    }
  ];
  
  const config = {
    hasWebhook: !!env.FEISHU_WEBHOOK,
    hasAppId: !!env.FEISHU_APP_ID,
    hasAppSecret: !!env.FEISHU_APP_SECRET,
    hasChatId: !!env.FEISHU_CHAT_ID,
    hasEmailKey: !!env.RESEND_API_KEY,
    hasMeoWUserId: !!(env.MEOW_USER_ID || '5bf48882')
  };
  
  try {
    if (type === 'email') {
      await sendAlertEmail(testAlerts, env, null);
      return jsonResponse({ success: true, message: 'Email alert test sent', config });
    }
    
    if (type === 'feishu' || type === 'webhook') {
      const result = await sendFeishuAlert(testAlerts, env);
      return jsonResponse({
        success: result.method !== 'none',
        message: 'Feishu alert test completed',
        config,
        feishuResult: result
      });
    }
    
    if (type === 'meow') {
      const result = await sendMeoWAlert(testAlerts, env);
      return jsonResponse({
        success: result.success,
        message: 'MeoW alert test completed',
        config,
        meowResult: result
      });
    }
    
    if (type === 'all') {
      await sendAlertEmail(testAlerts, env, null);
      const feishuResult = await sendFeishuAlert(testAlerts, env);
      const meowResult = await sendMeoWAlert(testAlerts, env);
      return jsonResponse({
        success: true,
        message: 'All alerts test sent',
        config,
        feishuResult,
        meowResult
      });
    }
    
    return jsonResponse({
      success: false,
      error: 'Invalid type. Use: email, feishu, webhook, meow, or all',
      usage: '/api/gold/alert/test?type=email|feishu|webhook|meow|all',
      config
    }, 400);
    
  } catch (error) {
    console.error('[Gold Alert Test] Error:', error);
    return jsonResponse({ success: false, error: error.message, config }, 500);
  }
}

export async function handleGoldAnalysis(request, env, ctx) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'analyze';
  const notify = url.searchParams.get('notify') === 'true';
  
  console.log('[Gold Analysis API] Action:', action, 'Notify:', notify);
  
  if (action === 'analyze') {
    const result = await performGoldAnalysis(env);
    
    if (!result.success) {
      return jsonResponse({
        success: false,
        error: result.error,
        timestamp: Date.now()
      }, 400);
    }
    
    if (notify && result.analysis) {
      const shouldNotify = result.analysis.domestic.signal.isBuySignal ||
                           result.analysis.international.signal.isBuySignal;
      
      if (shouldNotify) {
        await sendAnalysisNotification(result.analysis, env);
      }
    }
    
    return jsonResponse({
      success: true,
      analysis: result.analysis,
      timestamp: Date.now()
    });
  }
  
  if (action === 'signal') {
    const result = await performGoldAnalysis(env);
    
    if (!result.success) {
      return jsonResponse({ success: false, error: result.error }, 400);
    }
    
    return jsonResponse({
      success: true,
      domesticSignal: result.analysis.domestic.signal,
      internationalSignal: result.analysis.international.signal,
      recommendation: result.analysis.overallRecommendation,
      timestamp: Date.now()
    });
  }
  
  return jsonResponse({ success: false, error: 'Invalid action' }, 400);
}

async function sendAnalysisNotification(analysis, env) {
  console.log('[Gold Analysis] Sending notification for buy signal...');
  
  const hasDomesticSignal = analysis.domestic.signal.isBuySignal;
  const hasInternationalSignal = analysis.international.signal.isBuySignal;
  
  const title = `📊 金价分析：${analysis.overallRecommendation}`;
  
  let content = `时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
  
  if (hasDomesticSignal) {
    content += `🇨🇳 国内金价 (mAuT+D)\n`;
    content += `当前：${analysis.domestic.currentPrice.toFixed(2)} 元/克\n`;
    content += `RSI：${analysis.domestic.rsi?.toFixed(2) || 'N/A'}\n`;
    content += `建议：${analysis.domestic.signal.recommendation}\n`;
    content += `买入评分：${analysis.domestic.signal.buyScore}\n`;
    content += `风险等级：${analysis.domestic.signal.riskLevel}\n\n`;
  }
  
  if (hasInternationalSignal) {
    content += `🌍 国际金价 (XAU)\n`;
    content += `当前：${analysis.international.currentPrice.toFixed(2)} 美元/盎司\n`;
    content += `RSI：${analysis.international.rsi?.toFixed(2) || 'N/A'}\n`;
    content += `建议：${analysis.international.signal.recommendation}\n`;
    content += `买入评分：${analysis.international.signal.buyScore}\n\n`;
  }
  
  content += `📈 技术指标详情\n`;
  if (analysis.domestic.macd) {
    content += `MACD：${analysis.domestic.macd.histogram > 0 ? '金叉' : '死叉'}\n`;
  }
  if (analysis.domestic.bollinger) {
    const bollPosition = analysis.domestic.currentPrice < analysis.domestic.bollinger.lower ? '触及下轨' :
                         analysis.domestic.currentPrice > analysis.domestic.bollinger.upper ? '触及上轨' : '中轨附近';
    content += `布林带：${bollPosition}\n`;
  }
  
  const alerts = [{
    type: 'analysis',
    name: '金价智能分析',
    current: analysis.domestic.currentPrice.toFixed(2),
    unit: '元/克',
    direction: 'analysis',
    recommendation: analysis.overallRecommendation,
    buyScore: analysis.overallScores.buy,
    content
  }];
  
  await sendFeishuAlert(alerts, env);
  await sendMeoWAlert(alerts, env);
  await sendAlertEmail(alerts, env, analysis);
  
  console.log('[Gold Analysis] Notification sent successfully');
}
