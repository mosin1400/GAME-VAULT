#!/bin/bash
# ساخت پایگاه دادهٔ جداگانه برای اپ Agent (n8n از POSTGRES_DB استفاده می‌کند)
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE agent;
EOSQL
