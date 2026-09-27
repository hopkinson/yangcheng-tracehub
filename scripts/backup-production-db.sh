#!/usr/bin/env bash
set -euo pipefail

DATABASE_PATH="${DATABASE_PATH:-data/db/app.db}"
BACKUP_DIR="${BACKUP_DIR:-data/backups/production}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
LABEL="scheduled"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --label)
      LABEL="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [ ! -f "$DATABASE_PATH" ]; then
  echo "Database not found: $DATABASE_PATH" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for a transactionally consistent SQLite backup" >&2
  exit 1
fi

case "$LABEL" in
  *[!a-zA-Z0-9_-]*|'')
    echo "Backup label may only contain letters, numbers, underscores, and hyphens" >&2
    exit 2
    ;;
esac

mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_PATH="$BACKUP_DIR/${TIMESTAMP}-${LABEL}.sqlite.gz"
TEMP_DB="$BACKUP_DIR/.${TIMESTAMP}-${LABEL}.sqlite.tmp"
TEMP_GZIP="${FINAL_PATH}.tmp"

cleanup() {
  rm -f "$TEMP_DB" "$TEMP_GZIP"
}
trap cleanup EXIT

python3 - "$DATABASE_PATH" "$TEMP_DB" <<'PY'
import sqlite3
import sys

source_path, backup_path = sys.argv[1:]
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
target = sqlite3.connect(backup_path)
try:
    source.backup(target)
    result = target.execute("PRAGMA integrity_check").fetchone()
    if result != ("ok",):
        raise RuntimeError(f"SQLite integrity_check failed: {result!r}")
finally:
    target.close()
    source.close()
PY

gzip -c "$TEMP_DB" > "$TEMP_GZIP"
mv "$TEMP_GZIP" "$FINAL_PATH"
find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.sqlite.gz' -mtime "+$RETENTION_DAYS" -delete

echo "Verified SQLite backup: $FINAL_PATH"
