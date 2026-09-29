#!/usr/bin/env python3
"""
SQLite to PostgreSQL Data Migration Tool for yangcheng-tracehub
无损历史数据迁移工具：将 SQLite (.db) 完整转存至 PostgreSQL
"""

import sys
import os
import re
import sqlite3
import argparse
import subprocess

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def parse_prisma_schema(schema_path):
    """解析 schema.prisma，提取每个模型的字段及类型信息"""
    models = {}
    current_model = None
    
    if not os.path.exists(schema_path):
        return models

    with open(schema_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            
            model_match = re.match(r"^model\s+(\w+)\s*\{", line)
            if model_match:
                current_model = model_match.group(1)
                models[current_model] = {"date_fields": set(), "bool_fields": set(), "id_field": "id"}
                continue
            
            if current_model and line.startswith("}"):
                current_model = None
                continue
            
            if current_model:
                parts = line.split()
                if len(parts) >= 2:
                    field_name = parts[0]
                    field_type = parts[1].replace("?", "").replace("[]", "")
                    
                    if field_type == "DateTime":
                        models[current_model]["date_fields"].add(field_name)
                    elif field_type == "Boolean":
                        models[current_model]["bool_fields"].add(field_name)
                    
                    if "@id" in line:
                        models[current_model]["id_field"] = field_name

    return models

def format_sql_value(val, col_name, date_fields, bool_fields):
    """将 SQLite 中的值转换为合法的 PostgreSQL SQL 字面量"""
    if val is None:
        return "NULL"
    
    # 1. 布尔字段转换
    if col_name in bool_fields:
        if isinstance(val, (int, float)):
            return "TRUE" if val else "FALSE"
        if isinstance(val, str):
            return "TRUE" if val.lower() in ("true", "1", "t", "yes") else "FALSE"
        return "TRUE" if bool(val) else "FALSE"

    # 2. 日期时间字段转换 (Prisma SQLite 存的是毫秒数，也有可能是 ISO 字符串)
    if col_name in date_fields:
        if isinstance(val, (int, float)):
            return f"TO_TIMESTAMP({val} / 1000.0)"
        if isinstance(val, str):
            val_clean = val.strip().replace("'", "''")
            if val_clean.isdigit():
                return f"TO_TIMESTAMP({val_clean} / 1000.0)"
            return f"'{val_clean}'::timestamp"

    # 3. 数字类型
    if isinstance(val, (int, float)):
        return str(val)

    # 4. 字符串类型
    str_val = str(val).replace("'", "''")
    return f"'{str_val}'"

def dump_sqlite_to_postgres(sqlite_path, schema_path, output_sql_path=None, clean_target=False):
    """读取 SQLite 数据库，生成导入 PostgreSQL 的完整 SQL 脚本"""
    if not os.path.exists(sqlite_path):
        raise FileNotFoundError(f"SQLite database file not found: {sqlite_path}")

    models = parse_prisma_schema(schema_path)
    conn = sqlite3.connect(sqlite_path)
    cursor = conn.cursor()

    # 获取所有非系统表
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite_%';")
    tables = [r[0] for r in cursor.fetchall()]

    sql_statements = [
        "-- Auto-generated SQLite to PostgreSQL Migration Script",
        "BEGIN;",
        "SET session_replication_role = 'replica';",
    ]

    if clean_target and tables:
        quoted_all_tables = ", ".join([f'"{t}"' for t in tables])
        sql_statements.append(f"\n-- Clean target tables before migration\nTRUNCATE TABLE {quoted_all_tables} CASCADE;\n")

    total_migrated_rows = 0

    for table in tables:
        # 获取表列名
        cursor.execute(f"PRAGMA table_info('{table}')")
        col_info = cursor.fetchall()
        col_names = [c[1] for c in col_info]
        if not col_names:
            continue

        model_meta = models.get(table, {"date_fields": set(), "bool_fields": set(), "id_field": "id"})
        date_fields = model_meta["date_fields"]
        bool_fields = model_meta["bool_fields"]
        id_field = model_meta.get("id_field", "id")

        cursor.execute(f"SELECT * FROM \"{table}\"")
        rows = cursor.fetchall()
        if not rows:
            continue

        sql_statements.append(f"\n-- Table: {table} ({len(rows)} rows)")
        quoted_cols = ", ".join([f'"{c}"' for c in col_names])

        for row in rows:
            formatted_vals = []
            for col_name, val in zip(col_names, row):
                formatted_vals.append(format_sql_value(val, col_name, date_fields, bool_fields))
            
            vals_str = ", ".join(formatted_vals)

            if id_field in col_names and len(col_names) > 1:
                update_cols = [f'"{c}" = EXCLUDED."{c}"' for c in col_names if c != id_field]
                conflict_clause = f'ON CONFLICT ("{id_field}") DO UPDATE SET {", ".join(update_cols)}'
            else:
                conflict_clause = "ON CONFLICT DO NOTHING"

            sql_statements.append(
                f'INSERT INTO "{table}" ({quoted_cols}) VALUES ({vals_str}) {conflict_clause};'
            )
            total_migrated_rows += 1

    sql_statements.append("\nSET session_replication_role = 'origin';")
    sql_statements.append("COMMIT;")
    final_sql = "\n".join(sql_statements)

    if output_sql_path:
        with open(output_sql_path, "w", encoding="utf-8") as f:
            f.write(final_sql)

    return final_sql, len(tables), total_migrated_rows

def main():
    parser = argparse.ArgumentParser(description="Migrate SQLite data to PostgreSQL for yangcheng-tracehub")
    parser.add_argument("--sqlite", default="data/db/app.db", help="Path to SQLite database file")
    parser.add_argument("--schema", default="prisma/schema.prisma", help="Path to schema.prisma")
    parser.add_argument("--output", default="migration.sql", help="Path to output SQL file")
    parser.add_argument("--clean", action="store_true", help="Truncate target tables before inserting historical data")
    parser.add_argument("--container", default=None, help="Optional Docker PostgreSQL container name to execute SQL into")
    parser.add_argument("--db-user", default="yangcheng", help="PostgreSQL user")
    parser.add_argument("--db-name", default="yangcheng", help="PostgreSQL database name")

    args = parser.parse_args()

    print(f"📦 正在分析 SQLite 数据库: {args.sqlite}")
    print(f"📄 参考 Prisma Schema: {args.schema}")

    sql, table_count, row_count = dump_sqlite_to_postgres(args.sqlite, args.schema, args.output, clean_target=args.clean)
    print(f"✅ 转换完成！共解析 {table_count} 张数据表，生成 {row_count} 条记录的插入语句。")
    print(f"💾 SQL 脚本已保存至: {args.output}")

    if args.container:
        print(f"🚀 正在将数据导入 Docker 容器 [{args.container}] (DB: {args.db_name})...")
        cmd = ["docker", "exec", "-i", args.container, "psql", "-U", args.db_user, "-d", args.db_name]
        res = subprocess.run(cmd, input=sql, text=True, capture_output=True, encoding="utf-8")
        if res.returncode == 0:
            print("🎉 数据成功导入 PostgreSQL！")
        else:
            print(f"❌ 导入失败:\n{res.stderr}")
            sys.exit(1)

if __name__ == "__main__":
    main()
