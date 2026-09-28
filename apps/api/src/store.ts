import { collection, firestore, queryDocuments, readDocument, stableId, writeBatch, deleteBatch, type DemandSnapshotRecord, type IngestRunRecord, type JobRecord, type OAuthAccountRecord, type RoleEdgeRecord, type RoleRecord, type RoadmapRecord, type SessionRecord, type SourceRecord, type UserRecord } from "./firestore.js";

let roleCache: { expiresAt: number; records: RoleRecord[] } | null = null;
let roleLoad: Promise<RoleRecord[]> | null = null;

export async function allRoles(): Promise<RoleRecord[]> {
  if (roleCache && roleCache.expiresAt > Date.now()) return [...roleCache.records];
  roleLoad ??= queryDocuments<RoleRecord>(collection("roles"));
  try {
    const records = await roleLoad;
    roleCache = { expiresAt: Date.now() + 30_000, records };
    return [...records];
  } finally {
    roleLoad = null;
  }
}

export async function roleById(id: string): Promise<RoleRecord | null> {
  const snapshot = await collection("roles").doc(id).get();
  return snapshot.exists ? readDocument<RoleRecord>(snapshot.data() ?? {}, snapshot.id) : null;
}

export async function roleBySlug(slug: string): Promise<RoleRecord | null> {
  const snapshot = await collection("roles").where("slug", "==", slug).limit(1).get();
  const document = snapshot.docs[0];
  return document ? readDocument<RoleRecord>(document.data(), document.id) : null;
}

export async function saveRoles(roles: RoleRecord[], merge = true): Promise<void> {
  await writeBatch("roles", roles, merge);
  roleCache = null;
}

export async function deleteRoles(ids: string[]): Promise<void> {
  await deleteBatch("roles", ids);
  roleCache = null;
}

export function edgeId(fromId: string, toId: string): string {
  return stableId(`${fromId}:${toId}`);
}

export function allRoleEdges(roles: RoleRecord[]): RoleEdgeRecord[] {
  const byId = new Map<string, RoleEdgeRecord>();
  for (const role of roles) for (const edge of role.outgoing ?? []) byId.set(edge.id, edge);
  return [...byId.values()];
}

export interface JobFilter {
  roleId?: string;
  roleSlug?: string;
  skill?: string;
  seniority?: string;
  remote?: boolean;
  sourceKey?: string;
  lastSeenAfter?: Date;
  lastSeenBefore?: Date;
  postedAfter?: Date;
  search?: string;
}

export async function findJobs(filter: JobFilter = {}): Promise<JobRecord[]> {
  const tokens = searchTokens(filter.search ?? "");
  let query = collection("jobs");
  if (filter.roleId) query = query.where("roleId", "==", filter.roleId) as typeof query;
  else if (filter.roleSlug) query = query.where("roleSlug", "==", filter.roleSlug) as typeof query;
  else if (filter.skill) query = query.where("skillNames", "array-contains", filter.skill) as typeof query;
  else if (filter.sourceKey) query = query.where("sourceKey", "==", filter.sourceKey) as typeof query;
  else if (filter.seniority) query = query.where("seniority", "==", filter.seniority) as typeof query;
  else if (filter.remote !== undefined) query = query.where("isRemote", "==", filter.remote) as typeof query;
  else if (filter.lastSeenAfter) query = query.where("lastSeenAt", ">=", filter.lastSeenAfter) as typeof query;
  else if (filter.lastSeenBefore) query = query.where("lastSeenAt", "<", filter.lastSeenBefore) as typeof query;
  else if (filter.postedAfter) query = query.where("postedAt", ">=", filter.postedAfter) as typeof query;
  else if (tokens.length) query = query.where("searchTokens", "array-contains-any", tokens) as typeof query;

  let jobs = await queryDocuments<JobRecord>(query);
  if (filter.roleId) jobs = jobs.filter((job) => job.roleId === filter.roleId);
  if (filter.roleSlug) jobs = jobs.filter((job) => job.roleSlug === filter.roleSlug);
  if (filter.skill) jobs = jobs.filter((job) => job.skillNames.includes(filter.skill!));
  if (filter.seniority) jobs = jobs.filter((job) => job.seniority === filter.seniority);
  if (filter.remote !== undefined) jobs = jobs.filter((job) => job.isRemote === filter.remote);
  if (filter.sourceKey) jobs = jobs.filter((job) => job.sourceKey === filter.sourceKey);
  if (filter.lastSeenAfter) jobs = jobs.filter((job) => job.lastSeenAt >= filter.lastSeenAfter!);
  if (filter.lastSeenBefore) jobs = jobs.filter((job) => job.lastSeenAt < filter.lastSeenBefore!);
  if (filter.postedAfter) jobs = jobs.filter((job) => job.postedAt !== null && job.postedAt >= filter.postedAfter!);
  if (filter.search) {
    const term = filter.search.trim().toLowerCase();
    jobs = jobs.filter((job) => `${job.title} ${job.company} ${job.description}`.toLowerCase().includes(term));
  }
  return jobs;
}

