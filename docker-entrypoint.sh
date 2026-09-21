#!/bin/sh
set -e

# 1. 确保持久化与上传目录就绪
mkdir -p /app/data /app/public/uploads

# 2. 执行数据库表结构同步 (直接调用已安装好的 prisma CLI，绝对不走 npx 避免海外源拉取超时及无交互取消)
echo "🚀 [Init] 检查并同步 SQLite 数据库表结构..."
if [ -x "/usr/local/bin/prisma" ]; then
  PRISMA_BIN="/usr/local/bin/prisma"
elif command -v prisma >/dev/null 2>&1; then
  PRISMA_BIN="prisma"
elif [ -x "./node_modules/.bin/prisma" ]; then
  PRISMA_BIN="./node_modules/.bin/prisma"
else
  PRISMA_BIN=""
fi

# ponytail: db push 失败必须终止启动 —— 带病启动只会把错误推迟成运行期的 no such table
if [ -n "$PRISMA_BIN" ]; then
  "$PRISMA_BIN" db push --accept-data-loss --skip-generate
  # 自动自愈：若存在指向已删除用户的历史孤儿损耗单，将 applicantId 置为 NULL，杜绝关联查询崩溃
  node -e '
    const { PrismaClient } = require("@prisma/client");
    const p = new PrismaClient();
    p.$executeRawUnsafe(`
      UPDATE "OutboundLossOrder"
      SET "applicantId" = NULL
      WHERE "applicantId" IS NOT NULL
        AND "applicantId" NOT IN (SELECT "id" FROM "User");
    `).catch(() => {}).finally(() => p.$disconnect());
  ' >/dev/null 2>&1 || true
else
  echo "⚠️ [Init] 未检测到 prisma 命令行工具，跳过 db push（表结构需已存在）"
fi

# 3. 启动 Next.js 独立运行实例 (以 PID 1 运行接管系统信号)
echo "🚀 [Init] 正在启动 Next.js 生产服务 (PORT: ${PORT:-3000})..."
exec node server.js
