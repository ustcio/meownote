// ================================================================================
// USTC DEV Backend API - 重构优化版
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

function getBeijingHour() {
  return parseInt(new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    hour12: false
  }));
}

function calculateReliability(domestic, international, sgeData, intlData) {
  let reliability = 0.5;
  
  if (sgeData && sgeData.price > 0) reliability += 0.25;
  if (intlData && intlData.price > 0) reliability += 0.15;
  if (domestic && domestic.price > 0) reliability += 0.05;
  if (international && international.price > 0) reliability += 0.05;
  
  return Math.min(reliability, 1.0);
}

const SGE_ALERT_CONFIG = Object.freeze({
  WINDOW_SIZE: 5,
  SHORT_TERM_POINTS: 12,
  VOL_WINDOW: 20,
  BASE_THRESHOLD_YUAN: 2.0,
  MIN_THRESHOLD_YUAN: 1.2,
  INSTANT_ABS_THRESHOLD: 1.5,
  INSTANT_PERCENT_THRESHOLD: 0.20,
  INSTANT_CONFIRM_TICKS: 2,
  ATR_PERIOD: 14,
  ATR_MULTIPLIER: 1.8,
  ZSCORE_THRESHOLD: 2.2,
  EMA_FAST: 3,
  EMA_SLOW: 8,
  BASE_COOLDOWN_SECONDS: 90,
  MAX_COOLDOWN_SECONDS: 180,
  DEDUP_WINDOW_SECONDS: 120,
  STATE_CACHE_TTL: 86400,
  TOLERANCE_MIN: 0.5,
  TOLERANCE_MAX: 10.0,
  QUIET_HOURS_START: 1,
  QUIET_HOURS_END: 6,
  TICK_NOISE_FILTER: 0.20,
  MICRO_VOL_THRESHOLD: 0.7,
  NIGHT_SCORE_BOOST: 0,
  TREND_CONFIRM_BARS: 3,
  MIN_DIRECTION_CONSENSUS: 0.55,
  EMA_THRESHOLD_FACTOR: 0.7,
  EMA_MIN_PERCENT: 0.00012
});

function getSessionMultiplier(beijingHour) {
  if (beijingHour >= 20 || beijingHour <= 2) return 1.25;
  if (beijingHour >= 13 && beijingHour <= 15) return 1.1;
  return 1.0;
}

function getSession(beijingHour) {
  if (beijingHour >= 20 || beijingHour <= 2) return 'night';
  if (beijingHour >= 13 && beijingHour <= 15) return 'afternoon';
  return 'asian_morning';
}

