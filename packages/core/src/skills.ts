/**
 * Skill taxonomy + extractor.
 *
 * Scraped postings describe requirements in prose. To turn thousands of job
 * descriptions into "what this role actually requires today" we match against a
 * curated taxonomy rather than guessing at arbitrary n-grams, which keeps the
 * aggregated skill lists readable and stable enough to diff day over day.
 */

export type SkillCategory =
  | "language"
  | "framework"
  | "data"
  | "cloud"
  | "tooling"
  | "design"
  | "business"
  | "engineering"
  | "healthcare"
  | "finance"
  | "soft";

export interface SkillDefinition {
  name: string;
  category: SkillCategory;
  aliases?: string[];
  /**
   * Match only the aliases, never the canonical name.
   *
   * For skills whose name is an ordinary English word — Go, R, C — the bare token
   * appears constantly in prose ("go to market", "R&D"), so matching it produced
   * false positives on real postings. These require an unambiguous spelling.
   */
  aliasesOnly?: boolean;
}

export const SKILL_TAXONOMY: SkillDefinition[] = [
  // Languages
  { name: "JavaScript", category: "language", aliases: ["js", "ecmascript"] },
  { name: "TypeScript", category: "language", aliases: ["ts"] },
  { name: "Python", category: "language" },
  { name: "Java", category: "language" },
  { name: "C++", category: "language", aliases: ["cpp"] },
  { name: "C#", category: "language", aliases: ["csharp", ".net", "dotnet"] },
  { name: "Go", category: "language", aliases: ["golang", "go lang", "go developer", "go engineer"], aliasesOnly: true },
  { name: "Rust", category: "language" },
  { name: "Ruby", category: "language" },
  { name: "PHP", category: "language" },
  { name: "Swift", category: "language" },
  { name: "Kotlin", category: "language" },
  { name: "Scala", category: "language" },
  { name: "R", category: "language", aliases: ["r programming", "rstudio", "r language"], aliasesOnly: true },
  { name: "MATLAB", category: "language" },
  { name: "SQL", category: "language" },
  { name: "Bash", category: "language", aliases: ["shell scripting", "shell script"] },
  { name: "HTML", category: "language", aliases: ["html5"] },
  { name: "CSS", category: "language", aliases: ["css3", "scss", "sass", "tailwind"] },

  // Frameworks
  { name: "React", category: "framework", aliases: ["react.js", "reactjs"] },
  { name: "Vue", category: "framework", aliases: ["vue.js", "vuejs"] },
  { name: "Angular", category: "framework", aliases: ["angular.js", "angularjs"] },
  { name: "Svelte", category: "framework" },
  { name: "Next.js", category: "framework", aliases: ["nextjs"] },
  { name: "Node.js", category: "framework", aliases: ["nodejs", "node"] },
  { name: "Express", category: "framework", aliases: ["express.js"] },
  { name: "Django", category: "framework" },
  { name: "Flask", category: "framework" },
  { name: "FastAPI", category: "framework" },
  { name: "Spring Boot", category: "framework", aliases: ["spring"] },
  { name: "Rails", category: "framework", aliases: ["ruby on rails"] },
  { name: "Laravel", category: "framework" },
  { name: "Flutter", category: "framework" },
  { name: "React Native", category: "framework" },
  { name: "GraphQL", category: "framework" },
  { name: "REST APIs", category: "framework", aliases: ["rest api", "restful", "rest"] },

  // Data / ML
  { name: "Machine Learning", category: "data", aliases: ["ml"] },
  { name: "Deep Learning", category: "data" },
  { name: "PyTorch", category: "data" },
  { name: "TensorFlow", category: "data" },
  { name: "scikit-learn", category: "data", aliases: ["sklearn", "scikit learn"] },
  { name: "Pandas", category: "data" },
  { name: "NumPy", category: "data" },
  { name: "Spark", category: "data", aliases: ["pyspark", "apache spark"] },
  { name: "Airflow", category: "data", aliases: ["apache airflow"] },
  { name: "dbt", category: "data" },
  { name: "Snowflake", category: "data" },
  { name: "BigQuery", category: "data" },
  { name: "Kafka", category: "data", aliases: ["apache kafka"] },
  { name: "ETL", category: "data", aliases: ["elt", "data pipelines"] },
  { name: "Data Modelling", category: "data", aliases: ["data modeling", "dimensional modelling"] },
  { name: "Statistics", category: "data", aliases: ["statistical analysis"] },
  { name: "A/B Testing", category: "data", aliases: ["ab testing", "experimentation"] },
  { name: "NLP", category: "data", aliases: ["natural language processing"] },
  { name: "Computer Vision", category: "data", aliases: ["opencv"] },
  { name: "LLMs", category: "data", aliases: ["large language models", "generative ai", "genai", "prompt engineering", "rag"] },
  { name: "PostgreSQL", category: "data", aliases: ["postgres"] },
  { name: "MySQL", category: "data" },
  { name: "MongoDB", category: "data" },
  { name: "Redis", category: "data" },
  { name: "Elasticsearch", category: "data" },

  // Cloud / infra
  { name: "AWS", category: "cloud", aliases: ["amazon web services"] },
  { name: "Azure", category: "cloud", aliases: ["microsoft azure"] },
  { name: "GCP", category: "cloud", aliases: ["google cloud"] },
  { name: "Docker", category: "cloud", aliases: ["containers", "containerisation", "containerization"] },
  { name: "Kubernetes", category: "cloud", aliases: ["k8s"] },
  { name: "Terraform", category: "cloud", aliases: ["infrastructure as code", "iac"] },
  { name: "CI/CD", category: "cloud", aliases: ["ci cd", "continuous integration", "github actions", "jenkins"] },
  { name: "Linux", category: "cloud", aliases: ["unix"] },
  { name: "Observability", category: "cloud", aliases: ["monitoring", "prometheus", "grafana", "datadog"] },
  { name: "Microservices", category: "cloud" },
  { name: "System Design", category: "cloud", aliases: ["distributed systems", "scalability"] },

  // Tooling / practice
  { name: "Git", category: "tooling", aliases: ["github", "gitlab", "version control"] },
  { name: "Agile", category: "tooling", aliases: ["scrum", "kanban", "sprint planning"] },
  { name: "Testing", category: "tooling", aliases: ["unit testing", "test automation", "jest", "pytest", "cypress", "playwright", "selenium"] },
  { name: "Jira", category: "tooling", aliases: ["confluence"] },
  { name: "Excel", category: "tooling", aliases: ["microsoft excel", "spreadsheets", "advanced excel"] },
  { name: "Power BI", category: "tooling", aliases: ["powerbi"] },
  { name: "Tableau", category: "tooling" },
  { name: "SAP", category: "tooling" },
  { name: "Salesforce", category: "tooling", aliases: ["crm"] },

  // Design
  { name: "Figma", category: "design" },
  { name: "Adobe Photoshop", category: "design", aliases: ["photoshop"] },
  { name: "Adobe Illustrator", category: "design", aliases: ["illustrator"] },
  { name: "Adobe Premiere Pro", category: "design", aliases: ["premiere pro", "video editing"] },
  { name: "After Effects", category: "design", aliases: ["motion graphics"] },
  { name: "UI Design", category: "design", aliases: ["user interface design", "visual design"] },
  { name: "UX Research", category: "design", aliases: ["user research", "usability testing", "ux"] },
  { name: "Wireframing", category: "design", aliases: ["prototyping", "wireframes"] },
  { name: "Design Systems", category: "design" },
  { name: "Typography", category: "design" },
  { name: "Photography", category: "design", aliases: ["lighting", "natural and artificial lighting"] },

  // Business
  { name: "Product Management", category: "business", aliases: ["roadmapping", "product strategy"] },
  { name: "Project Management", category: "business", aliases: ["pmp", "programme management", "program management"] },
  { name: "Stakeholder Management", category: "business" },
  { name: "Digital Marketing", category: "business", aliases: ["seo", "sem", "google ads", "performance marketing"] },
  { name: "Content Writing", category: "business", aliases: ["copywriting", "technical writing"] },
  { name: "Sales", category: "business", aliases: ["business development", "lead generation"] },
  { name: "Customer Support", category: "business", aliases: ["customer service", "client servicing"] },
  { name: "Market Research", category: "business", aliases: ["competitive analysis"] },
  { name: "Operations", category: "business", aliases: ["supply chain", "logistics", "inventory management"] },
  // No "hr" alias: it matches hourly-rate text such as "$90-$170/hr".
  { name: "Human Resources", category: "business", aliases: ["recruitment", "talent acquisition", "human resource"] },

  // Core engineering (non-software)
  { name: "AutoCAD", category: "engineering", aliases: ["auto cad"] },
  { name: "SolidWorks", category: "engineering" },
  { name: "CATIA", category: "engineering" },
  { name: "ANSYS", category: "engineering", aliases: ["fea", "finite element analysis"] },
  // "automation" alone collides with "test automation" on software postings.
  { name: "PLC & SCADA", category: "engineering", aliases: ["plc", "scada", "industrial automation"] },
  { name: "Structural Analysis", category: "engineering", aliases: ["staad pro", "etabs", "rcc design"] },
  { name: "Surveying", category: "engineering", aliases: ["total station", "quantity surveying"] },
  { name: "Electrical Wiring", category: "engineering", aliases: ["switchgear", "transformers"] },
  { name: "Embedded Systems", category: "engineering", aliases: ["microcontrollers", "arduino", "raspberry pi", "vhdl", "verilog"] },
  { name: "Manufacturing Processes", category: "engineering", aliases: ["cnc", "welding", "machining", "lean manufacturing", "six sigma"] },
  { name: "HSE", category: "engineering", aliases: ["safety compliance", "occupational safety"] },

  // Healthcare
  { name: "Patient Care", category: "healthcare", aliases: ["nursing care", "bedside care"] },
  { name: "Clinical Diagnosis", category: "healthcare", aliases: ["diagnostics", "clinical assessment"] },
  { name: "Pharmacology", category: "healthcare", aliases: ["pharmacy practice", "dispensing"] },
  { name: "Medical Records", category: "healthcare", aliases: ["emr", "ehr", "medical coding"] },
  { name: "Laboratory Techniques", category: "healthcare", aliases: ["pathology", "microbiology", "phlebotomy"] },
  { name: "Radiology", category: "healthcare", aliases: ["x-ray", "mri", "ct scan", "sonography"] },

  // Finance / legal
  { name: "Accounting", category: "finance", aliases: ["bookkeeping", "tally", "book keeping"] },
  { name: "Financial Modelling", category: "finance", aliases: ["financial modeling", "valuation", "dcf"] },
  { name: "Taxation", category: "finance", aliases: ["gst", "income tax", "tds"] },
  { name: "Auditing", category: "finance", aliases: ["internal audit", "statutory audit"] },
  { name: "Banking Operations", category: "finance", aliases: ["retail banking", "kyc", "loan processing"] },
  { name: "Risk Management", category: "finance", aliases: ["credit risk", "compliance"] },
  { name: "Legal Research", category: "finance", aliases: ["drafting", "litigation", "contract law"] },

  // Soft skills
  { name: "Communication", category: "soft", aliases: ["verbal communication", "written communication"] },
  { name: "Leadership", category: "soft", aliases: ["team management", "people management", "mentoring"] },
  { name: "Problem Solving", category: "soft", aliases: ["analytical skills", "critical thinking"] },
  { name: "Teamwork", category: "soft", aliases: ["collaboration", "cross functional", "cross-functional"] },
  { name: "Time Management", category: "soft", aliases: ["prioritisation", "prioritization"] },
  { name: "Presentation Skills", category: "soft", aliases: ["public speaking"] },
  { name: "Attention to Detail", category: "soft" },
  { name: "Adaptability", category: "soft", aliases: ["flexibility"] },
];

