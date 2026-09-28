import { randomUUID } from "node:crypto";
import fastifyOauth2, { type OAuth2Namespace } from "@fastify/oauth2";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createSession, destroySession, hashPassword, setSessionCookie, verifyPassword } from "../auth/session.js";
import { env, googleOAuthEnabled } from "../env.js";
import { createUserIfEmailAvailable, linkOAuthUser, userByEmail } from "../store.js";
import type { OAuthAccountRecord, UserRecord } from "../firestore.js";

/**
 * @fastify/oauth2 hangs the provider presets off its exported function, but the
 * shipped types declare that function without them, so the constant is invisible
 * to TypeScript. Narrow to just what we use.
 */
const oauth2 = fastifyOauth2 as unknown as typeof fastifyOauth2 & {
  GOOGLE_CONFIGURATION: { authorizeHost: string; authorizePath: string; tokenHost: string; tokenPath: string };
};

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  name: z.string().trim().max(120).optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/auth/me", async (request) => ({
    user: request.user,
    providers: { password: true, google: googleOAuthEnabled },
  }));

  app.post("/api/auth/register", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const parsed = credentials.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid details", details: parsed.error.flatten().fieldErrors });
    }
    const { email, password, name } = parsed.data;
    const user: UserRecord = {
      id: randomUUID(),
      email,
      name: name ?? null,
      avatarUrl: null,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
    };
    if (!(await createUserIfEmailAvailable(user))) return reply.code(409).send({ error: "An account with that email already exists" });

    const session = await createSession(user.id);
    setSessionCookie(reply, session.id, session.expiresAt);
    return reply.code(201).send({ user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } });
  });

  app.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (request, reply) => {
    const parsed = credentials.omit({ name: true }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Enter an email and password" });
    const { email, password } = parsed.data;

    const user = await userByEmail(email);
    // Identical response whether the email is unknown or the password is wrong,
    // so the endpoint can't be used to enumerate registered addresses.
    const invalid = { error: "Email or password is incorrect" };
    if (!user?.passwordHash) return reply.code(401).send(invalid);
    if (!(await verifyPassword(password, user.passwordHash))) return reply.code(401).send(invalid);

    const session = await createSession(user.id);
    setSessionCookie(reply, session.id, session.expiresAt);
    return { user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl } };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    await destroySession(request, reply);
    return { ok: true };
  });

  if (!googleOAuthEnabled) {
    app.log.info("Google OAuth disabled (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable)");
    return;
  }

  await app.register(fastifyOauth2, {
    name: "googleOAuth2",
    scope: ["profile", "email"],
    credentials: {
      client: { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET },
      auth: oauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: "/api/auth/google",
    callbackUri: `${env.API_PUBLIC_URL}/api/auth/google/callback`,
  });

  app.get("/api/auth/google/callback", async (request, reply) => {
    const oauth = (app as unknown as { googleOAuth2: OAuth2Namespace }).googleOAuth2;

    try {
      const { token } = await oauth.getAccessTokenFromAuthorizationCodeFlow(request);
      const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${token.access_token}` },
      });
      if (!response.ok) throw new Error(`Google userinfo returned ${response.status}`);

      const profile = (await response.json()) as {
        sub: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
      };
      if (!profile.email) throw new Error("Google account has no email address");

      const email = profile.email.toLowerCase();
      const user = await linkOAuthUser(
        { id: `google:${profile.sub}`, provider: "google", providerUserId: profile.sub, userId: "" } satisfies OAuthAccountRecord,
        {
          id: randomUUID(),
          email,
          name: profile.name ?? null,
          avatarUrl: profile.picture ?? null,
          passwordHash: null,
          createdAt: new Date(),
        } satisfies UserRecord,
      );
      const session = await createSession(user.id);
      setSessionCookie(reply, session.id, session.expiresAt);
      return reply.redirect(`${env.WEB_ORIGIN}/`);
    } catch (error) {
      app.log.error({ err: error }, "Google sign-in failed");
      return reply.redirect(`${env.WEB_ORIGIN}/signin?error=google`);
    }
  });
}
