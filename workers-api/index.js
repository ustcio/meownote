import { handleCORS, withCORS } from './middleware/cors.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { 
  handleChat,
  handleSignup,
  handleLogin,
  handleUserProfile,
  handleUserPassword,
  handleAdminLogin,
  handleVisitor,
  handleStatsVisit,
  handleStatsGet,
  handleHeatmap,
  handleGoldPrice,
  handleGoldPriceStream,
  handleGoldHistory,
  handleAdminVerify,
  handleAdminFiles,
  handleAdminFileAction,
  handleAdminFolders,
  handleAdminFolderAction,
  handleAdminStats,
  handleAdminChangePassword,
  handleUploadInit,
  handleUploadPart,
  handleUploadComplete,
  handleUploadAbort
} from './handlers/index.js';
import { jsonResponse } from './utils/response.js';

const routes = [
  { pattern: '/api/chat', handler: handleChat, method: 'POST', rateLimit: 'chat' },
  { pattern: '/api/signup', handler: handleSignup, method: 'POST', rateLimit: 'api' },
  { pattern: '/api/login', handler: handleLogin, method: 'POST', rateLimit: 'login' },
  { pattern: '/api/user/profile', handler: handleUserProfile, method: 'PUT' },
  { pattern: '/api/user/password', handler: handleUserPassword, method: 'PUT' },
  { pattern: '/api/visitor', handler: handleVisitor, method: 'GET' },
  { pattern: '/api/gold', handler: handleGoldPrice, method: 'GET' },
  { pattern: '/api/gold/stream', handler: handleGoldPriceStream, method: 'GET' },
  { pattern: '/api/gold/history', handler: handleGoldHistory, method: 'GET' },
  { pattern: '/stats/visit', handler: handleStatsVisit, method: 'POST' },
  { pattern: '/stats/visitor', handler: handleStatsGet, method: 'GET' },
  { pattern: '/stats/heatmap', handler: handleHeatmap, method: 'GET' },
  { pattern: '/api/admin/login', handler: handleAdminLogin, method: 'POST', rateLimit: 'login' },
  { pattern: '/api/admin/verify', handler: handleAdminVerify, method: 'GET' },
  { pattern: '/api/admin/files', handler: handleAdminFiles, method: ['GET', 'POST'], rateLimit: 'upload' },
  { pattern: '/api/admin/folders', handler: handleAdminFolders, method: ['GET', 'POST'] },
  { pattern: '/api/admin/stats', handler: handleAdminStats, method: 'GET' },
  { pattern: '/api/admin/change-password', handler: handleAdminChangePassword, method: 'POST' },
  { pattern: '/api/admin/upload/init', handler: handleUploadInit, method: 'POST', rateLimit: 'upload' },
  { pattern: '/api/admin/upload/part', handler: handleUploadPart, method: 'POST' },
  { pattern: '/api/admin/upload/complete', handler: handleUploadComplete, method: 'POST' },
  { pattern: '/api/admin/upload/abort', handler: handleUploadAbort, method: 'POST' },
];

function matchRoute(pathname) {
  for (const route of routes) {
    if (pathname === route.pattern || pathname.startsWith(route.pattern + '/')) {
      return route;
    }
  }
  return null;
}

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (request.method === 'OPTIONS') {
    return handleCORS(request);
  }

  const route = matchRoute(pathname);

  if (!route) {
    return jsonResponse({ 
      success: false, 
      error: 'Not Found',
      path: pathname 
    }, 404);
  }

  if (route.method) {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    if (!methods.includes(request.method)) {
      return jsonResponse({ 
        success: false, 
        error: 'Method Not Allowed' 
      }, 405);
    }
  }

  if (route.rateLimit) {
    const limiter = rateLimitMiddleware(route.rateLimit);
    const result = await limiter(request, env, ctx, async () => null);
    if (result) return result;
  }

  try {
    if (pathname.startsWith('/api/admin/files/')) {
      return await handleAdminFileAction(request, env, pathname);
    }
    
    if (pathname.startsWith('/api/admin/folders/')) {
      return await handleAdminFolderAction(request, env, pathname);
    }

    const response = await route.handler(request, env, ctx);
    return withCORS(response, request);
  } catch (error) {
    console.error(`Handler error for ${pathname}:`, error);
    return jsonResponse({ 
      success: false, 
      error: 'Internal Server Error',
      message: error.message 
    }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    const { scheduledGoldCrawl } = await import('./handlers/gold.js');
    ctx.waitUntil(scheduledGoldCrawl(env));
  }
};
