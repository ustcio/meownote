import { jsonResponse } from '../utils/response.js';
import { sanitizeInput } from '../utils/validation.js';
import { verifyAdminAuth } from '../middleware/auth.js';

export async function handleAdminVerify(request, env, ctx) {
  const authResult = await verifyAdminAuth(request, env);
  
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  return jsonResponse({ success: true, user: authResult.user });
}

export async function handleAdminFiles(request, env, ctx) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  if (request.method === 'GET') {
    return await getAdminFiles(request, env);
  }

  if (request.method === 'POST') {
    return await uploadAdminFile(request, env, authResult);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

async function getAdminFiles(request, env) {
  try {
    const url = new URL(request.url);
    const folderId = url.searchParams.get('folder_id') || null;
    
    let files, folders;
    
    if (folderId) {
      [files, folders] = await Promise.all([
        env.DB.prepare(
          'SELECT id, name, type, size, downloads, folder_id, created_at as date FROM files WHERE folder_id = ? ORDER BY created_at DESC'
        ).bind(folderId).all(),
        env.DB.prepare(
          'SELECT id, name, parent_id, created_at as date FROM folders WHERE parent_id = ? ORDER BY name ASC'
        ).bind(folderId).all()
      ]);
    } else {
      [files, folders] = await Promise.all([
        env.DB.prepare(
          'SELECT id, name, type, size, downloads, folder_id, created_at as date FROM files WHERE folder_id IS NULL ORDER BY created_at DESC'
        ).all(),
        env.DB.prepare(
          'SELECT id, name, parent_id, created_at as date FROM folders WHERE parent_id IS NULL ORDER BY name ASC'
        ).all()
      ]);
    }

    return jsonResponse({
      success: true,
      files: files.results || [],
      folders: folders.results || [],
      currentFolder: folderId
    });
  } catch (error) {
    console.error('Get files error:', error);
    return jsonResponse({ success: false, message: '获取文件列表失败' }, 500);
  }
}

async function uploadAdminFile(request, env, authResult) {
  try {
    const contentType = request.headers.get('Content-Type') || '';
    const url = new URL(request.url);
    const folderId = url.searchParams.get('folder_id') || null;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      
      if (!file || !(file instanceof File)) {
        return jsonResponse({ success: false, message: '请选择文件' }, 400);
      }
      
      const fileId = crypto.randomUUID();
      const ext = file.name.split('.').pop() || 'bin';
      const storagePath = `uploads/${fileId}.${ext}`;
      
      if (env.R2) {
        await env.R2.put(storagePath, file.stream(), {
          httpMetadata: { contentType: file.type || 'application/octet-stream' },
          customMetadata: {
            originalName: file.name,
            uploadedBy: String(authResult.user.userId),
          },
        });
      }
      
      await env.DB.prepare(
        `INSERT INTO files (id, name, type, size, storage_path, downloads, uploaded_by, folder_id, created_at) 
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`
      ).bind(fileId, sanitizeInput(file.name), ext, file.size, storagePath, authResult.user.userId, folderId).run();
      
      return jsonResponse({
        success: true,
        message: '文件上传成功',
        file: { id: fileId, name: file.name, type: ext, size: file.size }
      });
    } else {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
      }

      const { name, type, size } = body;

      if (!name) {
        return jsonResponse({ success: false, message: '文件名不能为空' }, 400);
      }

      const fileId = crypto.randomUUID();
      const storagePath = `uploads/${fileId}.${type || 'bin'}`;

      await env.DB.prepare(
        `INSERT INTO files (id, name, type, size, storage_path, downloads, uploaded_by, created_at) 
         VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))`
      ).bind(fileId, sanitizeInput(name), type || '', size || 0, storagePath, authResult.user.userId).run();

      return jsonResponse({
        success: true,
        message: '文件记录已创建',
        file: { id: fileId, name, type, size }
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return jsonResponse({ success: false, message: '上传失败: ' + error.message }, 500);
  }
}

export async function handleAdminFileAction(request, env, path) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  const fileId = path.split('/').pop();

  if (request.method === 'GET') {
    try {
      const file = await env.DB.prepare(
        'SELECT * FROM files WHERE id = ?'
      ).bind(fileId).first();

      if (!file) {
        return jsonResponse({ success: false, message: '文件不存在' }, 404);
      }

      await env.DB.prepare(
        'UPDATE files SET downloads = downloads + 1 WHERE id = ?'
      ).bind(fileId).run();

      if (env.R2 && file.storage_path) {
        const object = await env.R2.get(file.storage_path);
        
        if (object) {
          const headers = new Headers();
          headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
          headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
          headers.set('Access-Control-Allow-Origin', '*');
          
          return new Response(object.body, { headers });
        }
      }

      return jsonResponse({
        success: true,
        file: file,
        message: '文件元数据（R2中无实际文件）'
      });

    } catch (error) {
      console.error('Download error:', error);
      return jsonResponse({ success: false, message: '下载失败' }, 500);
    }
  }

  if (request.method === 'DELETE') {
    try {
      const file = await env.DB.prepare(
        'SELECT * FROM files WHERE id = ?'
      ).bind(fileId).first();

      if (!file) {
        return jsonResponse({ success: false, message: '文件不存在' }, 404);
      }

      if (env.R2 && file.storage_path) {
        try {
          await env.R2.delete(file.storage_path);
        } catch (e) {
          console.warn('R2 delete warning:', e);
        }
      }

      await env.DB.prepare(
        'DELETE FROM files WHERE id = ?'
      ).bind(fileId).run();

      return jsonResponse({ success: true, message: '文件已删除' });

    } catch (error) {
      console.error('Delete file error:', error);
      return jsonResponse({ success: false, message: '删除失败' }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

export async function handleAdminFolders(request, env, ctx) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  if (request.method === 'GET') {
    try {
      const folders = await env.DB.prepare(
        'SELECT id, name, parent_id, created_at as date FROM folders ORDER BY name ASC'
      ).all();

      return jsonResponse({
        success: true,
        folders: folders.results || []
      });
    } catch (error) {
      console.error('Get folders error:', error);
      return jsonResponse({ success: false, message: '获取文件夹列表失败' }, 500);
    }
  }

  if (request.method === 'POST') {
    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
      }

      const { name, parent_id } = body;

      if (!name || name.trim() === '') {
        return jsonResponse({ success: false, message: '文件夹名称不能为空' }, 400);
      }

      const sanitizedName = sanitizeInput(name.trim());

      const existing = await env.DB.prepare(
        parent_id 
          ? 'SELECT id FROM folders WHERE name = ? AND parent_id = ?'
          : 'SELECT id FROM folders WHERE name = ? AND parent_id IS NULL'
      ).bind(...(parent_id ? [sanitizedName, parent_id] : [sanitizedName])).first();

      if (existing) {
        return jsonResponse({ success: false, message: '该文件夹已存在' }, 400);
      }

      const folderId = crypto.randomUUID();

      await env.DB.prepare(
        `INSERT INTO folders (id, name, parent_id, created_by, created_at) 
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(folderId, sanitizedName, parent_id || null, authResult.user.userId).run();

      return jsonResponse({
        success: true,
        message: '文件夹创建成功',
        folder: { id: folderId, name: sanitizedName, parent_id: parent_id || null }
      });

    } catch (error) {
      console.error('Create folder error:', error);
      return jsonResponse({ success: false, message: '创建文件夹失败: ' + error.message }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

export async function handleAdminFolderAction(request, env, path) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  const folderId = path.split('/').pop();

  if (request.method === 'PUT') {
    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
      }

      const { name } = body;

      if (!name || name.trim() === '') {
        return jsonResponse({ success: false, message: '文件夹名称不能为空' }, 400);
      }

      const sanitizedName = sanitizeInput(name.trim());

      const folder = await env.DB.prepare(
        'SELECT * FROM folders WHERE id = ?'
      ).bind(folderId).first();

      if (!folder) {
        return jsonResponse({ success: false, message: '文件夹不存在' }, 404);
      }

      await env.DB.prepare(
        'UPDATE folders SET name = ? WHERE id = ?'
      ).bind(sanitizedName, folderId).run();

      return jsonResponse({ success: true, message: '文件夹已重命名' });

    } catch (error) {
      console.error('Rename folder error:', error);
      return jsonResponse({ success: false, message: '重命名失败' }, 500);
    }
  }

  if (request.method === 'DELETE') {
    try {
      const folder = await env.DB.prepare(
        'SELECT * FROM folders WHERE id = ?'
      ).bind(folderId).first();

      if (!folder) {
        return jsonResponse({ success: false, message: '文件夹不存在' }, 404);
      }

      const [filesInFolder, subFolders] = await Promise.all([
        env.DB.prepare('SELECT COUNT(*) as count FROM files WHERE folder_id = ?').bind(folderId).first(),
        env.DB.prepare('SELECT COUNT(*) as count FROM folders WHERE parent_id = ?').bind(folderId).first()
      ]);

      if ((filesInFolder?.count || 0) > 0 || (subFolders?.count || 0) > 0) {
        return jsonResponse({ 
          success: false, 
          message: '文件夹不为空，请先删除或移动其中的文件和子文件夹' 
        }, 400);
      }

      await env.DB.prepare(
        'DELETE FROM folders WHERE id = ?'
      ).bind(folderId).run();

      return jsonResponse({ success: true, message: '文件夹已删除' });

    } catch (error) {
      console.error('Delete folder error:', error);
      return jsonResponse({ success: false, message: '删除失败' }, 500);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

export async function handleAdminStats(request, env, ctx) {
  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    const [fileCount, totalSize, totalDownloads, lastUpload, userCount, todayUV] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) as count FROM files').first(),
      env.DB.prepare('SELECT SUM(size) as total FROM files').first(),
      env.DB.prepare('SELECT SUM(downloads) as total FROM files').first(),
      env.DB.prepare('SELECT created_at FROM files ORDER BY created_at DESC LIMIT 1').first(),
      env.DB.prepare('SELECT COUNT(*) as count FROM users').first(),
      env.DB.prepare(`SELECT COUNT(DISTINCT visitor_id) as count FROM unique_visitors WHERE date = date('now')`).first()
    ]);

    return jsonResponse({
      success: true,
      stats: {
        fileCount: fileCount?.count || 0,
        totalSize: totalSize?.total || 0,
        totalDownloads: totalDownloads?.total || 0,
        lastUpload: lastUpload?.created_at || null,
        userCount: userCount?.count || 0,
        todayUV: todayUV?.count || 0
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    return jsonResponse({ success: false, message: '获取统计失败' }, 500);
  }
}

export async function handleAdminChangePassword(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { oldPassword, newPassword } = body;

    if (!oldPassword || !newPassword) {
      return jsonResponse({ success: false, message: '请输入旧密码和新密码' }, 400);
    }

    if (newPassword.length < 8) {
      return jsonResponse({ success: false, message: '新密码至少需要8个字符' }, 400);
    }

    const { hashAdminPassword } = await import('../utils/crypto.js');
    const oldHash = await hashAdminPassword(oldPassword);
    const newHash = await hashAdminPassword(newPassword);

    const result = await env.DB.prepare(
      'UPDATE admin_users SET password_hash = ? WHERE id = ? AND password_hash = ?'
    ).bind(newHash, authResult.user.userId, oldHash).run();

    if (result.changes === 0) {
      return jsonResponse({ success: false, message: '原密码错误' }, 400);
    }

    return jsonResponse({ success: true, message: '密码修改成功' });

  } catch (error) {
    console.error('Change password error:', error);
    return jsonResponse({ success: false, message: '修改失败' }, 500);
  }
}

export async function handleUploadInit(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { filename, fileSize, contentType } = body;

    if (!filename) {
      return jsonResponse({ success: false, message: '文件名不能为空' }, 400);
    }

    const sanitizedFilename = sanitizeInput(filename);
    const fileId = crypto.randomUUID();
    const ext = sanitizedFilename.split('.').pop() || 'bin';
    const storagePath = `uploads/${fileId}.${ext}`;

    const multipartUpload = await env.R2.createMultipartUpload(storagePath, {
      httpMetadata: { contentType: contentType || 'application/octet-stream' },
      customMetadata: {
        originalName: sanitizedFilename,
        uploadedBy: String(authResult.user.userId),
      },
    });

    return jsonResponse({
      success: true,
      uploadId: multipartUpload.uploadId,
      fileId,
      storagePath,
      filename: sanitizedFilename,
      fileSize,
      ext
    });

  } catch (error) {
    console.error('Upload init error:', error);
    return jsonResponse({ success: false, message: '初始化上传失败: ' + error.message }, 500);
  }
}

export async function handleUploadPart(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    const url = new URL(request.url);
    const uploadId = url.searchParams.get('uploadId');
    const partNumber = parseInt(url.searchParams.get('partNumber'));
    const storagePath = url.searchParams.get('storagePath');

    if (!uploadId || !partNumber || !storagePath) {
      return jsonResponse({ success: false, message: '缺少必要参数' }, 400);
    }

    const multipartUpload = env.R2.resumeMultipartUpload(storagePath, uploadId);
    const partData = await request.arrayBuffer();
    const uploadedPart = await multipartUpload.uploadPart(partNumber, partData);

    return jsonResponse({
      success: true,
      partNumber,
      etag: uploadedPart.etag
    });

  } catch (error) {
    console.error('Upload part error:', error);
    return jsonResponse({ success: false, message: '分片上传失败: ' + error.message }, 500);
  }
}

export async function handleUploadComplete(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { uploadId, storagePath, fileId, filename, fileSize, ext, parts } = body;

    if (!uploadId || !storagePath || !parts || !Array.isArray(parts)) {
      return jsonResponse({ success: false, message: '缺少必要参数' }, 400);
    }

    const multipartUpload = env.R2.resumeMultipartUpload(storagePath, uploadId);
    await multipartUpload.complete(parts);

    await env.DB.prepare(
      `INSERT INTO files (id, name, type, size, storage_path, downloads, uploaded_by, created_at) 
       VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))`
    ).bind(fileId, sanitizeInput(filename), ext, fileSize, storagePath, authResult.user.userId).run();

    return jsonResponse({
      success: true,
      message: '文件上传成功',
      file: { id: fileId, name: filename, type: ext, size: fileSize }
    });

  } catch (error) {
    console.error('Upload complete error:', error);
    return jsonResponse({ success: false, message: '完成上传失败: ' + error.message }, 500);
  }
}

export async function handleUploadAbort(request, env, ctx) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authResult = await verifyAdminAuth(request, env);
  if (!authResult.success) {
    return jsonResponse({ success: false, message: authResult.message }, 401);
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
    }

    const { uploadId, storagePath } = body;

    if (!uploadId || !storagePath) {
      return jsonResponse({ success: false, message: '缺少必要参数' }, 400);
    }

    const multipartUpload = env.R2.resumeMultipartUpload(storagePath, uploadId);
    await multipartUpload.abort();

    return jsonResponse({
      success: true,
      message: '上传已取消'
    });

  } catch (error) {
    console.error('Upload abort error:', error);
    return jsonResponse({ success: false, message: '取消上传失败: ' + error.message }, 500);
  }
}
