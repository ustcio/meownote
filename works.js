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
// - https://api.ustc.dev (自定义域名)
// - https://visitor-stats.metanext.workers.dev (Workers域名)
//
// ================================================================================

function getBeijingDate(date = new Date()) {
  return date.toLocaleDateString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
}

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
  },
  
  // Cron Trigger - 每60秒执行一次金价爬取
  async scheduled(event, env, ctx) {
    const now = Date.now();
    console.log('[Cron] Triggered at:', now);
    
    switch (event.cron) {
      case '*/1 * * * *': // 每分钟执行
        console.log('[Cron] Starting gold price crawl...');
        ctx.waitUntil(scheduledGoldCrawlWithRetry(event, env, ctx));
        break;
      case '*/5 * * * *': // 每5分钟执行分析
        console.log('[Cron] Starting gold price analysis...');
        ctx.waitUntil(scheduledGoldAnalysis(env, ctx));
        break;
      default:
        console.log('[Cron] Unknown cron pattern:', event.cron);
        ctx.waitUntil(scheduledGoldCrawlWithRetry(event, env, ctx));
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
  '/api/gold/stream': { handler: handleGoldPriceStream },
  '/api/gold/history': { handler: handleGoldHistory },
  '/api/gold/alert/test': { handler: handleGoldAlertTest },
  '/api/gold/analysis': { handler: handleGoldAnalysis },
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
  '/api/trading/login': { handler: handleTradingLogin },
  '/api/trading/verify': { handler: handleTradingVerify },
  '/api/trading/buy': { handler: handleBuyTransaction },
  '/api/trading/sell': { handler: handleSellTransaction },
  '/api/trading/transactions': { handler: handleGetTransactions },
  '/api/trading/stats': { handler: handleGetTransactionStats },
  '/api/trading/alerts': { handler: handleGetAlerts },
  '/api/trading/alert': { handler: handleCreateAlert },
  '/api/trading/notifications': { handler: handleGetNotifications },
};

// ================================================================================
// CORS 处理
// ================================================================================

const ALLOWED_ORIGINS = [
  'https://ustc.dev',
  'https://www.ustc.dev',
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Cache-Control',
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
  },
  // Cloudflare Workers AI - Llama 3
  'llama-3-8b': {
    provider: 'workers-ai',
    model: '@cf/meta/llama-3-8b-instruct',
    maxTokens: 2000,
    temperature: 0.7
  },
  'llama-3.1-8b': {
    provider: 'workers-ai',
    model: '@cf/meta/llama-3.1-8b-instruct',
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

  // Handle Workers AI models
  if (config.provider === 'workers-ai') {
    return await handleWorkersAIChat(env, config, message, history, model);
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

async function handleWorkersAIChat(env, config, message, history, model) {
  const requestStartTime = Date.now();
  console.log('[Workers AI] Using model:', config.model);
  
  try {
    const optimizedHistory = history
      .slice(-5)
      .map(h => ({
        role: h.role || 'user',
        content: h.content?.slice(0, 1000) || ''
      }));

    const messages = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      ...optimizedHistory,
      { role: 'user', content: sanitizeInput(message) }
    ];

    const aiStartTime = Date.now();
    
    const result = await env.AI.run(config.model, {
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature
    });

    const aiLatency = Date.now() - aiStartTime;
    const totalLatency = Date.now() - requestStartTime;
    
    console.log('[Workers AI] Response received, latency:', aiLatency + 'ms');
    console.log('[Workers AI] Result:', JSON.stringify(result).substring(0, 200));

    if (result.response) {
      return jsonResponse({
        success: true,
        reply: result.response,
        model: model,
        usage: result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        latency: {
          provider: aiLatency,
          total: totalLatency
        }
      });
    }

    console.error('[Workers AI] Unexpected response:', result);
    return jsonResponse({
      success: false,
      message: 'Unexpected response from Workers AI'
    }, 500);

  } catch (error) {
    console.error('[Workers AI] Error:', error);
    return jsonResponse({
      success: false,
      message: 'Workers AI error: ' + error.message
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
  const today = getBeijingDate();

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
    const today = getBeijingDate();

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

// 爬取国内金价（黄金T+D）
async function crawlSGEData() {
  try {
    console.log('[Crawl] Fetching SGE data...');
    
    // 使用金投网 m黄金T+D API - JO_92226
    const jtwUrl = 'https://api.jijinhao.com/quoteCenter/realTime.htm?codes=JO_92226';
    
    const response = await fetch(jtwUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*',
        'Referer': 'https://quote.cngold.org/'
      }
    });
    
    console.log('[Crawl] SGE response status:', response.status);
    
    if (response.ok) {
      const text = await response.text();
      console.log('[Crawl] SGE response text length:', text.length);
      
      const match = text.match(/var\s+quote_json\s*=\s*(\{[\s\S]*?\});?\s*$/);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          console.log('[Crawl] SGE data flag:', data.flag);
          
          if (data.flag && data.JO_92226) {
            const quote = data.JO_92226;
            console.log('[Crawl] SGE quote:', { name: quote.showName, price: quote.q63 });
            
            const price = parseFloat(quote.q63);
            const open = parseFloat(quote.q1) || price;
            const high = parseFloat(quote.q3) || price;
            const low = parseFloat(quote.q4) || price;
            const prevClose = parseFloat(quote.q2);
            
            if (price > 0) {
              const change = price - prevClose;
              const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
              
              return {
                price: price,
                open: open,
                high: high,
                low: low,
                prevClose: prevClose,
                change: change,
                changePercent: changePercent,
                source: 'JTW-mAuT+D',
                timestamp: Date.now()
              };
            }
          }
        } catch (parseError) {
          console.error('[Crawl] SGE JSON parse error:', parseError.message);
        }
      } else {
        console.error('[Crawl] SGE regex match failed, response preview:', text.substring(0, 200));
      }
    }
    
    console.error('[Crawl] Failed to fetch SGE data, using fallback');
    // 返回模拟数据作为 fallback
    return {
      price: 1109.99,
      open: 1110.0,
      high: 1118.8,
      low: 1103.0,
      prevClose: 1123.84,
      change: -13.85,
      changePercent: -1.23,
      source: 'Fallback-mAuT+D',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[Crawl] SGE error:', error.message);
    // 返回模拟数据作为 fallback
    return {
      price: 1109.99,
      open: 1110.0,
      high: 1118.8,
      low: 1103.0,
      prevClose: 1123.84,
      change: -13.85,
      changePercent: -1.23,
      source: 'Fallback-mAuT+D',
      timestamp: Date.now()
    };
  }
}

// 爬取国际金价（现货黄金 XAU）
async function crawlInternationalPrice() {
  try {
    console.log('[Crawl] Fetching XAU data...');
    
    // 使用金投网现货黄金 API - JO_92233 是现货黄金(XAU)
    const jtwUrl = 'https://api.jijinhao.com/quoteCenter/realTime.htm?codes=JO_92233';
    
    const response = await fetch(jtwUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/javascript, */*',
        'Referer': 'https://quote.cngold.org/'
      }
    });
    
    console.log('[Crawl] XAU response status:', response.status);
    
    if (response.ok) {
      const text = await response.text();
      console.log('[Crawl] XAU response text length:', text.length);
      
      const match = text.match(/var\s+quote_json\s*=\s*(\{[\s\S]*?\});?\s*$/);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          console.log('[Crawl] XAU data flag:', data.flag);
          
          if (data.flag && data.JO_92233) {
            const quote = data.JO_92233;
            console.log('[Crawl] XAU quote:', { name: quote.showName, code: quote.showCode, price: quote.q63 });
            
            const price = parseFloat(quote.q63);
            const open = parseFloat(quote.q1);
            const high = parseFloat(quote.q3);
            const low = parseFloat(quote.q4);
            const prevClose = parseFloat(quote.q2);
            const change = parseFloat(quote.q70);
            const changePercent = parseFloat(quote.q80);
            
            if (price > 0) {
              return {
                price: price,
                open: open,
                high: high,
                low: low,
                change: change,
                changePercent: changePercent,
                source: 'JTW-XAU',
                timestamp: Date.now()
              };
            }
          }
        } catch (parseError) {
          console.error('[Crawl] XAU JSON parse error:', parseError.message);
        }
      } else {
        console.error('[Crawl] XAU regex match failed, response preview:', text.substring(0, 200));
      }
    }
    
    console.error('[Crawl] Failed to fetch XAU data, using fallback');
    // 返回模拟数据作为 fallback
    return {
      price: 4936.51,
      open: 4992.18,
      high: 4999.86,
      low: 4861.99,
      change: -54.34,
      changePercent: -1.09,
      source: 'Fallback-XAU',
      timestamp: Date.now()
    };
    
  } catch (error) {
    console.error('[Crawl] XAU error:', error.message);
    // 返回模拟数据作为 fallback
    return {
      price: 4936.51,
      open: 4992.18,
      high: 4999.86,
      low: 4861.99,
      change: -54.34,
      changePercent: -1.09,
      source: 'Fallback-XAU',
      timestamp: Date.now()
    };
  }
}

// 获取 USD/CNY 汇率
async function getExchangeRate() {
  try {
    console.log('[Crawl] Fetching exchange rate...');
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    console.log('[Crawl] Exchange rate response status:', response.status);
    if (response.ok) {
      const data = await response.json();
      const rate = data.rates?.CNY || 7.25;
      console.log('[Crawl] Exchange rate:', rate);
      return rate;
    }
  } catch (e) {
    console.error('[Crawl] Exchange rate error:', e.message);
  }
  console.log('[Crawl] Using default exchange rate: 7.25');
  return 7.25;
}

// 执行爬取任务
async function performCrawl(env) {
  if (goldPriceCache.isCrawling) {
    console.log('[Gold Crawler] Already crawling, waiting...');
    // 等待当前爬取完成
    let attempts = 0;
    while (goldPriceCache.isCrawling && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    return goldPriceCache.data;
  }
  
  goldPriceCache.isCrawling = true;
  console.log('[Gold Crawler] Starting crawl at', new Date().toISOString());
  
  try {
    // 并行爬取数据，使用 Promise.allSettled 防止一个失败影响其他
    const [sgeResult, intlResult, rateResult] = await Promise.allSettled([
      crawlSGEData(),
      crawlInternationalPrice(),
      getExchangeRate()
    ]);
    
    const sgeData = sgeResult.status === 'fulfilled' ? sgeResult.value : null;
    const intlData = intlResult.status === 'fulfilled' ? intlResult.value : null;
    const exchangeRate = rateResult.status === 'fulfilled' ? rateResult.value : 7.25;
    
    if (!sgeData) console.error('[Gold Crawler] SGE data fetch failed');
    if (!intlData) console.error('[Gold Crawler] International data fetch failed');
    
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
        source: sgeData.source
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
    
    // 如果都没有获取到，返回错误状态
    if (!domestic || !international) {
      console.error('[Gold Crawler] Failed to fetch any data');
      return {
        success: false,
        error: 'Failed to fetch gold price data from all sources',
        timestamp: Date.now(),
        domestic: domestic || null,
        international: international || null
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
        expirationTtl: 60
      });
      
      // 存储历史数据
      const historyKey = `history:${getBeijingDate()}`;
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
    console.log(`[Gold Crawler] Domestic: ${domestic.price} (${domestic.source})`);
    console.log(`[Gold Crawler] International: ${international.price} (${international.source})`);
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

// HTTP 处理函数 - 支持按日期查询金价数据
async function handleGoldPrice(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const queryDate = url.searchParams.get('date');
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    
    const today = getBeijingDate();
    const targetDate = queryDate || today;
    
    console.log('[Gold Price] Request for date:', targetDate);
    
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
  const today = getBeijingDate();
  
  if (!forceRefresh && env?.GOLD_PRICE_CACHE) {
    try {
      const cached = await env.GOLD_PRICE_CACHE.get('latest');
      if (cached) {
        const data = JSON.parse(cached);
        const cacheAge = Date.now() - (data.cachedAt || 0);
        
        if (cacheAge < 10000) {
          console.log('[Gold Price] Returning cached data, age:', cacheAge, 'ms');
          const history = await getDayHistory(env, today);
          return jsonResponse({
            ...data,
            history: history,
            fromCache: true,
            cacheAge: cacheAge
          });
        }
      }
    } catch (e) {
      console.log('[Gold Price] Cache read failed:', e.message);
    }
  }
  
  console.log('[Gold Price] Fetching real-time data...');
  const data = await performCrawl(env);
  
  if (!data.success) {
    if (env?.GOLD_PRICE_CACHE) {
      try {
        const cached = await env.GOLD_PRICE_CACHE.get('latest');
        if (cached) {
          const cachedData = JSON.parse(cached);
          const history = await getDayHistory(env, today);
          return jsonResponse({
            ...cachedData,
            history: history,
            fromCache: true,
            stale: true,
            error: data.error
          });
        }
      } catch (e) {}
    }
    
    return jsonResponse({
      success: false,
      error: data.error || 'Failed to fetch gold price',
      timestamp: Date.now()
    }, 503);
  }
  
  if (env?.GOLD_PRICE_CACHE) {
    await storeGoldPriceData(env, data);
  }
  
  if (data.success && data.domestic && data.international) {
    const history = await getDayHistory(env, today);
    ctx.waitUntil(sendGoldPriceAlert(data.domestic, data.international, history, env));
  }
  
  const history = await getDayHistory(env, today);
  return jsonResponse({
    ...data,
    history: history,
    fromCache: false
  });
}

async function handleHistoricalGoldPrice(env, targetDate) {
  const today = getBeijingDate();
  const yesterday = getBeijingDate(new Date(Date.now() - 86400000));
  
  if (targetDate !== yesterday && targetDate !== today) {
    return jsonResponse({
      success: false,
      error: 'Only today and yesterday data are available',
      timestamp: Date.now()
    }, 400);
  }
  
  const dayStats = await env?.GOLD_PRICE_CACHE?.get(`stats:${targetDate}`);
  const history = await getDayHistory(env, targetDate);
  
  if (!dayStats && (!history || history.domestic.length === 0)) {
    return jsonResponse({
      success: false,
      error: 'No data available for this date',
      date: targetDate,
      timestamp: Date.now()
    }, 404);
  }
  
  const stats = dayStats ? JSON.parse(dayStats) : {};
  
  const latestEntry = history.domestic.length > 0 ? {
    domestic: history.domestic[history.domestic.length - 1],
    international: history.international[history.international.length - 1]
  } : null;
  
  return jsonResponse({
    success: true,
    date: targetDate,
    timestamp: stats.lastUpdate || Date.now(),
    domestic: {
      price: latestEntry?.domestic || stats.domesticHigh || 0,
      open: stats.domesticOpen || stats.domesticHigh || 0,
      high: stats.domesticHigh || 0,
      low: stats.domesticLow || 0,
      changePercent: stats.domesticChange || 0,
      source: stats.source || 'Historical'
    },
    international: {
      price: latestEntry?.international || stats.internationalHigh || 0,
      open: stats.internationalOpen || stats.internationalHigh || 0,
      high: stats.internationalHigh || 0,
      low: stats.internationalLow || 0,
      changePercent: stats.internationalChange || 0,
      source: stats.source || 'Historical'
    },
    history: history,
    fromCache: true
  });
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
    
    const labels = history.map(h => {
      const date = new Date(h.timestamp);
      return date.toLocaleTimeString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
    });
    
    return {
      labels: labels,
      domestic: history.map(h => h.domestic),
      international: history.map(h => h.international)
    };
  } catch (e) {
    console.error('[History] Failed to get history:', e.message);
    return { labels: [], domestic: [], international: [] };
  }
}

// SSE 实时推送端点
async function handleGoldPriceStream(request, env, ctx) {
  const url = new URL(request.url);
  const clientId = crypto.randomUUID();
  
  console.log(`[SSE] Client connected: ${clientId}`);
  
  const stream = new ReadableStream({
    start(controller) {
      // 发送初始数据
      const sendData = async () => {
        try {
          let data = null;
          let fromCache = false;
          
          // 尝试从 KV 获取最新数据
          if (env?.GOLD_PRICE_CACHE) {
            try {
              const cached = await env.GOLD_PRICE_CACHE.get('latest');
              if (cached) {
                data = JSON.parse(cached);
                fromCache = true;
                console.log(`[SSE] Data from KV for client: ${clientId}`);
              }
            } catch (kvError) {
              console.warn(`[SSE] KV read failed for client ${clientId}:`, kvError.message);
            }
          }
          
          // 如果 KV 没有数据，尝试内存缓存
          if (!data && goldPriceCache.data) {
            data = goldPriceCache.data;
            fromCache = true;
            console.log(`[SSE] Data from memory cache for client: ${clientId}`);
          }
          
          // 如果没有缓存，执行爬取
          if (!data) {
            console.log(`[SSE] No cache, crawling for client: ${clientId}`);
            data = await performCrawl(env);
            fromCache = false;
          }
          
          const message = `data: ${JSON.stringify({
            type: 'price_update',
            clientId: clientId,
            timestamp: Date.now(),
            fromCache: fromCache,
            data: data
          })}\n\n`;
          
          controller.enqueue(new TextEncoder().encode(message));
        } catch (error) {
          console.error(`[SSE] Error for client ${clientId}:`, error.message);
          const errorMessage = `data: ${JSON.stringify({
            type: 'error',
            clientId: clientId,
            timestamp: Date.now(),
            error: error.message
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorMessage));
        }
      };
      
      // 立即发送一次数据
      sendData();
      
      // 每30秒推送一次
      const intervalId = setInterval(sendData, 30000);
      
      // 清理函数
      ctx.waitUntil(new Promise((resolve) => {
        // 当客户端断开时清理
        request.signal.addEventListener('abort', () => {
          clearInterval(intervalId);
          console.log(`[SSE] Client disconnected: ${clientId}`);
          resolve();
        });
      }));
    },
    
    cancel() {
      console.log(`[SSE] Stream cancelled for client: ${clientId}`);
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

// 定时爬取入口（用于 Cron Trigger）- 带重试机制
async function scheduledGoldCrawlWithRetry(event, env, ctx) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000; // 5秒
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[Scheduled] Attempt ${attempt}/${MAX_RETRIES} at`, new Date().toISOString());
    
    try {
      const result = await performCrawl(env);
      
      if (result.success) {
        console.log('[Scheduled] Crawl successful');
        
        await storeGoldPriceData(env, result);
        await logCrawlStatus(env, 'success', result);
        
        return result;
      } else {
        console.error('[Scheduled] Crawl failed:', result.error);
        
        if (attempt < MAX_RETRIES) {
          console.log(`[Scheduled] Retrying in ${RETRY_DELAY}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        } else {
          await logCrawlStatus(env, 'failed', result);
          throw new Error(result.error || 'Crawl failed after max retries');
        }
      }
    } catch (error) {
      console.error(`[Scheduled] Attempt ${attempt} error:`, error.message);
      
      if (attempt < MAX_RETRIES) {
        console.log(`[Scheduled] Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      } else {
        console.error('[Scheduled] All retries exhausted');
        await logCrawlStatus(env, 'error', { error: error.message });
        throw error;
      }
    }
  }
}

async function scheduledGoldAnalysis(env, ctx) {
  console.log('[Scheduled Analysis] Starting gold price analysis...');
  
  try {
    const result = await performGoldAnalysis(env);
    
    if (!result.success) {
      console.error('[Scheduled Analysis] Analysis failed:', result.error);
      await logAnalysisStatus(env, 'failed', result);
      return;
    }
    
    console.log('[Scheduled Analysis] Analysis completed successfully');
    await logAnalysisStatus(env, 'success', result);
    
    const shouldNotify = result.analysis.domestic.signal.isBuySignal || 
                         result.analysis.international.signal.isBuySignal;
    
    if (shouldNotify) {
      const lastNotifyKey = 'last_analysis_notify';
      const lastNotify = await env.GOLD_PRICE_CACHE.get(lastNotifyKey);
      const now = Date.now();
      const COOLDOWN = 30 * 60 * 1000;
      
      if (!lastNotify || (now - parseInt(lastNotify)) > COOLDOWN) {
        console.log('[Scheduled Analysis] Buy signal detected, sending notifications...');
        await sendAnalysisNotification(result.analysis, env);
        await env.GOLD_PRICE_CACHE.put(lastNotifyKey, String(now), { expirationTtl: 3600 });
      } else {
        console.log('[Scheduled Analysis] Buy signal detected but in cooldown period');
      }
    }
    
  } catch (error) {
    console.error('[Scheduled Analysis] Error:', error);
    await logAnalysisStatus(env, 'error', { error: error.message });
  }
}

async function logAnalysisStatus(env, status, data) {
  if (!env?.GOLD_PRICE_CACHE) return;
  
  const today = getBeijingDate();
  const logKey = `analysis_log:${today}`;
  
  try {
    let logs = [];
    const existing = await env.GOLD_PRICE_CACHE.get(logKey);
    if (existing) logs = JSON.parse(existing);
    
    logs.push({
      timestamp: Date.now(),
      status,
      recommendation: data.analysis?.overallRecommendation || null,
      domesticBuyScore: data.analysis?.domestic?.signal?.buyScore || null,
      internationalBuyScore: data.analysis?.international?.signal?.buyScore || null,
      error: data.error || null
    });
    
    if (logs.length > 288) logs = logs.slice(-288);
    
    await env.GOLD_PRICE_CACHE.put(logKey, JSON.stringify(logs), {
      expirationTtl: 86400 * 3
    });
  } catch (e) {
    console.error('[Analysis Log] Failed to save:', e);
  }
}

// 存储金价数据到 KV（数据保留至第三日开盘清除）
async function storeGoldPriceData(env, data) {
  if (!env?.GOLD_PRICE_CACHE) {
    console.warn('[Store] GOLD_PRICE_CACHE not configured, using memory cache only');
    goldPriceCache.data = { ...data, cachedAt: Date.now() };
    goldPriceCache.timestamp = Date.now();
    return;
  }
  
  try {
    const timestamp = Date.now();
    const dateKey = getBeijingDate();
    const THREE_DAYS_SECONDS = 3 * 24 * 60 * 60;
    
    try {
      await env.GOLD_PRICE_CACHE.put('latest', JSON.stringify({
        ...data,
        cachedAt: timestamp,
        date: dateKey
      }), { expirationTtl: 60 });
    } catch (kvError) {
      console.warn('[Store] Failed to store latest data to KV:', kvError.message);
      goldPriceCache.data = { ...data, cachedAt: timestamp };
      goldPriceCache.timestamp = timestamp;
    }
    
    try {
      const historyKey = `history:${dateKey}`;
      let history = [];
      try {
        const existing = await env.GOLD_PRICE_CACHE.get(historyKey);
        if (existing) {
          history = JSON.parse(existing);
        }
      } catch (e) {
        console.log('[Store] No existing history in KV');
      }
      
      history.push({
        timestamp: timestamp,
        domestic: data.domestic?.price || 0,
        international: data.international?.price || 0,
        domesticChange: data.domestic?.changePercent || 0,
        internationalChange: data.international?.changePercent || 0
      });
      
      if (history.length > 1440) {
        history = history.slice(-1440);
      }
      
      await env.GOLD_PRICE_CACHE.put(historyKey, JSON.stringify(history), {
        expirationTtl: THREE_DAYS_SECONDS
      });
    } catch (kvError) {
      console.warn('[Store] Failed to store history to KV:', kvError.message);
    }
    
    try {
      const statsKey = `stats:${dateKey}`;
      let existingStats = {};
      try {
        const existing = await env.GOLD_PRICE_CACHE.get(statsKey);
        if (existing) {
          existingStats = JSON.parse(existing);
        }
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
    } catch (kvError) {
      console.warn('[Store] Failed to store stats to KV:', kvError.message);
    }
    
    console.log('[Store] Data stored successfully for date:', dateKey);
    
  } catch (error) {
    console.error('[Store] Failed to store data:', error);
    goldPriceCache.data = { ...data, cachedAt: Date.now() };
    goldPriceCache.timestamp = Date.now();
  }
}

// 记录爬取状态日志
async function logCrawlStatus(env, status, data) {
  const timestamp = Date.now();
  const logEntry = {
    timestamp: timestamp,
    status: status,
    data: status === 'success' ? {
      domesticPrice: data.domestic?.price,
      internationalPrice: data.international?.price,
      domesticSource: data.domestic?.source,
      internationalSource: data.international?.source
    } : data
  };
  
  console.log(`[Log] Crawl status: ${status}`, JSON.stringify(logEntry));
  
  // 如果配置了 KV，存储日志
  if (env?.GOLD_PRICE_CACHE) {
    try {
      const dateKey = getBeijingDate();
      const logKey = `logs:${dateKey}`;
      
      let logs = [];
      try {
        const existing = await env.GOLD_PRICE_CACHE.get(logKey);
        if (existing) {
          logs = JSON.parse(existing);
        }
      } catch (e) {
        // 没有现有日志或读取失败
        console.log('[Log] No existing logs in KV or read failed');
      }
      
      logs.push(logEntry);
      
      // 限制日志数量
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }
      
      try {
        await env.GOLD_PRICE_CACHE.put(logKey, JSON.stringify(logs), {
          expirationTtl: 86400
        });
      } catch (kvError) {
        console.warn('[Log] Failed to write log to KV:', kvError.message);
      }
    } catch (e) {
      console.error('[Log] Failed to store log:', e.message);
    }
  }
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
        from: 'AGI Era <noreply@ustc.dev>',
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
        from: 'AGI Era <noreply@ustc.dev>',
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
                <a href="https://ustc.dev" style="display: inline-block; background: linear-gradient(135deg, #00d4ff, #0099cc); color: #000; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">开始探索</a>
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
// 金价预警邮件 - 智能波动检测
// ================================================================================

const ALERT_CONFIG = {
  WINDOW_SIZE: 5,
  SHORT_TERM_MINUTES: 1,
  DOMESTIC_THRESHOLD: 5,
  INTERNATIONAL_THRESHOLD: 10,
  COOLDOWN_MINUTES: 1,
  ALERT_ON_RISE: false
};

async function sendGoldPriceAlert(domestic, international, history, env) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.log('[Gold Alert] RESEND_API_KEY not configured, skipping alert');
    return;
  }

  const alerts = [];
  
  const domesticWindow = analyzeWindow(history?.domestic || [], ALERT_CONFIG.DOMESTIC_THRESHOLD);
  const internationalWindow = analyzeWindow(history?.international || [], ALERT_CONFIG.INTERNATIONAL_THRESHOLD);
  
  const domesticShortTerm = analyzeShortTerm(history?.domestic || [], ALERT_CONFIG.DOMESTIC_THRESHOLD);
  const internationalShortTerm = analyzeShortTerm(history?.international || [], ALERT_CONFIG.INTERNATIONAL_THRESHOLD);
  
  if (domesticWindow.triggered) {
    alerts.push({
      type: 'window',
      name: '国内黄金 (mAuT+D)',
      price: domestic.price,
      unit: '元/克',
      ...domesticWindow
    });
  }
  
  if (internationalWindow.triggered) {
    alerts.push({
      type: 'window',
      name: '国际黄金 (XAU)',
      price: international.price,
      unit: '美元/盎司',
      ...internationalWindow
    });
  }
  
  if (domesticShortTerm.triggered) {
    alerts.push({
      type: 'short_term',
      name: '国内黄金 (mAuT+D)',
      price: domestic.price,
      unit: '元/克',
      ...domesticShortTerm
    });
  }
  
  if (internationalShortTerm.triggered) {
    alerts.push({
      type: 'short_term',
      name: '国际黄金 (XAU)',
      price: international.price,
      unit: '美元/盎司',
      ...internationalShortTerm
    });
  }
  
  if (alerts.length === 0) {
    console.log('[Gold Alert] No significant price movement detected');
    return;
  }
  
  if (env?.GOLD_PRICE_CACHE) {
    try {
      const lastAlert = await env.GOLD_PRICE_CACHE.get('last_alert');
      if (lastAlert) {
        const lastAlertTime = parseInt(lastAlert);
        const cooldownMs = ALERT_CONFIG.COOLDOWN_MINUTES * 60 * 1000;
        if (Date.now() - lastAlertTime < cooldownMs) {
          console.log('[Gold Alert] Alert already sent within', ALERT_CONFIG.COOLDOWN_MINUTES, 'minutes, skipping');
          return;
        }
      }
    } catch (e) {
      console.log('[Gold Alert] Failed to check last alert time');
    }
  }
  
  console.log('[Gold Alert] Price movement detected!', alerts.length, 'alerts');
  await sendAlertEmail(alerts, env);
}

function analyzeWindow(prices, threshold) {
  if (prices.length < ALERT_CONFIG.WINDOW_SIZE) {
    return { triggered: false, reason: 'insufficient_data' };
  }
  
  const window = prices.slice(-ALERT_CONFIG.WINDOW_SIZE);
  const max = Math.max(...window);
  const min = Math.min(...window);
  const range = max - min;
  const current = window[window.length - 1];
  const direction = current <= min ? 'down' : (current >= max ? 'up' : 'volatile');
  
  if (!ALERT_CONFIG.ALERT_ON_RISE && direction === 'up') {
    return { triggered: false, reason: 'price_rising' };
  }
  
  if (range >= threshold) {
    return {
      triggered: true,
      range: range.toFixed(2),
      max: max.toFixed(2),
      min: min.toFixed(2),
      current: current.toFixed(2),
      direction: direction,
      message: `最近${ALERT_CONFIG.WINDOW_SIZE}个采集点波动 ${range.toFixed(2)}，超过阈值 ${threshold}`
    };
  }
  
  return { triggered: false };
}

function analyzeShortTerm(prices, threshold) {
  if (prices.length < 2) {
    return { triggered: false, reason: 'insufficient_data' };
  }
  
  const current = prices[prices.length - 1];
  const pointsInWindow = Math.min(prices.length, 12);
  const recentPrices = prices.slice(-pointsInWindow, -1);
  
  if (recentPrices.length === 0) {
    return { triggered: false, reason: 'insufficient_data' };
  }
  
  let maxDeviation = 0;
  let deviationPoint = 0;
  
  for (const price of recentPrices) {
    const deviation = Math.abs(current - price);
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
      deviationPoint = price;
    }
  }
  
  const direction = current > deviationPoint ? 'up' : 'down';
  
  if (!ALERT_CONFIG.ALERT_ON_RISE && direction === 'up') {
    return { triggered: false, reason: 'price_rising' };
  }
  
  if (maxDeviation >= threshold) {
    return {
      triggered: true,
      deviation: maxDeviation.toFixed(2),
      current: current.toFixed(2),
      comparedTo: deviationPoint.toFixed(2),
      direction: direction,
      message: `当前价格与近期价格偏差 ${maxDeviation.toFixed(2)}，超过阈值 ${threshold}`
    };
  }
  
  return { triggered: false };
}

async function sendAlertEmail(alerts, env) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  
  sendFeishuAlert(alerts, env);
  sendWeComAlert(alerts, env);
  sendMeoWAlert(alerts, env);
  
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const alertEmoji = hasDownward ? '🚨' : (hasVolatile ? '⚡' : '📈');
  const alertTitle = hasDownward ? '金价暴跌预警' : (hasVolatile ? '金价剧烈波动' : '金价快速上涨');
  
  const windowAlerts = alerts.filter(a => a.type === 'window');
  const shortTermAlerts = alerts.filter(a => a.type === 'short_term');
  
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
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0b; color: #fafafa;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: ${hasDownward ? '#ef4444' : (hasVolatile ? '#f59e0b' : '#22c55e')}; margin: 0;">${alertEmoji} ${alertTitle}</h1>
              <p style="color: #71717a; margin-top: 5px;">实时金价智能监控</p>
            </div>
            
            ${windowAlerts.length > 0 ? `
            <div style="background: #18181b; padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
              <h3 style="color: #fafafa; margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">📊 滑动窗口检测 (最近${ALERT_CONFIG.WINDOW_SIZE}个采集点)</h3>
              ${windowAlerts.map(alert => `
                <div style="margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                  <h4 style="color: #fafafa; margin: 0 0 12px 0;">${alert.name}</h4>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;">当前价格</td>
                      <td style="padding: 6px 0; color: #fafafa; text-align: right; font-weight: bold;">${alert.current} ${alert.unit}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;">最高价</td>
                      <td style="padding: 6px 0; color: #22c55e; text-align: right;">${alert.max} ${alert.unit}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;">最低价</td>
                      <td style="padding: 6px 0; color: #ef4444; text-align: right;">${alert.min} ${alert.unit}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;">波动幅度</td>
                      <td style="padding: 6px 0; color: ${alert.direction === 'down' ? '#ef4444' : (alert.direction === 'up' ? '#22c55e' : '#f59e0b')}; text-align: right; font-weight: bold;">${alert.range} ${alert.unit}</td>
                    </tr>
                  </table>
                </div>
              `).join('')}
            </div>
            ` : ''}
            
            ${shortTermAlerts.length > 0 ? `
            <div style="background: #18181b; padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
              <h3 style="color: #fafafa; margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">⚡ 短期波动检测 (最近${ALERT_CONFIG.SHORT_TERM_MINUTES}分钟)</h3>
              ${shortTermAlerts.map(alert => `
                <div style="margin-bottom: 16px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px;">
                  <h4 style="color: #fafafa; margin: 0 0 12px 0;">${alert.name}</h4>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;">当前价格</td>
                      <td style="padding: 6px 0; color: #fafafa; text-align: right; font-weight: bold;">${alert.current} ${alert.unit}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;">对比价格</td>
                      <td style="padding: 6px 0; color: #a1a1aa; text-align: right;">${alert.comparedTo} ${alert.unit}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #71717a;">价格偏差</td>
                      <td style="padding: 6px 0; color: ${alert.direction === 'down' ? '#ef4444' : '#22c55e'}; text-align: right; font-weight: bold;">${alert.deviation} ${alert.unit}</td>
                    </tr>
                  </table>
                </div>
              `).join('')}
            </div>
            ` : ''}
            
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://ustc.dev/kit/gold/" style="display: inline-block; background: linear-gradient(135deg, #00d4ff, #0099cc); color: #000; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">查看实时金价</a>
            </div>
            
            <div style="margin-top: 20px; padding: 16px; background: rgba(255,255,255,0.03); border-radius: 8px; font-size: 13px;">
              <p style="color: #71717a; margin: 0 0 8px 0;"><strong>预警规则：</strong></p>
              <ul style="color: #a1a1aa; margin: 0; padding-left: 20px;">
                <li>滑动窗口：最近${ALERT_CONFIG.WINDOW_SIZE}个采集点内，最高价与最低价差值超过阈值</li>
                <li>短期波动：当前价格与最近${ALERT_CONFIG.SHORT_TERM_MINUTES}分钟内价格偏差超过阈值</li>
                <li>国内黄金阈值：${ALERT_CONFIG.DOMESTIC_THRESHOLD} 元/克</li>
                <li>国际黄金阈值：${ALERT_CONFIG.INTERNATIONAL_THRESHOLD} 美元/盎司</li>
              </ul>
            </div>
            
            <p style="text-align: center; color: #71717a; font-size: 12px; margin-top: 24px;">
              ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} | 此邮件由系统自动发送 | ${ALERT_CONFIG.COOLDOWN_MINUTES}分钟内不会重复发送
            </p>
          </div>
        `,
      }),
    });
    
    if (response.ok) {
      console.log('[Gold Alert] Alert email sent successfully');
      if (env?.GOLD_PRICE_CACHE) {
        await env.GOLD_PRICE_CACHE.put('last_alert', Date.now().toString(), { expirationTtl: 3600 });
      }
    } else {
      const error = await response.text();
      console.error('[Gold Alert] Failed to send email:', error);
    }
  } catch (error) {
    console.error('[Gold Alert] Exception:', error);
  }
}

async function sendFeishuAlert(alerts, env) {
  const FEISHU_WEBHOOK = env.FEISHU_WEBHOOK;
  const FEISHU_APP_ID = env.FEISHU_APP_ID;
  const FEISHU_APP_SECRET = env.FEISHU_APP_SECRET;
  const FEISHU_CHAT_ID = env.FEISHU_CHAT_ID;
  
  console.log('[Gold Alert] Feishu config check:', {
    hasWebhook: !!FEISHU_WEBHOOK,
    hasAppId: !!FEISHU_APP_ID,
    hasAppSecret: !!FEISHU_APP_SECRET,
    hasChatId: !!FEISHU_CHAT_ID
  });
  
  if (FEISHU_WEBHOOK) {
    console.log('[Gold Alert] Using webhook mode');
    const result = await sendFeishuWebhook(FEISHU_WEBHOOK, alerts);
    return { method: 'webhook', result };
  }
  
  if (FEISHU_APP_ID && FEISHU_APP_SECRET && FEISHU_CHAT_ID) {
    console.log('[Gold Alert] Using app message mode');
    const result = await sendFeishuAppMessage(FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_CHAT_ID, alerts);
    return { method: 'app', result };
  }
  
  console.log('[Gold Alert] No Feishu configuration found');
  return { method: 'none', error: 'No Feishu configuration found' };
}

async function sendFeishuWebhook(webhookUrl, alerts) {
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const alertEmoji = hasDownward ? '🚨' : (hasVolatile ? '⚡' : '📈');
  const alertTitle = hasDownward ? '金价暴跌预警' : (hasVolatile ? '金价剧烈波动' : '金价快速上涨');
  
  let content = `**${alertEmoji} ${alertTitle}**\n`;
  content += `> 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
  
  for (const alert of alerts) {
    if (alert.type === 'window') {
      content += `**${alert.name}** (滑动窗口)\n`;
      content += `当前: ${alert.current} ${alert.unit}\n`;
      content += `最高: ${alert.max} | 最低: ${alert.min}\n`;
      content += `波动: **${alert.range} ${alert.unit}**\n\n`;
    } else {
      content += `**${alert.name}** (短期波动)\n`;
      content += `当前: ${alert.current} ${alert.unit}\n`;
      content += `偏差: **${alert.deviation} ${alert.unit}**\n\n`;
    }
  }
  
  content += `[查看详情](https://ustc.dev/kit/gold/)`;
  
  console.log('[Gold Alert] Sending to Feishu webhook:', webhookUrl.substring(0, 50) + '...');
  
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
    console.log('[Gold Alert] Feishu webhook response:', JSON.stringify(result));
    
    if (result.code === 0 || result.StatusCode === 0) {
      console.log('[Gold Alert] Feishu webhook sent successfully');
      return { success: true, response: result };
    } else {
      console.error('[Gold Alert] Feishu webhook failed:', JSON.stringify(result));
      return { success: false, error: result };
    }
  } catch (error) {
    console.error('[Gold Alert] Feishu webhook error:', error);
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
      if (alert.type === 'window') {
        contentElements.push([{ tag: 'text', text: `${alert.name} (滑动窗口)` }]);
        contentElements.push([{ tag: 'text', text: `当前价格: ${alert.current} ${alert.unit}` }]);
        contentElements.push([{ tag: 'text', text: `最高: ${alert.max} | 最低: ${alert.min}` }]);
        contentElements.push([{ tag: 'text', text: `波动幅度: ${alert.range} ${alert.unit}` }]);
        contentElements.push([{ tag: 'text', text: '' }]);
      } else {
        contentElements.push([{ tag: 'text', text: `${alert.name} (短期波动)` }]);
        contentElements.push([{ tag: 'text', text: `当前价格: ${alert.current} ${alert.unit}` }]);
        contentElements.push([{ tag: 'text', text: `价格偏差: ${alert.deviation} ${alert.unit}` }]);
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
    console.log('[Gold Alert] Feishu message response:', JSON.stringify(messageData));
    
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

async function sendWeComAlert(alerts, env) {
  const WECOM_WEBHOOK = env.WECOM_WEBHOOK;
  
  if (!WECOM_WEBHOOK) {
    return;
  }
  
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const alertEmoji = hasDownward ? '🚨' : (hasVolatile ? '⚡' : '📈');
  const alertTitle = hasDownward ? '金价暴跌预警' : (hasVolatile ? '金价剧烈波动' : '金价快速上涨');
  
  let content = `## ${alertEmoji} ${alertTitle}\n`;
  content += `> 时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
  
  for (const alert of alerts) {
    if (alert.type === 'window') {
      content += `**${alert.name}** (滑动窗口)\n`;
      content += `> 当前: ${alert.current} ${alert.unit}\n`;
      content += `> 最高: ${alert.max} | 最低: ${alert.min}\n`;
      content += `> 波动: <font color="warning">${alert.range} ${alert.unit}</font>\n\n`;
    } else {
      content += `**${alert.name}** (短期波动)\n`;
      content += `> 当前: ${alert.current} ${alert.unit}\n`;
      content += `> 偏差: <font color="warning">${alert.deviation} ${alert.unit}</font>\n\n`;
    }
  }
  
  content += `[查看详情](https://ustc.dev/kit/gold/)`;
  
  try {
    await fetch(WECOM_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: { content: content }
      })
    });
    console.log('[Gold Alert] WeCom notification sent');
  } catch (error) {
    console.error('[Gold Alert] WeCom error:', error);
  }
}

async function sendMeoWAlert(alerts, env) {
  const MEOW_USER_ID = env.MEOW_USER_ID || '5bf48882';
  
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const alertEmoji = hasDownward ? '🚨' : (hasVolatile ? '⚡' : '📈');
  const alertTitle = hasDownward ? '金价暴跌预警' : (hasVolatile ? '金价剧烈波动' : '金价快速上涨');
  
  let msgContent = `时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  
  for (const alert of alerts) {
    msgContent += `${alert.name}: ${alert.current} ${alert.unit} (波动${alert.range})\n`;
  }
  
  const meowUrl = `https://api.chuckfang.com/${MEOW_USER_ID}`;
  
  console.log('[Gold Alert] Sending to MeoW...');
  
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
    console.log('[Gold Alert] MeoW response:', JSON.stringify(result));
    
    if (result.status === 200) {
      console.log('[Gold Alert] MeoW notification sent successfully');
      return { success: true, response: result };
    } else {
      console.error('[Gold Alert] MeoW notification failed:', result.msg);
      return { success: false, error: result.msg };
    }
  } catch (error) {
    console.error('[Gold Alert] MeoW error:', error);
    return { success: false, error: error.message };
  }
}

// ================================================================================
// 金价智能分析系统
// ================================================================================

const ANALYSIS_CONFIG = {
  RSI_PERIOD: 14,
  RSI_OVERSOLD: 30,
  RSI_OVERBOUGHT: 70,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  BOLLINGER_PERIOD: 20,
  BOLLINGER_STD: 2,
  VOLUME_SPIKE_THRESHOLD: 1.5,
  PRICE_CHANGE_THRESHOLD: 0.5,
  MIN_DATA_POINTS: 15
};

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

function calculateRSI(prices, period = 14) {
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
  if (prices.length < 26) return null;
  
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  
  const recentPrices = prices.slice(-35);
  const macdLine = [];
  const multiplier12 = 2 / 13;
  const multiplier26 = 2 / 27;
  
  let e12 = recentPrices.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let e26 = recentPrices.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  
  for (let i = 26; i < recentPrices.length; i++) {
    e12 = (recentPrices[i] - e12) * multiplier12 + e12;
    e26 = (recentPrices[i] - e26) * multiplier26 + e26;
    macdLine.push(e12 - e26);
  }
  
  const signal = macdLine.length >= 9 ? calculateEMA(macdLine, 9) : macd;
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  if (prices.length < period) return null;
  
  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    middle: sma,
    upper: sma + stdDev * std,
    lower: sma - stdDev * std,
    bandwidth: (2 * stdDev * std) / sma * 100
  };
}

function analyzePriceTrend(prices) {
  if (prices.length < 5) return { trend: 'unknown', strength: 0 };
  
  const recent = prices.slice(-5);
  const changes = [];
  for (let i = 1; i < recent.length; i++) {
    changes.push((recent[i] - recent[i - 1]) / recent[i - 1] * 100);
  }
  
  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  const trend = avgChange > 0.1 ? 'up' : avgChange < -0.1 ? 'down' : 'sideways';
  
  return {
    trend,
    strength: Math.abs(avgChange),
    avgChange: avgChange.toFixed(3)
  };
}

function detectVolumeSpike(volumes) {
  if (volumes.length < 10) return { spike: false, ratio: 1 };
  
  const recent = volumes[volumes.length - 1];
  const avg = volumes.slice(-10, -1).reduce((a, b) => a + b, 0) / 9;
  const ratio = recent / avg;
  
  return {
    spike: ratio > ANALYSIS_CONFIG.VOLUME_SPIKE_THRESHOLD,
    ratio: ratio.toFixed(2)
  };
}

function generateTradingSignal(analysis) {
  const signals = [];
  let buyScore = 0;
  let sellScore = 0;
  
  if (analysis.rsi !== null) {
    if (analysis.rsi < ANALYSIS_CONFIG.RSI_OVERSOLD) {
      signals.push({ indicator: 'RSI', signal: '超卖', action: 'buy', strength: 2, value: analysis.rsi.toFixed(2) });
      buyScore += 2;
    } else if (analysis.rsi > ANALYSIS_CONFIG.RSI_OVERBOUGHT) {
      signals.push({ indicator: 'RSI', signal: '超买', action: 'sell', strength: 2, value: analysis.rsi.toFixed(2) });
      sellScore += 2;
    } else {
      signals.push({ indicator: 'RSI', signal: '中性', action: 'hold', strength: 0, value: analysis.rsi.toFixed(2) });
    }
  }
  
  if (analysis.macd) {
    if (analysis.macd.histogram > 0 && analysis.macd.macd > analysis.macd.signal) {
      signals.push({ indicator: 'MACD', signal: '金叉', action: 'buy', strength: 1.5, value: analysis.macd.histogram.toFixed(4) });
      buyScore += 1.5;
    } else if (analysis.macd.histogram < 0 && analysis.macd.macd < analysis.macd.signal) {
      signals.push({ indicator: 'MACD', signal: '死叉', action: 'sell', strength: 1.5, value: analysis.macd.histogram.toFixed(4) });
      sellScore += 1.5;
    }
  }
  
  if (analysis.bollinger) {
    const currentPrice = analysis.currentPrice;
    if (currentPrice <= analysis.bollinger.lower) {
      signals.push({ indicator: 'Bollinger', signal: '触及下轨', action: 'buy', strength: 1.5, value: currentPrice.toFixed(2) });
      buyScore += 1.5;
    } else if (currentPrice >= analysis.bollinger.upper) {
      signals.push({ indicator: 'Bollinger', signal: '触及上轨', action: 'sell', strength: 1.5, value: currentPrice.toFixed(2) });
      sellScore += 1.5;
    }
  }
  
  if (analysis.trend) {
    if (analysis.trend.trend === 'down' && analysis.trend.strength > 0.2) {
      signals.push({ indicator: 'Trend', signal: '下跌趋势', action: 'watch', strength: 1, value: analysis.trend.avgChange + '%' });
      buyScore += 0.5;
    } else if (analysis.trend.trend === 'up' && analysis.trend.strength > 0.2) {
      signals.push({ indicator: 'Trend', signal: '上涨趋势', action: 'hold', strength: 1, value: analysis.trend.avgChange + '%' });
    }
  }
  
  if (analysis.priceChange !== null) {
    if (analysis.priceChange < -ANALYSIS_CONFIG.PRICE_CHANGE_THRESHOLD) {
      signals.push({ indicator: 'PriceChange', signal: '价格下跌', action: 'buy', strength: 1, value: analysis.priceChange.toFixed(2) + '%' });
      buyScore += 1;
    } else if (analysis.priceChange > ANALYSIS_CONFIG.PRICE_CHANGE_THRESHOLD) {
      signals.push({ indicator: 'PriceChange', signal: '价格上涨', action: 'watch', strength: 1, value: analysis.priceChange.toFixed(2) + '%' });
    }
  }
  
  const recommendation = buyScore >= 4 ? '强烈买入' : 
                         buyScore >= 2.5 ? '建议买入' : 
                         sellScore >= 4 ? '建议卖出' : 
                         sellScore >= 2.5 ? '谨慎持有' : '观望';
  
  return {
    signals,
    buyScore,
    sellScore,
    recommendation,
    isBuySignal: buyScore >= 2.5 && buyScore > sellScore
  };
}

async function performGoldAnalysis(env) {
  console.log('[Gold Analysis] Starting analysis...');
  
  const today = getBeijingDate();
  const historyKey = `history:${today}`;
  
  if (!env?.GOLD_PRICE_CACHE) {
    return { success: false, error: 'KV cache not available' };
  }
  
  const historyData = await env.GOLD_PRICE_CACHE.get(historyKey);
  if (!historyData) {
    return { success: false, error: 'No history data available for today' };
  }
  
  const history = JSON.parse(historyData);
  if (history.length < ANALYSIS_CONFIG.MIN_DATA_POINTS) {
    return { success: false, error: `Insufficient data points: ${history.length}/${ANALYSIS_CONFIG.MIN_DATA_POINTS}` };
  }
  
  const domesticPrices = history.map(h => h.domestic).filter(p => p > 0);
  const internationalPrices = history.map(h => h.international).filter(p => p > 0);
  
  const latestData = history[history.length - 1];
  const previousData = history.length > 1 ? history[history.length - 2] : latestData;
  
  const domesticAnalysis = {
    currentPrice: latestData.domestic,
    previousPrice: previousData.domestic,
    priceChange: ((latestData.domestic - previousData.domestic) / previousData.domestic * 100),
    high: Math.max(...domesticPrices),
    low: Math.min(...domesticPrices),
    rsi: calculateRSI(domesticPrices),
    macd: calculateMACD(domesticPrices),
    bollinger: calculateBollingerBands(domesticPrices),
    trend: analyzePriceTrend(domesticPrices),
    sma20: calculateSMA(domesticPrices, 20),
    ema12: calculateEMA(domesticPrices, 12)
  };
  
  const internationalAnalysis = {
    currentPrice: latestData.international,
    previousPrice: previousData.international,
    priceChange: ((latestData.international - previousData.international) / previousData.international * 100),
    high: Math.max(...internationalPrices),
    low: Math.min(...internationalPrices),
    rsi: calculateRSI(internationalPrices),
    macd: calculateMACD(internationalPrices),
    bollinger: calculateBollingerBands(internationalPrices),
    trend: analyzePriceTrend(internationalPrices)
  };
  
  const domesticSignal = generateTradingSignal(domesticAnalysis);
  const internationalSignal = generateTradingSignal(internationalAnalysis);
  
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
    overallRecommendation: domesticSignal.isBuySignal || internationalSignal.isBuySignal ? '建议关注' : '观望'
  };
  
  console.log('[Gold Analysis] Analysis completed:', JSON.stringify({
    domesticRSI: domesticAnalysis.rsi,
    domesticRecommendation: domesticSignal.recommendation,
    internationalRSI: internationalAnalysis.rsi,
    internationalRecommendation: internationalSignal.recommendation
  }));
  
  return { success: true, analysis: analysisResult };
}

async function handleGoldAnalysis(request, env, ctx) {
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
    content += `买入评分：${analysis.domestic.signal.buyScore.toFixed(1)}\n\n`;
  }
  
  if (hasInternationalSignal) {
    content += `🌍 国际金价 (XAU)\n`;
    content += `当前：${analysis.international.currentPrice.toFixed(2)} 美元/盎司\n`;
    content += `RSI：${analysis.international.rsi?.toFixed(2) || 'N/A'}\n`;
    content += `建议：${analysis.international.signal.recommendation}\n`;
    content += `买入评分：${analysis.international.signal.buyScore.toFixed(1)}\n\n`;
  }
  
  content += `📈 技术指标详情\n`;
  if (analysis.domestic.macd) {
    content += `MACD：${analysis.domestic.macd.histogram > 0 ? '金叉' : '死叉'}\n`;
  }
  if (analysis.domestic.bollinger) {
    content += `布林带：${analysis.domestic.currentPrice < analysis.domestic.bollinger.lower ? '触及下轨' : analysis.domestic.currentPrice > analysis.domestic.bollinger.upper ? '触及上轨' : '中轨附近'}\n`;
  }
  
  const alerts = [{
    type: 'analysis',
    name: '金价智能分析',
    current: analysis.domestic.currentPrice.toFixed(2),
    unit: '元/克',
    direction: 'analysis',
    content
  }];
  
  await sendFeishuAlert(alerts, env);
  await sendMeoWAlert(alerts, env);
  await sendAlertEmail(alerts, env);
  
  console.log('[Gold Analysis] Notification sent successfully');
}

// 工具函数 - 密码哈希（增强安全）
// ================================================================================

async function handleGoldAlertTest(request, env, ctx) {
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
      await sendAlertEmail(testAlerts, env);
      return new Response(JSON.stringify({ success: true, message: 'Email alert test sent', config }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    if (type === 'feishu' || type === 'webhook') {
      const result = await sendFeishuAlert(testAlerts, env);
      return new Response(JSON.stringify({ 
        success: result.method !== 'none', 
        message: 'Feishu alert test completed',
        config,
        feishuResult: result
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    if (type === 'meow') {
      const result = await sendMeoWAlert(testAlerts, env);
      return new Response(JSON.stringify({ 
        success: result.success, 
        message: 'MeoW alert test completed',
        config,
        meowResult: result
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    if (type === 'all') {
      await sendAlertEmail(testAlerts, env);
      const feishuResult = await sendFeishuAlert(testAlerts, env);
      const meowResult = await sendMeoWAlert(testAlerts, env);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All alerts test sent',
        config,
        feishuResult,
        meowResult
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid type. Use: email, feishu, meow, or all',
      usage: '/api/gold/alert/test?type=email|feishu|meow|all',
      config
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
    
  } catch (error) {
    console.error('[Gold Alert Test] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message, config }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
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
// 交易系统处理函数
// ================================================================================

const TRADING_CONFIG = {
  MAX_QUANTITY: 10000,
  MIN_QUANTITY: 0.001,
  MAX_PRICE: 100000,
  MIN_PRICE: 0.01,
};

function validateNumber(value, min, max, fieldName) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }
  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }
  if (num > max) {
    return { valid: false, error: `${fieldName} must not exceed ${max}` };
  }
  return { valid: true, value: num };
}

function formatDateForTrading(date) {
  return new Date(date).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
}

async function handleTradingLogin(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return jsonResponse({ success: false, error: 'Username and password are required' }, 400);
    }

    const stmt = env.DB.prepare('SELECT * FROM admin_users WHERE username = ?');
    const result = await stmt.bind(username).first();

    if (!result) {
      return jsonResponse({ success: false, error: 'Invalid credentials' }, 401);
    }

    const [salt, storedHash] = result.password_hash.split(':');
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (hash !== storedHash) {
      return jsonResponse({ success: false, error: 'Invalid credentials' }, 401);
    }

    const secret = env.JWT_SECRET || 'agiera-default-jwt-secret-2024';
    const token = await createAdminToken({
      userId: result.id,
      username: result.username,
      role: result.role
    }, secret);

    await env.DB.prepare('UPDATE admin_users SET last_login = ? WHERE id = ?')
      .bind(new Date().toISOString(), result.id).run();

    return jsonResponse({
      success: true,
      token,
      user: { id: result.id, username: result.username, role: result.role }
    });
  } catch (error) {
    console.error('[Trading Login Error]', error);
    return jsonResponse({ success: false, error: 'Login failed' }, 500);
  }
}

async function handleTradingVerify(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'No token provided' }, 401);
  }

  const token = authHeader.substring(7);
  const secret = env.JWT_SECRET || 'agiera-default-jwt-secret-2024';
  const verification = await verifyAdminToken(token, secret);
  
  if (!verification) {
    return jsonResponse({ success: false, error: 'Invalid token' }, 401);
  }

  return jsonResponse({ success: true, user: verification });
}

async function handleBuyTransaction(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { price, quantity, notes } = await request.json();

    const priceValidation = validateNumber(price, TRADING_CONFIG.MIN_PRICE, TRADING_CONFIG.MAX_PRICE, 'Buy price');
    if (!priceValidation.valid) {
      return jsonResponse({ success: false, error: priceValidation.error }, 400);
    }

    const quantityValidation = validateNumber(quantity, TRADING_CONFIG.MIN_QUANTITY, TRADING_CONFIG.MAX_QUANTITY, 'Quantity');
    if (!quantityValidation.valid) {
      return jsonResponse({ success: false, error: quantityValidation.error }, 400);
    }

    const buyPrice = priceValidation.value;
    const buyQuantity = quantityValidation.value;
    const totalAmount = buyPrice * buyQuantity;

    const stmt = env.DB.prepare(`
      INSERT INTO gold_transactions (type, price, quantity, total_amount, notes, status, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)
    `);
    
    const now = new Date().toISOString();
    const result = await stmt.bind('buy', buyPrice, buyQuantity, totalAmount, notes || null, now, now).run();

    return jsonResponse({
      success: true,
      transaction: {
        id: result.meta.last_row_id,
        type: 'buy',
        price: buyPrice,
        quantity: buyQuantity,
        totalAmount,
        notes,
        createdAt: now
      }
    });
  } catch (error) {
    console.error('[Buy Transaction Error]', error);
    return jsonResponse({ success: false, error: 'Failed to create buy transaction' }, 500);
  }
}

async function handleSellTransaction(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { buyTransactionId, actualSellPrice, price, quantity, notes } = await request.json();
    const sellPriceInput = actualSellPrice || price;

    const priceValidation = validateNumber(sellPriceInput, TRADING_CONFIG.MIN_PRICE, TRADING_CONFIG.MAX_PRICE, 'Sell price');
    if (!priceValidation.valid) {
      return jsonResponse({ success: false, error: priceValidation.error }, 400);
    }

    const quantityValidation = validateNumber(quantity, TRADING_CONFIG.MIN_QUANTITY, TRADING_CONFIG.MAX_QUANTITY, 'Quantity');
    if (!quantityValidation.valid) {
      return jsonResponse({ success: false, error: quantityValidation.error }, 400);
    }

    const sellPrice = priceValidation.value;
    const sellQuantity = quantityValidation.value;
    const totalAmount = sellPrice * sellQuantity;

    let profit = 0;
    let buyPrice = 0;

    if (buyTransactionId) {
      const buyStmt = env.DB.prepare('SELECT * FROM gold_transactions WHERE id = ? AND type = ?');
      const buyResult = await buyStmt.bind(buyTransactionId, 'buy').first();
      
      if (buyResult) {
        buyPrice = buyResult.price;
        profit = (sellPrice - buyPrice) * sellQuantity;
      }
    }

    const stmt = env.DB.prepare(`
      INSERT INTO gold_transactions (type, price, quantity, total_amount, actual_sell_price, profit, notes, status, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
    `);
    
    const now = new Date().toISOString();
    const result = await stmt.bind('sell', buyPrice || sellPrice, sellQuantity, totalAmount, sellPrice, profit, notes || null, now, now).run();

    return jsonResponse({
      success: true,
      transaction: {
        id: result.meta.last_row_id,
        type: 'sell',
        price: buyPrice || sellPrice,
        quantity: sellQuantity,
        totalAmount,
        actualSellPrice: sellPrice,
        profit,
        notes,
        createdAt: now
      }
    });
  } catch (error) {
    console.error('[Sell Transaction Error]', error);
    return jsonResponse({ success: false, error: 'Failed to create sell transaction' }, 500);
  }
}

async function handleGetTransactions(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401);
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const type = url.searchParams.get('type');
  const sortBy = url.searchParams.get('sortBy') || 'created_at';
  const sortOrder = url.searchParams.get('sortOrder') || 'DESC';

  const offset = (page - 1) * limit;

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (type && ['buy', 'sell'].includes(type)) {
      whereClause += ' AND type = ?';
      params.push(type);
    }

    const validSortColumns = ['created_at', 'price', 'quantity', 'total_amount', 'profit'];
    const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    const validSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';

    const countStmt = env.DB.prepare(`SELECT COUNT(*) as total FROM gold_transactions ${whereClause}`);
    const countResult = await countStmt.bind(...params).first();
    const total = countResult?.total || 0;

    const dataStmt = env.DB.prepare(`
      SELECT * FROM gold_transactions 
      ${whereClause}
      ORDER BY ${validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `);
    
    const dataResult = await dataStmt.bind(...params, limit, offset).all();

    return jsonResponse({
      success: true,
      transactions: dataResult.results,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('[Get Transactions Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch transactions' }, 500);
  }
}

async function handleGetTransactionStats(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401);
  }

  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = formatDateForTrading(weekStart);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = formatDateForTrading(monthStart);

    const totalStmt = env.DB.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'buy' THEN total_amount ELSE 0 END), 0) as total_buy,
        COALESCE(SUM(CASE WHEN type = 'sell' THEN total_amount ELSE 0 END), 0) as total_sell,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(CASE WHEN type = 'buy' THEN quantity ELSE 0 END), 0) as total_quantity_bought,
        COALESCE(SUM(CASE WHEN type = 'sell' THEN quantity ELSE 0 END), 0) as total_quantity_sold,
        COUNT(*) as total_transactions
      FROM gold_transactions
    `);
    const totalStats = await totalStmt.first();

    const weekStmt = env.DB.prepare(`
      SELECT COALESCE(SUM(profit), 0) as week_profit
      FROM gold_transactions
      WHERE date(created_at) >= date(?)
    `);
    const weekStats = await weekStmt.bind(weekStartStr).first();

    const monthStmt = env.DB.prepare(`
      SELECT COALESCE(SUM(profit), 0) as month_profit
      FROM gold_transactions
      WHERE date(created_at) >= date(?)
    `);
    const monthStats = await monthStmt.bind(monthStartStr).first();

    const dailyStmt = env.DB.prepare(`
      SELECT date(created_at) as date, SUM(profit) as profit
      FROM gold_transactions
      WHERE date(created_at) >= date(?)
      GROUP BY date(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);
    const dailyResult = await dailyStmt.bind(weekStartStr).all();

    const weeklyStmt = env.DB.prepare(`
      SELECT strftime('%Y-W%W', created_at) as week, SUM(profit) as profit
      FROM gold_transactions
      WHERE created_at >= datetime('now', '-12 weeks')
      GROUP BY strftime('%Y-W%W', created_at)
      ORDER BY week DESC
      LIMIT 12
    `);
    const weeklyResult = await weeklyStmt.all();

    return jsonResponse({
      success: true,
      stats: {
        total: {
          buy: totalStats?.total_buy || 0,
          sell: totalStats?.total_sell || 0,
          profit: totalStats?.total_profit || 0,
          quantityBought: totalStats?.total_quantity_bought || 0,
          quantitySold: totalStats?.total_quantity_sold || 0,
          transactions: totalStats?.total_transactions || 0
        },
        week: { profit: weekStats?.week_profit || 0 },
        month: { profit: monthStats?.month_profit || 0 },
        daily: dailyResult.results,
        weekly: weeklyResult.results
      }
    });
  } catch (error) {
    console.error('[Get Transaction Stats Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch statistics' }, 500);
  }
}

async function handleCreateAlert(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { alertType, targetPrice } = await request.json();

    if (!['buy', 'sell'].includes(alertType)) {
      return jsonResponse({ success: false, error: 'Invalid alert type' }, 400);
    }

    const priceValidation = validateNumber(targetPrice, TRADING_CONFIG.MIN_PRICE, TRADING_CONFIG.MAX_PRICE, 'Target price');
    if (!priceValidation.valid) {
      return jsonResponse({ success: false, error: priceValidation.error }, 400);
    }

    const stmt = env.DB.prepare(`INSERT INTO price_alerts (alert_type, target_price, created_at) VALUES (?, ?, ?)`);
    const now = new Date().toISOString();
    const result = await stmt.bind(alertType, priceValidation.value, now).run();

    return jsonResponse({
      success: true,
      alert: { id: result.meta.last_row_id, alertType, targetPrice: priceValidation.value, createdAt: now }
    });
  } catch (error) {
    console.error('[Create Alert Error]', error);
    return jsonResponse({ success: false, error: 'Failed to create alert' }, 500);
  }
}

async function handleGetAlerts(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401);
  }

  try {
    const stmt = env.DB.prepare(`SELECT * FROM price_alerts WHERE is_active = 1 ORDER BY created_at DESC`);
    const result = await stmt.all();

    return jsonResponse({ success: true, alerts: result.results });
  } catch (error) {
    console.error('[Get Alerts Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch alerts' }, 500);
  }
}

async function handleGetNotifications(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401);
  }

  try {
    const stmt = env.DB.prepare(`SELECT * FROM notification_queue WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50`);
    const result = await stmt.all();

    return jsonResponse({ success: true, notifications: result.results });
  } catch (error) {
    console.error('[Get Notifications Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch notifications' }, 500);
  }
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
