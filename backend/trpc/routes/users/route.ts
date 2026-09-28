import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export const getProfile = publicProcedure
  .input(z.object({ userId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("*")
      .eq("id", input.userId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  });

export const search = publicProcedure
  .input(z.object({ query: z.string().min(1), limit: z.number().min(1).max(20).default(10) }))
  .query(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("profiles")
      .select("id, full_name, username, avatar, is_verified")
      .or(`full_name.ilike.%${input.query}%,username.ilike.%${input.query}%`)
      .limit(input.limit);

    if (error) throw new Error(error.message);
    return data;
  });
