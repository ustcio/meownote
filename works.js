// ================================================================================
// AGI Era Backend API - 重构优化版
// ================================================================================
// 
// 功能模块：
// 1. 通义千问/豆包 ChatBot
// 2. 用户注册/登录（增强安全）
// 3. 访客统计 (PV/UV/热力图)
// 4. 管理员系统（登录、文件管理）
// 5. Resend 邮件通知
// 6. R2 大文件上传（Multipart Upload）
//
// 域名：
// - https://api.agiera.net (自定义域名)
// - https://visitor-stats.metanext.workers.dev (Workers域名)
//
// ================================================================================

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      const route = ROUTES[path] || ROUTES[path.endsWith('/') ? path.slice(0, -1) : path];
      
      if (route) {
        if (route.pattern) {
          const match = path.match(route.pattern);
          if (match) {
            return await route.handler(request, env, ctx, match);
          }
        } else {
          return await route.handler(request, env, ctx);
        }
      }

      if (path.startsWith('/api/admin/files/')) {
        return await handleAdminFileAction(request, env, path);
      }
      
      if (path.startsWith('/api/admin/folders/')) {
        return await handleAdminFolderAction(request, env, path);
      }

      return jsonResponse({ error: 'Not Found' }, 404);
      
    } catch (error) {
      console.error('Server Error:', error);
      return jsonResponse({ error: 'Internal Server Error', message: error.message }, 500);
    }
  }
};

// ================================================================================
// 路由配置
// ================================================================================

const ROUTES = {
  '/api/chat': { handler: handleChat },
  '/api/signup': { handler: handleSignup },
  '/api/login': { handler: handleLogin },
  '/api/visitor': { handler: handleVisitor },
  '/api/gold': { handler: handleGoldPrice },
  '/api/gold/history': { handler: handleGoldHistory },
  '/api/user/profile': { handler: handleUserProfile },
  '/api/user/password': { handler: handleUserPassword },
  '/stats/visit': { handler: handleStatsVisit },
  '/stats/visitor': { handler: handleStatsGet },
  '/stats/heatmap': { handler: handleHeatmap },
  '/api/admin/login': { handler: handleAdminLogin },
  '/api/admin/verify': { handler: handleAdminVerify },
  '/api/admin/files': { handler: handleAdminFiles },
  '/api/admin/folders': { handler: handleAdminFolders },
  '/api/admin/stats': { handler: handleAdminStats },
  '/api/admin/change-password': { handler: handleAdminChangePassword },
  '/api/admin/upload/init': { handler: handleUploadInit },
  '/api/admin/upload/part': { handler: handleUploadPart },
  '/api/admin/upload/complete': { handler: handleUploadComplete },
  '/api/admin/upload/abort': { handler: handleUploadAbort },
};

// ================================================================================
// CORS 处理
// ================================================================================

const ALLOWED_ORIGINS = [
  'https://agiera.net',
  'https://www.agiera.net',
  'https://meow-note.com',
  'http://localhost:4321',
  'http://localhost:4322',
  'http://localhost:4323',
  'http://localhost:4324',
];

function handleCORS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

// ================================================================================
// 输入验证工具
// ================================================================================

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePassword(password) {
  return password && password.length >= 8;
}

function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>\"'&]/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '&': '&amp;'
  })[char]);
}

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
         'unknown';
}

// ================================================================================
// 1. Unified Chat API (Qwen & Doubao Models)
// ================================================================================

const CHAT_SYSTEM_PROMPT = 'You are Meow AI Assistant, a helpful, harmless, and honest AI assistant. You can help users with coding, analysis, creative writing, and various other tasks. Please respond in the same language as the user.';

const MODEL_CONFIG = {
  // Qwen Models
  'qwen-turbo': {
    provider: 'qwen',
    model: 'qwen-turbo',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    maxTokens: 2000,
    temperature: 0.7
  },
  'qwen-plus': {
    provider: 'qwen',
    model: 'qwen-plus',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    maxTokens: 2000,
    temperature: 0.7
  },
  // Doubao Models
  'doubao-2.0-pro': {
    provider: 'doubao',
    model: 'doubao-seed-2-0-pro-260215',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    maxTokens: 2000,
    temperature: 0.7
  },
  'doubao-2.0-code': {
    provider: 'doubao',
    model: 'doubao-seed-2-0-code-preview-260215',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    maxTokens: 2000,
    temperature: 0.7
  }
};

async function handleChat(request, env, ctx) {
  const requestStartTime = Date.now();
  console.log('[Chat API] Received request');
  
  if (request.method !== 'POST') {
    console.log('[Chat API] Method not allowed:', request.method);
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
    console.log('[Chat API] Request body:', JSON.stringify(body, null, 2));
  } catch (error) {
    console.error('[Chat API] Invalid JSON:', error);
    return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
  }

  const { message, model = 'qwen-turbo', history = [], stream = false } = body;
  
  console.log('[Chat API] Message:', message?.substring(0, 50));
  console.log('[Chat API] Model:', model);
  console.log('[Chat API] History length:', history?.length);
  console.log('[Chat API] Stream mode:', stream);
  
  if (!message || typeof message !== 'string') {
    console.error('[Chat API] Message is required');
    return jsonResponse({ success: false, message: 'Message is required' }, 400);
  }

  if (message.length > 4000) {
    console.error('[Chat API] Message too long:', message.length);
    return jsonResponse({ success: false, message: 'Message too long (max 4000 chars)' }, 400);
  }

  const config = MODEL_CONFIG[model];
  if (!config) {
    console.error('[Chat API] Invalid model selected:', model);
    return jsonResponse({ success: false, message: 'Invalid model selected' }, 400);
  }

  const apiKey = config.provider === 'qwen' ? env.DASHSCOPE_API_KEY : env.DOUBAO_API_KEY;
  
  if (!apiKey) {
    console.error('[Chat API] API key not configured for provider:', config.provider);
    return jsonResponse({ success: false, message: 'API not configured' }, 500);
  }

  // Optimize history - reduce token count
  const optimizedHistory = history
    .slice(-5)  // Reduce from 10 to 5 messages
    .map(h => ({
      role: h.role || 'user',
      content: h.content?.slice(0, 1000) || ''  // Limit each message length
    }));

  const messages = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...optimizedHistory,
    { role: 'user', content: sanitizeInput(message) }
  ];

  console.log('[Chat API] Sending to', config.provider, 'endpoint:', config.endpoint);
  console.log('[Chat API] Messages count:', messages.length);

  try {
    const requestBody = {
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: stream  // Enable streaming if requested
    };
    
    console.log('[Chat API] Request body to AI provider:', JSON.stringify({
      ...requestBody,
      messages: requestBody.messages.slice(-2) // Only log last 2 messages for brevity
    }, null, 2));

    const providerStartTime = Date.now();
    
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const providerLatency = Date.now() - providerStartTime;
    console.log('[Chat API] AI provider response status:', response.status);
    console.log(`[Performance] Provider latency: ${providerLatency}ms`);

    // Handle streaming response
    if (stream && response.ok) {
      console.log('[Chat API] Returning streaming response');
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Handle non-streaming response
    const data = await response.json();
    console.log('[Chat API] AI provider response:', JSON.stringify(data, null, 2));
    
    const totalLatency = Date.now() - requestStartTime;
    console.log(`[Performance] Total latency: ${totalLatency}ms`);
    
    if (data.choices?.[0]?.message?.content) {
      console.log('[Chat API] Success! Reply length:', data.choices[0].message.content.length);
      return jsonResponse({
        success: true,
        reply: data.choices[0].message.content,
        model: model,
        usage: data.usage,
        latency: {
          provider: providerLatency,
          total: totalLatency
        }
      });
    }
    
    if (data.error) {
      console.error('[Chat API] AI provider error:', data.error);
      return jsonResponse({
        success: false,
        message: data.error.message || 'AI service error'
      }, 500);
    }

    console.error('[Chat API] Unexpected response format:', data);
    return jsonResponse({
      success: false,
      message: 'Unexpected response from AI'
    }, 500);

  } catch (error) {
    console.error('[Chat API] Fetch error:', error);
    return jsonResponse({
      success: false,
      message: 'Failed to get AI response: ' + error.message
    }, 500);
  }
}

