import { jsonResponse } from '../utils/response.js';
import { sanitizeInput, getClientIP } from '../utils/validation.js';
import { generateVisitorId } from '../utils/crypto.js';

export async function handleVisitor(request, env, ctx) {
  const ip = getClientIP(request);
  const today = new Date().toISOString().split('T')[0];

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

export async function handleStatsVisit(request, env, ctx) {
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
    const today = new Date().toISOString().split('T')[0];

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

    const [pvResult, onlineResult, todayPVResult] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as count FROM page_views`).first(),
      env.DB.prepare(
        `SELECT COUNT(*) as count FROM (
          SELECT visitor_id FROM page_views 
          WHERE created_at > datetime('now', '-5 minutes')
          GROUP BY visitor_id
        )`
      ).first(),
      env.DB.prepare(
        `SELECT COUNT(*) as count FROM page_views 
         WHERE date(created_at) = date('now')`
      ).first()
    ]);

    return jsonResponse({ 
      success: true,
      pv: pvResult?.count || 0,
      total: pvResult?.count || 0,
      online: onlineResult?.count || 0,
      today: todayPVResult?.count || 0
    });

  } catch (error) {
    console.error('Stats visit error:', error);
    return jsonResponse({ success: true, pv: 0, total: 0, online: 0, today: 0 });
  }
}

export async function handleStatsGet(request, env, ctx) {
  try {
    const [pvResult, uvResult, onlineResult, todayPVResult] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as count FROM page_views`).first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT visitor_id) as count FROM unique_visitors`).first(),
      env.DB.prepare(
        `SELECT COUNT(*) as count FROM (
          SELECT visitor_id FROM page_views 
          WHERE created_at > datetime('now', '-5 minutes')
          GROUP BY visitor_id
        )`
      ).first(),
      env.DB.prepare(
        `SELECT COUNT(*) as count FROM page_views 
         WHERE date(created_at) = date('now')`
      ).first()
    ]);

    return jsonResponse({ 
      success: true,
      pv: pvResult?.count || 0, 
      uv: uvResult?.count || 0,
      total: pvResult?.count || 0,
      online: onlineResult?.count || 0,
      today: todayPVResult?.count || 0
    });
  } catch (error) {
    console.error('Stats get error:', error);
    return jsonResponse({ success: true, pv: 0, uv: 0, total: 0, online: 0, today: 0 });
  }
}

export async function handleHeatmap(request, env, ctx) {
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
