#!/bin/bash
# Start the Hono/tRPC backend + tunnel for the Apparently app
# Data layer uses Supabase directly; this backend serves tRPC routes

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

echo "🚀 Starting Apparently Backend (Hono/tRPC)..."

# 1. Kill existing processes
pkill -f "bun.*backend/hono" 2>/dev/null || true
pkill -f "localtunnel.*3000" 2>/dev/null || true
sleep 1

# 2. Start Hono backend (defaults to :3000)
echo "📦 Starting Hono/tRPC backend on :3000..."
cd "$SCRIPT_DIR"
nohup bun run --hot backend/hono.ts > "$LOG_DIR/backend.log" 2>&1 &
echo "   PID: $!"
sleep 3

# Check if running
if curl -s http://localhost:3000/ > /dev/null 2>&1; then
  echo "   ✅ Backend running"
else
  echo "   ⚠️  Still starting — check $LOG_DIR/backend.log"
fi

# 3. Start localtunnel
echo "🌐 Starting localtunnel..."
nohup npx -y localtunnel --port 3000 > "$LOG_DIR/tunnel.log" 2>&1 &
echo "   PID: $!"
sleep 8

TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.loca\.lt' "$LOG_DIR/tunnel.log" | head -1)
if [ -z "$TUNNEL_URL" ]; then
  echo "   ⚠️  Could not extract tunnel URL — check $LOG_DIR/tunnel.log"
else
  echo "   ✅ Tunnel URL: $TUNNEL_URL"
  ENV_FILE="$SCRIPT_DIR/.env"
  if [ -f "$ENV_FILE" ]; then
    if grep -q "EXPO_PUBLIC_TOOLKIT_URL" "$ENV_FILE"; then
      sed -i '' "s|EXPO_PUBLIC_TOOLKIT_URL=.*|EXPO_PUBLIC_TOOLKIT_URL=${TUNNEL_URL}|" "$ENV_FILE"
    else
      echo "EXPO_PUBLIC_TOOLKIT_URL=${TUNNEL_URL}" >> "$ENV_FILE"
    fi
    echo "   ✅ Updated .env"
  fi
  echo "$TUNNEL_URL" > "$LOG_DIR/current-tunnel-url.txt"
fi

echo ""
echo "✅ Backend ready — http://localhost:3000"
echo "   Tunnel: ${TUNNEL_URL:-check logs}"
