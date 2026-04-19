#!/bin/bash

# 测试上传下载功能的诊断脚本

echo "========================================="
echo "Meownote 上传下载功能诊断"
echo "========================================="
echo ""

# 1. 检查 R2 bucket
echo "1. 检查 R2 bucket..."
npx wrangler r2 bucket list 2>&1 | grep -i "meownote-storage" || echo "   ❌ R2 bucket 'meownote-storage' 未找到"
echo ""

# 2. 检查 worker 部署状态
echo "2. 检查 worker 部署..."
npx wrangler deploy --dry-run 2>&1 | head -20
echo ""

# 3. 测试 API 连通性
echo "3. 测试 API 连通性..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://api.moonsun.ai/api/workspace
echo ""

# 4. 测试上传（小文件）
echo "4. 测试文件上传..."
echo "test content" > /tmp/test-upload.txt
curl -s -X POST https://api.moonsun.ai/api/workspace \
  -F "file=@/tmp/test-upload.txt" \
  -w "\nHTTP Status: %{http_code}\n" | head -20
rm -f /tmp/test-upload.txt
echo ""

# 5. 列出文件（获取文件 ID）
echo "5. 列出 workspace 文件..."
curl -s https://api.moonsun.ai/api/workspace | head -50
echo ""

echo "========================================="
echo "诊断完成"
echo "========================================="
