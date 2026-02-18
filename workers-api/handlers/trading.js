import { jsonResponse } from '../utils/response.js';
import { verifyAdminToken } from '../middleware/auth.js';
import { createAdminToken } from '../utils/crypto.js';

const TRADING_CONFIG = {
  MAX_QUANTITY: 10000,
  MIN_QUANTITY: 0.001,
  MAX_PRICE: 100000,
  MIN_PRICE: 0.01,
  ALERT_COOLDOWN_MS: 60000,
  NOTIFICATION_RETRY_LIMIT: 3
};

function validateNumber(value, min, max, fieldName) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }
  if (num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }
  if (num > max) {
    return { valid: false, error: `${fieldName} must not exceed ${max}` };
  }
  return { valid: true, value: num };
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
}

function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export async function handleTradingLogin(request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return jsonResponse({ success: false, error: 'Username and password are required' }, 400);
    }

    const stmt = env.DB.prepare(
      'SELECT * FROM admin_users WHERE username = ?'
    );
    const result = await stmt.bind(username).first();

    if (!result) {
      return jsonResponse({ success: false, error: 'Invalid credentials' }, 401);
    }

    const [salt, storedHash] = result.password_hash.split(':');
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (hash !== storedHash) {
      return jsonResponse({ success: false, error: 'Invalid credentials' }, 401);
    }

    const secret = env.JWT_SECRET || 'agiera-default-jwt-secret-2024';
    const token = await createAdminToken({
      userId: result.id,
      username: result.username,
      role: result.role
    }, secret);

    await env.DB.prepare(
      'UPDATE admin_users SET last_login = ? WHERE id = ?'
    ).bind(new Date().toISOString(), result.id).run();

    return jsonResponse({
      success: true,
      token,
      user: {
        id: result.id,
        username: result.username,
        role: result.role
      }
    });
  } catch (error) {
    console.error('[Trading Login Error]', error);
    return jsonResponse({ success: false, error: 'Login failed' }, 500);
  }
}

export async function handleTradingVerify(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'No token provided' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  return jsonResponse({ success: true, user: verification.user });
}

export async function handleBuyTransaction(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { price, quantity, notes } = await request.json();

    const priceValidation = validateNumber(price, TRADING_CONFIG.MIN_PRICE, TRADING_CONFIG.MAX_PRICE, 'Buy price');
    if (!priceValidation.valid) {
      return jsonResponse({ success: false, error: priceValidation.error }, 400);
    }

    const quantityValidation = validateNumber(quantity, TRADING_CONFIG.MIN_QUANTITY, TRADING_CONFIG.MAX_QUANTITY, 'Quantity');
    if (!quantityValidation.valid) {
      return jsonResponse({ success: false, error: quantityValidation.error }, 400);
    }

    const buyPrice = priceValidation.value;
    const buyQuantity = quantityValidation.value;
    const totalAmount = buyPrice * buyQuantity;

    const stmt = env.DB.prepare(`
      INSERT INTO gold_transactions (type, price, quantity, total_amount, notes, status, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)
    `);
    
    const now = new Date().toISOString();
    const result = await stmt.bind('buy', buyPrice, buyQuantity, totalAmount, notes || null, now, now).run();

    await updateTradingStats(env, now, 'buy', totalAmount, buyQuantity, 0);

    return jsonResponse({
      success: true,
      transaction: {
        id: result.meta.last_row_id,
        type: 'buy',
        price: buyPrice,
        quantity: buyQuantity,
        totalAmount,
        notes,
        createdAt: now
      }
    });
  } catch (error) {
    console.error('[Buy Transaction Error]', error);
    return jsonResponse({ success: false, error: 'Failed to create buy transaction' }, 500);
  }
}

