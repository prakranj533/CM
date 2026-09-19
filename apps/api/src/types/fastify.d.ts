import type { SessionUser } from "../auth/session.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Populated by the onRequest hook in server.ts; null when signed out. */
    user: SessionUser | null;
  }
}
