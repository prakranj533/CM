import { createHash } from "node:crypto";
import { slugify } from "@career-maps/core";
import { prisma } from "../db.js";
import { fetchJson } from "../scraper/http.js";

const ESCO_SEARCH = "https://ec.europa.eu/esco/api/search";
const PAGE_SIZE = 100;
const ROOT_ROLE_NAMES = ["10th (S.S.C.)", "12th (H.S.C.)", "12th Science", "12th Commerce", "12th Arts"];

const PREPARATION = {
  degree: { id: "catalog-prep-degree", name: "Bachelor's degree or equivalent professional qualification", years: 3 },
  technical: { id: "catalog-prep-technical", name: "Diploma or technical degree", years: 2 },
  vocational: { id: "catalog-prep-vocational", name: "Vocational training, apprenticeship or certification", years: 1 },
  foundation: { id: "catalog-prep-foundation", name: "Job-ready foundational skills training", years: 0.5 },
  defence: { id: "catalog-prep-defence", name: "Defence entrance test, medical and fitness assessment", years: 0.5 },
} as const;

function preparationFor(category: string): keyof typeof PREPARATION {
  if (category === "Managers" || category === "Professionals") return "degree";
  if (category === "Technicians and associate professionals") return "technical";
  if (category === "Elementary occupations") return "foundation";
  if (category === "Armed forces") return "defence";
  return "vocational";
}

interface EscoResult {
  uri: string;
  title?: string;
  code?: string;
  preferredLabel?: { en?: string; "en-us"?: string };
  broaderOccupation?: string[];
}

interface EscoPage {
  total: number;
  _embedded?: { results?: EscoResult[] };
}

function roleId(uri: string): string {
  return `esco:${createHash("sha1").update(uri).digest("hex").slice(0, 24)}`;
}

function categoryFor(code: string | undefined): string {
  const group = code?.charAt(0);
  return (
    {
      "0": "Armed forces",
      "1": "Managers",
      "2": "Professionals",
      "3": "Technicians and associate professionals",
      "4": "Clerical support workers",
      "5": "Services and sales workers",
      "6": "Skilled agricultural workers",
      "7": "Craft and trades workers",
      "8": "Plant and machine operators",
      "9": "Elementary occupations",
    }[group ?? ""] ?? "Other occupations"
  );
}

function titleFor(result: EscoResult): string {
  return result.title?.trim() || result.preferredLabel?.en?.trim() || result.preferredLabel?.["en-us"]?.trim() || "Unnamed occupation";
}

async function fetchOccupations(): Promise<EscoResult[]> {
  const results: EscoResult[] = [];
  let total = Number.POSITIVE_INFINITY;
  for (let pageNumber = 0; results.length < total; pageNumber += 1) {
    const url = `${ESCO_SEARCH}?language=en&type=occupation&limit=${PAGE_SIZE}&offset=${pageNumber}&text=`;
    const page = await fetchJson<EscoPage>(url);
    total = page.total;
    const rows = page._embedded?.results ?? [];
    results.push(...rows);
    console.log(`ESCO occupations: ${results.length}/${total}`);
    if (rows.length === 0) break;
  }
  return [...new Map(results.map((result) => [result.uri, result])).values()].filter(
    (result) => result.uri && titleFor(result) !== "Unnamed occupation",
  );
}

async function main(): Promise<void> {
  const occupations = await fetchOccupations();
  const byUri = new Map(occupations.map((occupation) => [occupation.uri, occupation]));
  const ids = new Map(occupations.map((occupation) => [occupation.uri, roleId(occupation.uri)]));

  await prisma.role.deleteMany({ where: { catalogSource: "esco" } });

  await prisma.role.createMany({
    data: [
      ...occupations.map((occupation) => ({
        id: ids.get(occupation.uri)!,
        slug: `esco-${slugify(titleFor(occupation))}-${(occupation.code ?? ids.get(occupation.uri)!).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`.slice(0, 100),
        name: titleFor(occupation),
        category: categoryFor(occupation.code),
        description: `Occupation from the ESCO public classification (${occupation.code ?? "no code"}).`,
        catalogUri: occupation.uri,
        catalogSource: "esco",
      })),
      ...Object.entries(PREPARATION).map(([key, preparation]) => ({
        id: preparation.id,
        slug: `career-preparation-${key}`,
        name: preparation.name,
        category: "Career preparation",
        description: "General preparation milestone. Exact requirements vary by occupation and institution.",
        catalogUri: `career-maps:preparation:${key}`,
        catalogSource: "esco",
      })),
    ],
  });

  const hierarchyEdges = occupations.flatMap((occupation) => {
    const childId = ids.get(occupation.uri);
    if (!childId) return [];
    return (occupation.broaderOccupation ?? [])
      .map((parentUri) => {
        const parentId = ids.get(parentUri);
        return parentId ? { fromId: parentId, toId: childId, durationYears: 0.5, skillsJson: "[]", origin: "catalog" } : null;
      })
      .filter((edge): edge is NonNullable<typeof edge> => edge !== null);
  });

  const rootOccupations = occupations.filter(
    (occupation) => !(occupation.broaderOccupation ?? []).some((parentUri) => byUri.has(parentUri)),
  );
  const preparationEdges = rootOccupations.flatMap((occupation) => {
    const rootId = ids.get(occupation.uri);
    if (!rootId) return [];
    const preparation = PREPARATION[preparationFor(categoryFor(occupation.code))];
    return [{ fromId: preparation.id, toId: rootId, durationYears: 0.5, skillsJson: "[]", origin: "catalog" }];
  });
  const educationRoles = await prisma.role.findMany({ where: { name: { in: ROOT_ROLE_NAMES } }, select: { id: true, name: true } });
  const educationEdges = educationRoles.flatMap((role) =>
    Object.entries(PREPARATION)
      .filter(([key]) => role.name !== "10th (S.S.C.)" || key !== "degree")
      .map(([, preparation]) => ({
        fromId: role.id,
        toId: preparation.id,
        durationYears: preparation.years,
        skillsJson: "[]",
        origin: "catalog",
      })),
  );

  await prisma.roleEdge.createMany({ data: [...hierarchyEdges, ...preparationEdges, ...educationEdges] });
  await prisma.$executeRawUnsafe(`
    UPDATE Role
    SET inDegree = (SELECT COUNT(*) FROM RoleEdge WHERE RoleEdge.toId = Role.id),
        outDegree = (SELECT COUNT(*) FROM RoleEdge WHERE RoleEdge.fromId = Role.id),
        centrality = (SELECT COUNT(*) FROM RoleEdge WHERE RoleEdge.toId = Role.id OR RoleEdge.fromId = Role.id)
    WHERE catalogSource = 'esco'
  `);
  console.log(
    `imported ${occupations.length} ESCO occupations and ${hierarchyEdges.length + preparationEdges.length + educationEdges.length} planning transitions`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