function calculateStd(values) {
  if (!values || values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function calculateMean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculateEMA(prev, price, period) {
  const k = 2 / (period + 1);
  return price * k + prev * (1 - k);
}

function calculateATR(prices, period) {
  if (!prices || prices.length < 2) return 0;
  
  const trValues = [];
  for (let i = 1; i < prices.length; i++) {
    const high = prices[i];
    const low = prices[i];
    const prevClose = prices[i - 1];
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trValues.push(tr);
  }
  
  if (trValues.length < period) return calculateMean(trValues);
  return calculateMean(trValues.slice(-period));
}

function calculateZScore(price, mean, std) {
  if (!std || std === 0) return 0;
  return (price - mean) / std;
}

async function getLevel3State(env) {
  try {
    const stateJson = await env?.GOLD_PRICE_CACHE?.get('level3_state');
    if (stateJson) {
      return JSON.parse(stateJson);
    }
  } catch (e) {
    console.error('[Level3] Failed to get state:', e);
  }
  return {
    emaFast: 0,
    emaSlow: 0,
    lastPrice: 0,
    instantConfirmCount: 0,
    lastInstantDirection: 'neutral',
    trendConfirmCount: 0,
    lastTrendDirection: 'neutral',
    priceHistory: [],
    atrValues: [],
    lastTriggeredScore: 0,
    isInAlert: false
  };
}

async function saveLevel3State(env, state) {
  try {
    await env?.GOLD_PRICE_CACHE?.put('level3_state', JSON.stringify(state), {
      expirationTtl: SGE_ALERT_CONFIG.STATE_CACHE_TTL
    });
  } catch (e) {
    console.error('[Level3] Failed to save state:', e);
  }
}

function fuseSignals(price, prevPrice, state, atr, rollingStd, rollingMean, session) {
  const signals = [];
  let score = 0;
  const timestamp = Date.now();

  // === Tick Noise Filter ===
  const rawChange = Math.abs(price - prevPrice);
  if (rawChange < SGE_ALERT_CONFIG.TICK_NOISE_FILTER && rawChange > 0) {
    return {
      score: 0,
      triggered: false,
      signals: [{ type: 'noise_filtered', triggered: false, strength: 0, direction: 'neutral', message: 'Tick noise filtered' }],
      direction: 'neutral',
      confidence: 0
    };
  }

  const absChange = Math.abs(price - prevPrice);
  const pctChange = prevPrice > 0 ? (absChange / prevPrice) * 100 : 0;
  
  // === Adaptive Instant Threshold ===
  const adaptiveAbsThreshold = Math.max(
    SGE_ALERT_CONFIG.INSTANT_ABS_THRESHOLD,
    (rollingStd || 0) * 1.1
  );
  
  const isInstantMove = absChange >= adaptiveAbsThreshold || 
                        pctChange >= SGE_ALERT_CONFIG.INSTANT_PERCENT_THRESHOLD;
  
  // === Direction Memory for Instant Confirm ===
  const direction = price > prevPrice ? 'up' : 'down';
  let newConfirmCount = 0;
  
  if (isInstantMove && direction === state.lastInstantDirection) {
    newConfirmCount = (state.instantConfirmCount || 0) + 1;
  } else if (isInstantMove) {
    newConfirmCount = 1;
  } else {
    newConfirmCount = 0;
  }
  state.lastInstantDirection = direction;
  state.instantConfirmCount = newConfirmCount;
  
  const instantTriggered = newConfirmCount >= SGE_ALERT_CONFIG.INSTANT_CONFIRM_TICKS;
  
  signals.push({
    type: 'instant_move',
    triggered: instantTriggered,
    strength: instantTriggered ? 1 : 0,
    direction: direction,
    confirmCount: newConfirmCount
  });
  if (instantTriggered) score += 1;

  // === ATR Breakout ===
  const atrSignal = atr > 0 && absChange >= SGE_ALERT_CONFIG.ATR_MULTIPLIER * atr;
  signals.push({
    type: 'atr_breakout',
    triggered: atrSignal,
    strength: atrSignal ? 2 : 0,
    direction: direction
  });
  if (atrSignal) score += 2;

  // === Z-score Anomaly ===
  const zscore = calculateZScore(price, rollingMean, rollingStd);
  const zSignal = Math.abs(zscore) >= SGE_ALERT_CONFIG.ZSCORE_THRESHOLD;
  signals.push({
    type: 'zscore_anomaly',
    triggered: zSignal,
    strength: zSignal ? 2 : 0,
    direction: zscore > 0 ? 'up' : 'down',
    value: zscore
  });
  if (zSignal) score += 2;

  // === EMA Trend Confirmation (Optimized Threshold) ===
  const emaDiff = state.emaFast - state.emaSlow;
  const emaThreshold = Math.max(
    (rollingStd || 1) * SGE_ALERT_CONFIG.EMA_THRESHOLD_FACTOR,
    price * SGE_ALERT_CONFIG.EMA_MIN_PERCENT
  );
  const emaDirection = emaDiff > emaThreshold ? 'up' : emaDiff < -emaThreshold ? 'down' : 'neutral';
  
  // === Trend Confirm Count ===
  if (emaDirection === state.lastTrendDirection && emaDirection !== 'neutral') {
    state.trendConfirmCount = (state.trendConfirmCount || 0) + 1;
  } else if (emaDirection !== 'neutral') {
    state.trendConfirmCount = 1;
  } else {
    state.trendConfirmCount = 0;
  }
  state.lastTrendDirection = emaDirection;
  
  const emaConfirmed = state.trendConfirmCount >= SGE_ALERT_CONFIG.TREND_CONFIRM_BARS;
  
  signals.push({
    type: 'ema_cross',
    triggered: emaConfirmed,
    strength: emaConfirmed ? 1 : 0,
    direction: emaDirection,
    confirmBars: state.trendConfirmCount
  });
  if (emaConfirmed) score += 1;

  const triggeredSignals = signals.filter(s => s.triggered);
  const upVotes = triggeredSignals.filter(s => s.direction === 'up').length;
  const downVotes = triggeredSignals.filter(s => s.direction === 'down').length;
  const directionVotes = triggeredSignals.length;
  
  let finalDirection = 'neutral';
  if (upVotes > downVotes) finalDirection = 'up';
  else if (downVotes > upVotes) finalDirection = 'down';

  // === Institution-grade Confidence Fusion ===
  const directionConsensus = directionVotes > 0 
    ? Math.abs(upVotes - downVotes) / directionVotes 
    : 0;
  
  const rawConfidence = triggeredSignals.length > 0 
    ? triggeredSignals.reduce((sum, s) => sum + s.strength, 0) / 6 
    : 0;
  
  const confidence = clamp(
    rawConfidence * (0.6 + 0.4 * directionConsensus),
    0,
    1
  );

  // === Dynamic Required Score (Night Session Suppression) ===
  let requiredScore = 3;
  
  if (session === 'night') {
    requiredScore += SGE_ALERT_CONFIG.NIGHT_SCORE_BOOST;
  }
  
  if ((rollingStd || 1) < SGE_ALERT_CONFIG.MICRO_VOL_THRESHOLD) {
    requiredScore += 1;
  }

  // === Score Hysteresis (Prevent threshold oscillation) ===
  const releaseScore = requiredScore - 1;
  let triggered = false;
  
  if (state.isInAlert) {
    // 已在预警状态，需要降分才释放
    triggered = score >= releaseScore;
    if (!triggered) {
      state.isInAlert = false;
      state.lastTriggeredScore = 0;
    }
  } else {
    // 未在预警状态，需要达到触发阈值
    triggered = score >= requiredScore;
    if (triggered) {
      state.isInAlert = true;
      state.lastTriggeredScore = score;
    }
  }

  return {
    score,
    triggered,
    signals,
    direction: finalDirection,
    confidence,
    requiredScore,
    releaseScore,
    directionConsensus,
    hysteresisState: state.isInAlert ? 'armed' : 'idle'
  };
}

// ================================================================================
// 初始化超级管理员账户
// ================================================================================

async function initializeSuperAdmin(env) {
  try {
    const username = 'YangHao';
    const password = 'YangHao@Trading.com';

    // 检查用户是否已存在
    const existingUser = await env.DB.prepare(
      'SELECT id FROM admin_users WHERE username = ?'
    ).bind(username).first();

    if (existingUser) {
      console.log('[Init] Super admin user already exists');
      return;
    }

    // 生成带salt的密码哈希
    const passwordHash = await hashAdminPasswordWithSalt(password);

    // 创建超级管理员用户
    await env.DB.prepare(
      `INSERT INTO admin_users (username, password_hash, role, created_at, last_login)
       VALUES (?, ?, 'super_admin', datetime('now'), NULL)`
    ).bind(username, passwordHash).run();

    console.log('[Init] Super admin user created successfully');
  } catch (error) {
    console.error('[Init] Failed to initialize super admin:', error);
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleCORS(request);
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

      return jsonResponse({ error: 'Not Found' }, 404, request);
      
    } catch (error) {
      console.error('Server Error:', error);
      return jsonResponse({ error: 'Internal Server Error', message: error.message }, 500, request);
    }
  },
  
  // Cron Trigger - 每60秒执行一次金价爬取和AI分析
  async scheduled(event, env, ctx) {
    const now = Date.now();
    console.log('[Cron] Triggered at:', now);
    
    switch (event.cron) {
      case '*/1 * * * *': // 每分钟执行金价爬取和AI数据提交
        console.log('[Cron] Starting gold price crawl and AI data submission...');
        ctx.waitUntil(scheduledGoldCrawlWithAI(event, env, ctx));
        break;
      case '*/5 * * * *': // 每5分钟执行趋势分析
        console.log('[Cron] Starting gold price trend analysis...');
        ctx.waitUntil(scheduledGoldAnalysis(env, ctx));
        break;
      case '59 15 * * *': // UTC 15:59 = 北京时间 23:59 清理所有价格预警
        console.log('[Cron] Starting daily price alerts cleanup at 23:59 Beijing time...');
        ctx.waitUntil(cleanupDailyPriceAlerts(env));
        break;
      default:
        console.log('[Cron] Unknown cron pattern:', event.cron);
        ctx.waitUntil(scheduledGoldCrawlWithAI(event, env, ctx));
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
  '/api/gold/ai-analysis': { handler: handleGoldAIAnalysis },
  '/api/gold/ai-signals': { handler: handleGoldAISignals },
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
  '/api/trading/logout': { handler: handleTradingLogout },
  '/api/trading/init-admin': { handler: handleInitSuperAdmin },
  '/api/trading/verify': { handler: handleTradingVerify },
  '/api/trading/buy': { handler: handleBuyTransaction },
  '/api/trading/sell': { handler: handleSellTransaction },
  '/api/trading/transactions': { handler: handleGetTransactions },
  '/api/trading/transaction': { handler: handleTransactionOperation },
  '/api/trading/stats': { handler: handleGetTransactionStats },
  '/api/trading/alerts': { handler: handleAlertsOperation },
  '/api/trading/alert': { handler: handleAlertOperation },
  '/api/trading/notifications': { handler: handleGetNotifications },
  '/api/trading/tolerance': { handler: handleToleranceSettings },
  '/api/trading/alerts/history': { handler: handleAlertHistory },
  '/api/trading/market/status': { handler: handleMarketStatus },
  '/api/trading/alert-config': { handler: handleAlertConfig },
};

// ================================================================================
// CORS 处理
// ================================================================================

const ALLOWED_ORIGINS = [
  'https://ustc.dev',
  'https://www.ustc.dev',
  'https://meow-note.com',
  'https://api.ustc.dev',
  'http://localhost:4321',
  'http://localhost:4322',
  'http://localhost:4323',
  'http://localhost:4324',
  'http://localhost:3000',
];

function handleCORS(request) {
  const origin = request?.headers?.get('Origin') || '*';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Cache-Control',
    'Access-Control-Max-Age': '86400',
  };
  
  if (allowedOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  return new Response(null, { headers });
}

function jsonResponse(data, status = 200, request = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (request) {
    const origin = request.headers.get('Origin');
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    } else {
      headers['Access-Control-Allow-Origin'] = '*';
    }
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }
  
  return new Response(JSON.stringify(data), { status, headers });
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

// 金价数据缓存 - 统一缓存管理
let goldPriceCache = {
  data: null,
  timestamp: 0,
  isCrawling: false,
  promise: null
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
      date: getBeijingDate(),
      exchangeRate: exchangeRate,
      domestic: domestic,
      international: international,
      source: `${domestic.source}+${international.source}`,
      reliability: calculateReliability(domestic, international, sgeData, intlData)
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

const REALTIME_CACHE_TTL = 8000;

async function handleTodayGoldPrice(env, ctx, forceRefresh) {
  const today = getBeijingDate();
  const now = Date.now();
  
  // 检查内存缓存（用于高频请求去重）
  if (!forceRefresh && goldPriceCache.data && (now - goldPriceCache.timestamp) < REALTIME_CACHE_TTL) {
    console.log('[Gold Price] Returning memory cache, age:', now - goldPriceCache.timestamp, 'ms');
    const history = await getDayHistory(env, today);
    return jsonResponse({
      ...goldPriceCache.data,
      history: history,
      fromCache: true,
      cacheAge: now - goldPriceCache.timestamp,
      cacheType: 'memory'
    });
  }
  
  // 如果有正在进行的爬取请求，等待它完成
  if (goldPriceCache.promise && (now - goldPriceCache.timestamp) < REALTIME_CACHE_TTL + 2000) {
    console.log('[Gold Price] Waiting for in-progress crawl...');
    try {
      const data = await goldPriceCache.promise;
      const history = await getDayHistory(env, today);
      return jsonResponse({
        ...data,
        history: history,
        fromCache: true,
        cacheAge: Date.now() - goldPriceCache.timestamp,
        cacheType: 'memory-shared'
      });
    } catch (e) {
      console.log('[Gold Price] Shared crawl failed, proceeding with new crawl');
    }
  }
  
  // 检查KV缓存
  if (!forceRefresh && env?.GOLD_PRICE_CACHE) {
    try {
      const cached = await env.GOLD_PRICE_CACHE.get('latest');
      if (cached) {
        const data = JSON.parse(cached);
        const cacheAge = now - (data.cachedAt || 0);
        
        // 如果KV缓存小于8秒，直接返回
        if (cacheAge < REALTIME_CACHE_TTL) {
          console.log('[Gold Price] Returning KV cache, age:', cacheAge, 'ms');
          goldPriceCache.data = data;
          goldPriceCache.timestamp = now;
          const history = await getDayHistory(env, today);
          return jsonResponse({
            ...data,
            history: history,
            fromCache: true,
            cacheAge: cacheAge,
            cacheType: 'kv'
          });
        }
      }
    } catch (e) {
      console.log('[Gold Price] KV cache read failed:', e.message);
    }
  }
  
  // 实时爬取数据
  console.log('[Gold Price] Fetching real-time data...');
  
  // 创建爬取Promise并缓存，防止并发重复爬取
  const crawlPromise = performCrawl(env);
  goldPriceCache.promise = crawlPromise;
  
  const data = await crawlPromise;
  
  if (!data.success) {
    // 爬取失败，尝试使用过期缓存
    if (env?.GOLD_PRICE_CACHE) {
      try {
        const cached = await env.GOLD_PRICE_CACHE.get('latest');
        if (cached) {
          const cachedData = JSON.parse(cached);
          const cacheAge = now - (cachedData.cachedAt || 0);
          // 允许使用30秒内的过期缓存
          if (cacheAge < 30000) {
            console.log('[Gold Price] Using stale cache, age:', cacheAge, 'ms');
            const history = await getDayHistory(env, today);
            return jsonResponse({
              ...cachedData,
              history: history,
              fromCache: true,
              stale: true,
              error: data.error
            });
          }
        }
      } catch (e) {}
    }
    
    return jsonResponse({
      success: false,
      error: data.error || 'Failed to fetch gold price',
      timestamp: now
    }, 503);
  }
  
  // 更新缓存
  goldPriceCache.data = data;
  goldPriceCache.timestamp = now;
  goldPriceCache.promise = null;
  
  // 异步存储到KV和D1
  if (env?.GOLD_PRICE_CACHE) {
    ctx.waitUntil(storeGoldPriceData(env, data));
  }
  
  // 异步检查价格预警
  if (data.success && data.domestic?.price) {
    ctx.waitUntil((async () => {
      try {
        await checkAndSendTradingAlerts(data.domestic.price, env);
      } catch (e) {
        console.error('[Trading Alerts] Error:', e);
      }
    })());
  }
  
  // 异步发送价格变动预警
  if (data.success && data.domestic && data.international) {
    const history = await getDayHistory(env, today);
    ctx.waitUntil(sendGoldPriceAlert(data.domestic, data.international, history, env));
  }
  
  const history = await getDayHistory(env, today);
  return jsonResponse({
    ...data,
    history: history,
    fromCache: false,
    cacheType: 'realtime'
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
          
          // 获取 Level 3 市场状态
          let level3Status = null;
          try {
            const state = await getLevel3State(env);
            const beijingHour = getBeijingHour();
            const priceHistory = state.priceHistory || [];
            const rollingStd = calculateStd(priceHistory);
            
            level3Status = {
              session: getSession(beijingHour),
              trend: state.emaFast > state.emaSlow ? 'up' : state.emaFast < state.emaSlow ? 'down' : 'neutral',
              emaFast: state.emaFast,
              emaSlow: state.emaSlow,
              volatility: rollingStd,
              dynamicThreshold: Math.max(
                SGE_ALERT_CONFIG.MIN_THRESHOLD_YUAN,
                SGE_ALERT_CONFIG.BASE_THRESHOLD_YUAN + 2.2 * rollingStd
              ) * getSessionMultiplier(beijingHour)
            };
          } catch (statusError) {
            console.log(`[SSE] Level 3 status error: ${statusError.message}`);
          }
          
          const message = `data: ${JSON.stringify({
            type: 'price_update',
            clientId: clientId,
            timestamp: Date.now(),
            fromCache: fromCache,
            data: data,
            level3: level3Status
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

// 定时爬取入口（用于 Cron Trigger）- 带重试机制和AI数据提交
async function scheduledGoldCrawlWithAI(event, env, ctx) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 3000;
  const pipelineStartTime = Date.now();
  
  console.log('[Pipeline] Starting gold price pipeline at', new Date().toISOString());
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[Scheduled] Attempt ${attempt}/${MAX_RETRIES} at`, new Date().toISOString());
    
    try {
      const crawlStartTime = Date.now();
      const result = await performCrawl(env);
      const crawlLatency = Date.now() - crawlStartTime;
      
      if (result.success) {
        console.log('[Scheduled] Crawl successful in', crawlLatency, 'ms');
        
        const today = getBeijingDate();
        // 先取历史再存库，保证波动预警对比的是「上一分钟 vs 当前」，而不是「当前 vs 当前」
        const historyForAlert = await getDayHistory(env, today);
        
        const storeStartTime = Date.now();
        await storeGoldPriceData(env, result);
        const storeLatency = Date.now() - storeStartTime;
        
        await logCrawlStatus(env, 'success', result);
        
        const alertStartTime = Date.now();
        if (result.domestic?.price) {
          console.log('[Scheduled] Checking trading price alerts...');
          await checkAndSendTradingAlerts(result.domestic.price, env);
        }
        if (result.domestic && result.international) {
          await sendGoldPriceAlert(result.domestic, result.international, historyForAlert, env);
        }
        const alertLatency = Date.now() - alertStartTime;
        
        ctx.waitUntil(submitDataToAIAnalysis(env, result));
        
        // 每小时执行一次数据清理
        const currentHour = new Date().getHours();
        if (currentHour === 0) {
          ctx.waitUntil(cleanupOldData(env));
        }
        
        const totalLatency = Date.now() - pipelineStartTime;
        console.log('[Pipeline] Completed in', totalLatency, 'ms', {
          crawl: crawlLatency,
          store: storeLatency,
          alert: alertLatency,
          total: totalLatency
        });
        
        await logPipelineMetrics(env, {
          crawlLatency,
          storeLatency,
          alertLatency,
          totalLatency,
          success: true,
          timestamp: Date.now()
        });
        
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

async function logPipelineMetrics(env, metrics) {
  if (!env?.GOLD_PRICE_CACHE) return;
  
  try {
    const today = getBeijingDate();
    const key = `pipeline_metrics:${today}`;
    
    let metricsHistory = [];
    try {
      const existing = await env.GOLD_PRICE_CACHE.get(key);
      if (existing) {
        metricsHistory = JSON.parse(existing);
      }
    } catch (e) {}
    
    metricsHistory.push(metrics);
    
    // 自动清理：只保留最近7天的指标数据
    if (metricsHistory.length > 1440 * 7) {
      metricsHistory = metricsHistory.slice(-1440 * 7);
    }
    
    await env.GOLD_PRICE_CACHE.put(key, JSON.stringify(metricsHistory), {
      expirationTtl: 7 * 24 * 60 * 60
    });
  } catch (error) {
    console.error('[Metrics] Failed to log pipeline metrics:', error);
  }
}

async function cleanupOldData(env) {
  if (!env?.DB) return;
  
  try {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    // 清理旧的预警历史
    const alertResult = await env.DB.prepare(
      'DELETE FROM alert_history WHERE timestamp < ?'
    ).bind(sevenDaysAgo).run();
    
    // 清理旧的 AI 分析结果
    const aiResult = await env.DB.prepare(
      'DELETE FROM ai_analysis_results WHERE timestamp < ?'
    ).bind(sevenDaysAgo).run();
    
    console.log(`[Cleanup] Deleted ${alertResult.changes || 0} old alerts, ${aiResult.changes || 0} old AI results`);
  } catch (error) {
    console.log('[Cleanup] Cleanup skipped:', error.message);
  }
}

// 提交数据到AI智能分析系统
async function submitDataToAIAnalysis(env, crawlResult) {
  try {
    const today = getBeijingDate();
    
    // 获取今日历史数据
    const historyData = await getTodayGoldPriceHistory(env, today);
    
    if (!historyData || historyData.length === 0) {
      console.log('[AI Submit] No history data available');
      return;
    }
    
    console.log(`[AI Submit] Retrieved ${historyData.length} data points for analysis`);
    
    // 获取交易参数
    const tradingParams = await getTradingParameters(env);
    
    // 分析市场趋势
    const marketAnalysis = analyzeMarketTrend(historyData);
    
    // 构建AI分析提示
    const analysisPrompt = buildAIAnalysisPrompt(historyData, tradingParams, marketAnalysis, crawlResult);
    
    // 并行调用多个AI服务
    const [qwenResult, doubaoResult] = await Promise.allSettled([
      callQwenForAnalysis(env, analysisPrompt),
      callDoubaoForAnalysis(env, analysisPrompt)
    ]);
    
    // 处理结果
    const qwenAnalysis = qwenResult.status === 'fulfilled' ? qwenResult.value : null;
    const doubaoAnalysis = doubaoResult.status === 'fulfilled' ? doubaoResult.value : null;
    
    // 合并AI结果
    const combinedAnalysis = combineAIResults(qwenAnalysis, doubaoAnalysis, marketAnalysis);
    
    // 存储分析结果
    await storeAIAnalysisResult(env, today, {
      timestamp: Date.now(),
      currentPrice: crawlResult.domestic?.price || crawlResult.international?.price,
      marketAnalysis,
      aiAnalysis: combinedAnalysis,
      tradingParams,
      dataPoints: historyData.length
    });
    
    console.log('[AI Submit] Analysis completed and stored successfully');
    
    // 如果有交易信号，发送通知
    if (combinedAnalysis.hasValue && combinedAnalysis.signals) {
      const hasActiveAlerts = tradingParams.alerts && tradingParams.alerts.length > 0;
      if (hasActiveAlerts) {
        await sendAITradingSignal(env, combinedAnalysis, crawlResult.domestic?.price, tradingParams);
      }
    }
    
  } catch (error) {
    console.error('[AI Submit] Error submitting data to AI analysis:', error);
    // 记录错误但不影响主流程
    await logAIAnalysisError(env, error);
  }
}

// 构建AI分析提示（增强版）
function buildAIAnalysisPrompt(historyData, tradingParams, marketAnalysis, crawlResult) {
  const recentPrices = historyData.slice(-30).map(h => ({
    time: new Date(h.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    price: h.price
  }));
  
  const currentPrice = crawlResult.domestic?.price || crawlResult.international?.price || marketAnalysis.currentPrice;
  
  return `作为黄金交易专家，请基于以下实时数据给出专业的交易分析和建议：

【实时行情数据】
当前价格: ¥${currentPrice}/克
今日开盘: ¥${marketAnalysis.openPrice}/克
今日最高: ¥${marketAnalysis.high}/克
今日最低: ¥${marketAnalysis.low}/克
日内涨跌: ${marketAnalysis.dayChange.toFixed(2)}%
波动率: ${marketAnalysis.volatility.toFixed(2)}%

【近期价格走势】(最近30个数据点)
${recentPrices.map(p => `${p.time}: ¥${p.price}/克`).join('\n')}

【市场趋势分析】
趋势方向: ${marketAnalysis.trend}
趋势强度: ${marketAnalysis.strength.toFixed(2)}%

【交易参数】
平均持仓成本: ¥${tradingParams.avgBuyPrice.toFixed(2)}/克
持仓总量: ${tradingParams.totalHoldings.toFixed(3)}克
买入目标价: ${tradingParams.buyTargets.map(p => `¥${p}`).join(', ') || '未设置'}
卖出目标价: ${tradingParams.sellTargets.map(p => `¥${p}`).join(', ') || '未设置'}
活跃预警数: ${tradingParams.alerts?.length || 0}

请提供以下分析（用JSON格式返回）:
{
  "trend": "上涨/下跌/震荡",
  "trendConfidence": 0-100,
  "recommendation": "买入/卖出/持有",
  "recommendationConfidence": 0-100,
  "targetPrice": 目标价格,
  "stopLoss": 止损价格,
  "takeProfit": 止盈价格,
  "riskLevel": "低/中/高",
  "reasoning": "分析理由",
  "expectedReturn": "预期收益率"
}`;
}

// 存储AI分析结果
async function storeAIAnalysisResult(env, date, analysisData) {
  try {
    if (!env.GOLD_PRICE_CACHE) {
      console.warn('[AI Store] GOLD_PRICE_CACHE not available');
      return;
    }
    
    const key = `ai_analysis:${date}`;
    
    // 获取现有分析记录
    let analyses = [];
    try {
      const existing = await env.GOLD_PRICE_CACHE.get(key);
      if (existing) {
        analyses = JSON.parse(existing);
      }
    } catch (e) {
      console.log('[AI Store] No existing analysis data');
    }
    
    // 添加新的分析结果
    analyses.push(analysisData);
    
    // 只保留最近1440条记录（24小时，每分钟一条）
    if (analyses.length > 1440) {
      analyses = analyses.slice(-1440);
    }
    
    // 存储到KV
    await env.GOLD_PRICE_CACHE.put(key, JSON.stringify(analyses), {
      expirationTtl: 3 * 24 * 60 * 60 // 3天
    });
    
    // 同时存储到 D1 数据库
    if (env.DB && analysisData.aiAnalysis) {
      try {
        await env.DB.prepare(`
          INSERT INTO ai_analysis_results (timestamp, price, trend, confidence, signals, recommendation, risk_level)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          analysisData.timestamp,
          analysisData.currentPrice,
          analysisData.marketAnalysis?.trend || 'unknown',
          analysisData.aiAnalysis?.confidence || 0,
          JSON.stringify(analysisData.aiAnalysis?.signals || []),
          analysisData.aiAnalysis?.recommendation || '',
          analysisData.aiAnalysis?.riskLevel || 'medium'
        ).run();
      } catch (dbError) {
        console.log('[AI Store] D1 insert skipped (table may not exist):', dbError.message);
      }
    }
    
    console.log(`[AI Store] Stored analysis result. Total records: ${analyses.length}`);
    
  } catch (error) {
    console.error('[AI Store] Error storing analysis result:', error);
  }
}

// 发送AI交易信号通知（三端：邮件 / 飞书 / MeoW）
async function sendAITradingSignal(env, analysis, currentPrice, tradingParams) {
  try {
    const { recommendation, signals } = analysis;
    
    if (!recommendation || recommendation === 'hold') {
      return;
    }
    
    const cooldownKey = 'last_ai_signal_notify';
    const lastNotify = await env.GOLD_PRICE_CACHE?.get(cooldownKey);
    const now = Date.now();
    const COOLDOWN = 2 * 60 * 1000; // 2 分钟冷却期（AI 分析信号）

    if (lastNotify && (now - parseInt(lastNotify, 10)) < COOLDOWN) {
      console.log('[AI Signal] In cooldown period, skipping notification');
      return;
    }
    
    const signalType = recommendation === 'buy' ? '买入' : '卖出';
    const confidence = (signals && (signals.buy > signals.sell ? signals.buy : signals.sell)) || 0;
    const reason = (analysis.combinedAnalysis || '').substring(0, 150);
    const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    
    const title = `🤖 AI交易信号 - ${signalType}`;
    const meowContent = `🤖 AI交易信号\n\n信号类型: ${signalType}\n当前价格: ¥${currentPrice}/克\n置信度: ${confidence}/10\n${reason ? `分析依据: ${reason}...\n\n` : ''}请登录系统查看详细分析。`;
    const feishuContent = `**${title}**\n\n> 时间：${timeStr}\n\n**当前价格：** ¥${currentPrice}/克\n**置信度：** ${confidence}/10\n${reason ? `**分析依据：** ${reason}...\n\n` : ''}[查看详情](https://ustc.dev/trading/)`;
    const emailSubject = `🤖 AI交易信号 - ${signalType} - ${timeStr}`;
    const emailHtml = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>body{font-family:-apple-system,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;}
.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:16px;border-radius:12px 12px 0 0;text-align:center;}
.content{background:#f8f9fa;padding:24px;border-radius:0 0 12px 12px;}
.price{font-size:24px;font-weight:700;color:#667eea;}
.footer{margin-top:20px;padding-top:16px;border-top:1px solid #ddd;color:#999;font-size:12px;}</style></head>
<body><div class="header"><h1>🤖 AI交易信号</h1><p>${signalType} · ${timeStr}</p></div>
<div class="content"><p><strong>当前价格：</strong> <span class="price">¥${currentPrice}/克</span></p>
<p><strong>置信度：</strong> ${confidence}/10</p>
${reason ? `<p><strong>分析依据：</strong> ${reason}...</p>` : ''}
<p><a href="https://ustc.dev/trading/">查看交易详情</a></p>
<div class="footer">此邮件由 Meow 系统自动发送</div></div></body></html>`;
    
    await sendMultiChannelNotification(env, {
      title,
      emailSubject,
      emailHtml,
      feishuContent,
      meowContent
    });
    
    if (env.GOLD_PRICE_CACHE) {
      await env.GOLD_PRICE_CACHE.put(cooldownKey, String(now), { expirationTtl: 3600 });
    }
    console.log('[AI Signal] Trading signal notification sent (email/feishu/meow)');
    
  } catch (error) {
    console.error('[AI Signal] Error sending notification:', error);
  }
}

// 记录AI分析错误
async function logAIAnalysisError(env, error) {
  try {
    if (!env.GOLD_PRICE_CACHE) return;
    
    const today = getBeijingDate();
    const key = `ai_analysis_errors:${today}`;
    
    let errors = [];
    try {
      const existing = await env.GOLD_PRICE_CACHE.get(key);
      if (existing) {
        errors = JSON.parse(existing);
      }
    } catch (e) {}
    
    errors.push({
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack
    });
    
    // 只保留最近100条错误记录
    if (errors.length > 100) {
      errors = errors.slice(-100);
    }
    
    await env.GOLD_PRICE_CACHE.put(key, JSON.stringify(errors), {
      expirationTtl: 7 * 24 * 60 * 60 // 7天
    });
    
  } catch (e) {
    console.error('[AI Error Log] Failed to log error:', e);
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
      const COOLDOWN = 5 * 60 * 1000; // 5分钟冷却期（智能分析买入信号）

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

    // Store in D1 for intelligent analysis
    try {
      const price = data.domestic?.price || data.international?.price;
      if (price && env.DB) {
        await env.DB.prepare(`
          INSERT INTO gold_price_history (price, date, timestamp)
          VALUES (?, ?, ?)
        `).bind(price, dateKey, new Date().toISOString()).run();
        console.log('[Store] Price history stored in D1:', price);
      }
    } catch (dbError) {
      console.warn('[Store] Failed to store price history to D1:', dbError.message);
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
    
    let days = 30;
    switch (range) {
      case '1m': days = 30; break;
      case '3m': days = 90; break;
      case '6m': days = 180; break;
      case '1y': days = 365; break;
    }
    
    const labels = [];
    const domesticPrices = [];
    const internationalPrices = [];
    const now = Date.now();
    
    if (env?.GOLD_PRICE_CACHE) {
      const dailyData = [];
      
      for (let i = days; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        try {
          const historyKey = `history:${dateStr}`;
          const dayHistory = await env.GOLD_PRICE_CACHE.get(historyKey);
          
          if (dayHistory) {
            const parsed = JSON.parse(dayHistory);
            if (parsed && parsed.length > 0) {
              const lastEntry = parsed[parsed.length - 1];
              domesticPrices.push(lastEntry.domestic || 0);
              internationalPrices.push(lastEntry.international || 0);
              dailyData.push({ date: dateStr, domestic: lastEntry.domestic, international: lastEntry.international });
            } else {
              domesticPrices.push(null);
              internationalPrices.push(null);
            }
          } else {
            const statsKey = `stats:${dateStr}`;
            const stats = await env.GOLD_PRICE_CACHE.get(statsKey);
            if (stats) {
              const parsedStats = JSON.parse(stats);
              domesticPrices.push(parsedStats.domesticClose || parsedStats.domesticHigh || null);
              internationalPrices.push(parsedStats.internationalClose || parsedStats.internationalHigh || null);
            } else {
              domesticPrices.push(null);
              internationalPrices.push(null);
            }
          }
        } catch (e) {
          console.error(`[History] Error fetching data for ${dateStr}:`, e.message);
          domesticPrices.push(null);
          internationalPrices.push(null);
        }
      }
      
      const validDomestic = domesticPrices.filter(p => p !== null);
      const validInternational = internationalPrices.filter(p => p !== null);
      
      if (validDomestic.length > 0 || validInternational.length > 0) {
        return jsonResponse({
          success: true,
          range,
          labels,
          domestic: { prices: domesticPrices },
          international: { prices: internationalPrices },
          dataSource: 'kv_storage',
          dataPoints: { domestic: validDomestic.length, international: validInternational.length }
        });
      }
    }
    
    console.log('[History] No KV data available, returning empty result');
    return jsonResponse({
      success: true,
      range,
      labels,
      domestic: { prices: domesticPrices },
      international: { prices: internationalPrices },
      dataSource: 'empty',
      message: 'No historical data available yet. Data will be collected over time.'
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
        from: 'USTC Dev <noreply@ustc.dev>',
        to: ['metanext@foxmail.com'],
        subject: '🎉 USTC Dev 新用户注册通知',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0b; color: #fafafa;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #00d4ff; margin: 0;">USTC Dev</h1>
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
        from: 'USTC Dev <noreply@ustc.dev>',
        to: [sanitizedEmail],
        subject: '🚀 欢迎加入 USTC Dev',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0a0a0b; color: #fafafa;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #00d4ff; margin: 0;">USTC Dev</h1>
              <p style="color: #71717a; margin-top: 5px;">欢迎加入我们</p>
            </div>
            <div style="background: #18181b; padding: 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
              <p style="color: #fafafa; font-size: 16px; margin: 0 0 16px 0;">Hi ${sanitizedUsername}，</p>
              <p style="color: #a1a1aa; line-height: 1.6; margin: 0 0 16px 0;">感谢你注册 USTC Dev！你的账号已创建成功。</p>
              <p style="color: #a1a1aa; line-height: 1.6; margin: 0 0 24px 0;">现在你可以使用我们的 AI 助手、探索最新的技术资讯，开启你的智能时代之旅。</p>
              <div style="text-align: center;">
                <a href="https://ustc.dev" style="display: inline-block; background: linear-gradient(135deg, #00d4ff, #0099cc); color: #000; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">开始探索</a>
              </div>
            </div>
            <p style="text-align: center; color: #71717a; font-size: 12px; margin-top: 24px;">如果你没有注册过 USTC Dev，请忽略此邮件</p>
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

async function sendGoldPriceAlert(domestic, international, history, env) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.log('[Gold Alert] RESEND_API_KEY not configured, skipping alert');
    return;
  }

  const now = Date.now();
  const beijingHour = getBeijingHour();
  const session = getSession(beijingHour);
  const sessionMultiplier = getSessionMultiplier(beijingHour);
  
  let userTolerance = { buyTolerance: SGE_ALERT_CONFIG.BASE_THRESHOLD_YUAN, sellTolerance: SGE_ALERT_CONFIG.BASE_THRESHOLD_YUAN };
  try {
    const toleranceStmt = env.DB.prepare(`SELECT buy_tolerance, sell_tolerance FROM alert_tolerance_settings ORDER BY id DESC LIMIT 1`);
    const toleranceResult = await toleranceStmt.first();
    if (toleranceResult) {
      userTolerance = {
        buyTolerance: clamp(parseFloat(toleranceResult.buy_tolerance) || SGE_ALERT_CONFIG.BASE_THRESHOLD_YUAN, SGE_ALERT_CONFIG.TOLERANCE_MIN, SGE_ALERT_CONFIG.TOLERANCE_MAX),
        sellTolerance: clamp(parseFloat(toleranceResult.sell_tolerance) || SGE_ALERT_CONFIG.BASE_THRESHOLD_YUAN, SGE_ALERT_CONFIG.TOLERANCE_MIN, SGE_ALERT_CONFIG.TOLERANCE_MAX)
      };
      console.log(`[Level3] User tolerance loaded: buy=${userTolerance.buyTolerance}, sell=${userTolerance.sellTolerance}`);
    }
  } catch (e) {
    console.log('[Level3] Failed to load tolerance settings, using defaults');
  }
  
  // 免打扰时段检查
  if (beijingHour >= SGE_ALERT_CONFIG.QUIET_HOURS_START && beijingHour < SGE_ALERT_CONFIG.QUIET_HOURS_END) {
    console.log(`[Level3] Quiet hours (${SGE_ALERT_CONFIG.QUIET_HOURS_START}:00-${SGE_ALERT_CONFIG.QUIET_HOURS_END}:00), skipping alerts`);
    return;
  }
  
  const priceHistory = history?.domestic || [];
  const rollingStd = calculateStd(priceHistory.slice(-SGE_ALERT_CONFIG.VOL_WINDOW));
  const rollingMean = calculateMean(priceHistory.slice(-SGE_ALERT_CONFIG.VOL_WINDOW));
  
  const prevPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : domestic?.price;
  const currentPrice = domestic?.price;
  
  let state = await getLevel3State(env);
  
  // EMA 初始化：首次运行或状态重置时使用当前价格初始化
  if (!state.emaFast || state.emaFast === 0 || !state.emaSlow || state.emaSlow === 0 || state.lastPrice === 0) {
    state.emaFast = currentPrice;
    state.emaSlow = currentPrice;
    console.log(`[Level3] EMA initialized with price: ${currentPrice}`);
  } else {
    state.emaFast = calculateEMA(state.emaFast, currentPrice, SGE_ALERT_CONFIG.EMA_FAST);
    state.emaSlow = calculateEMA(state.emaSlow, currentPrice, SGE_ALERT_CONFIG.EMA_SLOW);
  }
  state.lastPrice = currentPrice;
  
  state.priceHistory.push(currentPrice);
  if (state.priceHistory.length > SGE_ALERT_CONFIG.VOL_WINDOW) {
    state.priceHistory = state.priceHistory.slice(-SGE_ALERT_CONFIG.VOL_WINDOW);
  }
  
  const atr = calculateATR(state.priceHistory, SGE_ALERT_CONFIG.ATR_PERIOD);
  
  const fusionResult = fuseSignals(currentPrice, prevPrice, state, atr, rollingStd, rollingMean, session);
  
  await saveLevel3State(env, state);
  
  console.log(`[Level3] Score: ${fusionResult.score}/${fusionResult.requiredScore} (release: ${fusionResult.releaseScore}), Direction: ${fusionResult.direction}, Confidence: ${(fusionResult.confidence * 100).toFixed(1)}%, Consensus: ${((fusionResult.directionConsensus || 0) * 100).toFixed(0)}%, State: ${fusionResult.hysteresisState}`);
  console.log(`[Level3] EMA Fast/Slow: ${state.emaFast.toFixed(2)}/${state.emaSlow.toFixed(2)}, ATR: ${atr.toFixed(2)}, Std: ${rollingStd.toFixed(2)}, TrendConfirm: ${state.trendConfirmCount || 0}`);

  const alerts = [];
  
  if (fusionResult.triggered) {
    const sessionText = session === 'night' ? '夜盘' : session === 'afternoon' ? '午盘' : '早盘';
    const directionText = fusionResult.direction === 'up' ? '上涨' : fusionResult.direction === 'down' ? '下跌' : '震荡';
    
    alerts.push({
      type: 'level3_fusion',
      name: `Level 3 预警 (${sessionText})`,
      price: currentPrice,
      unit: '元/克',
      direction: fusionResult.direction,
      score: fusionResult.score,
      requiredScore: fusionResult.requiredScore,
      confidence: fusionResult.confidence,
      directionConsensus: fusionResult.directionConsensus,
      message: `信号融合评分 ${fusionResult.score}/${fusionResult.requiredScore}，检测到${directionText}信号，置信度 ${(fusionResult.confidence * 100).toFixed(1)}%，方向一致性 ${((fusionResult.directionConsensus || 0) * 100).toFixed(0)}%`
    });
  }
  
  const domesticInstant = analyzeInstantChange(history?.domestic || [], domestic?.price, userTolerance.buyTolerance, SGE_ALERT_CONFIG.INSTANT_PERCENT_THRESHOLD);
  const internationalInstant = analyzeInstantChange(history?.international || [], international?.price, userTolerance.sellTolerance, SGE_ALERT_CONFIG.INSTANT_PERCENT_THRESHOLD);
  
  if (domesticInstant.triggered) {
    alerts.push({
      type: 'instant',
      name: '国内黄金 (mAuT+D)',
      price: domestic.price,
      unit: '元/克',
      ...domesticInstant
    });
    console.log('[Gold Alert] INSTANT domestic price change detected:', domesticInstant.message);
  }
  
  if (internationalInstant.triggered) {
    alerts.push({
      type: 'instant',
      name: '国际黄金 (XAU)',
      price: international.price,
      unit: '美元/盎司',
      ...internationalInstant
    });
    console.log('[Gold Alert] INSTANT international price change detected:', internationalInstant.message);
  }
  
  // 窗口/短期：用「含当前点」的序列，保证最近 N 个点包含最新价
  const domesticSeries = [...(history?.domestic || []), domestic?.price].filter(v => v != null && v > 0);
  const internationalSeries = [...(history?.international || []), international?.price].filter(v => v != null && v > 0);
  const domesticWindow = analyzeWindow(domesticSeries, userTolerance.buyTolerance);
  const internationalWindow = analyzeWindow(internationalSeries, userTolerance.sellTolerance);
  
  const domesticShortTerm = analyzeShortTerm(domesticSeries, userTolerance.buyTolerance);
  const internationalShortTerm = analyzeShortTerm(internationalSeries, userTolerance.sellTolerance);
  
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
  
  const volFactor = domestic?.price ? rollingStd / domestic.price : 0;
  
  let dynamicCooldown = SGE_ALERT_CONFIG.BASE_COOLDOWN_SECONDS * (1 + 5 * volFactor) * sessionMultiplier;
  dynamicCooldown = clamp(dynamicCooldown, SGE_ALERT_CONFIG.BASE_COOLDOWN_SECONDS, SGE_ALERT_CONFIG.MAX_COOLDOWN_SECONDS);
  
  const cooldownMs = dynamicCooldown * 1000;
  
  console.log(`[Gold Alert] Dynamic cooldown: ${dynamicCooldown.toFixed(0)}s (volFactor: ${volFactor.toFixed(4)}, session: ${session})`);
  
  if (env?.GOLD_PRICE_CACHE) {
    try {
      const lastAlert = await env.GOLD_PRICE_CACHE.get('last_alert');
      const lastAlertDirection = await env.GOLD_PRICE_CACHE.get('last_alert_direction');
      
      if (lastAlert) {
        const lastAlertTime = parseInt(lastAlert);
        const timeSinceLastAlert = (now - lastAlertTime) / 1000;
        const alertDirection = alerts.some(a => a.direction === 'down') ? 'down' : 'up';
        
        // 方向改变时立即允许通知（暴涨→暴跌 或 暴跌→暴涨）
        if (lastAlertDirection && lastAlertDirection !== alertDirection) {
          console.log(`[Gold Alert] Direction changed from ${lastAlertDirection} to ${alertDirection}, allowing immediate notification`);
        }
        // 方向相同：检查冷却期和去重窗口
        else if (timeSinceLastAlert < dynamicCooldown) {
          if (timeSinceLastAlert < SGE_ALERT_CONFIG.DEDUP_WINDOW_SECONDS) {
            console.log(`[Gold Alert] Duplicate alert suppressed (same direction: ${alertDirection}, ${timeSinceLastAlert.toFixed(0)}s ago)`);
            return;
          }
          console.log(`[Gold Alert] Alert already sent ${timeSinceLastAlert.toFixed(0)}s ago, cooldown: ${dynamicCooldown.toFixed(0)}s`);
          return;
        }
      }
    } catch (e) {
      console.log('[Gold Alert] Failed to check last alert time');
    }
  }
  
  const hasInstantAlert = alerts.some(a => a.type === 'instant');
  console.log('[Gold Alert] Price movement detected!', alerts.length, 'alerts, instant:', hasInstantAlert);

  const result = await sendUnifiedNotification(alerts, env, {
    notificationType: hasInstantAlert ? 'instant_price_change' : 'price_movement',
    skipCooldown: true
  });
  
  if (result.success && env?.GOLD_PRICE_CACHE) {
    await env.GOLD_PRICE_CACHE.put('last_alert', String(now), { expirationTtl: 600 });
    const alertDirection = alerts.some(a => a.direction === 'down') ? 'down' : 'up';
    await env.GOLD_PRICE_CACHE.put('last_alert_direction', alertDirection, { expirationTtl: 600 });
    
    const historyJson = await env.GOLD_PRICE_CACHE.get('level3_alert_history');
    let historyList = historyJson ? JSON.parse(historyJson) : [];
    
    historyList.push({
      timestamp: now,
      session,
      direction: alertDirection,
      price: domestic?.price,
      alerts: alerts.map(a => ({
        type: a.type,
        name: a.name,
        message: a.message,
        score: a.score,
        confidence: a.confidence
      })),
      level3Metadata: {
        emaFast: state.emaFast,
        emaSlow: state.emaSlow,
        atr,
        rollingStd,
        signalScore: fusionResult?.score || 0
      }
    });
    
    if (historyList.length > 1000) {
      historyList = historyList.slice(-1000);
    }
    
    await env.GOLD_PRICE_CACHE.put('level3_alert_history', JSON.stringify(historyList), {
      expirationTtl: 86400 * 7
    });
    
    // 同时存储到 D1 数据库
    if (env.DB) {
      try {
        for (const alert of alerts) {
          await env.DB.prepare(`
            INSERT INTO alert_history (timestamp, session, direction, price, alert_type, alert_message, score, confidence, level3_metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            now,
            session,
            alertDirection,
            domestic?.price,
            alert.type,
            alert.message || alert.name,
            alert.score || 0,
            alert.confidence || 0,
            JSON.stringify({
              emaFast: state.emaFast,
              emaSlow: state.emaSlow,
              atr,
              rollingStd,
              signalScore: fusionResult?.score || 0
            })
          ).run();
        }
      } catch (dbError) {
        console.log('[Gold Alert] D1 insert skipped (table may not exist):', dbError.message);
      }
    }
  }

  console.log('[Gold Alert] Unified notification result:', {
    success: result.success,
    email: result.results.email?.success,
    feishu: result.results.feishu?.success,
    meow: result.results.meow?.success
  });
}

function analyzeInstantChange(prices, currentPrice, absoluteThreshold, percentThreshold) {
  if (!currentPrice || prices.length < 2) {
    return { triggered: false, reason: 'insufficient_data' };
  }
  
  const previousPrice = prices[prices.length - 1];
  if (!previousPrice || previousPrice <= 0) {
    return { triggered: false, reason: 'invalid_previous_price' };
  }
  
  const absoluteChange = Math.abs(currentPrice - previousPrice);
  const percentChange = Math.abs((currentPrice - previousPrice) / previousPrice) * 100;
  
  const isSignificant = absoluteChange >= absoluteThreshold || percentChange >= percentThreshold;
  
  if (isSignificant) {
    const direction = currentPrice > previousPrice ? 'up' : 'down';
    return {
      triggered: true,
      previousPrice: previousPrice.toFixed(2),
      currentPrice: currentPrice.toFixed(2),
      absoluteChange: absoluteChange.toFixed(2),
      percentChange: percentChange.toFixed(2),
      direction,
      message: `即时变化: ${direction === 'down' ? '下跌' : '上涨'} ${absoluteChange.toFixed(2)} (${percentChange.toFixed(2)}%)`
    };
  }
  
  return { triggered: false };
}

function analyzeWindow(prices, threshold) {
  if (prices.length < SGE_ALERT_CONFIG.WINDOW_SIZE) {
    return { triggered: false, reason: 'insufficient_data' };
  }
  
  const window = prices.slice(-SGE_ALERT_CONFIG.WINDOW_SIZE);
  const max = Math.max(...window);
  const min = Math.min(...window);
  const range = max - min;
  const current = window[window.length - 1];
  const direction = current <= min ? 'down' : (current >= max ? 'up' : 'volatile');
  
  if (range >= threshold) {
    return {
      triggered: true,
      range: range.toFixed(2),
      max: max.toFixed(2),
      min: min.toFixed(2),
      current: current.toFixed(2),
      direction: direction,
      message: `最近${SGE_ALERT_CONFIG.WINDOW_SIZE}个采集点波动 ${range.toFixed(2)}，超过阈值 ${threshold}`
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
        from: 'USTC Dev <noreply@ustc.dev>',
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
              <h3 style="color: #fafafa; margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">📊 滑动窗口检测 (最近${SGE_ALERT_CONFIG.WINDOW_SIZE}个采集点)</h3>
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
              <h3 style="color: #fafafa; margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">⚡ 短期波动检测 (最近${SGE_ALERT_CONFIG.SHORT_TERM_POINTS}分钟)</h3>
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
                <li>滑动窗口：最近${SGE_ALERT_CONFIG.WINDOW_SIZE}个采集点内，最高价与最低价差值超过阈值</li>
                <li>短期波动：当前价格与最近${SGE_ALERT_CONFIG.SHORT_TERM_POINTS}分钟内价格偏差超过阈值</li>
                <li>国内黄金阈值：${SGE_ALERT_CONFIG.BASE_THRESHOLD_YUAN} 元/克</li>
                <li>国际黄金阈值：${SGE_ALERT_CONFIG.BASE_THRESHOLD_YUAN} 美元/盎司</li>
              </ul>
            </div>
            
            <p style="text-align: center; color: #71717a; font-size: 12px; margin-top: 24px;">
              ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} | 此邮件由系统自动发送 | 动态冷却 ${SGE_ALERT_CONFIG.BASE_COOLDOWN_SECONDS}-${SGE_ALERT_CONFIG.MAX_COOLDOWN_SECONDS}秒
            </p>
          </div>
        `,
      }),
    });
    
    if (response.ok) {
      console.log('[Gold Alert] Alert email sent successfully');
    } else {
      const error = await response.text();
      console.error('[Gold Alert] Failed to send email:', error);
      throw new Error(`Email send failed: ${error}`);
    }
  } catch (error) {
    console.error('[Gold Alert] Exception:', error);
    throw error;
  }
}

// ================================================================================
// 统一通知系统 - 确保三端同步推送
// ================================================================================

const NOTIFICATION_CONFIG = {
  COOLDOWN_MINUTES: 0.5,
  MAX_RETRIES: 3,
  RETRY_DELAY: 500,
  INSTANT_COOLDOWN_SECONDS: 15,
  PARALLEL_SEND: true,
  MAX_EMAILS_PER_HOUR: 10,
  MAX_EMAILS_PER_DAY: 50
};

// 统一发送通知到所有渠道（Email + Feishu + MeoW）
async function sendUnifiedNotification(alerts, env, options = {}) {
  const {
    skipCooldown = false,
    notificationType = 'price_alert',
    customMessage = null
  } = options;

  console.log('[Unified Notification] Starting unified notification send...');
  console.log('[Unified Notification] Alert count:', alerts.length);
  console.log('[Unified Notification] Type:', notificationType);

  // 检查冷却期（除非跳过）
  if (!skipCooldown) {
    const cooldownKey = `notification_cooldown:${notificationType}`;
    const lastNotify = await env.GOLD_PRICE_CACHE?.get(cooldownKey);
    const now = Date.now();
    const cooldownMs = NOTIFICATION_CONFIG.COOLDOWN_MINUTES * 60 * 1000;

    if (lastNotify && (now - parseInt(lastNotify)) < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - (now - parseInt(lastNotify))) / 60000);
      console.log(`[Unified Notification] In cooldown period. ${remainingMinutes} minutes remaining.`);
      return {
        success: false,
        reason: 'cooldown',
        remainingMinutes,
        results: {}
      };
    }
  }

  // 邮件风暴保护：检查发送频率
  const now = Date.now();
  const hourKey = `email_rate_limit:hour:${Math.floor(now / 3600000)}`;
  const dayKey = `email_rate_limit:day:${Math.floor(now / 86400000)}`;
  
  try {
    const [hourCount, dayCount] = await Promise.all([
      env.GOLD_PRICE_CACHE?.get(hourKey),
      env.GOLD_PRICE_CACHE?.get(dayKey)
    ]);
    
    const hourlyEmails = parseInt(hourCount || '0');
    const dailyEmails = parseInt(dayCount || '0');
    
    if (hourlyEmails >= NOTIFICATION_CONFIG.MAX_EMAILS_PER_HOUR) {
      console.log(`[Unified Notification] Hourly rate limit reached: ${hourlyEmails}/${NOTIFICATION_CONFIG.MAX_EMAILS_PER_HOUR}`);
      return {
        success: false,
        reason: 'rate_limit_hourly',
        hourlyEmails,
        maxPerHour: NOTIFICATION_CONFIG.MAX_EMAILS_PER_HOUR,
        results: {}
      };
    }
    
    if (dailyEmails >= NOTIFICATION_CONFIG.MAX_EMAILS_PER_DAY) {
      console.log(`[Unified Notification] Daily rate limit reached: ${dailyEmails}/${NOTIFICATION_CONFIG.MAX_EMAILS_PER_DAY}`);
      return {
        success: false,
        reason: 'rate_limit_daily',
        dailyEmails,
        maxPerDay: NOTIFICATION_CONFIG.MAX_EMAILS_PER_DAY,
        results: {}
      };
    }
  } catch (rateLimitError) {
    console.log('[Unified Notification] Rate limit check failed, continuing:', rateLimitError.message);
  }

  // 准备通知内容
  const notificationContent = customMessage || formatAlertMessage(alerts);

  // 并行发送所有通知
  const results = await Promise.allSettled([
    // Email通知
    sendAlertEmailWithTracking(alerts, env, notificationContent).catch(err => {
      console.error('[Unified Notification] Email failed:', err);
      return { channel: 'email', success: false, error: err.message };
    }),

    // 飞书通知
    sendFeishuAlertWithTracking(alerts, env, notificationContent).catch(err => {
      console.error('[Unified Notification] Feishu failed:', err);
      return { channel: 'feishu', success: false, error: err.message };
    }),

    // MeoW通知
    sendMeoWAlertWithTracking(alerts, env, notificationContent).catch(err => {
      console.error('[Unified Notification] MeoW failed:', err);
      return { channel: 'meow', success: false, error: err.message };
    })
  ]);

  // 处理结果
  const resultMap = {
    email: results[0].status === 'fulfilled' ? results[0].value : { success: false, error: results[0].reason },
    feishu: results[1].status === 'fulfilled' ? results[1].value : { success: false, error: results[1].reason },
    meow: results[2].status === 'fulfilled' ? results[2].value : { success: false, error: results[2].reason }
  };

  // 记录发送历史
  const sendRecord = {
    timestamp: Date.now(),
    type: notificationType,
    alertCount: alerts.length,
    results: resultMap
  };

  await recordNotificationHistory(env, sendRecord);

  // 更新冷却时间（如果至少有一个成功）
  const anySuccess = Object.values(resultMap).some(r => r.success);
  if (anySuccess && !skipCooldown) {
    const cooldownKey = `notification_cooldown:${notificationType}`;
    await env.GOLD_PRICE_CACHE?.put(cooldownKey, String(Date.now()), {
      expirationTtl: NOTIFICATION_CONFIG.COOLDOWN_MINUTES * 60
    });
    console.log('[Unified Notification] Cooldown timer updated');
    
    // 更新速率限制计数器
    if (resultMap.email?.success) {
      try {
        const sendNow = Date.now();
        const hourKey = `email_rate_limit:hour:${Math.floor(sendNow / 3600000)}`;
        const dayKey = `email_rate_limit:day:${Math.floor(sendNow / 86400000)}`;
        
        const [currentHour, currentDay] = await Promise.all([
          env.GOLD_PRICE_CACHE?.get(hourKey),
          env.GOLD_PRICE_CACHE?.get(dayKey)
        ]);
        
        await Promise.all([
          env.GOLD_PRICE_CACHE?.put(hourKey, String(parseInt(currentHour || '0') + 1), { expirationTtl: 3600 }),
          env.GOLD_PRICE_CACHE?.put(dayKey, String(parseInt(currentDay || '0') + 1), { expirationTtl: 86400 })
        ]);
      } catch (counterError) {
        console.log('[Unified Notification] Rate counter update failed:', counterError.message);
      }
    }
  }

  console.log('[Unified Notification] Send completed:', {
    email: resultMap.email.success,
    feishu: resultMap.feishu.success,
    meow: resultMap.meow.success
  });

  return {
    success: anySuccess,
    results: resultMap,
    timestamp: Date.now()
  };
}

// 格式化预警消息
function formatAlertMessage(alerts) {
  const hasDownward = alerts.some(a => a.direction === 'down');
  const hasVolatile = alerts.some(a => a.direction === 'volatile');
  const alertEmoji = hasDownward ? '🚨' : (hasVolatile ? '⚡' : '📈');
  const alertTitle = hasDownward ? '金价暴跌预警' : (hasVolatile ? '金价剧烈波动' : '金价快速上涨');

  let message = `${alertEmoji} ${alertTitle}\n\n`;
  message += `时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;

  alerts.forEach(alert => {
    message += `${alert.name}: ${alert.current} ${alert.unit}`;
    if (alert.range) {
      message += ` (波动${alert.range})`;
    }
    message += '\n';
  });

  message += '\n[查看详情](https://ustc.dev/kit/gold/)';

  return { title: `${alertEmoji} ${alertTitle}`, content: message, emoji: alertEmoji };
}

// 带追踪的Email发送
async function sendAlertEmailWithTracking(alerts, env, messageContent) {
  const RESEND_API_KEY = env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.log('[Email Tracking] RESEND_API_KEY not configured');
    return { channel: 'email', success: false, reason: 'not_configured' };
  }

  try {
    console.log('[Email Tracking] Sending email notification...');
    await sendAlertEmail(alerts, env);
    console.log('[Email Tracking] Email sent successfully');
    return { channel: 'email', success: true };
  } catch (error) {
    console.error('[Email Tracking] Email failed:', error);
    return { channel: 'email', success: false, error: error.message };
  }
}

// 带追踪的飞书发送
async function sendFeishuAlertWithTracking(alerts, env, messageContent) {
  const FEISHU_WEBHOOK = env.FEISHU_WEBHOOK;
  const FEISHU_APP_ID = env.FEISHU_APP_ID;
  const FEISHU_APP_SECRET = env.FEISHU_APP_SECRET;
  const FEISHU_CHAT_ID = env.FEISHU_CHAT_ID;

  const hasConfig = FEISHU_WEBHOOK || (FEISHU_APP_ID && FEISHU_APP_SECRET && FEISHU_CHAT_ID);

  if (!hasConfig) {
    console.log('[Feishu Tracking] Feishu not configured');
    return { channel: 'feishu', success: false, reason: 'not_configured' };
  }

  try {
    console.log('[Feishu Tracking] Sending Feishu notification...');
    const result = await sendFeishuAlert(alerts, env);
    console.log('[Feishu Tracking] Feishu sent:', result.method);
    return { channel: 'feishu', success: result.method !== 'none', method: result.method };
  } catch (error) {
    console.error('[Feishu Tracking] Feishu failed:', error);
    return { channel: 'feishu', success: false, error: error.message };
  }
}

// 带追踪的MeoW发送
async function sendMeoWAlertWithTracking(alerts, env, messageContent) {
  const MEOW_USER_ID = env.MEOW_USER_ID || '5bf48882';

  if (!MEOW_USER_ID) {
    console.log('[MeoW Tracking] MEOW_USER_ID not configured');
    return { channel: 'meow', success: false, reason: 'not_configured' };
  }

  try {
    console.log('[MeoW Tracking] Sending MeoW notification...');
    const result = await sendMeoWAlert(alerts, env);
    console.log('[MeoW Tracking] MeoW sent:', result.success);
    return { channel: 'meow', success: result.success, response: result.response };
  } catch (error) {
    console.error('[MeoW Tracking] MeoW failed:', error);
    return { channel: 'meow', success: false, error: error.message };
  }
}

// 记录通知历史
async function recordNotificationHistory(env, record) {
  try {
    if (!env.GOLD_PRICE_CACHE) return;

    const today = new Date().toISOString().split('T')[0];
    const key = `notification_history:${today}`;

    let history = [];
    const existing = await env.GOLD_PRICE_CACHE.get(key);
    if (existing) {
      history = JSON.parse(existing);
    }

    history.push(record);

    // 只保留最近100条记录
    if (history.length > 100) {
      history = history.slice(-100);
    }

    await env.GOLD_PRICE_CACHE.put(key, JSON.stringify(history), {
      expirationTtl: 7 * 24 * 60 * 60 // 7天
    });

  } catch (error) {
    console.error('[Notification History] Failed to record:', error);
  }
}

// 获取通知历史
async function getNotificationHistory(env, date = null) {
  try {
    if (!env.GOLD_PRICE_CACHE) return [];

    const targetDate = date || new Date().toISOString().split('T')[0];
    const key = `notification_history:${targetDate}`;

    const data = await env.GOLD_PRICE_CACHE.get(key);
    return data ? JSON.parse(data) : [];

  } catch (error) {
    console.error('[Notification History] Failed to get:', error);
    return [];
  }
}

// ================================================================================
// 原有通知函数（保留用于兼容）
// ================================================================================

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

function calculateEMAFromArray(prices, period) {
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
  
  const ema12 = calculateEMAFromArray(prices, 12);
  const ema26 = calculateEMAFromArray(prices, 26);
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
  
  const signal = macdLine.length >= 9 ? calculateEMAFromArray(macdLine, 9) : macd;
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
    priceChange: previousData.domestic > 0 ? ((latestData.domestic - previousData.domestic) / previousData.domestic * 100) : 0,
    high: Math.max(...domesticPrices),
    low: Math.min(...domesticPrices),
    rsi: calculateRSI(domesticPrices),
    macd: calculateMACD(domesticPrices),
    bollinger: calculateBollingerBands(domesticPrices),
    trend: analyzePriceTrend(domesticPrices),
    sma20: calculateSMA(domesticPrices, 20),
    ema12: calculateEMAFromArray(domesticPrices, 12)
  };
  
  const internationalAnalysis = {
    currentPrice: latestData.international,
    previousPrice: previousData.international,
    priceChange: previousData.international > 0 ? ((latestData.international - previousData.international) / previousData.international * 100) : 0,
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

// 获取AI智能分析结果
async function handleGoldAIAnalysis(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getBeijingDate();
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    console.log('[Gold AI Analysis API] Getting AI analysis for date:', date);
    
    if (!env.GOLD_PRICE_CACHE) {
      return jsonResponse({
        success: false,
        error: 'GOLD_PRICE_CACHE not configured'
      }, 500);
    }
    
    // 获取AI分析结果
    const key = `ai_analysis:${date}`;
    const data = await env.GOLD_PRICE_CACHE.get(key);
    
    if (!data) {
      return jsonResponse({
        success: true,
        data: [],
        message: 'No AI analysis data available for this date'
      });
    }
    
    const analyses = JSON.parse(data);
    const recentAnalyses = analyses.slice(-limit);
    
    // 获取最新的完整分析
    const latestAnalysis = recentAnalyses[recentAnalyses.length - 1];
    
    return jsonResponse({
      success: true,
      date: date,
      totalRecords: analyses.length,
      latestAnalysis: latestAnalysis ? {
        timestamp: latestAnalysis.timestamp,
        currentPrice: latestAnalysis.currentPrice,
        marketTrend: latestAnalysis.marketAnalysis?.trend,
        trendStrength: latestAnalysis.marketAnalysis?.strength,
        dayChange: latestAnalysis.marketAnalysis?.dayChange,
        volatility: latestAnalysis.marketAnalysis?.volatility,
        aiRecommendation: latestAnalysis.aiAnalysis?.recommendation,
        aiConfidence: latestAnalysis.aiAnalysis?.signals ? 
          Math.max(latestAnalysis.aiAnalysis.signals.buy, latestAnalysis.aiAnalysis.signals.sell) : 0,
        hasValue: latestAnalysis.aiAnalysis?.hasValue
      } : null,
      recentAnalyses: recentAnalyses.map(a => ({
        timestamp: a.timestamp,
        price: a.currentPrice,
        recommendation: a.aiAnalysis?.recommendation,
        trend: a.marketAnalysis?.trend
      })),
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('[Gold AI Analysis API] Error:', error);
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

// 获取AI交易信号
async function handleGoldAISignals(request, env, ctx) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getBeijingDate();
    
    console.log('[Gold AI Signals API] Getting AI signals for date:', date);
    
    if (!env.GOLD_PRICE_CACHE) {
      return jsonResponse({
        success: false,
        error: 'GOLD_PRICE_CACHE not configured'
      }, 500);
    }
    
    // 获取AI分析结果
    const key = `ai_analysis:${date}`;
    const data = await env.GOLD_PRICE_CACHE.get(key);
    
    if (!data) {
      return jsonResponse({
        success: true,
        signals: [],
        message: 'No AI signals available for this date'
      });
    }
    
    const analyses = JSON.parse(data);
    
    // 提取交易信号
    const signals = analyses
      .filter(a => a.aiAnalysis?.hasValue && a.aiAnalysis?.recommendation !== 'hold')
      .map(a => ({
        timestamp: a.timestamp,
        time: new Date(a.timestamp).toLocaleTimeString('zh-CN'),
        price: a.currentPrice,
        recommendation: a.aiAnalysis.recommendation,
        confidence: a.aiAnalysis.signals ? 
          (a.aiAnalysis.recommendation === 'buy' ? a.aiAnalysis.signals.buy : a.aiAnalysis.signals.sell) : 0,
        trend: a.marketAnalysis?.trend,
        trendStrength: a.marketAnalysis?.strength
      }));
    
    // 获取最新信号
    const latestSignal = signals.length > 0 ? signals[signals.length - 1] : null;
    
    return jsonResponse({
      success: true,
      date: date,
      totalSignals: signals.length,
      latestSignal: latestSignal,
      signals: signals.slice(-20), // 只返回最近20个信号
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('[Gold AI Signals API] Error:', error);
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

async function sendAnalysisNotification(analysis, env) {
  console.log('[Gold Analysis] Sending notification for buy signal...');

  const hasDomesticSignal = analysis.domestic.signal.isBuySignal;
  const hasInternationalSignal = analysis.international.signal.isBuySignal;

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

  // 使用统一通知系统，确保三端同步推送
  const result = await sendUnifiedNotification(alerts, env, {
    notificationType: 'analysis_buy_signal',
    customMessage: {
      title: `📊 金价分析：${analysis.overallRecommendation}`,
      content: content,
      emoji: '📊'
    }
  });

  console.log('[Gold Analysis] Notification sent:', {
    success: result.success,
    email: result.results.email?.success,
    feishu: result.results.feishu?.success,
    meow: result.results.meow?.success
  });
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
      // 使用统一通知系统测试所有渠道
      const unifiedResult = await sendUnifiedNotification(testAlerts, env, {
        notificationType: 'test',
        skipCooldown: true
      });

      return new Response(JSON.stringify({
        success: unifiedResult.success,
        message: 'Unified notification test completed',
        config,
        unifiedResult: {
          email: unifiedResult.results.email,
          feishu: unifiedResult.results.feishu,
          meow: unifiedResult.results.meow
        }
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

// 生成带salt的密码哈希（新格式）
async function hashAdminPasswordWithSalt(password, salt = null) {
  const encoder = new TextEncoder();
  // 生成随机salt（如果没有提供）
  const useSalt = salt || Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const data = encoder.encode(useSalt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${useSalt}:${hash}`;
}

// ================================================================================
// 工具函数 - 管理员 JWT Token（增强验证）
// ================================================================================

async function createAdminToken(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Date.now() + 2 * 60 * 60 * 1000;
  const iat = Date.now();
  const body = btoa(JSON.stringify({ ...payload, exp, iat }));

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
  // Try to get token from Authorization header first
  const authHeader = request.headers.get('Authorization');
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    // Try to get token from cookie
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      const tokenCookie = cookies.find(c => c.startsWith('trading_token='));
      if (tokenCookie) {
        token = tokenCookie.substring('trading_token='.length);
      }
    }
  }

  if (!token) {
    return { success: false, message: '请先登录' };
  }

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
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request);
  }

  try {
    const body = await request.json();
    const username = body.username;
    const password = body.password;

    console.log('[Trading Login] Attempt for user:', username);

    if (!username || !password) {
      return jsonResponse({ success: false, error: 'Username and password are required' }, 400, request);
    }

    const stmt = env.DB.prepare('SELECT * FROM admin_users WHERE username = ?');
    const result = await stmt.bind(username).first();

    if (!result) {
      console.log('[Trading Login] User not found:', username);
      return jsonResponse({ success: false, error: 'Invalid credentials' }, 401, request);
    }

    let isPasswordValid = false;
    const passwordHash = result.password_hash;

    if (passwordHash.includes(':')) {
      const [salt, storedHash] = passwordHash.split(':');
      const encoder = new TextEncoder();
      const data = encoder.encode(salt + password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      isPasswordValid = hash === storedHash;
    } else {
      const inputHash = await hashAdminPassword(password);
      isPasswordValid = inputHash === passwordHash;
    }

    if (!isPasswordValid) {
      console.log('[Trading Login] Invalid password for user:', username);
      return jsonResponse({ success: false, error: 'Invalid credentials' }, 401, request);
    }

    const secret = env.JWT_SECRET || 'agiera-default-jwt-secret-2024';
    const token = await createAdminToken({
      userId: result.id,
      username: result.username,
      role: result.role
    }, secret);

    await env.DB.prepare('UPDATE admin_users SET last_login = ? WHERE id = ?')
      .bind(new Date().toISOString(), result.id).run();

    const origin = request.headers.get('Origin');
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '*';
    
    const isProduction = origin && origin.includes('ustc.dev');
    const maxAge = 2 * 60 * 60;
    const cookieValue = isProduction 
      ? `trading_token=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
      : `trading_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;

    console.log('[Trading Login] Success for user:', username);

    const headers = {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieValue
    };
    
    if (allowedOrigin !== '*') {
      headers['Access-Control-Allow-Origin'] = allowedOrigin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    } else {
      headers['Access-Control-Allow-Origin'] = '*';
    }

    return new Response(JSON.stringify({
      success: true,
      token,
      user: { id: result.id, username: result.username, role: result.role }
    }), { status: 200, headers });
  } catch (error) {
    console.error('[Trading Login Error]', error);
    return jsonResponse({ success: false, error: 'Login failed: ' + error.message }, 500, request);
  }
}

async function handleTradingLogout(request, env) {
  const clearCookie = 'trading_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  
  const origin = request.headers.get('Origin');
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  
  const headers = {
    'Content-Type': 'application/json',
    'Set-Cookie': clearCookie
  };
  
  if (allowedOrigin !== '*') {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Logged out successfully'
  }), { status: 200, headers });
}

async function handleInitSuperAdmin(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request);
  }

  try {
    const { secret } = await request.json();

    const initSecret = env.INIT_SECRET || env.JWT_SECRET || 'default-init-secret';
    if (secret !== initSecret) {
      return jsonResponse({ success: false, error: 'Invalid initialization secret' }, 403, request);
    }

    const username = 'YangHao';
    const password = 'YangHao@Trading.com';

    const existingUser = await env.DB.prepare(
      'SELECT id, password_hash FROM admin_users WHERE username = ?'
    ).bind(username).first();

    if (existingUser) {
      if (!existingUser.password_hash.includes(':')) {
        const newPasswordHash = await hashAdminPasswordWithSalt(password);
        await env.DB.prepare(
          'UPDATE admin_users SET password_hash = ? WHERE id = ?'
        ).bind(newPasswordHash, existingUser.id).run();

        return jsonResponse({
          success: true,
          message: 'Super admin password updated to new format',
          username
        }, 200, request);
      }

      return jsonResponse({
        success: true,
        message: 'Super admin user already exists with valid password format',
        username
      }, 200, request);
    }

    const passwordHash = await hashAdminPasswordWithSalt(password);

    await env.DB.prepare(
      `INSERT INTO admin_users (username, password_hash, role, created_at, last_login)
       VALUES (?, ?, 'super_admin', datetime('now'), NULL)`
    ).bind(username, passwordHash).run();

    return jsonResponse({
      success: true,
      message: 'Super admin user created successfully',
      username,
      password: 'YangHao@Trading.com'
    }, 200, request);
  } catch (error) {
    console.error('[Init SuperAdmin Error]', error);
    return jsonResponse({ success: false, error: 'Initialization failed: ' + error.message }, 500, request);
  }
}

async function handleTradingVerify(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'No token provided' }, 401, request);
  }

  const token = authHeader.substring(7);
  const secret = env.JWT_SECRET || 'agiera-default-jwt-secret-2024';
  const verification = await verifyAdminToken(token, secret);
  
  if (!verification) {
    return jsonResponse({ success: false, error: 'Invalid token' }, 401, request);
  }

  return jsonResponse({ success: true, user: verification }, 200, request);
}

async function handleBuyTransaction(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request);
  }

  try {
    const { price, quantity, notes } = await request.json();

    const priceValidation = validateNumber(price, TRADING_CONFIG.MIN_PRICE, TRADING_CONFIG.MAX_PRICE, 'Buy price');
    if (!priceValidation.valid) {
      return jsonResponse({ success: false, error: priceValidation.error }, 400, request);
    }

    const quantityValidation = validateNumber(quantity, TRADING_CONFIG.MIN_QUANTITY, TRADING_CONFIG.MAX_QUANTITY, 'Quantity');
    if (!quantityValidation.valid) {
      return jsonResponse({ success: false, error: quantityValidation.error }, 400, request);
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
    }, 200, request);
  } catch (error) {
    console.error('[Buy Transaction Error]', error);
    return jsonResponse({ success: false, error: 'Failed to create buy transaction' }, 500, request);
  }
}

async function handleSellTransaction(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request);
  }

  try {
    const { buyTransactionId, actualSellPrice, price, quantity, notes } = await request.json();
    const sellPriceInput = actualSellPrice || price;

    const priceValidation = validateNumber(sellPriceInput, TRADING_CONFIG.MIN_PRICE, TRADING_CONFIG.MAX_PRICE, 'Sell price');
    if (!priceValidation.valid) {
      return jsonResponse({ success: false, error: priceValidation.error }, 400, request);
    }

    const quantityValidation = validateNumber(quantity, TRADING_CONFIG.MIN_QUANTITY, TRADING_CONFIG.MAX_QUANTITY, 'Quantity');
    if (!quantityValidation.valid) {
      return jsonResponse({ success: false, error: quantityValidation.error }, 400, request);
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
    } else {
      const avgStmt = env.DB.prepare(`
        SELECT 
          COALESCE(SUM(quantity), 0) as total_bought,
          COALESCE(SUM(total_amount), 0) as total_cost
        FROM gold_transactions 
        WHERE type = 'buy' AND status = 'completed'
      `);
      const avgResult = await avgStmt.first();
      
      const avgStmtSell = env.DB.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total_sold
        FROM gold_transactions 
        WHERE type = 'sell' AND status = 'completed'
      `);
      const avgResultSell = await avgStmtSell.first();
      
      const holdings = (avgResult?.total_bought || 0) - (avgResultSell?.total_sold || 0);
      
      if (holdings > 0 && avgResult?.total_cost > 0) {
        buyPrice = avgResult.total_cost / avgResult.total_bought;
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
    }, 200, request);
  } catch (error) {
    console.error('[Sell Transaction Error]', error);
    return jsonResponse({ success: false, error: 'Failed to create sell transaction' }, 500, request);
  }
}

async function handleGetTransactions(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
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
    }, 200, request);
  } catch (error) {
    console.error('[Get Transactions Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch transactions' }, 500, request);
  }
}

async function handleTransactionOperation(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return jsonResponse({ success: false, error: 'Transaction ID is required' }, 400, request);
  }

  if (request.method === 'DELETE') {
    try {
      const stmt = env.DB.prepare('DELETE FROM gold_transactions WHERE id = ?');
      await stmt.bind(id).run();
      return jsonResponse({ success: true, message: 'Transaction deleted' }, 200, request);
    } catch (error) {
      console.error('[Delete Transaction Error]', error);
      return jsonResponse({ success: false, error: 'Failed to delete transaction' }, 500, request);
    }
  }

  if (request.method === 'PUT') {
    try {
      const { price, quantity, actualSellPrice, notes, createdAt, profit } = await request.json();
      
      const checkStmt = env.DB.prepare('SELECT * FROM gold_transactions WHERE id = ?');
      const existing = await checkStmt.bind(id).first();
      
      if (!existing) {
        return jsonResponse({ success: false, error: 'Transaction not found' }, 404);
      }

      const newPrice = price !== undefined ? parseFloat(price) : existing.price;
      const newQuantity = quantity !== undefined ? parseFloat(quantity) : existing.quantity;
      const newActualSellPrice = actualSellPrice !== undefined ? parseFloat(actualSellPrice) : existing.actual_sell_price;
      const newNotes = notes !== undefined ? notes : existing.notes;
      const newCreatedAt = createdAt !== undefined ? new Date(createdAt).toISOString() : existing.created_at;
      let newProfit = existing.profit;
      
      if (profit !== undefined) {
        newProfit = parseFloat(profit);
      } else if (existing.type === 'sell' && newActualSellPrice !== null && newActualSellPrice !== undefined) {
        const avgBuyStmt = env.DB.prepare(`
          SELECT 
            COALESCE(SUM(CASE WHEN type = 'buy' THEN quantity ELSE 0 END), 0) as total_bought,
            COALESCE(SUM(CASE WHEN type = 'buy' THEN total_amount ELSE 0 END), 0) as total_cost
          FROM gold_transactions 
          WHERE type = 'buy' AND status = 'completed'
        `);
        const avgBuyResult = await avgBuyStmt.first();
        
        if (avgBuyResult && avgBuyResult.total_bought > 0 && avgBuyResult.total_cost > 0) {
          const avgBuyPrice = avgBuyResult.total_cost / avgBuyResult.total_bought;
          newProfit = (newActualSellPrice - avgBuyPrice) * newQuantity;
        } else {
          newProfit = (newActualSellPrice - newPrice) * newQuantity;
        }
      }

      const newTotalAmount = newPrice * newQuantity;

      const updateStmt = env.DB.prepare(`
        UPDATE gold_transactions 
        SET price = ?, quantity = ?, total_amount = ?, actual_sell_price = ?, profit = ?, notes = ?, created_at = ?
        WHERE id = ?
      `);
      
      await updateStmt.bind(newPrice, newQuantity, newTotalAmount, newActualSellPrice, newProfit, newNotes, newCreatedAt, id).run();

      return jsonResponse({
        success: true,
        transaction: {
          id: parseInt(id),
          type: existing.type,
          price: newPrice,
          quantity: newQuantity,
          totalAmount: newTotalAmount,
          actualSellPrice: newActualSellPrice,
          profit: newProfit,
          notes: newNotes,
          createdAt: newCreatedAt
        }
      }, 200, request);
    } catch (error) {
      console.error('[Update Transaction Error]', error);
      return jsonResponse({ success: false, error: 'Failed to update transaction' }, 500, request);
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request);
}

async function handleAlertHistory(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
  }

  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const session = url.searchParams.get('session');
    
    const level3History = await env?.GOLD_PRICE_CACHE?.get('level3_alert_history');
    let alerts = level3History ? JSON.parse(level3History) : [];
    
    if (session) {
      alerts = alerts.filter(a => a.session === session);
    }
    
    alerts = alerts.slice(-limit);
    
    return jsonResponse({
      success: true,
      alerts,
      total: alerts.length,
      timestamp: Date.now()
    }, 200, request);
  } catch (error) {
    console.error('[Alert History Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch alert history' }, 500, request);
  }
}

async function handleMarketStatus(request, env) {
  try {
    const state = await getLevel3State(env);
    const beijingHour = getBeijingHour();
    const session = getSession(beijingHour);
    
    const latestData = await env?.GOLD_PRICE_CACHE?.get('latest');
    const priceData = latestData ? JSON.parse(latestData) : null;
    
    const priceHistory = state.priceHistory || [];
    const rollingStd = calculateStd(priceHistory);
    const rollingMean = calculateMean(priceHistory);
    
    const trend = state.emaFast > state.emaSlow ? 'up' : state.emaFast < state.emaSlow ? 'down' : 'neutral';
    
    return jsonResponse({
      success: true,
      status: {
        price: priceData?.domestic?.price || null,
        timestamp: priceData?.timestamp || null,
        session,
        beijingHour,
        trend,
        volatility: rollingStd,
        emaFast: state.emaFast,
        emaSlow: state.emaSlow,
        atr: calculateATR(priceHistory, SGE_ALERT_CONFIG.ATR_PERIOD),
        dynamicThreshold: Math.max(
          SGE_ALERT_CONFIG.MIN_THRESHOLD_YUAN,
          SGE_ALERT_CONFIG.BASE_THRESHOLD_YUAN + 2.2 * rollingStd
        ) * getSessionMultiplier(beijingHour)
      }
    }, 200, request);
  } catch (error) {
    console.error('[Market Status Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch market status' }, 500, request);
  }
}

async function handleAlertConfig(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
  }

  if (request.method === 'GET') {
    try {
      const configJson = await env?.GOLD_PRICE_CACHE?.get('alert_config');
      const config = configJson ? JSON.parse(configJson) : {
        baseThresholdYuan: SGE_ALERT_CONFIG.BASE_THRESHOLD_YUAN,
        minThresholdYuan: SGE_ALERT_CONFIG.MIN_THRESHOLD_YUAN,
        instantAbsThreshold: SGE_ALERT_CONFIG.INSTANT_ABS_THRESHOLD,
        instantPercentThreshold: SGE_ALERT_CONFIG.INSTANT_PERCENT_THRESHOLD,
        atrMultiplier: SGE_ALERT_CONFIG.ATR_MULTIPLIER,
        zscoreThreshold: SGE_ALERT_CONFIG.ZSCORE_THRESHOLD,
        baseCooldownSeconds: SGE_ALERT_CONFIG.BASE_COOLDOWN_SECONDS,
        maxCooldownSeconds: SGE_ALERT_CONFIG.MAX_COOLDOWN_SECONDS,
        dedupWindowSeconds: SGE_ALERT_CONFIG.DEDUP_WINDOW_SECONDS
      };
      
      return jsonResponse({ success: true, config }, 200, request);
    } catch (error) {
      console.error('[Alert Config Error]', error);
      return jsonResponse({ success: false, error: 'Failed to fetch config' }, 500, request);
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      
      const config = {
        baseThresholdYuan: parseFloat(body.baseThresholdYuan) || SGE_ALERT_CONFIG.BASE_THRESHOLD_YUAN,
        minThresholdYuan: parseFloat(body.minThresholdYuan) || SGE_ALERT_CONFIG.MIN_THRESHOLD_YUAN,
        instantAbsThreshold: parseFloat(body.instantAbsThreshold) || SGE_ALERT_CONFIG.INSTANT_ABS_THRESHOLD,
        instantPercentThreshold: parseFloat(body.instantPercentThreshold) || SGE_ALERT_CONFIG.INSTANT_PERCENT_THRESHOLD,
        atrMultiplier: parseFloat(body.atrMultiplier) || SGE_ALERT_CONFIG.ATR_MULTIPLIER,
        zscoreThreshold: parseFloat(body.zscoreThreshold) || SGE_ALERT_CONFIG.ZSCORE_THRESHOLD,
        baseCooldownSeconds: parseInt(body.baseCooldownSeconds) || SGE_ALERT_CONFIG.BASE_COOLDOWN_SECONDS,
        maxCooldownSeconds: parseInt(body.maxCooldownSeconds) || SGE_ALERT_CONFIG.MAX_COOLDOWN_SECONDS,
        dedupWindowSeconds: parseInt(body.dedupWindowSeconds) || SGE_ALERT_CONFIG.DEDUP_WINDOW_SECONDS
      };
      
      await env?.GOLD_PRICE_CACHE?.put('alert_config', JSON.stringify(config), {
        expirationTtl: 86400 * 30
      });
      
      return jsonResponse({ success: true, config }, 200, request);
    } catch (error) {
      console.error('[Alert Config Update Error]', error);
      return jsonResponse({ success: false, error: 'Failed to update config' }, 500, request);
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request);
}

async function handleGetTransactionStats(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
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

    const monthlyStmt = env.DB.prepare(`
      SELECT 
        strftime('%Y-%W', created_at) as week_key,
        strftime('%Y', created_at) as year,
        strftime('%W', created_at) as week,
        MIN(date(created_at)) as week_start,
        MAX(date(created_at)) as week_end,
        COALESCE(SUM(CASE WHEN type = 'buy' THEN total_amount ELSE 0 END), 0) as buy_amount,
        COALESCE(SUM(CASE WHEN type = 'sell' THEN total_amount ELSE 0 END), 0) as sell_amount,
        COALESCE(SUM(profit), 0) as profit,
        COUNT(CASE WHEN type = 'buy' THEN 1 END) as buy_count,
        COUNT(CASE WHEN type = 'sell' THEN 1 END) as sell_count
      FROM gold_transactions
      WHERE created_at >= datetime('now', '-5 weeks')
      GROUP BY strftime('%Y-%W', created_at)
      ORDER BY week_key DESC
      LIMIT 4
    `);
    const monthlyResult = await monthlyStmt.all();

    const weeklyStmt = env.DB.prepare(`
      SELECT 
        date(created_at) as date,
        COALESCE(SUM(CASE WHEN type = 'buy' THEN total_amount ELSE 0 END), 0) as buy_amount,
        COALESCE(SUM(CASE WHEN type = 'sell' THEN total_amount ELSE 0 END), 0) as sell_amount,
        COALESCE(SUM(CASE WHEN type = 'buy' THEN quantity ELSE 0 END), 0) as buy_quantity,
        COALESCE(SUM(CASE WHEN type = 'sell' THEN quantity ELSE 0 END), 0) as sell_quantity,
        COALESCE(SUM(CASE WHEN type = 'sell' THEN profit ELSE 0 END), 0) as profit,
        COUNT(CASE WHEN type = 'buy' THEN 1 END) as buy_count,
        COUNT(CASE WHEN type = 'sell' THEN 1 END) as sell_count
      FROM gold_transactions
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);
    const weeklyResult = await weeklyStmt.all();

    console.log('[Stats API] totalStats:', totalStats);
    console.log('[Stats API] weekStats:', weekStats);
    console.log('[Stats API] monthStats:', monthStats);
    console.log('[Stats API] weeklyResult:', weeklyResult.results);
    console.log('[Stats API] monthlyResult:', monthlyResult.results);

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
        monthly: monthlyResult.results || [],
        weekly: weeklyResult.results || []
      }
    }, 200, request);
  } catch (error) {
    console.error('[Get Transaction Stats Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch statistics' }, 500, request);
  }
}

async function handleAlertOperation(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
  }

  if (request.method === 'POST') {
    try {
      const { alertType, targetPrice, tolerance = 1.00 } = await request.json();

      if (!['buy', 'sell'].includes(alertType)) {
        return jsonResponse({ success: false, error: 'Invalid alert type' }, 400, request);
      }

      const priceValidation = validateNumber(targetPrice, TRADING_CONFIG.MIN_PRICE, TRADING_CONFIG.MAX_PRICE, 'Target price');
      if (!priceValidation.valid) {
        return jsonResponse({ success: false, error: priceValidation.error }, 400, request);
      }

      const toleranceValidation = validateNumber(tolerance, 0, 50, 'Tolerance');
      if (!toleranceValidation.valid) {
        return jsonResponse({ success: false, error: toleranceValidation.error }, 400, request);
      }

      const stmt = env.DB.prepare(`INSERT INTO price_alerts (alert_type, target_price, tolerance, created_at) VALUES (?, ?, ?, ?)`);
      const now = new Date().toISOString();
      const result = await stmt.bind(alertType, priceValidation.value, toleranceValidation.value, now).run();

      return jsonResponse({
        success: true,
        alert: { id: result.meta.last_row_id, alertType, targetPrice: priceValidation.value, tolerance: toleranceValidation.value, createdAt: now }
      }, 200, request);
    } catch (error) {
      console.error('[Create Alert Error]', error);
      return jsonResponse({ success: false, error: 'Failed to create alert' }, 500, request);
    }
  }

  if (request.method === 'DELETE') {
    try {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');

      if (!id) {
        return jsonResponse({ success: false, error: 'Alert ID required' }, 400, request);
      }

      const stmt = env.DB.prepare(`DELETE FROM price_alerts WHERE id = ?`);
      await stmt.bind(id).run();

      return jsonResponse({ success: true, message: 'Alert deleted' }, 200, request);
    } catch (error) {
      console.error('[Delete Alert Error]', error);
      return jsonResponse({ success: false, error: 'Failed to delete alert' }, 500, request);
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request);
}

async function handleAlertsOperation(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
  }

  if (request.method === 'GET') {
    try {
      const stmt = env.DB.prepare(`SELECT * FROM price_alerts ORDER BY created_at DESC`);
      const result = await stmt.all();

      return jsonResponse({ success: true, alerts: result.results }, 200, request);
    } catch (error) {
      console.error('[Get Alerts Error]', error);
      return jsonResponse({ success: false, error: 'Failed to fetch alerts' }, 500, request);
    }
  }

  if (request.method === 'DELETE') {
    try {
      const stmt = env.DB.prepare(`DELETE FROM price_alerts`);
      const result = await stmt.run();

      return jsonResponse({
        success: true,
        message: 'All alerts deleted',
        deletedCount: result.meta?.changes || 0
      }, 200, request);
    } catch (error) {
      console.error('[Delete All Alerts Error]', error);
      return jsonResponse({ success: false, error: 'Failed to delete alerts' }, 500, request);
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request);
}

async function handleGetNotifications(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
  }

  try {
    const stmt = env.DB.prepare(`SELECT * FROM notification_queue WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50`);
    const result = await stmt.all();

    return jsonResponse({ success: true, notifications: result.results }, 200, request);
  } catch (error) {
    console.error('[Get Notifications Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch notifications' }, 500, request);
  }
}

async function handleToleranceSettings(request, env) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, error: authResult.message }, 401, request);
  }

  if (request.method === 'GET') {
    try {
      const stmt = env.DB.prepare(`SELECT buy_tolerance, sell_tolerance, updated_at FROM alert_tolerance_settings ORDER BY id DESC LIMIT 1`);
      const result = await stmt.first();

      if (!result) {
        const insertStmt = env.DB.prepare(`INSERT INTO alert_tolerance_settings (buy_tolerance, sell_tolerance) VALUES (?, ?)`);
        await insertStmt.bind(2.0, 2.0).run();
        return jsonResponse({
          success: true,
          settings: { buyTolerance: 2.0, sellTolerance: 2.0, updatedAt: new Date().toISOString() }
        }, 200, request);
      }

      return jsonResponse({
        success: true,
        settings: {
          buyTolerance: result.buy_tolerance,
          sellTolerance: result.sell_tolerance,
          updatedAt: result.updated_at
        }
      }, 200, request);
    } catch (error) {
      console.error('[Get Tolerance Settings Error]', error);
      return jsonResponse({ success: false, error: 'Failed to fetch tolerance settings' }, 500, request);
    }
  }

  if (request.method === 'POST') {
    try {
      const { buyTolerance, sellTolerance } = await request.json();

      const buyToleranceNum = parseFloat(buyTolerance);
      const sellToleranceNum = parseFloat(sellTolerance);

      if (isNaN(buyToleranceNum) || isNaN(sellToleranceNum)) {
        return jsonResponse({ success: false, error: '容错值必须是有效数字' }, 400, request);
      }

      if (buyToleranceNum < 0.1 || buyToleranceNum > 100) {
        return jsonResponse({ success: false, error: '买入容错值必须在 0.1-100 之间' }, 400, request);
      }

      if (sellToleranceNum < 0.1 || sellToleranceNum > 100) {
        return jsonResponse({ success: false, error: '卖出容错值必须在 0.1-100 之间' }, 400, request);
      }

      const now = new Date().toISOString();
      
      // 检查是否存在设置记录
      const checkStmt = env.DB.prepare(`SELECT id FROM alert_tolerance_settings ORDER BY id DESC LIMIT 1`);
      const existing = await checkStmt.first();
      
      if (existing) {
        // 更新现有设置
        const updateStmt = env.DB.prepare(`
          UPDATE alert_tolerance_settings 
          SET buy_tolerance = ?, sell_tolerance = ?, updated_at = ?
          WHERE id = ?
        `);
        await updateStmt.bind(buyToleranceNum, sellToleranceNum, now, existing.id).run();
      } else {
        // 创建新设置
        const insertStmt = env.DB.prepare(`
          INSERT INTO alert_tolerance_settings (buy_tolerance, sell_tolerance, updated_at) VALUES (?, ?, ?)
        `);
        await insertStmt.bind(buyToleranceNum, sellToleranceNum, now).run();
      }

      return jsonResponse({
        success: true,
        settings: {
          buyTolerance: buyToleranceNum,
          sellTolerance: sellToleranceNum,
          updatedAt: now
        }
      }, 200, request);
    } catch (error) {
      console.error('[Save Tolerance Settings Error]', error);
      return jsonResponse({ success: false, error: 'Failed to save tolerance settings' }, 500, request);
    }
  }

  return jsonResponse({ success: false, error: 'Method not allowed' }, 405, request);
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

// ================================================================================
// Trading 价格预警检查 - 三端通知
// ================================================================================

async function checkAndSendTradingAlerts(currentPrice, env) {
  try {
    const stmt = env.DB.prepare(`
      SELECT * FROM price_alerts 
      WHERE is_active = 1 
      AND is_triggered = 0
    `);
    const result = await stmt.all();

    const triggeredAlerts = [];

    for (const alert of result.results) {
      const tolerance = alert.tolerance || 1.00;
      const minPrice = alert.target_price - tolerance;
      const maxPrice = alert.target_price + tolerance;
      
      let shouldTrigger = false;
      let proximityAlert = false;

      if (alert.alert_type === 'buy') {
        if (currentPrice <= alert.target_price) {
          shouldTrigger = true;
        } else if (currentPrice <= maxPrice && currentPrice > alert.target_price) {
          proximityAlert = true;
        }
      } else if (alert.alert_type === 'sell') {
        if (currentPrice >= alert.target_price) {
          shouldTrigger = true;
        } else if (currentPrice >= minPrice && currentPrice < alert.target_price) {
          proximityAlert = true;
        }
      }

      if (proximityAlert) {
        const proximityKey = `proximity_alert:${alert.id}`;
        const lastProximity = await env.GOLD_PRICE_CACHE?.get(proximityKey);
        const now = Date.now();
        const PROXIMITY_COOLDOWN = 5 * 60 * 1000;
        
        if (lastProximity && (now - parseInt(lastProximity)) < PROXIMITY_COOLDOWN) {
          console.log(`[Trading Alert] Proximity alert ${alert.id} in cooldown, skipping`);
          continue;
        }
        
        console.log(`[Trading Alert] Proximity alert for ${alert.alert_type} at ¥${currentPrice.toFixed(2)}/g, target ¥${alert.target_price.toFixed(2)}/g`);
        
        const proximityAlertData = {
          ...alert,
          currentPrice,
          triggeredAt: new Date().toISOString(),
          proximity: true
        };
        
        const notificationResults = await sendTradingMultiChannelAlert(proximityAlertData, env);
        console.log('[Trading Alert] Proximity notification results:', JSON.stringify(notificationResults));
        
        if (notificationResults.email?.success || notificationResults.feishu?.success || notificationResults.meow?.success) {
          await env.GOLD_PRICE_CACHE?.put(proximityKey, String(now), { expirationTtl: 300 });
        }
      }

      if (shouldTrigger) {
        await env.DB.prepare(`
          UPDATE price_alerts 
          SET is_triggered = 1, 
              triggered_at = ?, 
              current_price = ?,
              notification_sent = 1
          WHERE id = ?
        `).bind(new Date().toISOString(), currentPrice, alert.id).run();

        const triggeredAlert = {
          ...alert,
          currentPrice,
          triggeredAt: new Date().toISOString()
        };

        triggeredAlerts.push(triggeredAlert);

        console.log(`[Trading Alert] Triggering ${alert.alert_type} alert at ¥${currentPrice.toFixed(2)}/g, target ¥${alert.target_price.toFixed(2)}/g`);

        const notificationResults = await sendTradingMultiChannelAlert(triggeredAlert, env);
        
        await env.DB.prepare(`
          UPDATE price_alerts 
          SET email_sent = ?,
              feishu_sent = ?,
              meow_sent = ?
          WHERE id = ?
        `).bind(
          notificationResults.email.success ? 1 : 0,
          notificationResults.feishu.success ? 1 : 0,
          notificationResults.meow.success ? 1 : 0,
          alert.id
        ).run();
      }
    }

    return triggeredAlerts;
  } catch (error) {
    console.error('[Check Trading Alerts Error]', error);
    return [];
  }
}

async function sendTradingMultiChannelAlert(alert, env) {
  const results = await Promise.allSettled([
    sendTradingAlertEmail(alert, env),
    sendTradingFeishuAlert(alert, env),
    sendTradingMeoWAlert(alert, env)
  ]);
  
  const [emailResult, feishuResult, meowResult] = results;
  
  console.log('[Trading Alert] Multi-channel results:', {
    email: emailResult.status === 'fulfilled' ? emailResult.value : { success: false, error: emailResult.reason },
    feishu: feishuResult.status === 'fulfilled' ? feishuResult.value : { success: false, error: feishuResult.reason },
    meow: meowResult.status === 'fulfilled' ? meowResult.value : { success: false, error: meowResult.reason }
  });
  
  return {
    email: emailResult.status === 'fulfilled' ? emailResult.value : { success: false, error: emailResult.reason },
    feishu: feishuResult.status === 'fulfilled' ? feishuResult.value : { success: false, error: feishuResult.reason },
    meow: meowResult.status === 'fulfilled' ? meowResult.value : { success: false, error: meowResult.reason }
  };
}

async function sendTradingAlertEmail(alert, env) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log('[Trading Alert] RESEND_API_KEY not configured');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }
  
  const isBuy = alert.alert_type === 'buy';
  const isProximity = alert.proximity === true;
  const emoji = isProximity ? '⚠️' : (isBuy ? '🟢' : '🔴');
  const title = isProximity ? '价格接近提醒' : (isBuy ? '买入提醒' : '卖出提醒');
  const action = isBuy ? '买入' : '卖出';
  const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const headerColor = isProximity ? '#ff9f0a' : (isBuy ? '#30d158' : '#ff375f');
  
  const messageText = isProximity 
    ? `金价已接近您预设的${action}价格，请注意市场动态。`
    : `金价已达到您预设的${action}价格，请及时关注市场动态。`;
  
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${headerColor}; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
    .price-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .price { font-size: 32px; font-weight: bold; color: ${headerColor}; }
    .label { color: #666; font-size: 14px; margin-bottom: 8px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} ${title}</h1>
    </div>
    <div class="content">
      <p>您好，</p>
      <p>${messageText}</p>
      
      <div class="price-box">
        <div class="label">目标${action}价格</div>
        <div class="price">¥${alert.target_price}/克</div>
        <div style="margin-top: 10px; color: #666;">当前价格: ¥${alert.currentPrice}/克</div>
      </div>
      
      <p><strong>提醒时间:</strong> ${timeStr}</p>
      <p><strong>提醒类型:</strong> ${isBuy ? '买入' : '卖出'}预警</p>
      
      <div class="footer">
        <p>此邮件由 Meow 系统自动发送</p>
        <p><a href="https://ustc.dev/trading/">查看交易详情</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
  
  try {
    console.log('[Trading Alert] Sending email to metanext@foxmail.com...');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'USTC Dev <noreply@ustc.dev>',
        to: ['metanext@foxmail.com'],
        subject: `${emoji} ${title} - 金价${action}提醒`,
        html: htmlContent
      })
    });
    
    const responseText = await response.text();
    console.log('[Trading Alert] Email response status:', response.status, 'body:', responseText);
    
    if (response.ok) {
      console.log('[Trading Alert] Email sent successfully');
      return { success: true };
    } else {
      console.error('[Trading Alert] Email failed:', responseText);
      return { success: false, error: responseText };
    }
  } catch (error) {
    console.error('[Trading Alert] Email error:', error);
    return { success: false, error: error.message };
  }
}

async function sendTradingFeishuAlert(alert, env) {
  const FEISHU_WEBHOOK = env.FEISHU_WEBHOOK;
  const FEISHU_APP_ID = env.FEISHU_APP_ID;
  const FEISHU_APP_SECRET = env.FEISHU_APP_SECRET;
  const FEISHU_CHAT_ID = env.FEISHU_CHAT_ID;
  
  const hasConfig = FEISHU_WEBHOOK || (FEISHU_APP_ID && FEISHU_APP_SECRET && FEISHU_CHAT_ID);
  if (!hasConfig) {
    console.log('[Trading Alert] No Feishu configuration found');
    return { success: false, error: 'No Feishu configuration found' };
  }
  
  const isBuy = alert.alert_type === 'buy';
  const isProximity = alert.proximity === true;
  const emoji = isProximity ? '⚠️' : (isBuy ? '🟢' : '🔴');
  const title = isProximity ? '价格接近提醒' : (isBuy ? '买入提醒' : '卖出提醒');
  const action = isBuy ? '买入' : '卖出';
  const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const templateColor = isProximity ? 'orange' : (isBuy ? 'green' : 'red');
  
  const messageText = isProximity 
    ? `💡 金价已接近您预设的${action}价格，请注意市场动态。`
    : `💡 金价已达到您预设的${action}价格，请及时关注市场动态。`;
  
  const content = `**${emoji} ${title}**\n\n> 时间：${timeStr}\n\n**目标${action}价格：** ¥${alert.target_price}/克\n**当前价格：** ¥${alert.currentPrice}/克\n\n${messageText}\n\n[查看交易详情](https://ustc.dev/trading/)`;

  // Webhook 模式
  if (FEISHU_WEBHOOK) {
    console.log('[Trading Alert] Using Feishu webhook mode');
    try {
      const response = await fetch(FEISHU_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'interactive',
          card: {
            header: {
              title: { tag: 'plain_text', content: `${emoji} ${title}` },
              template: templateColor
            },
            elements: [
              { tag: 'markdown', content: content }
            ]
          }
        })
      });
      
      const result = await response.json();
      console.log('[Trading Alert] Feishu webhook response:', JSON.stringify(result));
      
      if (result.code === 0 || result.StatusCode === 0) {
        console.log('[Trading Alert] Feishu webhook sent successfully');
        return { success: true };
      } else {
        console.error('[Trading Alert] Feishu webhook failed:', JSON.stringify(result));
        return { success: false, error: result };
      }
    } catch (error) {
      console.error('[Trading Alert] Feishu webhook error:', error);
      return { success: false, error: error.message };
    }
  }

  // 飞书应用消息模式
  console.log('[Trading Alert] Using Feishu app message mode');
  try {
    const tokenResponse = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: FEISHU_APP_ID,
        app_secret: FEISHU_APP_SECRET
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.code !== 0) {
      console.error('[Trading Alert] Feishu auth failed:', tokenData.msg);
      return { success: false, error: tokenData.msg };
    }
    
    const accessToken = tokenData.tenant_access_token;
    
    const contentElements = [
      [{ tag: 'text', text: `时间：${timeStr}` }],
      [{ tag: 'text', text: '' }],
      [{ tag: 'text', text: `目标${action}价格: ¥${alert.target_price}/克` }],
      [{ tag: 'text', text: `当前价格: ¥${alert.currentPrice}/克` }],
      [{ tag: 'text', text: '' }],
      [{ tag: 'text', text: messageText }],
      [{ tag: 'text', text: '' }],
      [{ tag: 'a', text: '查看交易详情', href: 'https://ustc.dev/trading/' }]
    ];
    
    const messageResponse = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        receive_id: FEISHU_CHAT_ID,
        msg_type: 'post',
        content: JSON.stringify({
          zh_cn: {
            title: `${emoji} ${title}`,
            content: contentElements
          }
        })
      })
    });
    
    const messageData = await messageResponse.json();
    console.log('[Trading Alert] Feishu app message response:', JSON.stringify(messageData));
    
    if (messageData.code === 0) {
      console.log('[Trading Alert] Feishu app message sent successfully');
      return { success: true };
    } else {
      console.error('[Trading Alert] Feishu message failed:', messageData.msg);
      return { success: false, error: messageData.msg };
    }
  } catch (error) {
    console.error('[Trading Alert] Feishu app error:', error);
    return { success: false, error: error.message };
  }
}

async function sendTradingMeoWAlert(alert, env) {
  const MEOW_USER_ID = env.MEOW_USER_ID || '5bf48882';

  const isBuy = alert.alert_type === 'buy';
  const isProximity = alert.proximity === true;
  const emoji = isProximity ? '⚠️' : (isBuy ? '🟢' : '🔴');
  const title = isProximity ? '价格接近提醒' : (isBuy ? '买入提醒' : '卖出提醒');
  const action = isBuy ? '买入' : '卖出';
  const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const messageText = isProximity 
    ? `金价已接近您预设的${action}价格，请注意市场动态。`
    : `金价已达到您预设的${action}价格，请及时关注市场动态。`;

  const msgContent = `时间: ${timeStr}\n\n目标${action}价格: ¥${alert.target_price}/克\n当前价格: ¥${alert.currentPrice}/克\n\n${messageText}`;

  const meowUrl = `https://api.chuckfang.com/${MEOW_USER_ID}`;

  try {
    const response = await fetch(meowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${emoji} ${title}`,
        msg: msgContent,
        url: 'https://ustc.dev/trading/'
      })
    });
    const result = await response.json();

    if (result.status === 200) {
      console.log('[Trading Alert] MeoW notification sent successfully');
      return { success: true };
    } else {
      console.error('[Trading Alert] MeoW notification failed:', result.msg);
      return { success: false, error: result.msg };
    }
  } catch (error) {
    console.error('[Trading Alert] MeoW error:', error);
    return { success: false, error: error.message };
  }
}

// ================================================================================
// 智能金价分析与交易建议系统
// ================================================================================

const INTELLIGENT_ANALYSIS_CONFIG = {
  MIN_DATA_POINTS: 10,
  PRICE_CHANGE_THRESHOLD: 0.3,
  SIGNIFICANT_CHANGE_THRESHOLD: 0.8,
  TREND_CONFIRMATION_PERIODS: 3,
  COOLDOWN_MINUTES: 30,
  PROFIT_TARGET_PCT: 2.0,
  STOP_LOSS_PCT: -1.5
};

// 注意：scheduledIntelligentGoldAnalysis 功能已整合到 scheduledGoldCrawlWithAI 中
// 现在每分钟执行一次数据爬取和AI分析提交

async function getTodayGoldPriceHistory(env, date) {
  try {
    const stmt = env.DB.prepare(`
      SELECT price, timestamp 
      FROM gold_price_history 
      WHERE date = ? 
      ORDER BY timestamp ASC
    `);
    const result = await stmt.bind(date).all();
    return result.results || [];
  } catch (error) {
    console.error('[Get History] Error:', error);
    return [];
  }
}

async function getTradingParameters(env) {
  try {
    const alertsStmt = env.DB.prepare(`
      SELECT alert_type, target_price 
      FROM price_alerts 
      WHERE is_active = 1 
      ORDER BY created_at DESC
    `);
    const alertsResult = await alertsStmt.all();

    const avgBuyStmt = env.DB.prepare(`
      SELECT AVG(price) as avg_buy_price, SUM(quantity) as total_quantity
      FROM gold_transactions 
      WHERE type = 'buy' AND status = 'completed'
    `);
    const avgBuyResult = await avgBuyStmt.first();

    return {
      alerts: alertsResult.results || [],
      avgBuyPrice: avgBuyResult?.avg_buy_price || 0,
      totalHoldings: avgBuyResult?.total_quantity || 0,
      buyTargets: (alertsResult.results || []).filter(a => a.alert_type === 'buy').map(a => a.target_price),
      sellTargets: (alertsResult.results || []).filter(a => a.alert_type === 'sell').map(a => a.target_price)
    };
  } catch (error) {
    console.error('[Get Trading Params] Error:', error);
    return { alerts: [], avgBuyPrice: 0, totalHoldings: 0, buyTargets: [], sellTargets: [] };
  }
}

function analyzeMarketTrend(historyData) {
  if (!historyData || historyData.length < 5) return { trend: 'unknown', strength: 0 };

  // 兼容多种数据格式: { price }, { domestic }, 或直接数值
  const prices = historyData.map(h => {
    if (typeof h === 'number') return h;
    if (h.price !== undefined) return h.price;
    if (h.domestic !== undefined) return h.domestic;
    return null;
  }).filter(p => p !== null && p > 0);

  if (prices.length < 5) return { trend: 'unknown', strength: 0, error: 'insufficient_valid_prices' };

  const recent = prices.slice(-5);

  const changes = [];
  for (let i = 1; i < recent.length; i++) {
    changes.push((recent[i] - recent[i - 1]) / recent[i - 1] * 100);
  }

  const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
  const currentPrice = prices[prices.length - 1];
  const openPrice = prices[0];
  const dayChange = ((currentPrice - openPrice) / openPrice) * 100;

  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const volatility = ((high - low) / low) * 100;

  let trend;
  if (avgChange > INTELLIGENT_ANALYSIS_CONFIG.SIGNIFICANT_CHANGE_THRESHOLD) {
    trend = 'strong_up';
  } else if (avgChange > INTELLIGENT_ANALYSIS_CONFIG.PRICE_CHANGE_THRESHOLD) {
    trend = 'up';
  } else if (avgChange < -INTELLIGENT_ANALYSIS_CONFIG.SIGNIFICANT_CHANGE_THRESHOLD) {
    trend = 'strong_down';
  } else if (avgChange < -INTELLIGENT_ANALYSIS_CONFIG.PRICE_CHANGE_THRESHOLD) {
    trend = 'down';
  } else {
    trend = 'sideways';
  }

  return {
    trend,
    strength: Math.abs(avgChange),
    dayChange,
    volatility,
    high,
    low,
    currentPrice,
    openPrice
  };
}

async function performAIAnalysis(env, historyData, tradingParams, marketAnalysis) {
  const analysisPrompt = buildAnalysisPrompt(historyData, tradingParams, marketAnalysis);

  const qwenResult = await callQwenForAnalysis(env, analysisPrompt);
  const doubaoResult = await callDoubaoForAnalysis(env, analysisPrompt);

  const combinedAnalysis = combineAIResults(qwenResult, doubaoResult, marketAnalysis);

  return combinedAnalysis;
}

function buildAnalysisPrompt(historyData, tradingParams, marketAnalysis) {
  const recentPrices = historyData.slice(-20).map(h => ({
    time: new Date(h.timestamp).toLocaleTimeString('zh-CN'),
    price: h.price
  }));

  return `作为黄金交易专家，请分析以下数据并给出交易建议：

【今日金价走势】
${recentPrices.map(p => `${p.time}: ¥${p.price}/克`).join('\n')}

【市场概况】
- 当前趋势: ${marketAnalysis.trend}
- 趋势强度: ${marketAnalysis.strength.toFixed(2)}%
- 日内涨跌: ${marketAnalysis.dayChange.toFixed(2)}%
- 波动率: ${marketAnalysis.volatility.toFixed(2)}%
- 今日最高: ¥${marketAnalysis.high}/克
- 今日最低: ¥${marketAnalysis.low}/克

【交易参数】
- 平均持仓成本: ¥${tradingParams.avgBuyPrice.toFixed(2)}/克
- 持仓总量: ${tradingParams.totalHoldings.toFixed(3)}克
- 买入目标价: ${tradingParams.buyTargets.map(p => `¥${p}`).join(', ') || '未设置'}
- 卖出目标价: ${tradingParams.sellTargets.map(p => `¥${p}`).join(', ') || '未设置'}

请提供：
1. 趋势判断（上涨/下跌/震荡）及理由
2. 买入建议（是否适合买入，目标价位）
3. 卖出建议（是否适合卖出，目标价位）
4. 风险提示
5. 预期收益分析

请用简洁专业的语言回答。`;
}

async function callQwenForAnalysis(env, prompt) {
  try {
    const apiKey = env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      console.log('[AI Analysis] Qwen API key not configured');
      return null;
    }

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: {
          messages: [
            { role: 'system', content: '你是黄金交易分析专家，擅长技术分析和趋势判断。' },
            { role: 'user', content: prompt }
          ]
        },
        parameters: {
          temperature: 0.7,
          max_tokens: 800
        }
      })
    });

    const result = await response.json();
    return result.output?.text || null;
  } catch (error) {
    console.error('[AI Analysis] Qwen error:', error);
    return null;
  }
}

async function callDoubaoForAnalysis(env, prompt) {
  try {
    const apiKey = env.DOUBAO_API_KEY;
    if (!apiKey) {
      console.log('[AI Analysis] Doubao API key not configured');
      return null;
    }

    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'doubao-seed-2-0-pro-260215',
        messages: [
          { role: 'system', content: '你是黄金交易分析专家，擅长技术分析和趋势判断。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const result = await response.json();
    return result.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('[AI Analysis] Doubao error:', error);
    return null;
  }
}

function combineAIResults(qwenResult, doubaoResult, marketAnalysis) {
  const hasQwen = qwenResult && qwenResult.length > 50;
  const hasDoubao = doubaoResult && doubaoResult.length > 50;

  if (!hasQwen && !hasDoubao) {
    return { hasValue: false, reason: 'AI分析未返回有效结果' };
  }

  const combinedText = [qwenResult, doubaoResult].filter(Boolean).join('\n\n---\n\n');

  const buySignals = (combinedText.match(/买入|看多|建议买入|适合买入/gi) || []).length;
  const sellSignals = (combinedText.match(/卖出|看空|建议卖出|适合卖出/gi) || []).length;
  const holdSignals = (combinedText.match(/持有|观望|震荡|等待/gi) || []).length;

  let recommendation;
  if (buySignals > sellSignals && buySignals > holdSignals) {
    recommendation = 'buy';
  } else if (sellSignals > buySignals && sellSignals > holdSignals) {
    recommendation = 'sell';
  } else {
    recommendation = 'hold';
  }

  const hasSignificantInsight = buySignals >= 2 || sellSignals >= 2 || combinedText.includes('预期收益') || combinedText.includes('目标价位');

  return {
    hasValue: hasSignificantInsight,
    recommendation,
    qwenResult,
    doubaoResult,
    combinedAnalysis: combinedText,
    signals: { buy: buySignals, sell: sellSignals, hold: holdSignals }
  };
}

async function calculateProfitOpportunities(currentPrice, tradingParams, marketAnalysis, env) {
  const opportunities = [];

  // 获取容错阈值设置
  let toleranceSettings = { buyTolerance: 2.0, sellTolerance: 2.0 };
  try {
    const toleranceStmt = env.DB.prepare(`SELECT buy_tolerance, sell_tolerance FROM alert_tolerance_settings ORDER BY id DESC LIMIT 1`);
    const toleranceResult = await toleranceStmt.first();
    if (toleranceResult) {
      toleranceSettings = {
        buyTolerance: toleranceResult.buy_tolerance,
        sellTolerance: toleranceResult.sell_tolerance
      };
    }
  } catch (error) {
    console.log('[Tolerance] Using default tolerance settings');
  }

  if (tradingParams.avgBuyPrice > 0 && tradingParams.totalHoldings > 0) {
    const currentProfitPct = ((currentPrice - tradingParams.avgBuyPrice) / tradingParams.avgBuyPrice) * 100;

    if (currentProfitPct >= INTELLIGENT_ANALYSIS_CONFIG.PROFIT_TARGET_PCT) {
      const potentialProfit = (currentPrice - tradingParams.avgBuyPrice) * tradingParams.totalHoldings;
      opportunities.push({
        type: 'profit_taking',
        title: '获利了结提醒',
        message: `当前持仓收益率 ${currentProfitPct.toFixed(2)}%，建议考虑部分获利了结`,
        potentialProfit,
        currentPrice,
        avgBuyPrice: tradingParams.avgBuyPrice,
        recommendation: 'sell_partial'
      });
    }

    if (currentProfitPct <= INTELLIGENT_ANALYSIS_CONFIG.STOP_LOSS_PCT) {
      opportunities.push({
        type: 'stop_loss',
        title: '止损提醒',
        message: `当前持仓亏损 ${Math.abs(currentProfitPct).toFixed(2)}%，建议考虑止损`,
        currentPrice,
        avgBuyPrice: tradingParams.avgBuyPrice,
        recommendation: 'stop_loss'
      });
    }
  }

  // 使用用户设置的容错阈值
  tradingParams.buyTargets.forEach(target => {
    const priceDiff = Math.abs(currentPrice - target);
    const distance = ((target - currentPrice) / currentPrice) * 100;
    
    if (priceDiff <= toleranceSettings.buyTolerance) {
      opportunities.push({
        type: 'buy_target',
        title: '🎯 买入时机提醒',
        message: `当前价格 ¥${currentPrice} 距离买入目标 ¥${target} 仅差 ¥${priceDiff.toFixed(2)}（${distance.toFixed(2)}%），在容错范围 ±¥${toleranceSettings.buyTolerance} 内`,
        targetPrice: target,
        currentPrice,
        priceDiff,
        tolerance: toleranceSettings.buyTolerance,
        recommendation: currentPrice <= target ? 'buy_now' : 'watch_buy'
      });
    }
  });

  tradingParams.sellTargets.forEach(target => {
    const priceDiff = Math.abs(currentPrice - target);
    const distance = ((currentPrice - target) / target) * 100;
    
    if (priceDiff <= toleranceSettings.sellTolerance) {
      opportunities.push({
        type: 'sell_target',
        title: '🎯 卖出时机提醒',
        message: `当前价格 ¥${currentPrice} 距离卖出目标 ¥${target} 仅差 ¥${priceDiff.toFixed(2)}（${distance.toFixed(2)}%），在容错范围 ±¥${toleranceSettings.sellTolerance} 内`,
        targetPrice: target,
        currentPrice,
        priceDiff,
        tolerance: toleranceSettings.sellTolerance,
        recommendation: currentPrice >= target ? 'sell_now' : 'watch_sell'
      });
    }
  });

  return opportunities;
}

async function sendIntelligentTradingAdvice(env, aiAnalysis, currentPrice, tradingParams) {
  const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const titleMap = {
    'buy': '📈 AI买入建议',
    'sell': '📉 AI卖出建议',
    'hold': '⏸️ AI持仓建议'
  };

  const title = titleMap[aiAnalysis.recommendation] || '🤖 AI交易分析';

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
    .price-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .price { font-size: 28px; font-weight: bold; color: #667eea; }
    .analysis { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .analysis h3 { color: #667eea; margin-top: 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>智能分析时间: ${timeStr}</p>
    </div>
    <div class="content">
      <div class="price-box">
        <div style="color: #666; font-size: 14px; margin-bottom: 8px;">当前金价</div>
        <div class="price">¥${currentPrice}/克</div>
      </div>

      <div class="analysis">
        <h3>🤖 AI综合分析</h3>
        <pre style="white-space: pre-wrap; font-family: inherit; line-height: 1.8;">${aiAnalysis.combinedAnalysis}</pre>
      </div>

      ${tradingParams.avgBuyPrice > 0 ? `
      <div class="analysis">
        <h3>📊 持仓分析</h3>
        <p><strong>平均持仓成本:</strong> ¥${tradingParams.avgBuyPrice.toFixed(2)}/克</p>
        <p><strong>持仓数量:</strong> ${tradingParams.totalHoldings.toFixed(3)}克</p>
        <p><strong>当前盈亏:</strong> ${(((currentPrice - tradingParams.avgBuyPrice) / tradingParams.avgBuyPrice) * 100).toFixed(2)}%</p>
      </div>
      ` : ''}

      <div class="footer">
        <p>此分析由千问和豆包大模型联合生成</p>
        <p><a href="https://ustc.dev/trading/">查看交易详情</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

  await sendMultiChannelNotification(env, {
    title: `${title} - ¥${currentPrice}/克`,
    emailSubject: `${title} - ${timeStr}`,
    emailHtml,
    feishuContent: `**${title}**\n\n> 时间：${timeStr}\n\n**当前金价：** ¥${currentPrice}/克\n\n**AI分析结论：**\n${aiAnalysis.recommendation === 'buy' ? '建议买入' : aiAnalysis.recommendation === 'sell' ? '建议卖出' : '建议观望'}\n\n[查看详细分析](https://ustc.dev/trading/)`,
    meowContent: `${title}\n\n当前金价: ¥${currentPrice}/克\nAI建议: ${aiAnalysis.recommendation === 'buy' ? '买入' : aiAnalysis.recommendation === 'sell' ? '卖出' : '观望'}\n\n点击查看详细分析`
  });
}

async function sendProfitOpportunityAlerts(env, opportunities, currentPrice) {
  const timeStr = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  for (const opp of opportunities) {
    const emoji = opp.type === 'profit_taking' ? '💰' : opp.type === 'stop_loss' ? '⚠️' : '🎯';

    await sendMultiChannelNotification(env, {
      title: `${emoji} ${opp.title}`,
      emailSubject: `${emoji} ${opp.title} - ${timeStr}`,
      emailHtml: buildOpportunityEmailHtml(opp, currentPrice, timeStr),
      feishuContent: `**${emoji} ${opp.title}**\n\n> 时间：${timeStr}\n\n${opp.message}\n\n当前价格：¥${currentPrice}/克\n\n[查看交易详情](https://ustc.dev/trading/)`,
      meowContent: `${emoji} ${opp.title}\n\n${opp.message}\n\n当前: ¥${currentPrice}/克`
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

function buildOpportunityEmailHtml(opp, currentPrice, timeStr) {
  const colorMap = {
    'profit_taking': '#30d158',
    'stop_loss': '#ff375f',
    'buy_target': '#64d2ff',
    'sell_target': '#ff9500'
  };

  const color = colorMap[opp.type] || '#667eea';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${color}; color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
    .alert-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${color}; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${opp.title}</h1>
      <p>${timeStr}</p>
    </div>
    <div class="content">
      <div class="alert-box">
        <h3 style="margin-top: 0; color: ${color};">交易提醒</h3>
        <p style="font-size: 18px; margin: 15px 0;">${opp.message}</p>
        <p><strong>当前金价:</strong> ¥${currentPrice}/克</p>
        ${opp.potentialProfit ? `<p><strong>预期收益:</strong> ¥${opp.potentialProfit.toFixed(2)}</p>` : ''}
        ${opp.targetPrice ? `<p><strong>目标价格:</strong> ¥${opp.targetPrice}/克</p>` : ''}
      </div>
      <div class="footer">
        <p><a href="https://ustc.dev/trading/">查看交易详情</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function sendMultiChannelNotification(env, content) {
  const results = await Promise.allSettled([
    sendEmailNotification(env, content.emailSubject, content.emailHtml),
    sendFeishuNotification(env, content.feishuContent),
    sendMeowNotification(env, content.title, content.meowContent)
  ]);

  console.log('[Multi-Channel] Notification results:', {
    email: results[0].status,
    feishu: results[1].status,
    meow: results[2].status
  });
}

async function sendEmailNotification(env, subject, html) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return { success: false, error: 'No API key' };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'USTC Dev <noreply@ustc.dev>',
        to: ['metanext@foxmail.com'],
        subject,
        html
      })
    });
    return { success: response.ok };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendFeishuNotification(env, content) {
  const FEISHU_WEBHOOK = env.FEISHU_WEBHOOK;
  if (!FEISHU_WEBHOOK) return { success: false, error: 'No webhook' };

  try {
    const response = await fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: '智能交易提醒' },
            template: 'blue'
          },
          elements: [{ tag: 'markdown', content }]
        }
      })
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendMeowNotification(env, title, content) {
  const MEOW_USER_ID = env.MEOW_USER_ID || '5bf48882';

  try {
    const response = await fetch(`https://api.chuckfang.com/${MEOW_USER_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        msg: content,
        url: 'https://ustc.dev/trading/'
      })
    });
    const result = await response.json();
    return { success: result.status === 200 };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ================================================================================
// 每日零点清理预设价格任务
// ================================================================================

async function cleanupDailyPriceAlerts(env) {
  console.log('[Cleanup] Starting daily price alerts cleanup at:', new Date().toISOString());
  
  try {
    const deleteAllStmt = env.DB.prepare(`DELETE FROM price_alerts`);
    const result = await deleteAllStmt.run();
    console.log('[Cleanup] Deleted all price alerts:', result.meta?.changes || 0);
    
    await sendMultiChannelNotification(env, {
      title: '🧹 每日预警清理完成',
      emailSubject: '🧹 每日预警清理完成 - ' + new Date().toLocaleDateString('zh-CN'),
      emailHtml: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; text-align: center; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 12px 12px; }
    .stats { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #999; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧹 每日预警清理完成</h1>
      <p>${new Date().toLocaleDateString('zh-CN')}</p>
    </div>
    <div class="content">
      <div class="stats">
        <h3>清理统计</h3>
        <p>已删除已触发的预警: ${triggeredResult.meta?.changes || 0} 条</p>
        <p>已重置活跃预警: ${resetResult.meta?.changes || 0} 条</p>
      </div>
      <p>系统已自动清理昨日预警数据，今日预警任务已重置。</p>
      <div class="footer">
        <p><a href="https://ustc.dev/trading/">查看交易详情</a></p>
      </div>
    </div>
  </div>
</body>
</html>`,
      feishuContent: `**🧹 每日预警清理完成**\n\n日期：${new Date().toLocaleDateString('zh-CN')}\n\n清理统计：\n- 已删除已触发预警：${triggeredResult.meta?.changes || 0} 条\n- 已重置活跃预警：${resetResult.meta?.changes || 0} 条\n\n今日预警任务已重置，请重新设置交易策略。`,
      meowContent: `🧹 每日预警清理完成\n\n已删除已触发预警: ${triggeredResult.meta?.changes || 0} 条\n已重置活跃预警: ${resetResult.meta?.changes || 0} 条\n\n今日预警任务已重置`
    });
    
    console.log('[Cleanup] Daily cleanup completed successfully');
    return { 
      success: true, 
      deleted: triggeredResult.meta?.changes || 0,
      reset: resetResult.meta?.changes || 0
    };
  } catch (error) {
    console.error('[Cleanup] Error during daily cleanup:', error);
    return { success: false, error: error.message };
  }
}
