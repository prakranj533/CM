import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db.js";
import { env, isProduction } from "../env.js";

export const SESSION_COOKIE = "cm_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { id, userId, expiresAt } });
  return { id, expiresAt };
}

export function setSessionCookie(reply: FastifyReply, sessionId: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    signed: true,
    expires: expiresAt,
  });
}

export async function destroySession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionId = readSessionId(request);
  if (sessionId) await prisma.session.deleteMany({ where: { id: sessionId } });
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

function readSessionId(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}

/** Resolve the caller, expiring stale sessions as they are encountered. */
export async function loadUser(request: FastifyRequest): Promise<SessionUser | null> {
  const sessionId = readSessionId(request);
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return session.user;
}

/** Remove expired rows; called from the daily scheduler. */
export async function pruneSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}
