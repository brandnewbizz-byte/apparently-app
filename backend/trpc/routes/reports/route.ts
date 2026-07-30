import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export const report = publicProcedure
  .input(z.object({
    postId: z.string().uuid(),
    reason: z.string().min(1),
    reportedBy: z.string().uuid(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("reports")
      .insert({
        post_id: input.postId,
        reason: input.reason,
        reported_by: input.reportedBy,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  });

export const hide = publicProcedure
  .input(z.object({
    postId: z.string().uuid(),
    userId: z.string().uuid(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from("hidden_posts")
      .insert({
        post_id: input.postId,
        user_id: input.userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  });
