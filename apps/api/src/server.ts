import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { loadUser } from "./auth/session.js";
import { env, isProduction } from "./env.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { graphRoutes } from "./routes/graph.js";
import { jobRoutes } from "./routes/jobs.js";
import { meRoutes } from "./routes/me.js";
import { pathRoutes } from "./routes/paths.js";
import { roleRoutes } from "./routes/roles.js";

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: "info",
      transport: isProduction ? undefined : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
    },
    // Fastify's per-request logs bury the ingest output during development; errors
    // are still reported by the error handler below.
    disableRequestLogging: !isProduction,
    trustProxy: isProduction,
  });

  await app.register(fastifyCookie, { secret: env.SESSION_SECRET });
  await app.register(fastifyCors, {
    // Credentials mode requires an explicit origin — "*" is rejected by browsers.
    origin: env.WEB_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  });
  await app.register(fastifyRateLimit, { max: 300, timeWindow: "1 minute" });

  app.decorateRequest("user", null);
  app.addHook("onRequest", async (request) => {
    request.user = await loadUser(request);
  });

  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) request.log.error({ err: error }, "request failed");
    reply.code(status).send({ error: status >= 500 ? "Internal server error" : error.message });
  });

  app.get("/api/health", async () => ({ ok: true, now: new Date().toISOString() }));

  await app.register(graphRoutes);
  await app.register(roleRoutes);
  await app.register(pathRoutes);
  await app.register(jobRoutes);
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(adminRoutes);

  return app;
}
