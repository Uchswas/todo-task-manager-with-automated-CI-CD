#!/bin/bash
set -e

echo "Waiting for database at db:5432..."

# simple wait loop
while ! python - << 'PY'
import sys, time
import psycopg2
try:
    psycopg2.connect(
        dbname="todo_app_dev",
        user="todo_user",
        password="todo_password",
        host="db",
        port=5432,
    ).close()
    sys.exit(0)
except Exception:
    sys.exit(1)
PY
do
  echo "Database not ready yet, retrying in 2s..."
  sleep 2
done

echo "Database is up, starting app..."
exec python run.py
