const RATE_LIMITS = {
  default: { windowMs: 60000, max: 100 },
  login: { windowMs: 900000, max: 5 },
  chat: { windowMs: 60000, max: 30 },
  upload: { windowMs: 3600000, max: 10 },
  api: { windowMs: 60000, max: 60 },
};

const rateLimitStore = new Map();

const MAX_STORE_SIZE = 10000;

function cleanupStore() {
  if (rateLimitStore.size < MAX_STORE_SIZE) return;
  
  const now = Date.now();
  const keysToDelete = [];
  
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.windowStart > data.windowMs) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete.slice(0, 1000)) {
    rateLimitStore.delete(key);
  }
}

export function createRateLimiter(type = 'default') {
  const config = RATE_LIMITS[type] || RATE_LIMITS.default;
  
  return function rateLimit(identifier) {
    cleanupStore();
    
    const key = `${type}:${identifier}`;
    const now = Date.now();
    
    let data = rateLimitStore.get(key);
    
    if (!data || now - data.windowStart > config.windowMs) {
      data = {
        count: 1,
        windowStart: now,
        windowMs: config.windowMs
      };
      rateLimitStore.set(key, data);
      return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowMs };
    }
    
    if (data.count >= config.max) {
      const resetAt = data.windowStart + config.windowMs;
      return { allowed: false, remaining: 0, resetAt, retryAfter: Math.ceil((resetAt - now) / 1000) };
    }
    
    data.count++;
    rateLimitStore.set(key, data);
    
    return { allowed: true, remaining: config.max - data.count, resetAt: data.windowStart + config.windowMs };
  };
}

export function rateLimitMiddleware(type = 'api') {
  const limiter = createRateLimiter(type);
  
  return async function(request, env, ctx, next) {
    const ip = request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
               'unknown';
    
    const result = limiter(ip);
    
    if (!result.allowed) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `请求过于频繁，请在 ${result.retryAfter} 秒后重试`
        }
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMITS[type]?.max || 100),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt),
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    const response = await next();
    
    if (response) {
      response.headers.set('X-RateLimit-Limit', String(RATE_LIMITS[type]?.max || 100));
      response.headers.set('X-RateLimit-Remaining', String(result.remaining));
      response.headers.set('X-RateLimit-Reset', String(result.resetAt));
    }
    
    return response;
  };
}

export { RATE_LIMITS };
