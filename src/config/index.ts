const DEFAULT_API_BASE = 'https://api.moonsun.ai';
const apiBase = import.meta.env.PUBLIC_API_BASE || DEFAULT_API_BASE;

export const config = {
  api: {
    baseUrl: apiBase,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  
  auth: {
    tokenKey: 'meownote_auth_token',
    userKey: 'meownote_user_data',
    tokenExpiry: 7 * 24 * 60 * 60 * 1000,
    refreshTokenKey: 'meownote_refresh_token',
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
    defaultModel: 'qwen3.6-plus',
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
    apiBase,
    endpoint: '/api/workspace',
  },
} as const;

export const API_BASE = config.api.baseUrl;
export const AUTH_TOKEN_KEY = config.auth.tokenKey;

export type Config = typeof config;
