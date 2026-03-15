#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3030}"

curl -s "$BASE_URL/health"; echo

curl -s -X POST "$BASE_URL/api/leads" \
  -H 'Content-Type: application/json' \
  -d '{"name":"测试用户","email":"test@example.com","company":"示例科技","source":"demo","tags":["demo","b2b"]}'

echo
curl -s -X POST "$BASE_URL/api/tick"; echo

curl -s "$BASE_URL/api/report/weekly"; echo
