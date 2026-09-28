import type { FastifyInstance } from "fastify";
import { allRoleEdges, allRoles } from "../store.js";

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

export async function graphRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/graph/overview", async (request) => {
    const { family: rawFamily, subfamily: rawSubfamily } = request.query as { family?: string; subfamily?: string };
    const family = rawFamily?.trim();
    const subfamily = rawSubfamily?.trim();
    const all = await allRoles();
    const roles = all.filter((role) => {
      if (family && (family === "Curated pathways" ? role.catalogSource !== null : role.catalogSource !== "nco" || role.category !== family)) return false;
      return !subfamily || subfamily === "all" || role.catalogCode?.startsWith(subfamily);
    });
    const groups = new Map<string, { name: string; careers: number; openings: number; examples: string[] }>();
    for (const role of roles) {
      const key = subfamily
        ? role.catalogCode?.match(/^\d{3}/)?.[0] ?? "all"
        : family
          ? role.catalogCode?.match(/^\d{2}/)?.[0] ?? "all"
          : role.catalogSource === "nco"
            ? role.category ?? "Other occupations"
            : "Curated pathways";
      const name = family && !subfamily ? SUBFAMILY_NAMES[key] ?? `${family} pathways` : key;
      const group = groups.get(key) ?? { name, careers: 0, openings: 0, examples: [] };
      group.careers += 1;
      group.openings += role.openingCount ?? 0;
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
    const roles = (await allRoles())
      .filter((role) => {
        if (!family) return true;
        if (family === "Curated pathways" ? role.catalogSource !== null : role.catalogSource !== "nco" || role.category !== family) return false;
        return !codePrefix || role.catalogCode?.startsWith(codePrefix);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const roleIds = new Set(roles.map((role) => role.id));
    const edges = allRoleEdges(roles).filter((edge) => roleIds.has(edge.fromId) && roleIds.has(edge.toId));

    return {
      nodes: roles.map((role) => ({
        id: role.id,
        slug: role.slug,
        name: role.name,
        category: role.category,
        centrality: Math.round(role.centrality * 100) / 100,
        inDegree: role.inDegree,
        outDegree: role.outDegree,
        openings: role.openingCount ?? 0,
      })),
      edges: edges.map((edge) => ({
        from: edge.fromId,
        to: edge.toId,
        durationYears: edge.durationYears,
        skills: edge.skills,
      })),
    };
  });

  /** Roles ranked by betweenness centrality — the "hub" qualifications. */
  app.get("/api/graph/hubs", async (request) => {
    const limit = Math.min(Number((request.query as { limit?: string }).limit ?? 15) || 15, 100);
    const roles = (await allRoles()).sort((a, b) => b.centrality - a.centrality).slice(0, limit);
    return {
      hubs: roles.map((role) => ({
        slug: role.slug,
        name: role.name,
        centrality: Math.round(role.centrality * 100) / 100,
        inDegree: role.inDegree,
        outDegree: role.outDegree,
      })),
    };
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
