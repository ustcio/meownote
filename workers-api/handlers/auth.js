import { jsonResponse } from '../utils/response.js';
import { validateEmail, validatePassword, sanitizeInput, getClientIP } from '../utils/validation.js';
import { hashPassword, verifyPassword, generateToken, hashAdminPassword, createAdminToken } from '../utils/crypto.js';
import { createRateLimiter } from '../middleware/rateLimit.js';

const loginLimiter = createRateLimiter('login');

export async function handleSignup(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
  }

  const { username, email, password } = body;

  if (!username || !email || !password) {
    return jsonResponse({ success: false, message: '请填写所有字段' }, 400);
  }

  if (!validateEmail(email)) {
    return jsonResponse({ success: false, message: '请输入有效的邮箱地址' }, 400);
  }

  if (!validatePassword(password)) {
    return jsonResponse({ success: false, message: '密码至少需要8个字符' }, 400);
  }

  const sanitizedUsername = sanitizeInput(username).substring(0, 50);
  const sanitizedEmail = sanitizeInput(email).toLowerCase();
  const ip = getClientIP(request);

  try {
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(sanitizedEmail).first();

    if (existing) {
      return jsonResponse({ success: false, message: '该邮箱已注册' }, 400);
    }

    const hashedPassword = await hashPassword(password);
    const token = generateToken();

    await env.DB.prepare(
      `INSERT INTO users (username, email, password, ip, token, login_count, created_at, last_login) 
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
    ).bind(sanitizedUsername, sanitizedEmail, hashedPassword, ip, token).run();

    ctx.waitUntil(sendRegistrationEmail(sanitizedUsername, sanitizedEmail, ip, env));

    return jsonResponse({
      success: true,
      token,
      user: { username: sanitizedUsername, email: sanitizedEmail, loginCount: 1 }
    });

  } catch (error) {
    console.error('Signup error:', error);
    return jsonResponse({ success: false, message: '注册失败，请重试' }, 500);
  }
}

export async function handleLogin(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
  }

  const { username, email, password } = body;
  const loginIdentifier = username || email;

  if (!loginIdentifier || !password) {
    return jsonResponse({ success: false, message: '请填写用户名/邮箱和密码' }, 400);
  }

  const ip = getClientIP(request);
  
  const rateResult = loginLimiter(ip);
  if (!rateResult.allowed) {
    return jsonResponse({ 
      success: false, 
      message: `登录尝试次数过多，请${rateResult.retryAfter}秒后再试` 
    }, 429);
  }

  const sanitizedIdentifier = sanitizeInput(loginIdentifier).toLowerCase();

  try {
    const isEmail = sanitizedIdentifier.includes('@');
    const query = isEmail 
      ? 'SELECT * FROM users WHERE email = ?'
      : 'SELECT * FROM users WHERE username = ? OR email = ?';
    
    const user = isEmail 
      ? await env.DB.prepare(query).bind(sanitizedIdentifier).first()
      : await env.DB.prepare(query).bind(sanitizedIdentifier, sanitizedIdentifier).first();

    if (!user) {
      return jsonResponse({ success: false, message: '用户名/邮箱或密码错误' }, 401);
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return jsonResponse({ success: false, message: '用户名/邮箱或密码错误' }, 401);
    }

    const newLoginCount = user.login_count + 1;
    const newToken = generateToken();

    await env.DB.prepare(
      `UPDATE users SET login_count = ?, last_login = datetime('now'), token = ? WHERE id = ?`
    ).bind(newLoginCount, newToken, user.id).run();

    return jsonResponse({
      success: true,
      token: newToken,
      user: {
        username: user.username,
        email: user.email,
        loginCount: newLoginCount
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({ success: false, message: '登录失败，请重试' }, 500);
  }
}

export async function handleUserProfile(request, env, ctx) {
  if (request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, message: '未授权' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE token = ?'
    ).bind(token).first();

    if (!user) {
      return jsonResponse({ success: false, message: '用户不存在' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { username, email } = body;

    if (!username || !email) {
      return jsonResponse({ success: false, message: '请填写完整信息' }, 400);
    }

    const sanitizedUsername = sanitizeInput(username);
    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    const existingUser = await env.DB.prepare(
      'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?'
    ).bind(sanitizedUsername, sanitizedEmail, user.id).first();

    if (existingUser) {
      return jsonResponse({ success: false, message: '用户名或邮箱已被使用' }, 400);
    }

    await env.DB.prepare(
      'UPDATE users SET username = ?, email = ? WHERE id = ?'
    ).bind(sanitizedUsername, sanitizedEmail, user.id).run();

    return jsonResponse({
      success: true,
      message: '资料更新成功',
      user: {
        id: user.id,
        username: sanitizedUsername,
        email: sanitizedEmail,
        login_count: user.login_count,
        last_login: user.last_login,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return jsonResponse({ success: false, message: '更新失败' }, 500);
  }
}

export async function handleUserPassword(request, env, ctx) {
  if (request.method !== 'PUT') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, message: '未授权' }, 401);
  }

  const token = authHeader.substring(7);

  try {
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE token = ?'
    ).bind(token).first();

    if (!user) {
      return jsonResponse({ success: false, message: '用户不存在' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return jsonResponse({ success: false, message: '请填写完整信息' }, 400);
    }

    if (newPassword.length < 6) {
      return jsonResponse({ success: false, message: '新密码至少6个字符' }, 400);
    }

    const isValid = await verifyPassword(currentPassword, user.password);
    if (!isValid) {
      return jsonResponse({ success: false, message: '当前密码错误' }, 401);
    }

    const newHashedPassword = await hashPassword(newPassword);
    const newToken = generateToken();

    await env.DB.prepare(
      'UPDATE users SET password = ?, token = ? WHERE id = ?'
    ).bind(newHashedPassword, newToken, user.id).run();

    return jsonResponse({
      success: true,
      message: '密码更新成功',
      token: newToken
    });

  } catch (error) {
    console.error('Password update error:', error);
    return jsonResponse({ success: false, message: '更新失败' }, 500);
  }
}

export async function handleAdminLogin(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { username, password } = body;

    if (!username || !password) {
      return jsonResponse({ success: false, message: '请输入用户名和密码' }, 400);
    }

    const passwordHash = await hashAdminPassword(password);

    const user = await env.DB.prepare(
      'SELECT id, username, role FROM admin_users WHERE username = ? AND password_hash = ?'
    ).bind(sanitizeInput(username), passwordHash).first();

    if (!user) {
      return jsonResponse({ success: false, message: '用户名或密码错误' }, 401);
    }

    await env.DB.prepare(
      "UPDATE admin_users SET last_login = datetime('now') WHERE id = ?"
    ).bind(user.id).run();

    const token = await createAdminToken(
      { userId: user.id, username: user.username, role: user.role },
      env.JWT_SECRET || 'agiera-default-jwt-secret-2024'
    );

    return jsonResponse({
      success: true,
      token,
      user: { username: user.username, role: user.role }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    return jsonResponse({ success: false, message: '服务器错误' }, 500);
  }
}

async function sendRegistrationEmail(username, email, ip, env) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return;
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AGI Era <noreply@ustc.dev>',
        to: ['metanext@foxmail.com'],
        subject: '🎉 AGI Era 新用户注册通知',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>新用户注册</h2>
            <p><strong>用户名:</strong> ${username}</p>
            <p><strong>邮箱:</strong> ${email}</p>
            <p><strong>IP:</strong> ${ip}</p>
            <p><strong>时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
          </div>
        `,
      }),
    });
  } catch (error) {
    console.error('Email error:', error);
  }
}
