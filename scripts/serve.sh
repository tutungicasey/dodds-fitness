#!/usr/bin/env bash
# Restart the production server in the background on port 3100 (logs: data/server.log)
cd "$(dirname "$0")/.."
PORT="${PORT:-3100}"
PID=$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
[ -n "$PID" ] && kill "$PID" && sleep 1
[ -f .env.local ] && set -a && . ./.env.local && set +a
NEXT_TELEMETRY_DISABLED=1 setsid nohup npx next start -p "$PORT" -H 0.0.0.0 > data/server.log 2>&1 < /dev/null &
for i in $(seq 1 30); do curl -fs -o /dev/null "http://localhost:$PORT/login" && echo "Dodds Fitness running on http://localhost:$PORT" && exit 0; sleep 0.5; done
echo "Server failed to start; see data/server.log"; exit 1
