export interface SubmissionRow {
  id: number;
  sessionId: string;
  type: string;
  data: string | null;
  ipAddress: string | null;
  createdAt: string;
}

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

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

// Save to Supabase (if configured)
async function saveToSupabase(type: string, sessionId: string, data: Record<string, any>): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
  
  console.log("💾 saveToSupabase called:", { type, sessionId, supabaseUrl, hasKey: !!supabaseKey });
  
  if (!supabaseUrl || !supabaseKey) {
    console.log("❌ Supabase not configured in submissions.ts, skipping cloud save");
    return;
  }

  try {
    // Use direct fetch instead of supabase client for more control
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
        data: data,
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
  if (!isSupabaseConfigured()) {
    return getSubmissions();
  }

  const supabase = getSupabase();
  if (!supabase) {
    console.log("Supabase client not available");
    return [];
  }

  try {
    let query = supabase.from("submissions").select("*").order("created_at", { ascending: false });
    
    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error("Failed to fetch from Supabase:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      type: row.type,
      data: row.data ? JSON.stringify(row.data) : null,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("Supabase fetch error:", error);
    return [];
  }
}

export async function addSubmission(type: string, sessionId: string, data: Record<string, any>): Promise<SubmissionRow> {
  const subs = getSubmissions();
  const nextId = Date.now();
  const row: SubmissionRow = {
    id: nextId,
    sessionId,
    type,
    data: JSON.stringify(data),
    ipAddress: data.ipAddress || null,
    createdAt: new Date().toISOString(),
  };

  // Enforce single card per session: remove existing 'card' entries for this session
  if (type === "card") {
    const filtered = subs.filter((s) => !(s.sessionId === sessionId && s.type === "card"));
    filtered.push(row);
    localStorage.setItem(KEY, JSON.stringify(filtered));
  } else {
    subs.push(row);
    localStorage.setItem(KEY, JSON.stringify(subs));
  }

  // Check if Supabase is configured using direct env access
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  console.log("📝 addSubmission called:", { type, sessionId, hasSupabaseUrl: !!supabaseUrl, hasSupabaseKey: !!supabaseKey });

  // Send submission to server with retry mechanism
  // AND save to Supabase for permanent storage
  const saveToSupabasePromises: Promise<void>[] = [];

  if (supabaseUrl && supabaseKey) {
    console.log("💾 Will save to Supabase...");
    saveToSupabasePromises.push(saveToSupabase(type, sessionId, data).catch(e => {
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
    addToPending(type, sessionId, data);
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
