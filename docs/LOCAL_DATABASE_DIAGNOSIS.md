# 同步线上数据到本地排查

当前 Prisma 使用 PostgreSQL。`backup-production-db.sh` 和旧 `DATABASE_BACKUP.md` 仅适用于历史 SQLite 部署，不适用于当前 RDS。

## 配置一次

需要 Node.js 22.16+、PostgreSQL 客户端工具（pg_dump、pg_restore、createdb、psql），并启动本地 PostgreSQL。客户端版本应不低于线上 PostgreSQL 版本。RDS 需允许当前机器联网访问；优先使用只读导出账号。

在项目 `.env.local`（已被 Git 忽略）配置：

```dotenv
PROD_DATABASE_URL="postgresql://readonly_user:URL_ENCODED_PASSWORD@YOUR_RDS_HOST:5432/YOUR_PRODUCTION_DATABASE?sslmode=require"
# 可省略，默认读取 .env 的 DATABASE_URL。本地账号需要 CREATEDB 权限。
LOCAL_DATABASE_URL="postgresql://crabcard:crabcard@localhost:5433/yangcheng?schema=public"
# 客户端不在 PATH 时填写，Windows 示例：
# PG_BIN="C:/Program Files/PostgreSQL/16/bin"
```

确认选择正确租户和生产库，勿将服务器 1、服务器 2、测试库混用。密码中的特殊字符需 URL 编码。

如果 RDS 只有内网地址，可在 `.env.local` 增加 SSH 配置，命令会自动建立隧道并在同步结束后关闭：

```dotenv
SSH_HOST="root@8.153.165.46"
SSH_IDENTITY_FILE="C:/Users/16516/.ssh/codex_wufenshu_prod_ed25519"
```

SSH 用户需能从该服务器连接 RDS，公钥需事先授权。也可以把 `SSH_HOST` 设为现有 SSH 配置别名（可指定用户、端口与密钥）。首次连接需先在终端确认服务器主机指纹；同步命令使用严格主机校验及非交互认证。

线上为 PostgreSQL 18 时，本机 16 版 `pg_dump` 无法导出。可启动独立的 PostgreSQL 18 Docker 容器（绑定 `127.0.0.1:5434`，使用独立持久卷），把 `LOCAL_DATABASE_URL` 指向该端口，并设置 `PG_DOCKER_IMAGE="postgres:18"`。同步命令将使用该镜像内的客户端工具，dump 仍保存在本机 `data/db-sync/`。此方式需 Docker Desktop 正常运行，无需升级或覆盖原有 PostgreSQL 16。

## 一条命令同步

```powershell
pnpm db:sync:prod
```

该命令使用只读事务导出完整、一致的生产快照，恢复到全新的本地 `yangcheng_snapshot_<时间戳>_<随机值>` 数据库。不覆盖原开发库，不修改 `.env`，不修改生产数据。每次同步保留旧快照。

恢复使用单事务；只有恢复完成并能查询出库表后，才更新 `data/db-sync/snapshot.env`。失败时旧快照仍可使用，失败创建的数据库可根据输出名称手工清理。dump 和本地连接配置均位于 Git 忽略的 `data/db-sync/`，包含真实业务数据。

## 排查指定出库单

```powershell
pnpm db:diagnose-outbound -- CK-20260930-005
```

诊断固定使用最近一次成功同步的本地快照，以只读事务输出预约出库时间 `outboundTime`、申请时间 `createdAt`、审核时间 `approvedAt`、更新时间 `updatedAt`，并同时展示 UTC 与北京时间。随后输出通过单据 ID/编号关联的审计日志原始 details。

审核时间不能当作预约时间。当前快照只反映现在的存储值；若历史代码已覆盖预约时间，只有保留旧值的审计日志、旧备份或 RDS 时间点恢复才能确认原值，不能靠审核时间推算恢复。

需要页面复现时，可在单独的 PowerShell 终端启动：

```powershell
$snapshotConfig = Get-Content data/db-sync/snapshot.env -Raw
$env:DATABASE_URL = ($snapshotConfig -replace '^DATABASE_URL=', '').Trim() | ConvertFrom-Json
pnpm dev --port 3002
```

该页面连接真实快照，可进行本地写操作。不要对快照运行 seed、tenant:reset、prisma:push 或业务测试，否则会改变排查证据。图片附件不在数据库 dump 内，可能仍指向原存储地址。
