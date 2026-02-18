const ALLOWED_ORIGINS = [
  'https://ustc.dev',
  'https://www.ustc.dev',
  'https://meow-note.com',
  'https://www.meow-note.com',
  'http://localhost:4321',
  'http://localhost:4322',
  'http://localhost:4323',
  'http://localhost:4324',
];

export function handleCORS(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Cache-Control',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export function corsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Cache-Control',
    'Access-Control-Max-Age': '86400',
  };
}

export function withCORS(response, request) {
  const origin = request.headers.get('Origin');
  const headers = corsHeaders(origin);
  
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(headers)) {
    newResponse.headers.set(key, value);
  }
  
  return newResponse;
}
