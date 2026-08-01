import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import {
  handleSignalingMessage,
  handleSignalingClose,
  getRoomStats,
  getRoomCount,
  getTotalPeerCount,
} from "./webrtc/signaling-server";

const app = new Hono();

app.use("*", cors());

// tRPC endpoint
app.use(
  "/api/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

// REST health
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// WebRTC signaling + audio relay WebSocket
// Handles the upgrade manually — works on Bun, Deno, CF Workers
app.get("/ws/room", (c) => {
  const upgradeHeader = c.req.header("upgrade");

  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return c.text("WebSocket upgrade required", { status: 426 });
  }

  // Use the runtime's native WebSocket upgrade
  // @ts-ignore — Bun/Deno runtime provides global WebSocketPair
  const { 0: client, 1: server } = new WebSocketPair();
  const roomRef = { roomId: null as string | null, peerId: null as string | null };

  server.accept();

  server.addEventListener("message", (event: MessageEvent) => {
    const raw = typeof event.data === "string" ? event.data : "";
    handleSignalingMessage(raw, server as unknown as import("hono/ws").WSContext, roomRef);
  });

  server.addEventListener("close", () => {
    handleSignalingClose(roomRef.roomId, roomRef.peerId);
  });

  server.addEventListener("error", () => {
    handleSignalingClose(roomRef.roomId, roomRef.peerId);
  });

  return new Response(null, {
    status: 101,
    // @ts-ignore — WebSocket upgrade response
    webSocket: client,
  });
});

// Stats
app.get("/ws/stats", (c) => {
  return c.json({
    rooms: getRoomCount(),
    totalPeers: getTotalPeerCount(),
    details: getRoomStats(),
  });
});

// Root
app.get("/", (c) => {
  return c.json({
    app: "Apparently Backend",
    version: "1.1.0",
    endpoints: {
      health: "/health",
      trpc: "/api/trpc",
      ws: "/ws/room",
      wsStats: "/ws/stats",
    },
  });
});

export default app;
