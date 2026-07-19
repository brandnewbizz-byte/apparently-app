#!/bin/bash
# Start the local backend + tunnel for the Apparently app
# Run on the Mac mini (currently Dave's Mac mini)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend/local-server"
APP_DIR="$SCRIPT_DIR"
ENV_FILE="$APP_DIR/.env"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

echo "🚀 Starting Apparently Backend..."

# 1. Kill any existing backend processes
pkill -f "node.*local-server/server.js" 2>/dev/null || true
pkill -f "localtunnel.*3001" 2>/dev/null || true
sleep 1

# 2. Start the local backend server
echo "📦 Starting SQLite backend on :3001..."
nohup node "$BACKEND_DIR/server.js" > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
sleep 3

# Check if backend started
if curl -s http://localhost:3001/ > /dev/null 2>&1; then
  echo "   ✅ Backend running"
else
  echo "   ❌ Backend failed to start — check $LOG_DIR/backend.log"
  exit 1
fi

# 3. Start localtunnel
echo "🌐 Starting localtunnel..."
nohup npx -y localtunnel --port 3001 > "$LOG_DIR/tunnel.log" 2>&1 &
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
  
  # 4. Update .env with the tunnel URL
  if [ -f "$ENV_FILE" ]; then
    sed -i '' "s|EXPO_PUBLIC_LOCAL_API_URL=.*|EXPO_PUBLIC_LOCAL_API_URL=${TUNNEL_URL}/api|" "$ENV_FILE"
    echo "   ✅ Updated .env with tunnel URL"
  fi
  
  # Save for reference
  echo "$TUNNEL_URL" > "$LOG_DIR/current-tunnel-url.txt"
fi

# 5. Update api.ts hardcoded fallback
API_FILE="$APP_DIR/lib/api.ts"
if [ -f "$API_FILE" ] && [ -n "$TUNNEL_URL" ]; then
  sed -i '' "s|'https://[a-z0-9-]*\.loca\.lt/api'|'${TUNNEL_URL}/api'|" "$API_FILE"
  echo "   ✅ Updated api.ts fallback URL"
fi

echo ""
echo "✅ Backend is running!"
echo "   Local: http://localhost:3001"
echo "   Tunnel: ${TUNNEL_URL:-check logs}"
echo ""
echo "To check logs:"
echo "   tail -f $LOG_DIR/backend.log"
echo "   tail -f $LOG_DIR/tunnel.log"
echo ""
echo "To restart the Expo dev server with new .env:"
echo "   cd $APP_DIR && npx expo start --tunnel --clear"
