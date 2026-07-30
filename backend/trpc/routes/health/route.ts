import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export default publicProcedure.query(async ({ ctx }) => {
  const start = Date.now();
  try {
    const { data, error } = await ctx.supabase
      .from("posts")
      .select("*", { count: "exact", head: true });

    return {
      status: "ok",
      db: error ? "error" : "connected",
      latency_ms: Date.now() - start,
      error: error?.message || null,
    };
  } catch (e: any) {
    return {
      status: "error",
      db: "disconnected",
      latency_ms: Date.now() - start,
      error: e.message,
    };
  }
});
