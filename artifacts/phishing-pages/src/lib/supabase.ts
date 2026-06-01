import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase(): ReturnType<typeof createClient> | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("⚠️ Supabase not configured - missing URL or ANON_KEY");
    return null;
  }
  
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("✅ Supabase client initialized");
  }
  
  return supabaseInstance;
}

export const supabase = null as unknown as ReturnType<typeof createClient>;

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};