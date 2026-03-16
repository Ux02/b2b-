#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3030}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

AUTH_ARGS=()
if [ -n "$ADMIN_TOKEN" ]; then
  AUTH_ARGS=(-H "x-admin-token: $ADMIN_TOKEN")
fi

curl -s "$BASE_URL/health"; echo

curl -s -X POST "$BASE_URL/api/leads" \
  -H 'Content-Type: application/json' \
  "${AUTH_ARGS[@]}" \
  -d '{"name":"测试用户","email":"test@example.com","company":"示例科技","source":"demo","tags":["demo","b2b"]}'

echo
curl -s -X POST "$BASE_URL/api/tick" "${AUTH_ARGS[@]}"; echo

curl -s "$BASE_URL/api/report/weekly" "${AUTH_ARGS[@]}"; echo
