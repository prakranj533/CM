import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env, isProduction } from "../env.js";
import { deleteExpiredSessions, deleteSession, saveSession, sessionById, userById } from "../store.js";

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
  await saveSession({ id, userId, expiresAt, createdAt: new Date() });
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
  if (sessionId) await deleteSession(sessionId);
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

  const session = await sessionById(sessionId);
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await deleteSession(session.id).catch(() => undefined);
    return null;
  }

  const user = await userById(session.userId);
  return user ? { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } : null;
}

/** Remove expired rows; called from the daily scheduler. */
export async function pruneSessions(): Promise<number> {
  return deleteExpiredSessions(new Date());
}