export function searchTokens(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[\p{L}\p{N}+#.]{2,}/gu) ?? [])].slice(0, 200);
}

export function jobIdForExternal(sourceKey: string, externalId: string): string {
  return stableId(`${sourceKey}:${externalId}`);
}

export async function allJobs(): Promise<JobRecord[]> {
  return queryDocuments<JobRecord>(collection("jobs"));
}

export async function jobById(id: string): Promise<JobRecord | null> {
  const snapshot = await collection("jobs").doc(id).get();
  return snapshot.exists ? readDocument<JobRecord>(snapshot.data() ?? {}, snapshot.id) : null;
}

export async function saveJob(job: JobRecord): Promise<boolean> {
  const ref = collection("jobs").doc(job.id);
  const urlRef = collection("jobUrls").doc(stableId(job.url));
  return firestore.runTransaction(async (transaction) => {
    const [oldSnapshot, urlSnapshot] = await Promise.all([transaction.get(ref), transaction.get(urlRef)]);
    if (urlSnapshot.exists && urlSnapshot.get("jobId") !== job.id) throw new Error("Posting URL already belongs to another job");
    const old = oldSnapshot.exists ? readDocument<JobRecord>(oldSnapshot.data() ?? {}, oldSnapshot.id) : null;
    const oldUrlRef = old && old.url !== job.url ? collection("jobUrls").doc(stableId(old.url)) : null;
    const oldUrlSnapshot = oldUrlRef ? await transaction.get(oldUrlRef) : null;
    transaction.set(ref, job);
    transaction.set(urlRef, { jobId: job.id });
    if (oldUrlRef && oldUrlSnapshot?.get("jobId") === job.id) transaction.delete(oldUrlRef);
    return !oldSnapshot.exists;
  });
}

export async function deleteJobs(jobs: JobRecord[]): Promise<void> {
  for (let start = 0; start < jobs.length; start += 225) {
    const batch = firestore.batch();
    for (const job of jobs.slice(start, start + 225)) {
      batch.delete(collection("jobs").doc(job.id));
      batch.delete(collection("jobUrls").doc(stableId(job.url)));
    }
    await batch.commit();
  }
}

export async function upsertSource(source: SourceRecord): Promise<void> {
  await collection("sources").doc(source.key).set(source, { merge: true });
}

export async function sourceByKey(key: string): Promise<SourceRecord | null> {
  const snapshot = await collection("sources").doc(key).get();
  return snapshot.exists ? readDocument<SourceRecord>(snapshot.data() ?? {}, snapshot.id) : null;
}

export async function allSources(): Promise<SourceRecord[]> {
  return queryDocuments<SourceRecord>(collection("sources").orderBy("key"));
}

export async function saveIngestRun(run: IngestRunRecord): Promise<void> {
  await collection("ingestRuns").doc(run.id).set(run, { merge: true });
}

export async function recentIngestRuns(limit: number): Promise<IngestRunRecord[]> {
  return queryDocuments<IngestRunRecord>(collection("ingestRuns").orderBy("startedAt", "desc").limit(limit));
}

export async function saveSnapshot(snapshot: DemandSnapshotRecord): Promise<void> {
  const id = stableId(`${snapshot.day.toISOString()}|${snapshot.dimension}|${snapshot.key}`);
  await collection("demandSnapshots").doc(id).set({ ...snapshot, id }, { merge: true });
}

export async function findSnapshot(day: Date, dimension: string, key: string): Promise<DemandSnapshotRecord | null> {
  const id = stableId(`${day.toISOString()}|${dimension}|${key}`);
  const snapshot = await collection("demandSnapshots").doc(id).get();
  return snapshot.exists ? readDocument<DemandSnapshotRecord>(snapshot.data() ?? {}, snapshot.id) : null;
}

export async function querySnapshots(options: {
  dimension?: string;
  key?: string;
  origin?: string;
  from?: Date;
}): Promise<DemandSnapshotRecord[]> {
  let query = collection("demandSnapshots");
  if (options.dimension) query = query.where("dimension", "==", options.dimension) as typeof query;
  if (options.key) query = query.where("key", "==", options.key) as typeof query;
  if (options.origin) query = query.where("origin", "==", options.origin) as typeof query;
  if (options.from) query = query.where("day", ">=", options.from) as typeof query;
  return queryDocuments<DemandSnapshotRecord>(query.orderBy("day", "asc"));
}

export async function saveUser(user: UserRecord): Promise<void> {
  await collection("users").doc(user.id).set(user, { merge: true });
}

export async function userById(id: string): Promise<UserRecord | null> {
  const snapshot = await collection("users").doc(id).get();
  return snapshot.exists ? readDocument<UserRecord>(snapshot.data() ?? {}, snapshot.id) : null;
}

export async function userByEmail(email: string): Promise<UserRecord | null> {
  const snapshot = await collection("users").where("email", "==", email.toLowerCase()).limit(1).get();
  const document = snapshot.docs[0];
  return document ? readDocument<UserRecord>(document.data(), document.id) : null;
}

export async function createUserIfEmailAvailable(user: UserRecord): Promise<boolean> {
  const ref = collection("users").doc(user.id);
  const emailRef = collection("userEmails").doc(stableId(user.email.toLowerCase()));
  return firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(emailRef);
    if (existing.exists) return false;
    transaction.create(ref, user);
    transaction.create(emailRef, { userId: user.id });
    return true;
  });
}

