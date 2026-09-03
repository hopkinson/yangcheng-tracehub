#!/bin/sh
set -e

# 1. 确保持久化与上传目录就绪
mkdir -p /app/data /app/public/uploads

# 2. 尝试执行数据库表结构同步 (直接调用已安装好的 prisma CLI，绝对不走 npx 避免海外源拉取超时及无交互取消)
echo "🚀 [Init] 检查并同步 SQLite 数据库表结构..."
if [ -x "/usr/local/bin/prisma" ]; then
  /usr/local/bin/prisma db push --accept-data-loss --skip-generate || echo "⚠️ [Init] prisma db push 执行遇告警，继续启动应用..."
elif command -v prisma >/dev/null 2>&1; then
  prisma db push --accept-data-loss --skip-generate || echo "⚠️ [Init] prisma db push 执行遇告警，继续启动应用..."
elif [ -x "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma db push --accept-data-loss --skip-generate || echo "⚠️ [Init] prisma db push 执行遇告警，继续启动应用..."
else
  echo "ℹ️ [Init] 未检测到 prisma 命令行工具，跳过 db push。"
fi

# 3. 启动 Next.js 独立运行实例 (以 PID 1 运行接管系统信号)
echo "🚀 [Init] 正在启动 Next.js 生产服务 (PORT: ${PORT:-3000})..."
exec node server.js