// ================================================================================
// 2. 豆包 ChatBot (火山引擎)
// ================================================================================

const MODEL_MAP = {
  'doubao-2.0-pro': 'doubao-seed-2-0-pro-260215',
  'doubao-2.0-code': 'doubao-seed-2-0-code-preview-260215'
};

// ================================================================================
// 3. 用户注册（增强安全）
// ================================================================================

async function handleSignup(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
  }

  const { username, email, password } = body;

  if (!username || !email || !password) {
    return jsonResponse({ success: false, message: '请填写所有字段' }, 400);
  }

  if (!validateEmail(email)) {
    return jsonResponse({ success: false, message: '请输入有效的邮箱地址' }, 400);
  }

  if (!validatePassword(password)) {
    return jsonResponse({ success: false, message: '密码至少需要8个字符' }, 400);
  }

  const sanitizedUsername = sanitizeInput(username).substring(0, 50);
  const sanitizedEmail = sanitizeInput(email).toLowerCase();
  const ip = getClientIP(request);

  try {
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(sanitizedEmail).first();

    if (existing) {
      return jsonResponse({ success: false, message: '该邮箱已注册' }, 400);
    }

    const hashedPassword = await hashPassword(password);
    const token = generateToken();

    await env.DB.prepare(
      `INSERT INTO users (username, email, password, ip, token, login_count, created_at, last_login) 
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
    ).bind(sanitizedUsername, sanitizedEmail, hashedPassword, ip, token).run();

    ctx.waitUntil(sendRegistrationEmail(sanitizedUsername, sanitizedEmail, ip, env));

    return jsonResponse({
      success: true,
      token,
      user: { username: sanitizedUsername, email: sanitizedEmail, loginCount: 1 }
    });

  } catch (error) {
    console.error('Signup error:', error);
    return jsonResponse({ success: false, message: '注册失败，请重试' }, 500);
  }
}

// ================================================================================
// 4. 用户登录（增强安全）
// ================================================================================

const LOGIN_ATTEMPTS = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const LOGIN_ATTEMPTS_MAX_SIZE = 1000; // Maximum entries to prevent unbounded growth

// Cleanup old login attempts when map gets too large
// Called within request handler to comply with Cloudflare Workers restrictions
function cleanupLoginAttemptsIfNeeded() {
  // If map is small enough, skip cleanup
  if (LOGIN_ATTEMPTS.size < LOGIN_ATTEMPTS_MAX_SIZE) {
    return;
  }

  const now = Date.now();
  let cleaned = 0;

  for (const [ip, attempts] of LOGIN_ATTEMPTS.entries()) {
    // Remove entries older than lockout time, or if we've cleaned enough
    if (now - attempts.lastAttempt > LOGIN_LOCKOUT_TIME || cleaned > 100) {
      LOGIN_ATTEMPTS.delete(ip);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Login] Cleaned up ${cleaned} expired login attempt records`);
  }
}

