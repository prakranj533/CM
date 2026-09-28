import { createHash } from "node:crypto";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, getFirestore, Timestamp, type DocumentData, type Query } from "firebase-admin/firestore";
import { env } from "./env.js";

if (env.NODE_ENV !== "production" && !process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

const app = getApps()[0] ?? initializeApp({
  ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() }),
  projectId: env.FIREBASE_PROJECT_ID,
});

export const firestore = getFirestore(app);
firestore.settings({ ignoreUndefinedProperties: true });

export interface RoleSkillRecord {
  name: string;
  category: string;
  origin: "graph" | "jobs";
  demand: number;
  mentions: number;
}

export interface RoleRecord {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  catalogUri: string | null;
  catalogSource: string | null;
  catalogCode: string | null;
  centrality: number;
  inDegree: number;
  outDegree: number;
  openingCount: number;
  nameLower: string;
  aliases: string[];
  skills: RoleSkillRecord[];
  incoming: RoleEdgeRecord[];
  outgoing: RoleEdgeRecord[];
  updatedAt: Date;
}

export interface RoleEdgeRecord {
  id: string;
  fromId: string;
  toId: string;
  durationYears: number;
  skills: string[];
  origin: "curated" | "catalog";
}

export interface JobSkillRecord {
  name: string;
  category: string;
  mentions: number;
}

export interface JobRecord {
  id: string;
  sourceKey: string;
  externalId: string;
  url: string;
  title: string;
  company: string;
  location: string | null;
  isRemote: boolean;
  description: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  seniority: string | null;
  postedAt: Date | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  roleId: string | null;
  roleSlug: string | null;
  roleName: string | null;
  matchScore: number;
  matchReason: string | null;
  skills: JobSkillRecord[];
  skillNames: string[];
  searchTokens: string[];
}

export interface SourceRecord {
  key: string;
  name: string;
  homepage: string;
  kind: string;
  enabled: boolean;
  lastRunAt: Date | null;
}

export interface IngestRunRecord {
  id: string;
  sourceKey: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  jobsFound: number;
  jobsNew: number;
  jobsMatched: number;
  message: string | null;
}

export interface DemandSnapshotRecord {
  id: string;
  day: Date;
  dimension: "total" | "skill" | "role" | "source";
  key: string;
  created: number;
  active: number | null;
  origin: "live" | "backfill";
}

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface RoadmapRecord {
  id: string;
  userId: string;
  fromId: string;
  toId: string;
  from: { slug: string; name: string };
  to: { slug: string; name: string };
  title: string;
  path: unknown;
  notes: string | null;
  createdAt: Date;
}

export interface OAuthAccountRecord {
  id: string;
  provider: string;
  providerUserId: string;
  userId: string;
}

export function collection(name: string) {
  return firestore.collection(name);
}

export function stableId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function readDocument<T>(data: DocumentData, id: string): T {
  return { ...(convertDates(data) as DocumentData), id } as T;
}

export function convertDates(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(convertDates);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, convertDates(entry)]));
  }
  return value;
}

export async function queryDocuments<T>(query: Query): Promise<T[]> {
  const snapshot = await query.get();
  return snapshot.docs.map((document) => readDocument<T>(document.data(), document.id));
}

export async function allDocuments<T>(name: string): Promise<T[]> {
  return queryDocuments<T>(collection(name));
}

export async function writeBatch<T extends { id: string }>(name: string, records: T[], merge = false): Promise<void> {
  for (let start = 0; start < records.length; start += 450) {
    const batch = firestore.batch();
    for (const record of records.slice(start, start + 450)) {
      const { id, ...data } = record;
      batch.set(collection(name).doc(id), data, { merge });
    }
    await batch.commit();
  }
}

export async function deleteBatch(name: string, ids: string[]): Promise<void> {
  for (let start = 0; start < ids.length; start += 450) {
    const batch = firestore.batch();
    for (const id of ids.slice(start, start + 450)) batch.delete(collection(name).doc(id));
    await batch.commit();
  }
}

export const documentId = FieldPath.documentId();
