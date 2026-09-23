import type {
  AuthUser,
  CareerGraphPayload,
  CareerPath,
  JobsPayload,
  JobSummary,
  PathsPayload,
  RoleDetail,
  RoleSummary,
  FreshnessPayload,
  SavedRoadmap,
  StatusPayload,
  TrendsPayload,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    // Session lives in an httpOnly cookie, so every call must send credentials.
    credentials: "include",
    headers: init.body ? { "content-type": "application/json", ...init.headers } : init.headers,
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let details: Record<string, string[]> | undefined;
    try {
      const body = (await response.json()) as { error?: string; details?: Record<string, string[]> };
      if (body.error) message = body.error;
      details = body.details;
    } catch {
      // Non-JSON error body (proxy error, HTML page) — keep the generic message.
    }
    throw new ApiError(message, response.status, details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  graph: (family?: string, subfamily?: string, specialty?: string) =>
    request<CareerGraphPayload>(buildUrl("/api/graph", { family, subfamily, specialty })),
  graphOverview: (family?: string, subfamily?: string) =>
    request<CareerGraphPayload>(buildUrl("/api/graph/overview", { family, subfamily })),
  hubs: (limit = 15) =>
    request<{ hubs: Array<{ slug: string; name: string; centrality: number; inDegree: number; outDegree: number }> }>(
      buildUrl("/api/graph/hubs", { limit }),
    ),
  roles: (query: { search?: string; limit?: number } = {}) =>
    request<{ roles: RoleSummary[] }>(buildUrl("/api/roles", query)),
  role: (slug: string) => request<RoleDetail>(`/api/roles/${encodeURIComponent(slug)}`),
  paths: (from: string, to: string, maxPaths = 25) =>
    request<PathsPayload>(buildUrl("/api/paths", { from, to, maxPaths })),
  reachable: (slug: string) =>
    request<{ roles: Array<{ slug: string; name: string }> }>(`/api/paths/reachable/${encodeURIComponent(slug)}`),
  jobs: (query: Query = {}) => request<JobsPayload>(buildUrl("/api/jobs", query)),
  job: (id: string) =>
    request<{ job: JobSummary & { description: string; skills: Array<{ mentions: number; skill: { name: string; category: string } }> } }>(
      `/api/jobs/${encodeURIComponent(id)}`,
    ),
  trendingSkills: (limit = 25) =>
    request<{ skills: Array<{ name: string; category: string; postings: number }> }>(
      buildUrl("/api/skills/trending", { limit }),
    ),
  status: () => request<StatusPayload>("/api/status"),
  trends: (dimension = "skill", windowDays = 28, limit = 15) =>
    request<TrendsPayload>(buildUrl("/api/trends", { dimension, windowDays, limit })),
  freshness: (weeks = 12) => request<FreshnessPayload>(buildUrl("/api/trends/freshness", { weeks })),

  me: () => request<{ user: AuthUser | null; providers: { password: boolean; google: boolean } }>("/api/auth/me"),
  login: (email: string, password: string) =>
    request<{ user: AuthUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name?: string) =>
    request<{ user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

  roadmaps: () => request<{ roadmaps: SavedRoadmap[] }>("/api/me/roadmaps"),
  saveRoadmap: (payload: { from: string; to: string; title?: string; notes?: string; path: CareerPath }) =>
    request<{ roadmap: { id: string; title: string; createdAt: string } }>("/api/me/roadmaps", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteRoadmap: (id: string) =>
    request<{ ok: boolean }>(`/api/me/roadmaps/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
