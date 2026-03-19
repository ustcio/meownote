export const config = {
  api: {
    baseUrl: import.meta.env.PUBLIC_API_BASE || 'https://api.ustc.dev',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  
  auth: {
    tokenKey: 'auth_token',
    userKey: 'user_data',
    tokenExpiry: 7 * 24 * 60 * 60 * 1000,
    refreshTokenKey: 'refresh_token',
  },
  
  storage: {
    prefix: 'meownote_',
    version: '1.0',
  },
  
  security: {
    csrfHeaderName: 'X-CSRF-Token',
    csrfCookieName: 'csrf_token',
  },
  
  chatbot: {
    maxHistoryLength: 20,
    maxMessageLength: 4000,
    defaultModel: 'minimax-2.7',
    storageKey: 'chatbot_conversations',
    sessionKey: 'chatbot_session_id',
  },
  
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: false,
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  },
  
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000,
  },

  workspace: {
    apiBase: import.meta.env.PUBLIC_API_BASE || 'https://api.ustc.dev',
    endpoint: '/api/workspace',
  },
} as const;

export type Config = typeof config;
