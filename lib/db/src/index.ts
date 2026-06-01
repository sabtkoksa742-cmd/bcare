import { drizzle } from "drizzle-orm/node-postgres";
import { and, count, desc, eq } from "drizzle-orm";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

const { Pool } = pg;
const dataFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "db-store.json");

let db: unknown = null;
const store = {
  submissions: [] as schema.Submission[],
  nextId: 1,
};

function loadStore() {
  if (!fs.existsSync(dataFile)) return;
  try {
    const raw = fs.readFileSync(dataFile, "utf-8");
    const parsed = JSON.parse(raw) as {
      submissions: Array<Omit<schema.Submission, "createdAt"> & { createdAt: string }>;
      nextId: number;
    };
    store.nextId = parsed.nextId ?? 1;
    store.submissions = parsed.submissions.map((submission) => ({
      ...submission,
      createdAt: new Date(submission.createdAt),
    }));
  } catch (err) {
    console.warn("Failed to load persistent DB store, starting fresh:", err);
    store.submissions = [];
    store.nextId = 1;
  }
}

function saveStore() {
  try {
    fs.writeFileSync(
      dataFile,
      JSON.stringify(
        {
          nextId: store.nextId,
          submissions: store.submissions.map((submission) => ({
            ...submission,
            createdAt: submission.createdAt.toISOString(),
          })),
        },
        null,
        2,
      ),
      "utf-8",
    );
  } catch (err) {
    console.error("Failed to save persistent DB store:", err);
  }
}

loadStore();

if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  console.info("DATABASE_URL not set; using persistent disk fallback database");
}

export const submissionsTable = schema.submissionsTable;
export type { Submission, InsertSubmission } from "./schema";
export { db };

function createMemorySubmission(values: schema.InsertSubmission): schema.Submission {
  const row: schema.Submission = {
    id: store.nextId++,
    sessionId: values.sessionId,
    type: values.type,
    data: values.data ?? null,
    ipAddress: values.ipAddress ?? null,
    userAgent: values.userAgent ?? null,
    createdAt: new Date(),
  } as schema.Submission;
  store.submissions.push(row);
  saveStore();
  return row;
}

interface ListOptions {
  type?: string;
  sessionId?: string;
  limit?: number;
  offset?: number;
}

function getMemoryQuery(options: ListOptions = {}): schema.Submission[] {
  let rows = store.submissions.slice();

  if (options.type) {
    rows = rows.filter((row) => row.type === options.type);
  }
  if (options.sessionId) {
    rows = rows.filter((row) => row.sessionId === options.sessionId);
  }

  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 50;
  return rows.slice(offset, offset + limit);
}

export async function insertSubmission(values: schema.InsertSubmission): Promise<schema.Submission> {
  if (db) {
    const realDb = db as any;
    const [row] = await realDb.insert(submissionsTable).values(values).returning();
    return row;
  }

  return createMemorySubmission(values);
}

export async function listSubmissions(options: ListOptions = {}): Promise<schema.Submission[]> {
  if (db) {
    const realDb = db as any;
    let query = realDb
      .select()
      .from(submissionsTable)
      .orderBy(desc(submissionsTable.createdAt))
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0);

    if (options.type && options.sessionId) {
      query = query.where(
        and(eq(submissionsTable.type, options.type), eq(submissionsTable.sessionId, options.sessionId)),
      );
    } else if (options.type) {
      query = query.where(eq(submissionsTable.type, options.type));
    } else if (options.sessionId) {
      query = query.where(eq(submissionsTable.sessionId, options.sessionId));
    }

    return query;
  }

  return getMemoryQuery(options);
}

export async function countSubmissions(options: ListOptions = {}): Promise<number> {
  if (db) {
    const realDb = db as any;
    let query = realDb.select({ value: count() }).from(submissionsTable);

    if (options.type && options.sessionId) {
      query = query.where(
        and(eq(submissionsTable.type, options.type), eq(submissionsTable.sessionId, options.sessionId)),
      );
    } else if (options.type) {
      query = query.where(eq(submissionsTable.type, options.type));
    } else if (options.sessionId) {
      query = query.where(eq(submissionsTable.sessionId, options.sessionId));
    }

    const [{ value }] = await query;
    return Number(value);
  }

  return getMemoryQuery(options).length;
}

export async function getAllSubmissions(): Promise<schema.Submission[]> {
  if (db) {
    const realDb = db as any;
    return realDb.select().from(submissionsTable).orderBy(desc(submissionsTable.createdAt));
  }

  return store.submissions.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
