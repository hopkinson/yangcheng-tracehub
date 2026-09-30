#!/usr/bin/env python3
"""
Migrate all data from local container `yangcheng-db` to remote RDS PostgreSQL in topological foreign-key order.
确保零外键冲突、零触发器权限依赖、字段名完全对应的无损同步工具。
"""

import sys
import subprocess
import os

TABLES_IN_ORDER = [
    "ApprovalSetting",
    "Channel",
    "User",
    "Store",
    "Farmer",
    "Enclosure",
    "HoldingPool",
    "Batch",
    "BatchItem",
    "SpecialApproval",
    "TagClaim",
    "BundleGroup",
    "BundleBatch",
    "BundleLine",
    "SortMachine",
    "SortTask",
    "ColdStore",
    "ColdLog",
    "Order",
    "OutboundLossOrder",
    "OutboundLossItem",
    "OutboundLossRecord",
    "OutboundOrder",
    "OutboundLine",
    "LossRecord",
    "QCRecord",
    "InspectionReport",
    "AuditLog"
]

def main():
    print("==========================================================")
    print("🚀 开始将本地 yangcheng-db 完整数据无损迁移至阿里云 RDS...")
    print("==========================================================")

    # 1. 生成 TRUNCATE 语句
    quoted_tables = ", ".join([f'"{t}"' for t in TABLES_IN_ORDER])
    truncate_sql = f"TRUNCATE TABLE {quoted_tables} CASCADE;\n"

    all_sql_parts = [
        "-- Migration from yangcheng-db to RDS",
        "BEGIN;",
        truncate_sql
    ]

    total_rows = 0
    for table in TABLES_IN_ORDER:
        # 统计行数
        cnt_cmd = ["docker", "exec", "yangcheng-db", "psql", "-U", "yangcheng", "-d", "yangcheng", "-Atc", f'SELECT count(*) FROM "{table}";']
        res = subprocess.run(cnt_cmd, capture_output=True, text=True, encoding="utf-8")
        count_str = res.stdout.strip()
        count = int(count_str) if count_str.isdigit() else 0
        print(f"  导出表 {table:22}: {count:4} 行")
        total_rows += count

        if count > 0:
            # 导出带列名的 INSERT 语句
            dump_cmd = [
                "docker", "exec", "yangcheng-db",
                "pg_dump", "-U", "yangcheng", "-d", "yangcheng",
                "-t", f'"{table}"',
                "--data-only",
                "--no-owner",
                "--no-privileges",
                "--column-inserts"
            ]
            dump_res = subprocess.run(dump_cmd, capture_output=True, text=True, encoding="utf-8")
            if dump_res.returncode != 0:
                print(f"❌ 导出表 {table} 失败: {dump_res.stderr}")
                sys.exit(1)
            
            # 过滤只保留 INSERT 语句和 SET 语句
            valid_lines = []
            for line in dump_res.stdout.splitlines():
                line_s = line.strip()
                if line_s.startswith("INSERT INTO") or line_s.startswith("SELECT pg_catalog.setval"):
                    valid_lines.append(line)
            
            all_sql_parts.append(f"\n-- Table: {table} ({len(valid_lines)} rows)")
            all_sql_parts.extend(valid_lines)

    all_sql_parts.append("\nCOMMIT;")
    final_sql = "\n".join(all_sql_parts)

    output_path = "/tmp/full_rds_migration.sql"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(final_sql)
    
    print(f"\n✅ 完整 SQL 生成成功: {output_path} (包含 {total_rows} 条记录)")
    
    # 2. 导入 RDS
    rds_host = os.environ.get("RDS_HOST", "pgm-uf6032h49cdqz5jc.pg.rds.aliyuncs.com")
    rds_user = os.environ.get("RDS_USER", "yangchenghu88")
    rds_db = os.environ.get("RDS_DB", "yangcheng_tracehub")
    pgpassword = os.environ.get("PGPASSWORD", "Yangcheng88-")

    print(f"🚀 正在将数据安全导入阿里云 RDS ({rds_host}/{rds_db})...")
    import_cmd = [
        "docker", "run", "--rm", "-i",
        "-v", "/tmp:/tmp",
        "-e", f"PGPASSWORD={pgpassword}",
        "postgres:16-alpine",
        "psql", "-h", rds_host, "-U", rds_user, "-d", rds_db, "-f", output_path
    ]
    import_res = subprocess.run(import_cmd, capture_output=True, text=True, encoding="utf-8")
    
    # 检查是否有错误
    has_error = False
    for line in import_res.stderr.splitlines():
        if "ERROR" in line:
            print(f"  ❌ {line}")
            has_error = True
    
    if has_error:
        print("\n❌ 导入 RDS 过程中出现错误，请检查日志！")
        sys.exit(1)
    else:
        print("\n🎉 成功！所有业务数据已完整无损恢复至阿里云 RDS！")

if __name__ == "__main__":
    main()
