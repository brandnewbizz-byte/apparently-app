#!/bin/bash
# Start the Hono/tRPC backend + tunnel for the Apparently app
# The data layer now talks directly to Supabase; this backend serves tRPC routes

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

echo "🚀 Starting Apparently Backend (Hono/tRPC)..."

# 1. Kill any existing backend processes
pkill -f "bun.*backend/hono" 2>/dev/null || true
pkill -f "localtunnel.*3005" 2>/dev/null || true
sleep 1

# 2. Start the Hono backend on port 3005
echo "📦 Starting Hono/tRPC backend on :3005..."
cd "$SCRIPT_DIR"
nohup bun run --hot backend/hono.ts > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
sleep 3

# Check if backend started
if curl -s http://localhost:3005/ > /dev/null 2>&1; then
  echo "   ✅ Backend running"
else
  echo "   ⚠️  Backend may still be starting — check $LOG_DIR/backend.log"
fi

# 3. Start localtunnel
echo "🌐 Starting localtunnel..."
nohup npx -y localtunnel --port 3005 > "$LOG_DIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!
echo "   Tunnel PID: $TUNNEL_PID"
sleep 8

# Extract tunnel URL
TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.loca\.lt' "$LOG_DIR/tunnel.log" | head -1)
if [ -z "$TUNNEL_URL" ]; then
  echo "   ⚠️  Could not extract tunnel URL — check $LOG_DIR/tunnel.log"
  cat "$LOG_DIR/tunnel.log"
else
  echo "   ✅ Tunnel URL: $TUNNEL_URL"
  
  # Update .env with the tunnel URL
  ENV_FILE="$SCRIPT_DIR/.env"
  if [ -f "$ENV_FILE" ]; then
    if grep -q "EXPO_PUBLIC_TOOLKIT_URL" "$ENV_FILE"; then
      sed -i '' "s|EXPO_PUBLIC_TOOLKIT_URL=.*|EXPO_PUBLIC_TOOLKIT_URL=${TUNNEL_URL}|" "$ENV_FILE"
    else
      echo "EXPO_PUBLIC_TOOLKIT_URL=${TUNNEL_URL}" >> "$ENV_FILE"
    fi
    echo "   ✅ Updated .env with tunnel URL"
  fi
  
  echo "$TUNNEL_URL" > "$LOG_DIR/current-tunnel-url.txt"
fi

echo ""
echo "✅ Backend is running!"
echo "   Local: http://localhost:3005"
echo "   Tunnel: ${TUNNEL_URL:-check logs}"
echo ""
echo "To check logs:"
echo "   tail -f $LOG_DIR/backend.log"
echo "   tail -f $LOG_DIR/tunnel.log"
