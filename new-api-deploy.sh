#!/bin/bash
set -e
echo "========================================="
echo "  New API 一键部署脚本"
echo "========================================="
echo ""
if [ "$EUID" -ne 0 ]; then 
    echo "请使用 root 用户运行"
    exit 1
fi
echo "[1/5] 安装 Docker..."
if command -v docker &> /dev/null; then
    echo "Docker 已安装，跳过"
else
    apt update
    apt install -y docker.io docker-compose-plugin
    systemctl start docker
    systemctl enable docker
    echo "Docker 安装完成"
fi
docker --version
docker compose version
echo ""
echo "[2/5] 创建项目目录..."
PROJECT_DIR="/opt/new-api"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR
echo ""
echo "[3/5] 创建配置文件..."
cat > docker-compose.yml << 'COMPOSEOF'
version: '3.8'

services:
  new-api:
    image: justsong/new-api:latest
    container_name: new-api
    restart: always
    ports:
      - "3000:3000"
    environment:
      - SQL_DSN=root:NewApi2024!@tcp(mysql:3306)/new-api
      - REDIS_CONN_STRING=redis://redis:6379
      - SESSION_SECRET=mysecretkey2024
      - TZ=Asia/Shanghai
      - PORT=3000
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./data:/data
    networks:
      - new-api-network

  mysql:
    image: mysql:8.0
    container_name: new-api-mysql
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=NewApi2024!
      - MYSQL_DATABASE=new-api
      - TZ=Asia/Shanghai
    volumes:
      - ./mysql_data:/var/lib/mysql
    ports:
      - "127.0.0.1:3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 20s
      retries: 10
    networks:
      - new-api-network

  redis:
    image: redis:7-alpine
    container_name: new-api-redis
    restart: always
    volumes:
      - ./redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"
    networks:
      - new-api-network

networks:
  new-api-network:
    driver: bridge
COMPOSEOF
echo "配置文件创建完成"
echo ""
echo "[4/5] 启动服务..."
cd $PROJECT_DIR
docker compose pull
docker compose up -d
echo "等待服务初始化..."
sleep 10
echo ""
echo "[5/5] 检查服务状态..."
docker compose ps
echo ""
echo "========================================="
echo "  部署完成！"
echo "========================================="
echo ""
echo "访问地址: http://43.108.11.112:3000"
echo ""
echo "默认管理员账号："
echo "  用户名: root"
echo "  密码: 123456"
echo ""
echo "重要：请立即登录修改默认密码！"
echo ""
echo "管理命令："
echo "  cd /opt/new-api && docker compose logs -f    # 查看日志"
echo "  cd /opt/new-api && docker compose restart    # 重启服务"
echo "  cd /opt/new-api && docker compose down       # 停止服务"
echo ""
