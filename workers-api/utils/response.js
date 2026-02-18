export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

export function successResponse(data, meta = {}) {
  return jsonResponse({
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      ...meta
    }
  });
}

export function errorResponse(message, code = 'ERROR', status = 400) {
  return jsonResponse({
    success: false,
    error: {
      code,
      message
    },
    meta: {
      timestamp: Date.now()
    }
  }, status);
}

export function paginatedResponse(data, pagination, meta = {}) {
  return jsonResponse({
    success: true,
    data,
    pagination,
    meta: {
      timestamp: Date.now(),
      ...meta
    }
  });
}