async function handleLogin(request, env, ctx) {
  // Cleanup old login attempts if needed (within handler to comply with Workers restrictions)
  cleanupLoginAttemptsIfNeeded();

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
  }

  const { username, email, password } = body;
  const loginIdentifier = username || email;

  if (!loginIdentifier || !password) {
    return jsonResponse({ success: false, message: '请填写用户名/邮箱和密码' }, 400);
  }

  const sanitizedIdentifier = sanitizeInput(loginIdentifier).toLowerCase();
  const ip = getClientIP(request);

  const attempts = LOGIN_ATTEMPTS.get(ip) || { count: 0, lastAttempt: 0 };
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS && Date.now() - attempts.lastAttempt < LOGIN_LOCKOUT_TIME) {
    return jsonResponse({ 
      success: false, 
      message: '登录尝试次数过多，请15分钟后再试' 
    }, 429);
  }

  try {
    // 支持用户名或邮箱登录
    const isEmail = sanitizedIdentifier.includes('@');
    const query = isEmail 
      ? 'SELECT * FROM users WHERE email = ?'
      : 'SELECT * FROM users WHERE username = ? OR email = ?';
    
    const user = isEmail 
      ? await env.DB.prepare(query).bind(sanitizedIdentifier).first()
      : await env.DB.prepare(query).bind(sanitizedIdentifier, sanitizedIdentifier).first();

    if (!user) {
      recordFailedLogin(ip);
      return jsonResponse({ success: false, message: '用户名/邮箱或密码错误' }, 401);
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      recordFailedLogin(ip);
      return jsonResponse({ success: false, message: '用户名/邮箱或密码错误' }, 401);
    }

    LOGIN_ATTEMPTS.delete(ip);

    const newLoginCount = user.login_count + 1;
    const newToken = generateToken();

    await env.DB.prepare(
      `UPDATE users SET login_count = ?, last_login = datetime('now'), token = ? WHERE id = ?`
    ).bind(newLoginCount, newToken, user.id).run();

    return jsonResponse({
      success: true,
      token: newToken,
      user: {
        username: user.username,
        email: user.email,
        loginCount: newLoginCount
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({ success: false, message: '登录失败，请重试' }, 500);
  }
}

function recordFailedLogin(ip) {
  const attempts = LOGIN_ATTEMPTS.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  LOGIN_ATTEMPTS.set(ip, attempts);
}

// ================================================================================
// 5. 访客统计 - 旧版（保留兼容）
// ================================================================================

async function handleVisitor(request, env, ctx) {
  const ip = getClientIP(request);
  const today = new Date().toISOString().split('T')[0];

  try {
    const existing = await env.DB.prepare(
      'SELECT id FROM visitors WHERE ip = ? AND date = ?'
    ).bind(ip, today).first();

    if (!existing) {
      await env.DB.prepare(
        'INSERT INTO visitors (ip, date, created_at) VALUES (?, ?, datetime("now"))'
      ).bind(ip, today).run();
    }

    const total = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM visitors'
    ).first();

    const online = await env.DB.prepare(
      `SELECT COUNT(DISTINCT ip) as count FROM visitors 
       WHERE created_at > datetime('now', '-30 minutes')`
    ).first();

    return jsonResponse({
      success: true,
      total: total?.count || 0,
      online: online?.count || 1
    });

  } catch (error) {
    console.error('Visitor error:', error);
    return jsonResponse({ success: true, total: 0, online: 1 });
  }
}

// ================================================================================
// 6. 访客统计 - 新版 PV/UV
// ================================================================================

async function handleStatsVisit(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const page = sanitizeInput(body.page || '/');
    const referrer = body.referrer ? sanitizeInput(body.referrer) : null;
    const userAgent = request.headers.get('User-Agent') || '';
    const ip = getClientIP(request);

    const visitorId = await generateVisitorId(ip, userAgent);
    const today = new Date().toISOString().split('T')[0];

    await env.DB.prepare(
      `INSERT INTO page_views (page, referrer, visitor_id, created_at) VALUES (?, ?, ?, datetime('now'))`
    ).bind(page, referrer, visitorId).run();

    const existingVisitor = await env.DB.prepare(
      `SELECT id FROM unique_visitors WHERE visitor_id = ? AND date = ?`
    ).bind(visitorId, today).first();

    if (!existingVisitor) {
      await env.DB.prepare(
        `INSERT INTO unique_visitors (visitor_id, date) VALUES (?, ?)`
      ).bind(visitorId, today).run();
    }

    const pvResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM page_views`).first();
    const online = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM (
        SELECT visitor_id FROM page_views 
        WHERE created_at > datetime('now', '-5 minutes')
        GROUP BY visitor_id
      )`
    ).first();
    
    const todayPV = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM page_views 
       WHERE date(created_at) = date('now')`
    ).first();

    return jsonResponse({ 
      success: true,
      pv: pvResult?.count || 0,
      total: pvResult?.count || 0,
      online: online?.count || 0,
      today: todayPV?.count || 0
    });

  } catch (error) {
    console.error('Stats visit error:', error);
    return jsonResponse({ success: true, pv: 0, total: 0, online: 0, today: 0 });
  }
}

async function handleStatsGet(request, env, ctx) {
  try {
    const pvResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM page_views`).first();
    const uvResult = await env.DB.prepare(`SELECT COUNT(DISTINCT visitor_id) as count FROM unique_visitors`).first();
    
    const online = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM (
        SELECT visitor_id FROM page_views 
        WHERE created_at > datetime('now', '-5 minutes')
        GROUP BY visitor_id
      )`
    ).first();
    
    const todayPV = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM page_views 
       WHERE date(created_at) = date('now')`
    ).first();

    return jsonResponse({ 
      success: true,
      pv: pvResult?.count || 0, 
      uv: uvResult?.count || 0,
      total: pvResult?.count || 0,
      online: online?.count || 0,
      today: todayPV?.count || 0
    });
  } catch (error) {
    console.error('Stats get error:', error);
    return jsonResponse({ success: true, pv: 0, uv: 0, total: 0, online: 0, today: 0 });
  }
}

async function getStatsResponse(env) {
  const pvResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM page_views`).first();
  const uvResult = await env.DB.prepare(`SELECT COUNT(DISTINCT visitor_id) as count FROM unique_visitors`).first();
  return jsonResponse({ 
    success: true,
    pv: pvResult?.count || 0, 
    uv: uvResult?.count || 0 
  });
}

// ================================================================================
// 7. 访客热力图数据接口
// ================================================================================

async function handleHeatmap(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year')) || new Date().getFullYear();

    const result = await env.DB.prepare(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as count
      FROM page_views
      WHERE created_at >= datetime('now', '-1 year')
      GROUP BY date(created_at)
      ORDER BY date
    `).all();

    const heatmapData = {};
    (result.results || []).forEach(row => {
      heatmapData[row.date] = row.count;
    });

    const maxCount = Math.max(...Object.values(heatmapData), 1);

    return jsonResponse({
      success: true,
      year,
      data: heatmapData,
      maxCount
    });

  } catch (error) {
    console.error('Heatmap error:', error);
    return jsonResponse({ success: false, data: {}, maxCount: 0 });
  }
}

// ================================================================================
// 黄金价格 API - 增强版（带定时爬取和缓存）
// ================================================================================

// 金价数据缓存
let goldPriceCache = {
  data: null,
  timestamp: 0,
  isCrawling: false
};

// 爬取上海黄金交易所数据
async function crawlSGEData() {
  try {
    // 尝试多个 SGE 数据源
    const sgeApis = [
      'https://www.sge.com.cn/graph/DelayMakretData',
      'https://www.sge.com.cn/sgepub/sgepublication/marketdata/delaymarketdata'
    ];
    
    for (const api of sgeApis) {
      try {
        const response = await fetch(api, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Referer': 'https://www.sge.com.cn/',
            'X-Requested-With': 'XMLHttpRequest'
          },
          cf: { cacheTtl: 0 }
        });
        
        if (response.ok) {
          const data = await response.json();
          // 查找 Au99.99 数据
          const au9999 = data.find(item => 
            item.name?.includes('Au99.99') || 
            item.code === 'Au99.99' ||
            item.symbol === 'Au99.99'
          );
          
          if (au9999) {
            return {
              price: parseFloat(au9999.lastPrice || au9999.price || au9999.close),
              open: parseFloat(au9999.openPrice || au9999.open),
              high: parseFloat(au9999.highPrice || au9999.high),
              low: parseFloat(au9999.lowPrice || au9999.low),
              prevClose: parseFloat(au9999.prevClose || au9999.prevSettlement),
              change: parseFloat(au9999.change || 0),
              changePercent: parseFloat(au9999.changePercent || au9999.changeRate || 0),
              volume: parseFloat(au9999.volume || 0),
              source: 'SGE',
              timestamp: Date.now()
            };
          }
        }
      } catch (e) {
        console.error(`SGE API ${api} error:`, e.message);
      }
    }
    return null;
  } catch (error) {
    console.error('Crawl SGE error:', error);
    return null;
  }
}

