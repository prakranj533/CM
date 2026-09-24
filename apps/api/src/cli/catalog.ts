import { createHash } from "node:crypto";
import { slugify } from "@career-maps/core";
import { load } from "cheerio";
import { prisma } from "../db.js";
import { fetchText } from "../scraper/http.js";

const NCO_URL = "https://dge.gov.in/nat";
const ROOT_ROLE_NAMES = ["10th (S.S.C.)", "12th (H.S.C.)", "12th Science", "12th Commerce", "12th Arts"];

const PREPARATION = {
  degree: { id: "catalog-prep-degree", name: "Bachelor's degree or equivalent professional qualification", years: 3 },
  technical: { id: "catalog-prep-technical", name: "Diploma or technical degree", years: 2 },
  vocational: { id: "catalog-prep-vocational", name: "ITI, vocational training, apprenticeship or certification", years: 1 },
  foundation: { id: "catalog-prep-foundation", name: "Job-ready foundational skills training", years: 0.5 },
  defence: { id: "catalog-prep-defence", name: "Defence entrance test, medical and fitness assessment", years: 0.5 },
} as const;

interface NcoOccupation {
  code: string;
  title: string;
  division: string;
  subdivision: string;
  group: string;
  family: string;
}

function preparationFor(division: string): keyof typeof PREPARATION {
  if (division === "Managers" || division === "Professionals") return "degree";
  if (division.includes("Technicians")) return "technical";
  if (division.includes("Elementary")) return "foundation";
  if (division.includes("Armed")) return "defence";
  return "vocational";
}

function roleId(occupation: NcoOccupation): string {
  return `nco:${createHash("sha1").update(`${occupation.code}:${occupation.title}`).digest("hex").slice(0, 24)}`;
}

async function fetchOccupations(): Promise<NcoOccupation[]> {
  const occupations: NcoOccupation[] = [];
  for (let page = 0; page < 50; page += 1) {
    const html = await fetchText(`${NCO_URL}?page=${page}`);
    const $ = load(html);
    let pageRows = 0;
    $("main table tbody tr").each((_index, row) => {
      const cells = $(row)
        .find("td")
        .map((_cellIndex, cell) => $(cell).text().replace(/\s+/g, " ").trim())
        .get();
      if (cells.length < 8 || !cells[1] || !cells[2]) return;
      occupations.push({
        title: cells[1],
        code: cells[2],
        division: cells[4] || "Other occupations",
        subdivision: cells[5] || "Other occupations",
        group: cells[6] || "Other occupations",
        family: cells[7] || "Other occupations",
      });
      pageRows += 1;
    });
    console.log(`NCO occupations: ${occupations.length}`);
    const hasNext = $("a").toArray().some((link) => $(link).text().trim() === "Next");
    if (pageRows === 0 || !hasNext) break;
  }
  return [...new Map(occupations.map((occupation) => [`${occupation.code}:${occupation.title}`, occupation])).values()];
}

async function main(): Promise<void> {
  const occupations = await fetchOccupations();
  await prisma.role.deleteMany({ where: { catalogSource: { in: ["esco", "nco"] } } });

  await prisma.role.createMany({
    data: [
      ...occupations.map((occupation) => ({
        id: roleId(occupation),
        slug: `nco-${slugify(occupation.title)}-${occupation.code.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`.slice(0, 100),
        name: occupation.title,
        category: occupation.division,
        description: `${occupation.family}. Indian National Classification of Occupations 2015 code ${occupation.code}.`,
        catalogUri: NCO_URL,
        catalogSource: "nco",
        catalogCode: occupation.code,
      })),
      ...Object.entries(PREPARATION).map(([key, preparation]) => ({
        id: preparation.id,
        slug: `career-preparation-${key}`,
        name: preparation.name,
        category: "Career preparation",
        description: "General Indian preparation milestone. Exact requirements vary by occupation, regulator and institution.",
        catalogUri: `career-maps:preparation:${key}`,
        catalogSource: "nco",
        catalogCode: `prep-${key}`,
      })),
    ],
  });

  const preparationEdges = occupations.map((occupation) => ({
    fromId: PREPARATION[preparationFor(occupation.division)].id,
    toId: roleId(occupation),
    durationYears: 0.5,
    skillsJson: "[]",
    origin: "catalog",
  }));
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

  await prisma.roleEdge.createMany({ data: [...preparationEdges, ...educationEdges] });
  await prisma.$executeRawUnsafe(`
    UPDATE Role
    SET inDegree = (SELECT COUNT(*) FROM RoleEdge WHERE RoleEdge.toId = Role.id),
        outDegree = (SELECT COUNT(*) FROM RoleEdge WHERE RoleEdge.fromId = Role.id),
        centrality = (SELECT COUNT(*) FROM RoleEdge WHERE RoleEdge.toId = Role.id OR RoleEdge.fromId = Role.id)
    WHERE catalogSource = 'nco'
  `);
  console.log(`imported ${occupations.length} Indian NCO-2015 occupations and ${preparationEdges.length + educationEdges.length} planning transitions`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
