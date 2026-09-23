import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

const SUBFAMILY_NAMES: Record<string, string> = {
  "01": "Commissioned armed forces officers",
  "02": "Non-commissioned armed forces officers",
  "03": "Other armed forces occupations",
  "11": "Chief executives and senior officials",
  "12": "Administrative and commercial managers",
  "13": "Production and specialised services managers",
  "14": "Hospitality, retail and services managers",
  "21": "Science and engineering professionals",
  "22": "Health professionals",
  "23": "Teaching professionals",
  "24": "Business and administration professionals",
  "25": "Information and communications professionals",
  "26": "Legal, social and cultural professionals",
  "31": "Science and engineering associate professionals",
  "32": "Health associate professionals",
  "33": "Business and administration associate professionals",
  "34": "Legal, social, cultural and related associates",
  "35": "Information and communications technicians",
  "41": "General and keyboard clerks",
  "42": "Customer services clerks",
  "43": "Numerical and material recording clerks",
  "44": "Other clerical support workers",
  "51": "Personal service workers",
  "52": "Sales workers",
  "53": "Personal care workers",
  "54": "Protective services workers",
  "61": "Market-oriented agricultural workers",
  "62": "Market-oriented forestry and fishery workers",
  "63": "Subsistence farmers, fishers and gatherers",
  "71": "Building and related trades workers",
  "72": "Metal, machinery and related trades workers",
  "73": "Handicraft and printing workers",
  "74": "Electrical and electronic trades workers",
  "75": "Food, garment and other craft workers",
  "81": "Stationary plant and machine operators",
  "82": "Assemblers",
  "83": "Drivers and mobile plant operators",
  "91": "Cleaners and helpers",
  "92": "Agricultural, forestry and fishery labourers",
  "93": "Mining, construction and manufacturing labourers",
  "94": "Food preparation assistants",
  "95": "Street and related sales and service workers",
  "96": "Refuse workers and other elementary workers",
};

function familyWhere(family: string): Prisma.RoleWhereInput {
  return family === "Curated pathways" ? { catalogSource: null } : { catalogSource: "esco", category: family };
}

export async function graphRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/graph/overview", async (request) => {
    const { family: rawFamily, subfamily: rawSubfamily } = request.query as { family?: string; subfamily?: string };
    const family = rawFamily?.trim();
    const subfamily = rawSubfamily?.trim();
    const where: Prisma.RoleWhereInput | undefined = family
      ? { ...familyWhere(family), ...(subfamily && subfamily !== "all" ? { catalogCode: { startsWith: subfamily } } : {}) }
      : undefined;
    const [roles, jobCounts] = await Promise.all([
      prisma.role.findMany({ where, select: { id: true, name: true, category: true, catalogSource: true, catalogCode: true } }),
      prisma.jobPosting.groupBy({ by: ["roleId"], _count: { _all: true } }),
    ]);
    const openings = new Map<string, number>();
    for (const row of jobCounts) if (row.roleId) openings.set(row.roleId, row._count._all);
    const groups = new Map<string, { name: string; careers: number; openings: number; examples: string[] }>();
    for (const role of roles) {
      const key = subfamily
        ? role.catalogCode?.match(/^\d{3}/)?.[0] ?? "all"
        : family
          ? role.catalogCode?.match(/^\d{2}/)?.[0] ?? "all"
          : role.catalogSource === "esco"
            ? role.category ?? "Other occupations"
            : "Curated pathways";
      const name = family && !subfamily ? SUBFAMILY_NAMES[key] ?? `${family} pathways` : key;
      const group = groups.get(key) ?? { name, careers: 0, openings: 0, examples: [] };
      group.careers += 1;
      group.openings += openings.get(role.id) ?? 0;
      if (group.examples.length < 2) group.examples.push(role.name);
      groups.set(key, group);
    }
    return {
      nodes: [...groups.entries()].map(([key, group]) => ({
        id: subfamily ? `specialty:${key}` : family ? `subfamily:${key}` : `family:${key}`,
        slug: subfamily ? `specialty:${key}` : family ? `subfamily:${key}` : `family:${key}`,
        name: subfamily ? `${group.examples.join(" and ")} careers` : group.name,
        category: family ?? group.name,
        centrality: group.careers,
        inDegree: 0,
        outDegree: group.careers,
        openings: group.openings,
        summaryCount: group.careers,
      })),
      edges: [],
    };
  });

  app.get("/api/graph", async (request) => {
    const { family: rawFamily, subfamily: rawSubfamily, specialty: rawSpecialty } = request.query as {
      family?: string;
      subfamily?: string;
      specialty?: string;
    };
    const family = rawFamily?.trim();
    const subfamily = rawSubfamily?.trim();
    const specialty = rawSpecialty?.trim();
    const codePrefix = specialty && specialty !== "all" ? specialty : subfamily && subfamily !== "all" ? subfamily : null;
    const where: Prisma.RoleWhereInput | undefined = family
      ? { ...familyWhere(family), ...(codePrefix ? { catalogCode: { startsWith: codePrefix } } : {}) }
      : undefined;
    const roles = await prisma.role.findMany({
      where,
      select: { id: true, slug: true, name: true, category: true, centrality: true, inDegree: true, outDegree: true },
      orderBy: { name: "asc" },
    });
    const roleIds = roles.map((role) => role.id);
    const [edges, jobCounts] = await Promise.all([
      prisma.roleEdge.findMany({
        where: family ? { fromId: { in: roleIds }, toId: { in: roleIds } } : undefined,
        select: { fromId: true, toId: true, durationYears: true, skillsJson: true },
      }),
      prisma.jobPosting.groupBy({ by: ["roleId"], where: family ? { roleId: { in: roleIds } } : undefined, _count: { _all: true } }),
    ]);

    const openings = new Map<string, number>();
    for (const row of jobCounts) if (row.roleId) openings.set(row.roleId, row._count._all);

    return {
      nodes: roles.map((role) => ({
        id: role.id,
        slug: role.slug,
        name: role.name,
        category: role.category,
        centrality: Math.round(role.centrality * 100) / 100,
        inDegree: role.inDegree,
        outDegree: role.outDegree,
        openings: openings.get(role.id) ?? 0,
      })),
      edges: edges.map((edge) => ({
        from: edge.fromId,
        to: edge.toId,
        durationYears: edge.durationYears,
        skills: parseSkills(edge.skillsJson),
      })),
    };
  });

  /** Roles ranked by betweenness centrality — the "hub" qualifications. */
  app.get("/api/graph/hubs", async (request) => {
    const limit = Math.min(Number((request.query as { limit?: string }).limit ?? 15) || 15, 100);
    const roles = await prisma.role.findMany({
      select: { slug: true, name: true, centrality: true, inDegree: true, outDegree: true },
      orderBy: { centrality: "desc" },
      take: limit,
    });
    return { hubs: roles.map((role) => ({ ...role, centrality: Math.round(role.centrality * 100) / 100 })) };
  });
}

export function parseSkills(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}