// 爬取国际金价
async function crawlInternationalPrice() {
  try {
    // 尝试多个国际金价 API
    const apis = [
      // CoinGecko
      async () => {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=usd&include_24hr_change=true');
        if (res.ok) {
          const data = await res.json();
          const xaut = data['tether-gold'];
          if (xaut?.usd) {
            const change = xaut.usd_24h_change || 0;
            const open = xaut.usd / (1 + change / 100);
            return {
              price: xaut.usd,
              open: open,
              high: Math.max(xaut.usd, open) * 1.005,
              low: Math.min(xaut.usd, open) * 0.995,
              change: change,
              changePercent: change,
              source: 'CoinGecko'
            };
          }
        }
        return null;
      },
      // GoldPrice.org
      async () => {
        const res = await fetch('https://api.goldprice.org/goldprice/api/v1/gold/spot', {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.price) {
            return {
              price: parseFloat(data.price),
              open: parseFloat(data.open || data.price),
              high: parseFloat(data.high || data.price * 1.005),
              low: parseFloat(data.low || data.price * 0.995),
              change: parseFloat(data.changePercent || 0),
              changePercent: parseFloat(data.changePercent || 0),
              source: 'GoldPrice.org'
            };
          }
        }
        return null;
      },
      // Metals.dev
      async () => {
        const res = await fetch('https://api.metals.dev/v1/latest?api_key=FREEAPI&currency=USD&unit=toz', {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.rates?.XAU) {
            return {
              price: data.rates.XAU,
              open: data.rates.XAU * 0.998,
              high: data.rates.XAU * 1.005,
              low: data.rates.XAU * 0.995,
              change: 0,
              changePercent: 0,
              source: 'Metals.dev'
            };
          }
        }
        return null;
      }
    ];
    
    for (const apiFn of apis) {
      try {
        const result = await apiFn();
        if (result) return result;
      } catch (e) {
        console.error('International API error:', e.message);
      }
    }
    return null;
  } catch (error) {
    console.error('Crawl international error:', error);
    return null;
  }
}

// 获取 USD/CNY 汇率
async function getExchangeRate() {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      cf: { cacheTtl: 3600 } // 缓存1小时
    });
    if (response.ok) {
      const data = await response.json();
      return data.rates?.CNY || 7.25;
    }
  } catch (e) {
    console.error('Exchange rate error:', e);
  }
  return 7.25;
}

