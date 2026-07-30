import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import healthRoute from "./routes/health/route";
import * as postsRoutes from "./routes/posts/route";
import * as usersRoutes from "./routes/users/route";

export const appRouter = createTRPCRouter({
  // Example
  example: createTRPCRouter({
    hi: hiRoute,
  }),

  // Health check
  health: healthRoute,

  // Posts
  posts: createTRPCRouter({
    list: postsRoutes.list,
    byId: postsRoutes.byId,
    byUser: postsRoutes.byUser,
  }),

  // Users
  users: createTRPCRouter({
    getProfile: usersRoutes.getProfile,
    search: usersRoutes.search,
  }),
});

export type AppRouter = typeof appRouter;