export async function handleSellTransaction(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { buyTransactionId, actualSellPrice, quantity, notes } = await request.json();

    const priceValidation = validateNumber(actualSellPrice, TRADING_CONFIG.MIN_PRICE, TRADING_CONFIG.MAX_PRICE, 'Sell price');
    if (!priceValidation.valid) {
      return jsonResponse({ success: false, error: priceValidation.error }, 400);
    }

    const quantityValidation = validateNumber(quantity, TRADING_CONFIG.MIN_QUANTITY, TRADING_CONFIG.MAX_QUANTITY, 'Quantity');
    if (!quantityValidation.valid) {
      return jsonResponse({ success: false, error: quantityValidation.error }, 400);
    }

    const sellPrice = priceValidation.value;
    const sellQuantity = quantityValidation.value;
    const totalAmount = sellPrice * sellQuantity;

    let profit = 0;
    let buyPrice = 0;

    if (buyTransactionId) {
      const buyStmt = env.DB.prepare('SELECT * FROM gold_transactions WHERE id = ? AND type = ?');
      const buyResult = await buyStmt.bind(buyTransactionId, 'buy').first();
      
      if (buyResult) {
        buyPrice = buyResult.price;
        profit = (sellPrice - buyPrice) * sellQuantity;
      }
    }

    const stmt = env.DB.prepare(`
      INSERT INTO gold_transactions (type, price, quantity, total_amount, actual_sell_price, profit, notes, status, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
    `);
    
    const now = new Date().toISOString();
    const result = await stmt.bind('sell', buyPrice || sellPrice, sellQuantity, totalAmount, sellPrice, profit, notes || null, now, now).run();

    await updateTradingStats(env, now, 'sell', totalAmount, sellQuantity, profit);

    return jsonResponse({
      success: true,
      transaction: {
        id: result.meta.last_row_id,
        type: 'sell',
        price: buyPrice || sellPrice,
        quantity: sellQuantity,
        totalAmount,
        actualSellPrice: sellPrice,
        profit,
        notes,
        createdAt: now
      }
    });
  } catch (error) {
    console.error('[Sell Transaction Error]', error);
    return jsonResponse({ success: false, error: 'Failed to create sell transaction' }, 500);
  }
}

