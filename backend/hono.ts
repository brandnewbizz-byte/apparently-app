import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

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

// Root
app.get("/", (c) => {
  return c.json({
    app: "Apparently Backend",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      trpc: "/api/trpc",
    },
  });
});

export default app;
