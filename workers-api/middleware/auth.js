import { verifyAdminToken } from '../utils/crypto.js';
import { jsonResponse } from '../utils/response.js';

export async function verifyAdminAuth(request, env) {
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

export function requireAuth(handler) {
  return async (request, env, ctx, ...args) => {
    const authResult = await verifyAdminAuth(request, env);
    
    if (!authResult.success) {
      return jsonResponse({ success: false, message: authResult.message }, 401);
    }
    
    return handler(request, env, ctx, authResult.user, ...args);
  };
}

export function requireRole(role) {
  return function(handler) {
    return async (request, env, ctx, ...args) => {
      const authResult = await verifyAdminAuth(request, env);
      
      if (!authResult.success) {
        return jsonResponse({ success: false, message: authResult.message }, 401);
      }
      
      if (authResult.user.role !== role && authResult.user.role !== 'admin') {
        return jsonResponse({ success: false, message: '权限不足' }, 403);
      }
      
      return handler(request, env, ctx, authResult.user, ...args);
    };
  };
}
