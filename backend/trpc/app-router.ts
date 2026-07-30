import { createTRPCRouter } from "./create-context";
import hiRoute from "./routes/example/hi/route";
import healthRoute from "./routes/health/route";
import * as postsRoutes from "./routes/posts/route";
import * as reportsRoutes from "./routes/reports/route";
import * as spotRoutes from "./routes/spot/route";
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

  // Reports
  reports: createTRPCRouter({
    report: reportsRoutes.report,
    hide: reportsRoutes.hide,
  }),

  // Spot (Live/Discovery Feed)
  spot: createTRPCRouter({
    getFeed: spotRoutes.getFeed,
  }),

  // Users
  users: createTRPCRouter({
    getProfile: usersRoutes.getProfile,
    search: usersRoutes.search,
  }),
});

export type AppRouter = typeof appRouter;