// 执行爬取任务
async function performCrawl(env) {
  if (goldPriceCache.isCrawling) {
    console.log('[Gold Crawler] Already crawling, skipping...');
    return goldPriceCache.data;
  }
  
  goldPriceCache.isCrawling = true;
  console.log('[Gold Crawler] Starting crawl at', new Date().toISOString());
  
  try {
    // 并行爬取数据
    const [sgeData, intlData, exchangeRate] = await Promise.all([
      crawlSGEData(),
      crawlInternationalPrice(),
      getExchangeRate()
    ]);
    
    const OZ_TO_G = 31.1035;
    
    // 构建结果
    let domestic, international;
    
    if (sgeData) {
      // 使用真实的 SGE 数据
      domestic = {
        price: sgeData.price,
        open: sgeData.open,
        high: sgeData.high,
        low: sgeData.low,
        change: sgeData.changePercent,
        changePercent: sgeData.changePercent,
        volume: sgeData.volume,
        source: 'SGE'
      };
    } else if (intlData) {
      // 从国际金价计算国内金价
      const cnyPrice = (intlData.price * exchangeRate) / OZ_TO_G;
      domestic = {
        price: cnyPrice,
        open: (intlData.open * exchangeRate) / OZ_TO_G,
        high: (intlData.high * exchangeRate) / OZ_TO_G,
        low: (intlData.low * exchangeRate) / OZ_TO_G,
        change: intlData.changePercent,
        changePercent: intlData.changePercent,
        source: 'Calculated'
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
    
    // 如果都没有获取到，使用缓存或默认值
    if (!domestic || !international) {
      if (goldPriceCache.data) {
        console.log('[Gold Crawler] Using cached data');
        goldPriceCache.isCrawling = false;
        return goldPriceCache.data;
      }
      
      // 使用默认值
      domestic = {
        price: 580.00,
        open: 579.00,
        high: 582.00,
        low: 578.00,
        change: 0.17,
        changePercent: 0.17,
        source: 'Default'
      };
      international = {
        price: 2650.00,
        open: 2645.00,
        high: 2660.00,
        low: 2640.00,
        change: 5.00,
        changePercent: 0.19,
        source: 'Default'
      };
    }
    
    const result = {
      success: true,
      timestamp: Date.now(),
      exchangeRate: exchangeRate,
      domestic: domestic,
      international: international
    };
    
    // 更新缓存
    goldPriceCache.data = result;
    goldPriceCache.timestamp = Date.now();
    
    // 存储到 KV（如果有）
    if (env?.GOLD_PRICE_CACHE) {
      await env.GOLD_PRICE_CACHE.put('latest', JSON.stringify(result), {
        expirationTtl: 300 // 5分钟过期
      });
      
      // 存储历史数据
      const historyKey = `history:${new Date().toISOString().split('T')[0]}`;
      let history = await env.GOLD_PRICE_CACHE.get(historyKey);
      history = history ? JSON.parse(history) : [];
      history.push({
        timestamp: Date.now(),
        domestic: domestic.price,
        international: international.price
      });
      if (history.length > 1440) history = history.slice(-1440);
      await env.GOLD_PRICE_CACHE.put(historyKey, JSON.stringify(history), {
        expirationTtl: 86400
      });
    }
    
    console.log('[Gold Crawler] Crawl completed successfully');
    return result;
    
  } catch (error) {
    console.error('[Gold Crawler] Crawl failed:', error);
    // 返回缓存数据或默认值
    return goldPriceCache.data || {
      success: true,
      timestamp: Date.now(),
      exchangeRate: 7.25,
      domestic: { price: 580.00, open: 579.00, high: 582.00, low: 578.00, change: 0.17, changePercent: 0.17 },
      international: { price: 2650.00, open: 2645.00, high: 2660.00, low: 2640.00, change: 5.00, changePercent: 0.19 }
    };
  } finally {
    goldPriceCache.isCrawling = false;
  }
}

// HTTP 处理函数
async function handleGoldPrice(request, env, ctx) {
  try {
    // 检查缓存是否有效（30秒内）
    const now = Date.now();
    if (goldPriceCache.data && (now - goldPriceCache.timestamp) < 30000) {
      console.log('[Gold Price] Returning cached data');
      return jsonResponse(goldPriceCache.data);
    }
    
    // 执行爬取
    const data = await performCrawl(env);
    return jsonResponse(data);
    
  } catch (error) {
    console.error('Gold price error:', error);
    // 返回缓存或默认值
    if (goldPriceCache.data) {
      return jsonResponse(goldPriceCache.data);
    }
    return jsonResponse({
      success: true,
      timestamp: Date.now(),
      exchangeRate: 7.25,
      domestic: { price: 580.00, change: 0.17, high: 582.00, low: 578.00, open: 579.00 },
      international: { price: 2650.00, change: 0.19, high: 2660.00, low: 2640.00, open: 2645.00 }
    });
  }
}

// 定时爬取入口（用于 Cron Trigger）
export async function scheduledGoldCrawl(event, env, ctx) {
  console.log('[Scheduled] Gold price crawl triggered at', new Date().toISOString());
  ctx.waitUntil(performCrawl(env));
}

async function handleGoldHistory(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const range = url.searchParams.get('range') || '1m';
    
    const now = Date.now();
    const labels = [];
    const domesticPrices = [];
    const internationalPrices = [];
    
    let days = 30;
    switch (range) {
      case '1m': days = 30; break;
      case '3m': days = 90; break;
      case '6m': days = 180; break;
      case '1y': days = 365; break;
    }
    
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

// ================================================================================
// 用户资料 API
// ================================================================================

async function handleUserProfile(request, env, ctx) {
  if (request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, message: '未授权' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE token = ?'
    ).bind(token).first();

    if (!user) {
      return jsonResponse({ success: false, message: '用户不存在' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { username, email } = body;

    if (!username || !email) {
      return jsonResponse({ success: false, message: '请填写完整信息' }, 400);
    }

    const sanitizedUsername = sanitizeInput(username);
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    // 检查用户名是否被其他用户占用
    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?'
    ).bind(sanitizedUsername, sanitizedEmail, user.id).first();

    if (existingUser) {
      return jsonResponse({ success: false, message: '用户名或邮箱已被使用' }, 400);
    }

    await env.DB.prepare(
      'UPDATE users SET username = ?, email = ? WHERE id = ?'
    ).bind(sanitizedUsername, sanitizedEmail, user.id).run();

    return jsonResponse({
      success: true,
      message: '资料更新成功',
      user: {
        id: user.id,
        username: sanitizedUsername,
        email: sanitizedEmail,
        login_count: user.login_count,
        last_login: user.last_login,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return jsonResponse({ success: false, message: '更新失败' }, 500);
  }
}

async function handleUserPassword(request, env, ctx) {
  if (request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, message: '未授权' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE token = ?'
    ).bind(token).first();

    if (!user) {
      return jsonResponse({ success: false, message: '用户不存在' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return jsonResponse({ success: false, message: '请填写完整信息' }, 400);
    }

    if (newPassword.length < 6) {
      return jsonResponse({ success: false, message: '新密码至少6个字符' }, 400);
    }

    const isValid = await verifyPassword(currentPassword, user.password);
    if (!isValid) {
      return jsonResponse({ success: false, message: '当前密码错误' }, 401);
    }

    const newHashedPassword = await hashPassword(newPassword);
    const newToken = generateToken();

    await env.DB.prepare(
      'UPDATE users SET password = ?, token = ? WHERE id = ?'
    ).bind(newHashedPassword, newToken, user.id).run();

    return jsonResponse({
      success: true,
      message: '密码更新成功',
      token: newToken
    });

  } catch (error) {
    console.error('Password update error:', error);
    return jsonResponse({ success: false, message: '更新失败' }, 500);
  }
}

// ================================================================================
// 8. 管理员登录
// ================================================================================

async function handleAdminLogin(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { username, password } = body;

    if (!username || !password) {
      return jsonResponse({ success: false, message: '请输入用户名和密码' }, 400);
    }

    const passwordHash = await hashAdminPassword(password);

    const user = await env.DB.prepare(
      'SELECT id, username, role FROM admin_users WHERE username = ? AND password_hash = ?'
    ).bind(sanitizeInput(username), passwordHash).first();

    if (!user) {
      console.log('Admin login failed for:', username);
      return jsonResponse({ success: false, message: '用户名或密码错误' }, 401);
    }

    await env.DB.prepare(
      "UPDATE admin_users SET last_login = datetime('now') WHERE id = ?"
    ).bind(user.id).run();

    const token = await createAdminToken(
      { userId: user.id, username: user.username, role: user.role },
      env.JWT_SECRET || 'agiera-default-jwt-secret-2024'
    );

    console.log('Admin login success:', user.username);

    return jsonResponse({
      success: true,
      token,
      user: { username: user.username, role: user.role }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return jsonResponse({ success: false, message: '服务器错误' }, 500);
  }
}

// ================================================================================
// 9. 验证管理员 Token
// ================================================================================

async function handleAdminVerify(request, env, ctx) {
  const authResult = await verifyAdminAuth(request, env);
  
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  return jsonResponse({ success: true, user: authResult.user });
}

// ================================================================================
// 10. 管理员文件列表/上传
// ================================================================================

async function handleAdminFiles(request, env, ctx) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  if (request.method === 'GET') {
    return await getAdminFiles(request, env);
  }

  if (request.method === 'POST') {
    return await uploadAdminFile(request, env, authResult);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

async function getAdminFiles(request, env) {
  try {
    const url = new URL(request.url);
    const folderId = url.searchParams.get('folder_id') || null;
    
    let files, folders;
    
    if (folderId) {
      files = await env.DB.prepare(
        'SELECT id, name, type, size, downloads, folder_id, created_at as date FROM files WHERE folder_id = ? ORDER BY created_at DESC'
      ).bind(folderId).all();
      folders = await env.DB.prepare(
        'SELECT id, name, parent_id, created_at as date FROM folders WHERE parent_id = ? ORDER BY name ASC'
      ).bind(folderId).all();
    } else {
      files = await env.DB.prepare(
        'SELECT id, name, type, size, downloads, folder_id, created_at as date FROM files WHERE folder_id IS NULL ORDER BY created_at DESC'
      ).all();
      folders = await env.DB.prepare(
        'SELECT id, name, parent_id, created_at as date FROM folders WHERE parent_id IS NULL ORDER BY name ASC'
      ).all();
    }

    return jsonResponse({
      success: true,
      files: files.results || [],
      folders: folders.results || [],
      currentFolder: folderId
    });
  } catch (error) {
    console.error('Get files error:', error);
    return jsonResponse({ success: false, message: '获取文件列表失败' }, 500);
  }
}

async function uploadAdminFile(request, env, authResult) {
  try {
    const contentType = request.headers.get('Content-Type') || '';
    const url = new URL(request.url);
    const folderId = url.searchParams.get('folder_id') || null;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!file || !(file instanceof File)) {
        return jsonResponse({ success: false, message: '请选择文件' }, 400);
      }
      
      const fileId = crypto.randomUUID();
      const ext = file.name.split('.').pop() || 'bin';
      const storagePath = `uploads/${fileId}.${ext}`;
      
      if (env.R2) {
        await env.R2.put(storagePath, file.stream(), {
          httpMetadata: {
            contentType: file.type || 'application/octet-stream',
          },
          customMetadata: {
            originalName: file.name,
            uploadedBy: String(authResult.user.userId),
          },
        });
      }
      
      await env.DB.prepare(
        `INSERT INTO files (id, name, type, size, storage_path, downloads, uploaded_by, folder_id, created_at) 
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`
      ).bind(
        fileId,
        sanitizeInput(file.name),
        ext,
        file.size,
        storagePath,
        authResult.user.userId,
        folderId
      ).run();
      
      return jsonResponse({
        success: true,
        message: '文件上传成功',
        file: { id: fileId, name: file.name, type: ext, size: file.size }
      });
      
    } else {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
      }

      const { name, type, size } = body;

      if (!name) {
        return jsonResponse({ success: false, message: '文件名不能为空' }, 400);
      }

      const fileId = crypto.randomUUID();
      const storagePath = `uploads/${fileId}.${type || 'bin'}`;

      await env.DB.prepare(
        `INSERT INTO files (id, name, type, size, storage_path, downloads, uploaded_by, created_at) 
         VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))`
      ).bind(
        fileId,
        sanitizeInput(name),
        type || '',
        size || 0,
        storagePath,
        authResult.user.userId
      ).run();

      return jsonResponse({
        success: true,
        message: '文件记录已创建',
        file: { id: fileId, name, type, size }
      });
    }

  } catch (error) {
    console.error('Upload error:', error);
    return jsonResponse({ success: false, message: '上传失败: ' + error.message }, 500);
  }
}

// ================================================================================
// 11. 管理员文件夹管理
// ================================================================================

async function handleAdminFolders(request, env, ctx) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  if (request.method === 'GET') {
    try {
      const folders = await env.DB.prepare(
        'SELECT id, name, parent_id, created_at as date FROM folders ORDER BY name ASC'
      ).all();

      return jsonResponse({
        success: true,
        folders: folders.results || []
      });
    } catch (error) {
      console.error('Get folders error:', error);
      return jsonResponse({ success: false, message: '获取文件夹列表失败' }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
      }

      const { name, parent_id } = body;

      if (!name || name.trim() === '') {
        return jsonResponse({ success: false, message: '文件夹名称不能为空' }, 400);
      }

      const sanitizedName = sanitizeInput(name.trim());

      const existing = await env.DB.prepare(
        parent_id 
          ? 'SELECT id FROM folders WHERE name = ? AND parent_id = ?'
          : 'SELECT id FROM folders WHERE name = ? AND parent_id IS NULL'
      ).bind(...(parent_id ? [sanitizedName, parent_id] : [sanitizedName])).first();

      if (existing) {
        return jsonResponse({ success: false, message: '该文件夹已存在' }, 400);
      }

      const folderId = crypto.randomUUID();

      await env.DB.prepare(
        `INSERT INTO folders (id, name, parent_id, created_by, created_at) 
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(
        folderId,
        sanitizedName,
        parent_id || null,
        authResult.user.userId
      ).run();

      return jsonResponse({
        success: true,
        message: '文件夹创建成功',
        folder: { id: folderId, name: sanitizedName, parent_id: parent_id || null }
      });

    } catch (error) {
      console.error('Create folder error:', error);
      return jsonResponse({ success: false, message: '创建文件夹失败: ' + error.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// ================================================================================
// 12. 管理员文件夹操作（重命名/删除）
// ================================================================================

async function handleAdminFolderAction(request, env, path) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  const folderId = path.split('/').pop();

  if (request.method === 'GET') {
    try {
      const folder = await env.DB.prepare(
        'SELECT * FROM folders WHERE id = ?'
      ).bind(folderId).first();

      if (!folder) {
        return jsonResponse({ success: false, message: '文件夹不存在' }, 404);
      }

      const breadcrumbs = await getFolderBreadcrumbs(env, folderId);

      return jsonResponse({
        success: true,
        folder: folder,
        breadcrumbs: breadcrumbs
      });

    } catch (error) {
      console.error('Get folder error:', error);
      return jsonResponse({ success: false, message: '获取文件夹失败' }, 500);
    }
  }

  if (request.method === 'PUT') {
    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
      }

      const { name } = body;

      if (!name || name.trim() === '') {
        return jsonResponse({ success: false, message: '文件夹名称不能为空' }, 400);
      }

      const sanitizedName = sanitizeInput(name.trim());

      const folder = await env.DB.prepare(
        'SELECT * FROM folders WHERE id = ?'
      ).bind(folderId).first();

      if (!folder) {
        return jsonResponse({ success: false, message: '文件夹不存在' }, 404);
      }

      const existing = await env.DB.prepare(
        folder.parent_id 
          ? 'SELECT id FROM folders WHERE name = ? AND parent_id = ? AND id != ?'
          : 'SELECT id FROM folders WHERE name = ? AND parent_id IS NULL AND id != ?'
      ).bind(...(folder.parent_id ? [sanitizedName, folder.parent_id, folderId] : [sanitizedName, folderId])).first();

      if (existing) {
        return jsonResponse({ success: false, message: '该文件夹名已存在' }, 400);
      }

      await env.DB.prepare(
        'UPDATE folders SET name = ? WHERE id = ?'
      ).bind(sanitizedName, folderId).run();

      return jsonResponse({ success: true, message: '文件夹已重命名' });

    } catch (error) {
      console.error('Rename folder error:', error);
      return jsonResponse({ success: false, message: '重命名失败' }, 500);
    }
  }

  if (request.method === 'DELETE') {
    try {
      const folder = await env.DB.prepare(
        'SELECT * FROM folders WHERE id = ?'
      ).bind(folderId).first();

      if (!folder) {
        return jsonResponse({ success: false, message: '文件夹不存在' }, 404);
      }

      const filesInFolder = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM files WHERE folder_id = ?'
      ).bind(folderId).first();

      const subFolders = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM folders WHERE parent_id = ?'
      ).bind(folderId).first();

      if ((filesInFolder?.count || 0) > 0 || (subFolders?.count || 0) > 0) {
        return jsonResponse({ 
          success: false, 
          message: '文件夹不为空，请先删除或移动其中的文件和子文件夹' 
        }, 400);
      }

      await env.DB.prepare(
        'DELETE FROM folders WHERE id = ?'
      ).bind(folderId).run();

      return jsonResponse({ success: true, message: '文件夹已删除' });

    } catch (error) {
      console.error('Delete folder error:', error);
      return jsonResponse({ success: false, message: '删除失败' }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

async function getFolderBreadcrumbs(env, folderId) {
  const breadcrumbs = [];
  let currentId = folderId;

  while (currentId) {
    const folder = await env.DB.prepare(
      'SELECT id, name, parent_id FROM folders WHERE id = ?'
    ).bind(currentId).first();

    if (folder) {
      breadcrumbs.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parent_id;
    } else {
      break;
    }
  }

  return breadcrumbs;
}

// ================================================================================
// 13. 大文件上传 - Multipart Upload（初始化）
// ================================================================================

async function handleUploadInit(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { filename, fileSize, contentType } = body;

    if (!filename) {
      return jsonResponse({ success: false, message: '文件名不能为空' }, 400);
    }

    const sanitizedFilename = sanitizeInput(filename);
    const fileId = crypto.randomUUID();
    const ext = sanitizedFilename.split('.').pop() || 'bin';
    const storagePath = `uploads/${fileId}.${ext}`;

    const multipartUpload = await env.R2.createMultipartUpload(storagePath, {
      httpMetadata: {
        contentType: contentType || 'application/octet-stream',
      },
      customMetadata: {
        originalName: sanitizedFilename,
        uploadedBy: String(authResult.user.userId),
      },
    });

    return jsonResponse({
      success: true,
      uploadId: multipartUpload.uploadId,
      fileId: fileId,
      storagePath: storagePath,
      filename: sanitizedFilename,
      fileSize: fileSize,
      ext: ext
    });

  } catch (error) {
    console.error('Upload init error:', error);
    return jsonResponse({ success: false, message: '初始化上传失败: ' + error.message }, 500);
  }
}

// ================================================================================
// 14. 大文件上传 - Multipart Upload（上传分片）
// ================================================================================

async function handleUploadPart(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    const url = new URL(request.url);
    const uploadId = url.searchParams.get('uploadId');
    const partNumber = parseInt(url.searchParams.get('partNumber'));
    const storagePath = url.searchParams.get('storagePath');

    if (!uploadId || !partNumber || !storagePath) {
      return jsonResponse({ success: false, message: '缺少必要参数' }, 400);
    }

    const multipartUpload = env.R2.resumeMultipartUpload(storagePath, uploadId);

    const partData = await request.arrayBuffer();
    const uploadedPart = await multipartUpload.uploadPart(partNumber, partData);

    return jsonResponse({
      success: true,
      partNumber: partNumber,
      etag: uploadedPart.etag
    });

  } catch (error) {
    console.error('Upload part error:', error);
    return jsonResponse({ success: false, message: '分片上传失败: ' + error.message }, 500);
  }
}

// ================================================================================
// 15. 大文件上传 - Multipart Upload（完成上传）
// ================================================================================

async function handleUploadComplete(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { uploadId, storagePath, fileId, filename, fileSize, ext, parts } = body;

    if (!uploadId || !storagePath || !parts || !Array.isArray(parts)) {
      return jsonResponse({ success: false, message: '缺少必要参数' }, 400);
    }

    const multipartUpload = env.R2.resumeMultipartUpload(storagePath, uploadId);
    
    await multipartUpload.complete(parts);

    await env.DB.prepare(
      `INSERT INTO files (id, name, type, size, storage_path, downloads, uploaded_by, created_at) 
       VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))`
    ).bind(
      fileId,
      sanitizeInput(filename),
      ext,
      fileSize,
      storagePath,
      authResult.user.userId
    ).run();

    return jsonResponse({
      success: true,
      message: '文件上传成功',
      file: { id: fileId, name: filename, type: ext, size: fileSize }
    });

  } catch (error) {
    console.error('Upload complete error:', error);
    return jsonResponse({ success: false, message: '完成上传失败: ' + error.message }, 500);
  }
}

// ================================================================================
// 16. 大文件上传 - Multipart Upload（取消上传）
// ================================================================================

async function handleUploadAbort(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { uploadId, storagePath } = body;

    if (!uploadId || !storagePath) {
      return jsonResponse({ success: false, message: '缺少必要参数' }, 400);
    }

    const multipartUpload = env.R2.resumeMultipartUpload(storagePath, uploadId);
    await multipartUpload.abort();

    return jsonResponse({
      success: true,
      message: '上传已取消'
    });

  } catch (error) {
    console.error('Upload abort error:', error);
    return jsonResponse({ success: false, message: '取消上传失败: ' + error.message }, 500);
  }
}

// ================================================================================
// 17. 管理员文件操作（下载/删除）
// ================================================================================

async function handleAdminFileAction(request, env, path) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  const fileId = path.split('/').pop();

  if (request.method === 'GET') {
    try {
      const file = await env.DB.prepare(
        'SELECT * FROM files WHERE id = ?'
      ).bind(fileId).first();

      if (!file) {
        return jsonResponse({ success: false, message: '文件不存在' }, 404);
      }

      await env.DB.prepare(
        'UPDATE files SET downloads = downloads + 1 WHERE id = ?'
      ).bind(fileId).run();

      if (env.R2 && file.storage_path) {
        const object = await env.R2.get(file.storage_path);
        
        if (object) {
          const headers = new Headers();
          headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
          headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
          headers.set('Access-Control-Allow-Origin', '*');
          
          return new Response(object.body, { headers });
        }
      }

      return jsonResponse({
        success: true,
        file: file,
        message: '文件元数据（R2中无实际文件）'
      });

    } catch (error) {
      console.error('Download error:', error);
      return jsonResponse({ success: false, message: '下载失败' }, 500);
    }
  }

  if (request.method === 'DELETE') {
    try {
      const file = await env.DB.prepare(
        'SELECT * FROM files WHERE id = ?'
      ).bind(fileId).first();

      if (!file) {
        return jsonResponse({ success: false, message: '文件不存在' }, 404);
      }

      if (env.R2 && file.storage_path) {
        try {
          await env.R2.delete(file.storage_path);
        } catch (e) {
          console.warn('R2 delete warning:', e);
        }
      }

      await env.DB.prepare(
        'DELETE FROM files WHERE id = ?'
      ).bind(fileId).run();

      return jsonResponse({ success: true, message: '文件已删除' });

    } catch (error) {
      console.error('Delete file error:', error);
      return jsonResponse({ success: false, message: '删除失败' }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// ================================================================================
// 18. 管理员统计信息
// ================================================================================

async function handleAdminStats(request, env, ctx) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    // Parallelize independent database queries for better performance
    const [
      fileCount,
      totalSize,
      totalDownloads,
      lastUpload,
      userCount,
      todayUV
    ] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count FROM files').first(),
      env.DB.prepare('SELECT SUM(size) as total FROM files').first(),
      env.DB.prepare('SELECT SUM(downloads) as total FROM files').first(),
      env.DB.prepare('SELECT created_at FROM files ORDER BY created_at DESC LIMIT 1').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM users').first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT visitor_id) as count FROM unique_visitors WHERE date = date('now')`).first()
    ]);

    return jsonResponse({
      success: true,
      stats: {
        fileCount: fileCount?.count || 0,
        totalSize: totalSize?.total || 0,
        totalDownloads: totalDownloads?.total || 0,
        lastUpload: lastUpload?.created_at || null,
        userCount: userCount?.count || 0,
        todayUV: todayUV?.count || 0
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    return jsonResponse({ success: false, message: '获取统计失败' }, 500);
  }
}

// ================================================================================
// 19. 管理员修改密码
// ================================================================================

async function handleAdminChangePassword(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return jsonResponse({ success: false, message: '请输入旧密码和新密码' }, 400);
    }

    if (!validatePassword(newPassword)) {
      return jsonResponse({ success: false, message: '新密码至少需要8个字符' }, 400);
    }

    const oldHash = await hashAdminPassword(oldPassword);
    const newHash = await hashAdminPassword(newPassword);

    const result = await env.DB.prepare(
      'UPDATE admin_users SET password_hash = ? WHERE id = ? AND password_hash = ?'
    ).bind(newHash, authResult.user.userId, oldHash).run();

    if (result.changes === 0) {
      return jsonResponse({ success: false, message: '原密码错误' }, 400);
    }

    return jsonResponse({ success: true, message: '密码修改成功' });

  } catch (error) {
    console.error('Change password error:', error);
    return jsonResponse({ success: false, message: '修改失败' }, 500);
  }
}

// ================================================================================
// 邮件发送 (Resend)
// ================================================================================

async function sendRegistrationEmail(username, email, ip, env) {
  console.log('=== sendRegistrationEmail called ===');

  const RESEND_API_KEY = env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return;
  }

  const sanitizedUsername = sanitizeInput(username);
  const sanitizedEmail = sanitizeInput(email);

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
        subject: '🎉 AGI Era 新用户注册通知',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0b; color: #fafafa;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #00d4ff; margin: 0;">AGI Era</h1>
              <p style="color: #71717a; margin-top: 5px;">新用户注册通知</p>
            </div>
            <div style="background: #18181b; padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: #71717a;">用户名</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fafafa; text-align: right; font-weight: 600;">${sanitizedUsername}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: #71717a;">邮箱</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: #00d4ff; text-align: right;">${sanitizedEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: #71717a;">IP 地址</td>
                  <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); color: #fafafa; text-align: right; font-family: monospace;">${ip}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #71717a;">注册时间</td>
                  <td style="padding: 12px 0; color: #fafafa; text-align: right;">${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
                </tr>
              </table>
            </div>
            <p style="text-align: center; color: #71717a; font-size: 12px; margin-top: 24px;">此邮件由系统自动发送</p>
          </div>
        `,
      }),
    });
    
    console.log('Admin notification sent');
  } catch (error) {
    console.error('Admin email exception:', error);
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AGI Era <noreply@agiera.net>',
        to: [sanitizedEmail],
        subject: '🚀 欢迎加入 AGI Era',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0b; color: #fafafa;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #00d4ff; margin: 0;">AGI Era</h1>
              <p style="color: #71717a; margin-top: 5px;">欢迎加入我们</p>
            </div>
            <div style="background: #18181b; padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
              <p style="color: #fafafa; font-size: 16px; margin: 0 0 16px 0;">Hi ${sanitizedUsername}，</p>
              <p style="color: #a1a1aa; line-height: 1.6; margin: 0 0 16px 0;">感谢你注册 AGI Era！你的账号已创建成功。</p>
              <p style="color: #a1a1aa; line-height: 1.6; margin: 0 0 24px 0;">现在你可以使用我们的 AI 助手、探索最新的 AGI 技术资讯，开启你的智能时代之旅。</p>
              <div style="text-align: center;">
                <a href="https://agiera.net" style="display: inline-block; background: linear-gradient(135deg, #00d4ff, #0099cc); color: #000; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">开始探索</a>
              </div>
            </div>
            <p style="text-align: center; color: #71717a; font-size: 12px; margin-top: 24px;">如果你没有注册过 AGI Era，请忽略此邮件</p>
          </div>
        `,
      }),
    });
    
    console.log('Welcome email sent to:', sanitizedEmail);
  } catch (error) {
    console.error('User email exception:', error);
  }
}

