import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { createClient } from "@supabase/supabase-js";
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

// Supabase admin client (service role key — bypasses RLS for data reads)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || "https://inejlmksbzujgpwvnnch.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

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

// Home feed — reads via service key to bypass RLS
app.get("/api/home-feed", async (c) => {
  try {
    const [bundlesRes, skillsRes, requestsRes] = await Promise.all([
      supabaseAdmin.from("bundles").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("skill_deals").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("service_requests").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    return c.json({
      bundles: bundlesRes.data || [],
      skillDeals: skillsRes.data || [],
      serviceRequests: requestsRes.data || [],
      _errors: {
        bundles: bundlesRes.error?.message || null,
        skillDeals: skillsRes.error?.message || null,
        serviceRequests: requestsRes.error?.message || null,
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message, bundles: [], skillDeals: [], serviceRequests: [] }, 500);
  }
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
