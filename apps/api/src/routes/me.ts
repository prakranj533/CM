import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../auth/guard.js";
import { deleteRoadmap, roadmapList, roleById, roleBySlug, saveRoadmap } from "../store.js";

const createRoadmap = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  title: z.string().trim().min(1).max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
  /** The chosen CareerPath, stored verbatim so later graph edits can't rewrite history. */
  path: z.object({
    steps: z
      .array(
        z.object({
          roleId: z.string(),
          slug: z.string(),
          name: z.string(),
          durationYears: z.number(),
          skills: z.array(z.string()),
        }),
      )
      .min(1),
    totalYears: z.number(),
    skills: z.array(z.string()),
  }),
});

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/me/roadmaps", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const roadmaps = await roadmapList(user.id);
    return {
      roadmaps: roadmaps.map((roadmap) => ({
        id: roadmap.id,
        title: roadmap.title,
        notes: roadmap.notes,
        createdAt: roadmap.createdAt,
        from: roadmap.from,
        to: roadmap.to,
        path: roadmap.path,
      })),
    };
  });

  app.post("/api/me/roadmaps", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;

    const parsed = createRoadmap.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid roadmap", details: parsed.error.flatten().fieldErrors });
    }
    const { from, to, title, notes, path } = parsed.data;
    const [fromRole, toRole] = await Promise.all([
      roleBySlug(from).then((role) => role ?? roleById(from)),
      roleBySlug(to).then((role) => role ?? roleById(to)),
    ]);
    if (!fromRole || !toRole) return reply.code(404).send({ error: "Start or destination role not found" });

    const roadmap = {
      id: randomUUID(),
      userId: user.id,
      fromId: fromRole.id,
      toId: toRole.id,
      from: { slug: fromRole.slug, name: fromRole.name },
      to: { slug: toRole.slug, name: toRole.name },
      title: title ?? `${fromRole.name} → ${toRole.name}`,
      notes: notes ?? null,
      path,
      createdAt: new Date(),
    };
    await saveRoadmap(roadmap);
    return reply.code(201).send({ roadmap: { id: roadmap.id, title: roadmap.title, createdAt: roadmap.createdAt } });
  });

  app.delete("/api/me/roadmaps/:id", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return;
    const { id } = request.params as { id: string };

    // Scope the delete by userId so one account cannot remove another's roadmap.
    if (!(await deleteRoadmap(id, user.id))) return reply.code(404).send({ error: "Roadmap not found" });
    return { ok: true };
  });
}
