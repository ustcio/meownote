export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePassword(password) {
  return password && password.length >= 8;
}

export function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>\"'&]/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '&': '&amp;'
  })[char]);
}

export function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
         'unknown';
}

export function validateRequired(obj, fields) {
  const missing = [];
  for (const field of fields) {
    if (!obj[field]) {
      missing.push(field);
    }
  }
  return missing.length === 0 ? null : missing;
}

export function validateLength(str, min, max) {
  if (!str) return false;
  const len = str.length;
  return len >= min && len <= max;
}

export function validateModel(model) {
  const validModels = ['qwen-turbo', 'qwen-plus', 'doubao-2.0-pro', 'doubao-2.0-code'];
  return validModels.includes(model);
}

export function sanitizeObject(obj, maxDepth = 3) {
  if (maxDepth <= 0) return null;
  
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string') {
      return sanitizeInput(obj);
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth - 1));
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeInput(key);
    result[sanitizedKey] = sanitizeObject(value, maxDepth - 1);
  }
  return result;
}
