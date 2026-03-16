#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3090}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.state"
LAST_HASH_FILE="$STATE_DIR/last-alert-hash.txt"
NOTIFY_FILE="$ROOT_DIR/config/notify.json"

mkdir -p "$STATE_DIR"

if [ ! -f "$NOTIFY_FILE" ]; then
  echo "notify config missing: $NOTIFY_FILE"
  exit 0
fi

ROOT_DIR="$ROOT_DIR" python3 - <<'PY'
import json, os, sys, hashlib, urllib.request

base_url = os.environ.get('BASE_URL', 'http://localhost:3090')
root = os.environ.get('ROOT_DIR')
notify_file = os.path.join(root, 'config', 'notify.json')
state_file = os.path.join(root, '.state', 'last-alert-hash.txt')

with open(notify_file, 'r', encoding='utf-8') as f:
    cfg = json.load(f)

if not cfg.get('enabled'):
    print('notify disabled')
    sys.exit(0)

with urllib.request.urlopen(base_url + '/api/overview', timeout=15) as r:
    data = json.loads(r.read().decode('utf-8'))

alerts = data.get('alerts', [])
if cfg.get('onlyHigh'):
    alerts = [a for a in alerts if a.get('level') == 'high']
else:
    alerts = [a for a in alerts if a.get('level') != 'ok']

if not alerts:
    print('no actionable alerts')
    sys.exit(0)

summary = data.get('summary', '')
now = data.get('now', '')
lines = [f"⚠️ Workbench 告警 ({now})"] + [f"- [{a.get('level')}] {a.get('text')}" for a in alerts]
if summary:
    lines += ["", "摘要：", summary]
text = '\n'.join(lines)

h = hashlib.sha256(text.encode('utf-8')).hexdigest()
old = ''
if os.path.exists(state_file):
    old = open(state_file, 'r', encoding='utf-8').read().strip()
if h == old:
    print('same alert as last time, skip push')
    sys.exit(0)

webhook = cfg.get('webhookUrl', '').strip()
if not webhook:
    print('webhookUrl empty')
    sys.exit(1)

payload = {
    "msg_type": "text",
    "content": {"text": text}
}
req = urllib.request.Request(
    webhook,
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST'
)
with urllib.request.urlopen(req, timeout=15) as r:
    body = r.read().decode('utf-8', errors='ignore')
    print('push ok:', body[:200])

os.makedirs(os.path.dirname(state_file), exist_ok=True)
with open(state_file, 'w', encoding='utf-8') as f:
    f.write(h)
PY