// ================================================================================
// 工具函数 - 密码哈希（增强安全）
// ================================================================================

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.randomUUID().substring(0, 16);
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hash}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) {
    const legacyHash = await legacyHashPassword(password);
    return legacyHash === storedHash;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return computedHash === hash;
}

async function legacyHashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'agi-era-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// ================================================================================
// 工具函数 - 管理员密码
// ================================================================================

async function hashAdminPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return btoa(String.fromCharCode(...hashArray));
}

// ================================================================================
// 工具函数 - 管理员 JWT Token（增强验证）
// ================================================================================

async function createAdminToken(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const body = btoa(JSON.stringify({ ...payload, exp }));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${body}`)
  );

  return `${header}.${body}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

async function verifyAdminToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    const payload = JSON.parse(atob(body));

    if (payload.exp < Date.now()) {
      return null;
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBuffer = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      new TextEncoder().encode(`${header}.${body}`)
    );

    return isValid ? payload : null;
  } catch {
    return null;
  }
}

// ================================================================================
// 工具函数 - 验证管理员请求
// ================================================================================

async function verifyAdminAuth(request, env) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, message: '请先登录' };
  }

  const token = authHeader.slice(7);
  const payload = await verifyAdminToken(token, env.JWT_SECRET || 'agiera-default-jwt-secret-2024');

  if (!payload) {
    return { success: false, message: 'Token 已过期或无效，请重新登录' };
  }

  return { success: true, user: payload };
}

// ================================================================================
// 工具函数 - 生成访客ID
// ================================================================================

async function generateVisitorId(ip, userAgent) {
  const data = `${ip}-${userAgent}-${Date.now().toString(36)}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}
