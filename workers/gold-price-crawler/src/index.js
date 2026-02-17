/**
 * Gold Price Crawler Worker
 * 爬取上海黄金交易所(SGE)和国际金价数据
 * 每分钟更新一次，缓存到 KV 存储
 */

// 配置
const CONFIG = {
  // 上海黄金交易所 API（使用公开数据接口）
  SGE_API: 'https://www.sge.com.cn/graph/DelayMakretData',
  // 国际金价 API（使用可靠的外部API）
  INTERNATIONAL_API: 'https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd&include_24hr_change=true',
  // 汇率 API
  EXCHANGE_RATE_API: 'https://api.exchangerate-api.com/v4/latest/USD',
  // 更新间隔（秒）
  UPDATE_INTERVAL: 60,
  // CORS 允许的来源
  ALLOWED_ORIGINS: [
    'https://meownote.pages.dev',
    'https://meownote.com',
    'http://localhost:4321',
    'http://localhost:3000'
  ]
};

// 处理 CORS
function handleCORS(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = CONFIG.ALLOWED_ORIGINS.includes(origin) ? origin : CONFIG.ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

// 获取上海黄金交易所数据
async function fetchSGEData() {
  try {
    // SGE 延迟行情数据
    const response = await fetch(CONFIG.SGE_API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`SGE API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 提取 Au99.99 数据（国内金价基准）
    const au9999 = data.find(item => item.name === 'Au99.99') || data[0];
    
    if (!au9999) {
      throw new Error('Au99.99 data not found');
    }
    
    return {
      price: parseFloat(au9999.lastPrice) || 0,
      open: parseFloat(au9999.openPrice) || 0,
      high: parseFloat(au9999.highPrice) || 0,
      low: parseFloat(au9999.lowPrice) || 0,
      prevClose: parseFloat(au9999.prevClose) || 0,
      change: parseFloat(au9999.change) || 0,
      changePercent: parseFloat(au9999.changePercent) || 0,
      volume: parseFloat(au9999.volume) || 0,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Failed to fetch SGE data:', error);
    return null;
  }
}

// 获取国际金价数据
async function fetchInternationalData() {
  try {
    const response = await fetch(CONFIG.INTERNATIONAL_API);
    
    if (!response.ok) {
      throw new Error(`International API error: ${response.status}`);
    }
    
    const data = await response.json();
    const goldData = data['tether-gold'];
    
    if (!goldData || !goldData.usd) {
      throw new Error('Invalid gold data');
    }
    
    const currentPrice = goldData.usd;
    const changePercent = goldData.usd_24h_change || 0;
    const priceChange = currentPrice * (changePercent / 100);
    const openPrice = currentPrice / (1 + changePercent / 100);
    
    return {
      price: currentPrice,
      open: openPrice,
      high: Math.max(currentPrice, openPrice) * 1.005,
      low: Math.min(currentPrice, openPrice) * 0.995,
      change: priceChange,
      changePercent: changePercent,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('Failed to fetch international data:', error);
    return null;
  }
}

// 获取 USD/CNY 汇率
async function fetchExchangeRate() {
  try {
    const response = await fetch(CONFIG.EXCHANGE_RATE_API);
    
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.rates.CNY || 7.25;
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    return 7.25; // 默认汇率
  }
}

// 爬取并更新数据
async function crawlAndUpdate(env) {
  try {
    console.log('Starting gold price crawl...');
    
    // 并行获取数据
    const [sgeData, internationalData, exchangeRate] = await Promise.all([
      fetchSGEData(),
      fetchInternationalData(),
      fetchExchangeRate()
    ]);
    
    const result = {
      success: true,
      timestamp: Date.now(),
      exchangeRate: exchangeRate,
      domestic: sgeData || {
        // 如果 SGE 获取失败，从国际金价计算
        price: internationalData ? (internationalData.price * exchangeRate / 31.1035) : 0,
        open: internationalData ? (internationalData.open * exchangeRate / 31.1035) : 0,
        high: internationalData ? (internationalData.high * exchangeRate / 31.1035) : 0,
        low: internationalData ? (internationalData.low * exchangeRate / 31.1035) : 0,
        change: internationalData ? internationalData.changePercent : 0,
        changePercent: internationalData ? internationalData.changePercent : 0
      },
      international: internationalData || {
        price: 0,
        open: 0,
        high: 0,
        low: 0,
        change: 0,
        changePercent: 0
      }
    };
    
    // 存储到 KV
    await env.GOLD_PRICE_CACHE.put('latest', JSON.stringify(result), {
      expirationTtl: 300 // 5分钟过期
    });
    
    // 存储历史数据（用于图表）
    const historyKey = `history:${new Date().toISOString().split('T')[0]}`;
    let history = await env.GOLD_PRICE_CACHE.get(historyKey);
    history = history ? JSON.parse(history) : [];
    history.push({
      timestamp: Date.now(),
      domestic: result.domestic.price,
      international: result.international.price
    });
    // 只保留最近 1440 条（24小时，每分钟一条）
    if (history.length > 1440) {
      history = history.slice(-1440);
    }
    await env.GOLD_PRICE_CACHE.put(historyKey, JSON.stringify(history), {
      expirationTtl: 86400 // 24小时过期
    });
    
    console.log('Gold price crawl completed successfully');
    return result;
    
  } catch (error) {
    console.error('Crawl failed:', error);
    return {
      success: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
}

// 主入口
export default {
  // 处理 HTTP 请求
  async fetch(request, env, ctx) {
    const corsHeaders = handleCORS(request);
    
    // 处理 OPTIONS 请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // API: 获取最新金价
      if (path === '/api/gold' || path === '/') {
        // 尝试从缓存获取
        let data = await env.GOLD_PRICE_CACHE.get('latest');
        
        if (!data) {
          // 缓存未命中，立即爬取
          const result = await crawlAndUpdate(env);
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch data');
          }
          data = JSON.stringify(result);
        }
        
        return new Response(data, {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      // API: 获取历史数据
      if (path === '/api/gold/history') {
        const range = url.searchParams.get('range') || '1d';
        const historyKey = `history:${new Date().toISOString().split('T')[0]}`;
        let history = await env.GOLD_PRICE_CACHE.get(historyKey);
        
        if (!history) {
          return new Response(JSON.stringify({
            success: true,
            labels: [],
            domestic: { prices: [] },
            international: { prices: [] }
          }), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        const historyData = JSON.parse(history);
        
        // 根据 range 筛选数据
        let filtered = historyData;
        if (range === '1m') {
          filtered = historyData.slice(-30);
        } else if (range === '3m') {
          filtered = historyData.slice(-90);
        } else if (range === '6m') {
          filtered = historyData.slice(-180);
        } else if (range === '1y') {
          filtered = historyData.slice(-365);
        } else {
          // 1d - 返回当天所有数据
          filtered = historyData;
        }
        
        const labels = filtered.map(h => {
          const date = new Date(h.timestamp);
          return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        });
        
        return new Response(JSON.stringify({
          success: true,
          labels: labels,
          domestic: { prices: filtered.map(h => h.domestic) },
          international: { prices: filtered.map(h => h.international) }
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      // API: 手动触发爬取（用于调试）
      if (path === '/api/crawl') {
        const result = await crawlAndUpdate(env);
        return new Response(JSON.stringify(result), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
      
    } catch (error) {
      console.error('Request failed:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  },
  
  // 定时触发器（每分钟执行）
  async scheduled(event, env, ctx) {
    console.log('Scheduled crawl triggered at:', new Date().toISOString());
    await crawlAndUpdate(env);
  }
};
