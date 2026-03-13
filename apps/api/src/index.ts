import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { auth } from "./lib/auth";
import { keyRoutes } from "./routes/keys";

const app = new Elysia()
  .use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:3000" }))
  .all("/api/auth/*", ({ request }) => auth.handler(request))
  .use(keyRoutes)
  .listen(process.env.PORT ?? 3001);

console.log(`API running on ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
