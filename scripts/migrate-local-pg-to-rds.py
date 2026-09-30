#!/usr/bin/env python3
"""
Migrate data from local container yangcheng-db to Alibaba Cloud RDS PostgreSQL in foreign-key order.
"""

import os
import subprocess
import sys

TABLES = [
    "ApprovalSetting", "Channel", "User", "Store", "Farmer", "Enclosure",
    "HoldingPool", "Batch", "BatchItem", "SpecialApproval", "TagClaim",
    "BundleGroup", "BundleBatch", "BundleLine", "SortMachine", "SortTask",
    "ColdStore", "ColdLog", "Order", "OutboundLossOrder", "OutboundLossItem",
    "OutboundLossRecord", "OutboundOrder", "OutboundLine", "LossRecord",
    "QCRecord", "InspectionReport", "AuditLog"
]

def main():
    rds_host = os.environ.get("RDS_HOST", "pgm-uf6032h49cdqz5jc.pg.rds.aliyuncs.com")
    rds_user = os.environ.get("RDS_USER", "yangchenghu88")
    rds_db = os.environ.get("RDS_DB", "yangcheng_tracehub")
    pgpassword = os.environ.get("PGPASSWORD", "Yangcheng88-")

    quoted = ", ".join(f'"{t}"' for t in TABLES)
    dump_args = ["docker", "exec", "yangcheng-db", "pg_dump", "-U", "yangcheng", "-d", "yangcheng",
                 "--data-only", "--no-owner", "--no-privileges", "--column-inserts"]
    for t in TABLES:
        dump_args.extend(["-t", f'"{t}"'])

    print(f"📦 正在从 yangcheng-db 导出并同步至 RDS ({rds_host}/{rds_db})...")
    dump_proc = subprocess.Popen(dump_args, stdout=subprocess.PIPE, text=True, encoding="utf-8")
    
    psql_cmd = [
        "docker", "run", "--rm", "-i", "-e", f"PGPASSWORD={pgpassword}",
        "postgres:16-alpine", "psql", "-h", rds_host, "-U", rds_user, "-d", rds_db, "-v", "ON_ERROR_STOP=1"
    ]
    psql_proc = subprocess.Popen(psql_cmd, stdin=subprocess.PIPE, text=True, encoding="utf-8")

    psql_proc.stdin.write(f"BEGIN;\nTRUNCATE TABLE {quoted} CASCADE;\n")
    for line in dump_proc.stdout:
        if line.startswith("INSERT INTO") or line.startswith("SELECT pg_catalog.setval"):
            psql_proc.stdin.write(line)
    psql_proc.stdin.write("COMMIT;\n")
    psql_proc.stdin.close()

    dump_proc.wait()
    psql_proc.wait()

    if psql_proc.returncode != 0:
        print("❌ 迁移失败！")
        sys.exit(psql_proc.returncode)
    print("✅ 迁移完成！")

if __name__ == "__main__":
    main()
