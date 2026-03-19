#!/bin/bash

echo "=== CodeBuddy 完全卸载脚本 ==="
echo "此脚本将删除所有 CodeBuddy 相关文件"
echo ""

# 1. 删除应用程序
echo "[1/8] 删除应用程序..."
sudo rm -rf "/Applications/CodeBuddy CN.app"

# 2. 删除用户配置目录
echo "[2/8] 删除用户配置目录 ~/.codebuddycn ..."
rm -rf ~/.codebuddycn

# 3. 删除 Application Support 中的文件
echo "[3/8] 删除 Application Support 文件..."
rm -rf ~/Library/Application\ Support/CodeBuddyExtension
rm -rf ~/Library/Application\ Support/CodeBuddy\ CN

# 4. 删除 HTTPStorages
echo "[4/8] 删除 HTTPStorages..."
rm -rf ~/Library/HTTPStorages/com.tencent.codebuddycn

# 5. 删除缓存文件
echo "[5/8] 删除缓存文件..."
rm -rf ~/Library/Caches/com.tencent.codebuddycn
rm -rf ~/Library/Caches/com.tencent.codebuddycn.ShipIt

# 6. 删除主目录中的 CodeBuddy 文件
echo "[6/8] 删除 ~/CodeBuddy 和 ~/.codebuddy..."
rm -rf ~/CodeBuddy
rm -rf ~/.codebuddy

# 7. 删除 WorkBuddy 中的插件
echo "[7/8] 删除 WorkBuddy 相关文件..."
rm -rf ~/.workbuddy/plugins/marketplaces/codebuddy-plugins-official
rm -rf ~/.workbuddy/plugins/marketplaces/cb_teams_marketplace
rm -rf ~/.workbuddy/skills-marketplace/.codebuddy-skill

# 8. 删除其他位置的 .codebuddy 文件
echo "[8/8] 删除其他位置的配置文件..."
rm -rf ~/.cloudbase-mcp/web-template/.codebuddy
rm -rf ~/WorkBuddy/Claw/.codebuddy

echo ""
echo "=== 卸载完成 ==="
echo "建议重启电脑以确保所有进程被终止"
