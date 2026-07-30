import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export const list = publicProcedure
  .input(z.object({ limit: z.number().min(1).max(50).default(20), offset: z.number().min(0).default(0) }))
  .query(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("posts")
      .select("*, users!posts_user_id_fkey(name, username, avatar)")
      .order("created_at", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (error) throw new Error(error.message);
    return data;
  });

export const byId = publicProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("posts")
      .select("*, users!posts_user_id_fkey(name, username, avatar)")
      .eq("id", input.id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  });

export const byUser = publicProcedure
  .input(z.object({ userId: z.string().uuid(), limit: z.number().min(1).max(50).default(20) }))
  .query(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("posts")
      .select("*")
      .eq("user_id", input.userId)
      .order("created_at", { ascending: false })
      .limit(input.limit);

    if (error) throw new Error(error.message);
    return data;
  });
