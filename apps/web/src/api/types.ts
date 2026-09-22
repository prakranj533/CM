export interface GraphNode {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  centrality: number;
  inDegree: number;
  outDegree: number;
  openings: number;
  summaryCount?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  durationYears: number;
  skills: string[];
}

export interface CareerGraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface RoleSummary {
  slug: string;
  name: string;
  category: string | null;
  centrality: number;
  nextSteps: number;
  openings: number;
}

export interface RoleLink {
  slug: string;
  name: string;
  durationYears: number;
  skills: string[];
}

export interface MarketSkill {
  name: string;
  category: string;
  demand: number;
  mentions: number;
}

export interface JobSummary {
  id: string;
  title: string;
  company: string;
  location: string | null;
  isRemote: boolean;
  url: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  seniority: string | null;
  postedAt: string | null;
  /** When we first saw the posting; used when the source publishes no date. */
  firstSeenAt?: string | null;
  sourceKey: string;
  role?: { slug: string; name: string } | null;
  skills?: Array<{ name: string; category: string }>;
}

export interface RoleDetail {
  role: { slug: string; name: string; category: string | null; description: string | null; centrality: number };
  nextSteps: RoleLink[];
  prerequisites: RoleLink[];
  curatedSkills: Array<{ name: string; category: string }>;
  marketSkills: MarketSkill[];
  market: {
    postings: number;
    remoteShare: number;
    avgSalaryMin: number | null;
    avgSalaryMax: number | null;
    seniority: Array<{ level: string; count: number }>;
  };
  recentJobs: JobSummary[];
}

export interface PathStep {
  roleId: string;
  slug: string;
  name: string;
  durationYears: number;
  skills: string[];
}

export interface CareerPath {
  steps: PathStep[];
  totalYears: number;
  skills: string[];
}

export interface PathsPayload {
  from: { slug: string; name: string };
  to: { slug: string; name: string };
  count: number;
  fastest: CareerPath | null;
  paths: CareerPath[];
  guidance: { essentialSkills: string[]; optionalSkills: string[]; source: string };
  subgraph: { nodes: Array<{ id: string; slug: string; name: string }>; edges: GraphEdge[] };
}

export interface JobsPayload {
  total: number;
  page: number;
  perPage: number;
  pages: number;
  jobs: JobSummary[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface SavedRoadmap {
  id: string;
  title: string;
  notes: string | null;
  createdAt: string;
  from: { slug: string; name: string };
  to: { slug: string; name: string };
  path: CareerPath | null;
}

export interface TrendMover {
  key: string;
  recent: number;
  previous: number;
  changePct: number | null;
  direction: "rising" | "falling" | "flat" | "new" | "unknown";
  insufficientData: boolean;
}

export interface TrendsPayload {
  dimension: string;
  windowDays: number;
  movers: TrendMover[];
  liveDays: number;
  daysNeeded: number;
  ready: boolean;
  explanation: string;
}

export interface FreshnessPayload {
  weeks: Array<{ weekStart: string; postings: number }>;
  liveCaptureDays: number;
  caveat: string;
}

export interface StatusPayload {
  registeredSources: Array<{ key: string; name: string; kind: string }>;
  sources: Array<{ key: string; name: string; homepage: string; kind: string; enabled: boolean; lastRunAt: string | null }>;
  runs: Array<{
    id: string;
    sourceKey: string;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    jobsFound: number;
    jobsNew: number;
    jobsMatched: number;
    message: string | null;
  }>;
  totals: { roles: number; jobs: number; jobsMatchedToRoles: number; schedule: string };
}
