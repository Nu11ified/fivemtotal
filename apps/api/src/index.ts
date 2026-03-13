import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./lib/auth";
import { keyRoutes } from "./routes/keys";
import { scanRoutes } from "./routes/scan";
import { reputationRoutes } from "./routes/reputation";
import { guardRoutes } from "./routes/guard";
import { adminRoutes } from "./routes/admin";
import { billingRoutes } from "./routes/billing";
import { dashboardRoutes } from "./routes/dashboard";

const app = new Elysia()
  .use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }))
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .use(keyRoutes)
  .use(scanRoutes)
  .use(reputationRoutes)
  .use(guardRoutes)
  .use(adminRoutes)
  .use(billingRoutes)
  .use(dashboardRoutes)
  .listen(process.env.PORT ?? 3001);

console.log(`API running on ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
