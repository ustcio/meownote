import { jsonResponse } from '../utils/response.js';
import { sanitizeInput, validateModel } from '../utils/validation.js';

const CHAT_SYSTEM_PROMPT = 'You are Meow AI Assistant, a helpful, harmless, and honest AI assistant. You can help users with coding, analysis, creative writing, and various other tasks. Please respond in the same language as the user.';

const MODEL_CONFIG = {
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

export async function handleChat(request, env, ctx) {
  const requestStartTime = Date.now();
  
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
  }

  const { message, model = 'qwen-turbo', history = [], stream = false } = body;
  
  if (!message || typeof message !== 'string') {
    return jsonResponse({ success: false, message: 'Message is required' }, 400);
  }

  if (message.length > 4000) {
    return jsonResponse({ success: false, message: 'Message too long (max 4000 chars)' }, 400);
  }

  if (!validateModel(model)) {
    return jsonResponse({ success: false, message: 'Invalid model selected' }, 400);
  }

  const config = MODEL_CONFIG[model];
  const apiKey = config.provider === 'qwen' ? env.DASHSCOPE_API_KEY : env.DOUBAO_API_KEY;
  
  if (!apiKey) {
    return jsonResponse({ success: false, message: 'API not configured' }, 500);
  }

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

  try {
    const requestBody = {
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: stream
    };

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

    if (stream && response.ok) {
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const data = await response.json();
    const totalLatency = Date.now() - requestStartTime;
    
    if (data.choices?.[0]?.message?.content) {
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
      return jsonResponse({
        success: false,
        message: data.error.message || 'AI service error'
      }, 500);
    }

    return jsonResponse({
      success: false,
      message: 'Unexpected response from AI'
    }, 500);

  } catch (error) {
    return jsonResponse({
      success: false,
      message: 'Failed to get AI response: ' + error.message
    }, 500);
  }
}