export interface ExtractedSkill {
  name: string;
  category: SkillCategory;
  /** Number of times any alias of the skill appeared. */
  hits: number;
}

interface CompiledSkill {
  definition: SkillDefinition;
  pattern: RegExp;
}

let compiled: CompiledSkill[] | null = null;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Alias matching is whole-token based so that "R" doesn't match every capital R
 * and "Go" doesn't match "going". Trailing symbols (C++, C#, Node.js) can't use
 * `\b` on the right-hand side, so we assert "not followed by a word character".
 */
function compileSkills(): CompiledSkill[] {
  if (compiled) return compiled;
  compiled = SKILL_TAXONOMY.map((definition) => {
    const sources = definition.aliasesOnly ? (definition.aliases ?? []) : [definition.name, ...(definition.aliases ?? [])];
    const terms = sources
      .map((term) => escapeRegExp(term.toLowerCase()).replace(/\\?\s+/g, "[\\s_-]+"))
      .sort((a, b) => b.length - a.length);
    return {
      definition,
      // An empty alternation would match the empty string everywhere, so a skill
      // with no usable terms gets a pattern that can never match.
      pattern: terms.length
        ? new RegExp(`(?:^|[^a-z0-9+#.])(?:${terms.join("|")})(?![a-z0-9+#])`, "gi")
        : /(?!)/g,
    };
  });
  return compiled;
}

/** Pull known skills out of a job description / requirements blob. */
export function extractSkills(text: string): ExtractedSkill[] {
  if (!text) return [];
  const haystack = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const found: ExtractedSkill[] = [];

  for (const { definition, pattern } of compileSkills()) {
    pattern.lastIndex = 0;
    const hits = haystack.match(pattern)?.length ?? 0;
    if (hits > 0) found.push({ name: definition.name, category: definition.category, hits });
  }

  return found.sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name));
}

export type Seniority = "intern" | "entry" | "mid" | "senior" | "lead" | "executive";

/** Best-effort seniority read from a job title. */
export function detectSeniority(title: string): Seniority | null {
  const value = title.toLowerCase();
  if (/\b(intern|internship|trainee|apprentice)\b/.test(value)) return "intern";
  if (/\b(chief|cto|ceo|cfo|vp|vice president|director|head of)\b/.test(value)) return "executive";
  if (/\b(lead|principal|staff|architect|manager)\b/.test(value)) return "lead";
  if (/\b(senior|sr\.?|iii|iv)\b/.test(value)) return "senior";
  if (/\b(junior|jr\.?|entry|graduate|fresher|associate|i{1,2})\b/.test(value)) return "entry";
  return "mid";
}