export async function updateUser(user: UserRecord): Promise<void> {
  await collection("users").doc(user.id).set(user, { merge: true });
}

export async function linkOAuthUser(account: OAuthAccountRecord, profile: UserRecord): Promise<UserRecord> {
  const accountRef = collection("oauthAccounts").doc(stableId(`${account.provider}:${account.providerUserId}`));
  const emailRef = collection("userEmails").doc(stableId(profile.email.toLowerCase()));
  return firestore.runTransaction(async (transaction) => {
    const linked = await transaction.get(accountRef);
    if (linked.exists) {
      const linkedUser = await transaction.get(collection("users").doc(String(linked.get("userId"))));
      if (linkedUser.exists) return readDocument<UserRecord>(linkedUser.data() ?? {}, linkedUser.id);
    }
    const email = await transaction.get(emailRef);
    const userId = email.exists ? String(email.get("userId")) : profile.id;
    const userRef = collection("users").doc(userId);
    const existingUser = email.exists ? await transaction.get(userRef) : null;
    const user = existingUser?.exists
      ? { ...readDocument<UserRecord>(existingUser.data() ?? {}, existingUser.id), name: profile.name ?? existingUser.get("name") ?? null, avatarUrl: profile.avatarUrl ?? existingUser.get("avatarUrl") ?? null }
      : { ...profile, id: userId };
    if (existingUser?.exists) transaction.set(userRef, { name: user.name, avatarUrl: user.avatarUrl }, { merge: true });
    else {
      transaction.create(userRef, user);
      if (!email.exists) transaction.create(emailRef, { userId });
    }
    transaction.set(accountRef, { ...account, userId });
    return user;
  });
}

export async function saveSession(session: SessionRecord): Promise<void> {
  await collection("sessions").doc(session.id).set(session);
}

export async function sessionById(id: string): Promise<SessionRecord | null> {
  const snapshot = await collection("sessions").doc(id).get();
  return snapshot.exists ? readDocument<SessionRecord>(snapshot.data() ?? {}, snapshot.id) : null;
}

export async function deleteSession(id: string): Promise<void> {
  await collection("sessions").doc(id).delete();
}

export async function deleteExpiredSessions(now: Date): Promise<number> {
  const snapshot = await collection("sessions").where("expiresAt", "<", now).get();
  await deleteBatch("sessions", snapshot.docs.map((document) => document.id));
  return snapshot.size;
}

export async function roadmapList(userId: string): Promise<RoadmapRecord[]> {
  return queryDocuments<RoadmapRecord>(collection("roadmaps").where("userId", "==", userId).orderBy("createdAt", "desc"));
}

export async function saveRoadmap(roadmap: RoadmapRecord): Promise<void> {
  await collection("roadmaps").doc(roadmap.id).set(roadmap);
}

export async function deleteRoadmap(id: string, userId: string): Promise<boolean> {
  const ref = collection("roadmaps").doc(id);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get("userId") !== userId) return false;
    transaction.delete(ref);
    return true;
  });
}

export async function saveOAuthAccount(account: OAuthAccountRecord): Promise<void> {
  await collection("oauthAccounts").doc(stableId(`${account.provider}:${account.providerUserId}`)).set(account);
}

export async function oauthAccount(provider: string, providerUserId: string): Promise<OAuthAccountRecord | null> {
  const id = stableId(`${provider}:${providerUserId}`);
  const snapshot = await collection("oauthAccounts").doc(id).get();
  return snapshot.exists ? readDocument<OAuthAccountRecord>(snapshot.data() ?? {}, snapshot.id) : null;
}

export async function matchedJobCount(): Promise<number> {
  return (await collection("jobs").where("roleId", "!=", null).count().get()).data().count;
}

export async function countJobs(filter: JobFilter = {}): Promise<number> {
  return (await findJobs(filter)).length;
}

export async function setBatch<T extends { id: string }>(name: string, documents: T[]): Promise<void> {
  await writeBatch(name, documents, true);
}