async function updateTradingStats(env, dateStr, type, amount, quantity, profit) {
  const date = formatDate(dateStr);
  
  const existingStmt = env.DB.prepare('SELECT * FROM trading_stats WHERE date = ?');
  const existing = await existingStmt.bind(date).first();

  if (existing) {
    const updateStmt = env.DB.prepare(`
      UPDATE trading_stats 
      SET total_buy = total_buy + ?,
          total_sell = total_sell + ?,
          total_quantity = total_quantity + ?,
          daily_profit = daily_profit + ?,
          transaction_count = transaction_count + 1
      WHERE date = ?
    `);
    
    await updateStmt.bind(
      type === 'buy' ? amount : 0,
      type === 'sell' ? amount : 0,
      quantity,
      profit,
      date
    ).run();
  } else {
    const insertStmt = env.DB.prepare(`
      INSERT INTO trading_stats (date, total_buy, total_sell, total_quantity, daily_profit, transaction_count)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    
    await insertStmt.bind(
      date,
      type === 'buy' ? amount : 0,
      type === 'sell' ? amount : 0,
      quantity,
      profit
    ).run();
  }
}

export async function handleGetTransactions(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const type = url.searchParams.get('type');
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const sortBy = url.searchParams.get('sortBy') || 'created_at';
  const sortOrder = url.searchParams.get('sortOrder') || 'DESC';

  const offset = (page - 1) * limit;

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (type && ['buy', 'sell'].includes(type)) {
      whereClause += ' AND type = ?';
      params.push(type);
    }

    if (startDate) {
      whereClause += ' AND date(created_at) >= date(?)';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND date(created_at) <= date(?)';
      params.push(endDate);
    }

    const validSortColumns = ['created_at', 'price', 'quantity', 'total_amount', 'profit'];
    const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    const validSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';

    const countStmt = env.DB.prepare(`SELECT COUNT(*) as total FROM gold_transactions ${whereClause}`);
    const countResult = await countStmt.bind(...params).first();
    const total = countResult?.total || 0;

    const dataStmt = env.DB.prepare(`
      SELECT * FROM gold_transactions 
      ${whereClause}
      ORDER BY ${validSortBy} ${validSortOrder}
      LIMIT ? OFFSET ?
    `);
    
    const dataResult = await dataStmt.bind(...params, limit, offset).all();

    return jsonResponse({
      success: true,
      transactions: dataResult.results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[Get Transactions Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch transactions' }, 500);
  }
}

export async function handleGetTransactionStats(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  try {
    const now = new Date();
    const today = formatDate(now);
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = formatDate(weekStart);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = formatDate(monthStart);

    const totalStmt = env.DB.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'buy' THEN total_amount ELSE 0 END), 0) as total_buy,
        COALESCE(SUM(CASE WHEN type = 'sell' THEN total_amount ELSE 0 END), 0) as total_sell,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(SUM(CASE WHEN type = 'buy' THEN quantity ELSE 0 END), 0) as total_quantity_bought,
        COALESCE(SUM(CASE WHEN type = 'sell' THEN quantity ELSE 0 END), 0) as total_quantity_sold,
        COUNT(*) as total_transactions
      FROM gold_transactions
    `);
    const totalStats = await totalStmt.first();

    const weekStmt = env.DB.prepare(`
      SELECT 
        COALESCE(SUM(profit), 0) as week_profit,
        COALESCE(SUM(CASE WHEN type = 'buy' THEN quantity ELSE 0 END), 0) as week_quantity
      FROM gold_transactions
      WHERE date(created_at) >= date(?)
    `);
    const weekStats = await weekStmt.bind(weekStartStr).first();

    const monthStmt = env.DB.prepare(`
      SELECT 
        COALESCE(SUM(profit), 0) as month_profit,
        COALESCE(SUM(CASE WHEN type = 'buy' THEN quantity ELSE 0 END), 0) as month_quantity
      FROM gold_transactions
      WHERE date(created_at) >= date(?)
    `);
    const monthStats = await monthStmt.bind(monthStartStr).first();

    const dailyStmt = env.DB.prepare(`
      SELECT 
        date(created_at) as date,
        SUM(profit) as profit,
        SUM(CASE WHEN type = 'buy' THEN total_amount ELSE 0 END) as buy_amount,
        SUM(CASE WHEN type = 'sell' THEN total_amount ELSE 0 END) as sell_amount
      FROM gold_transactions
      WHERE date(created_at) >= date(?)
      GROUP BY date(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);
    const dailyResult = await dailyStmt.bind(weekStartStr).all();

    const weeklyStmt = env.DB.prepare(`
      SELECT 
        strftime('%Y-W%W', created_at) as week,
        SUM(profit) as profit,
        SUM(CASE WHEN type = 'buy' THEN total_amount ELSE 0 END) as buy_amount,
        SUM(CASE WHEN type = 'sell' THEN total_amount ELSE 0 END) as sell_amount
      FROM gold_transactions
      WHERE created_at >= datetime('now', '-12 weeks')
      GROUP BY strftime('%Y-W%W', created_at)
      ORDER BY week DESC
      LIMIT 12
    `);
    const weeklyResult = await weeklyStmt.all();

    return jsonResponse({
      success: true,
      stats: {
        total: {
          buy: totalStats?.total_buy || 0,
          sell: totalStats?.total_sell || 0,
          profit: totalStats?.total_profit || 0,
          quantityBought: totalStats?.total_quantity_bought || 0,
          quantitySold: totalStats?.total_quantity_sold || 0,
          transactions: totalStats?.total_transactions || 0
        },
        week: {
          profit: weekStats?.week_profit || 0,
          quantity: weekStats?.week_quantity || 0
        },
        month: {
          profit: monthStats?.month_profit || 0,
          quantity: monthStats?.month_quantity || 0
        },
        daily: dailyResult.results,
        weekly: weeklyResult.results
      }
    });
  } catch (error) {
    console.error('[Get Transaction Stats Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch statistics' }, 500);
  }
}

export async function handleCreateAlert(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { alertType, targetPrice } = await request.json();

    if (!['buy', 'sell'].includes(alertType)) {
      return jsonResponse({ success: false, error: 'Invalid alert type' }, 400);
    }

    const priceValidation = validateNumber(targetPrice, TRADING_CONFIG.MIN_PRICE, TRADING_CONFIG.MAX_PRICE, 'Target price');
    if (!priceValidation.valid) {
      return jsonResponse({ success: false, error: priceValidation.error }, 400);
    }

    const stmt = env.DB.prepare(`
      INSERT INTO price_alerts (alert_type, target_price, created_at)
      VALUES (?, ?, ?)
    `);
    
    const now = new Date().toISOString();
    const result = await stmt.bind(alertType, priceValidation.value, now).run();

    return jsonResponse({
      success: true,
      alert: {
        id: result.meta.last_row_id,
        alertType,
        targetPrice: priceValidation.value,
        createdAt: now
      }
    });
  } catch (error) {
    console.error('[Create Alert Error]', error);
    return jsonResponse({ success: false, error: 'Failed to create alert' }, 500);
  }
}

export async function handleGetAlerts(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  try {
    const stmt = env.DB.prepare(`
      SELECT * FROM price_alerts 
      WHERE is_active = 1 
      ORDER BY created_at DESC
    `);
    const result = await stmt.all();

    return jsonResponse({
      success: true,
      alerts: result.results
    });
  } catch (error) {
    console.error('[Get Alerts Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch alerts' }, 500);
  }
}

export async function handleDeleteAlert(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  const url = new URL(request.url);
  const alertId = url.searchParams.get('id');

  if (!alertId) {
    return jsonResponse({ success: false, error: 'Alert ID is required' }, 400);
  }

  try {
    const stmt = env.DB.prepare('UPDATE price_alerts SET is_active = 0 WHERE id = ?');
    await stmt.bind(parseInt(alertId)).run();

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('[Delete Alert Error]', error);
    return jsonResponse({ success: false, error: 'Failed to delete alert' }, 500);
  }
}

export async function handleCheckAlerts(currentPrice, env) {
  try {
    const stmt = env.DB.prepare(`
      SELECT * FROM price_alerts 
      WHERE is_active = 1 
      AND is_triggered = 0
    `);
    const result = await stmt.all();

    const triggeredAlerts = [];

    for (const alert of result.results) {
      let shouldTrigger = false;

      if (alert.alert_type === 'buy' && currentPrice <= alert.target_price) {
        shouldTrigger = true;
      } else if (alert.alert_type === 'sell' && currentPrice >= alert.target_price) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        await env.DB.prepare(`
          UPDATE price_alerts 
          SET is_triggered = 1, 
              triggered_at = ?, 
              current_price = ?,
              notification_sent = 1
          WHERE id = ?
        `).bind(new Date().toISOString(), currentPrice, alert.id).run();

        triggeredAlerts.push({
          ...alert,
          currentPrice,
          triggeredAt: new Date().toISOString()
        });

        await queueNotification(env, {
          type: 'push',
          title: alert.alert_type === 'buy' ? '买入提醒' : '卖出提醒',
          message: `金价已达到预设${alert.alert_type === 'buy' ? '买入' : '卖出'}价格 ¥${alert.target_price}/克`,
          data: JSON.stringify({ alertId: alert.id, currentPrice, targetPrice: alert.target_price })
        });
      }
    }

    return triggeredAlerts;
  } catch (error) {
    console.error('[Check Alerts Error]', error);
    return [];
  }
}

async function queueNotification(env, notification) {
  try {
    const stmt = env.DB.prepare(`
      INSERT INTO notification_queue (type, title, message, data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      notification.type,
      notification.title,
      notification.message,
      notification.data || null,
      new Date().toISOString()
    ).run();
  } catch (error) {
    console.error('[Queue Notification Error]', error);
  }
}

export async function handleGetNotifications(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  try {
    const stmt = env.DB.prepare(`
      SELECT * FROM notification_queue 
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const result = await stmt.all();

    return jsonResponse({
      success: true,
      notifications: result.results
    });
  } catch (error) {
    console.error('[Get Notifications Error]', error);
    return jsonResponse({ success: false, error: 'Failed to fetch notifications' }, 500);
  }
}

export async function handleDeleteTransaction(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  const url = new URL(request.url);
  const transactionId = url.searchParams.get('id');

  if (!transactionId) {
    return jsonResponse({ success: false, error: 'Transaction ID is required' }, 400);
  }

  try {
    const stmt = env.DB.prepare('DELETE FROM gold_transactions WHERE id = ?');
    await stmt.bind(parseInt(transactionId)).run();

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('[Delete Transaction Error]', error);
    return jsonResponse({ success: false, error: 'Failed to delete transaction' }, 500);
  }
}

export async function handleUpdateTransaction(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const verification = await verifyAdminToken(token, env);
  
  if (!verification.valid) {
    return jsonResponse({ success: false, error: verification.error }, 401);
  }

  if (request.method !== 'PUT') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const { id, price, quantity, actualSellPrice, notes } = await request.json();

    if (!id) {
      return jsonResponse({ success: false, error: 'Transaction ID is required' }, 400);
    }

    const existingStmt = env.DB.prepare('SELECT * FROM gold_transactions WHERE id = ?');
    const existing = await existingStmt.bind(id).first();

    if (!existing) {
      return jsonResponse({ success: false, error: 'Transaction not found' }, 404);
    }

    const newPrice = price !== undefined ? parseFloat(price) : existing.price;
    const newQuantity = quantity !== undefined ? parseFloat(quantity) : existing.quantity;
    const newActualSellPrice = actualSellPrice !== undefined ? parseFloat(actualSellPrice) : existing.actual_sell_price;
    const newNotes = notes !== undefined ? notes : existing.notes;

    const totalAmount = newPrice * newQuantity;
    let profit = 0;

    if (existing.type === 'sell' && newActualSellPrice) {
      profit = (newActualSellPrice - newPrice) * newQuantity;
    }

    const updateStmt = env.DB.prepare(`
      UPDATE gold_transactions 
      SET price = ?, quantity = ?, total_amount = ?, actual_sell_price = ?, profit = ?, notes = ?
      WHERE id = ?
    `);
    
    await updateStmt.bind(newPrice, newQuantity, totalAmount, newActualSellPrice, profit, newNotes, id).run();

    return jsonResponse({
      success: true,
      transaction: {
        id,
        price: newPrice,
        quantity: newQuantity,
        totalAmount,
        actualSellPrice: newActualSellPrice,
        profit,
        notes: newNotes
      }
    });
  } catch (error) {
    console.error('[Update Transaction Error]', error);
    return jsonResponse({ success: false, error: 'Failed to update transaction' }, 500);
  }
}
