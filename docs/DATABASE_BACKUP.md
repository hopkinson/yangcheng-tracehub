# 生产数据库备份与恢复

生产环境使用 SQLite，数据库文件为部署目录下的 `data/db/app.db`。

## 备份策略

- GitHub Actions 每 6 小时连接服务器 1、服务器 2，各自在服务器本地执行一次备份。
- 备份使用 SQLite Backup API，不直接复制正在写入的数据库文件。
- 每次备份都会执行 `PRAGMA integrity_check`。
- 备份保存在服务器的 `data/backups/production/`，自动保留 30 天。
- 每次生产部署前额外创建一份 `pre-deploy` 备份；备份失败会阻止部署继续。
- 不上传数据库到 GitHub，不需要额外的备份 Environment、加密口令或 Artifact 配置。

## 手工备份

在服务器部署目录执行：

```bash
bash scripts/backup-production-db.sh --label manual
```

脚本成功时会输出备份文件路径，例如：

```text
data/backups/production/20260927T120000Z-manual.sqlite.gz
```

## 恢复

先选择需要恢复的备份，并解压到临时文件：

```bash
gzip -dc data/backups/production/20260927T120000Z-manual.sqlite.gz > restore-candidate.sqlite
python3 - <<'PY'
import sqlite3

db = sqlite3.connect("restore-candidate.sqlite")
try:
    assert db.execute("PRAGMA integrity_check").fetchone() == ("ok",)
finally:
    db.close()

print("restore candidate is valid")
PY
```

确认备份正确后再替换生产库：

```bash
docker compose stop app
mv data/db/app.db "data/db/app.db.before-restore-$(date -u +%Y%m%dT%H%M%SZ)"
install -m 0644 restore-candidate.sqlite data/db/app.db
docker compose start app
docker compose logs --tail=100 app
```

恢复完成后登录系统抽查最近业务单据。确认无误前，不要删除 `app.db.before-restore-*`。
