#!/usr/bin/env bash
set -e

echo "=== 1. 安装 Docker & Docker Compose ==="
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
  systemctl enable docker
  systemctl start docker
fi

echo "=== 2. 配置国内 Docker 镜像加速源 ==="
mkdir -p /etc/docker
cat << 'EOF' > /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://mirror.baidubce.com",
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "3"
  }
}
EOF
systemctl daemon-reload
systemctl restart docker

echo "=== 3. 初始化项目目录 ==="
mkdir -p /data/yangcheng-tracehub/data/db
mkdir -p /data/yangcheng-tracehub/data/uploads
chmod -R 777 /data/yangcheng-tracehub/data

echo "=== 服务器初始化完成 ==="
