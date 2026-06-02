// BlockScreen - Fullscreen ban overlay for blocked users
import { useEffect, useState, useCallback } from "react";
import { ShieldX } from "lucide-react";

interface BlockScreenProps {
  message?: string;
}

const LOCAL_BLOCKED_KEY = "admin_blocked_sessions";

export function BlockScreen({ message = "تم حظر وصولك إلى الموقع بسبب عدم اتباع السياسة والشروط" }: BlockScreenProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_20%,#000_70%)]" />
      </div>
      
      {/* Content */}
      <div className="relative z-10 max-w-md mx-auto px-6 text-center">
        {/* Icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full blur-xl opacity-50 animate-pulse" />
            <div className="relative w-24 h-24 bg-red-600 rounded-full flex items-center justify-center">
              <ShieldX className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-4">
          تم الحظر
        </h1>
        
        {/* Message */}
        <p className="text-lg text-slate-300 leading-relaxed">
          {message}
        </p>
        
        {/* Decorative elements */}
        <div className="mt-10 flex justify-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
      
      {/* Footer note */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-xs text-slate-500">
          لا يمكنك تجاوز هذه الرسالة
        </p>
      </div>
    </div>
  );
}

// Check if session is blocked in localStorage
function isSessionBlockedLocally(sessionId: string): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_BLOCKED_KEY);
    if (!raw) return false;
    
    const blockedSessions = JSON.parse(raw);
    return blockedSessions.some((item: { sessionId: string }) => item.sessionId === sessionId);
  } catch {
    return false;
  }
}

// Hook to check and persist blocked state
export function useBlockedState(sessionId: string): boolean {
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  
  // Check localStorage for immediate blocking
  useEffect(() => {
    // Check local blocked sessions list
    if (isSessionBlockedLocally(sessionId)) {
      setIsBlocked(true);
      return;
    }
    
    // Poll Supabase for block status
    const checkBlockStatus = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) return;
        
        // Check blocked_sessions table
        const response = await fetch(
          `${supabaseUrl}/rest/v1/blocked_sessions?session_id=eq.${sessionId}&select=*&limit=1`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
            },
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            setIsBlocked(true);
          }
        }
      } catch (error) {
        console.error("Error checking block status:", error);
      }
    };
    
    // Initial check
    checkBlockStatus();
    
    // Poll every 3 seconds for block status
    const interval = setInterval(checkBlockStatus, 3000);
    
    return () => clearInterval(interval);
  }, [sessionId]);
  
  return isBlocked;
}

// Clear block state (for admin/testing purposes)
export function clearBlockState(): void {
  localStorage.removeItem("bcare_user_blocked");
  localStorage.removeItem("bcare_blocked_session");
}