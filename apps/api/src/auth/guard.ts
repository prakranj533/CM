import type { FastifyReply, FastifyRequest } from "fastify";
import type { SessionUser } from "./session.js";

/**
 * Return the signed-in user or finish the request with 401.
 * Callers must `return` immediately when this yields null.
 */
export function requireUser(request: FastifyRequest, reply: FastifyReply): SessionUser | null {
  if (request.user) return request.user;
  reply.code(401).send({ error: "Sign in required" });
  return null;
}
