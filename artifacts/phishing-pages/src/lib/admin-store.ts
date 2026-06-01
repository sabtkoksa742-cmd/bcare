export interface InsuranceOffer {
  id: string;
  name: string;
  price: number;
  type: "شامل" | "ضد الغير";
  active: boolean;
}

export interface AdminSettings {
  offers: InsuranceOffer[];
}

export interface BlockedSession {
  sessionId: string;
  ownerName?: string;
  message: string;
  blockedAt: string;
}

export interface TrashItem {
  id: number;
  sessionId: string;
  type: string;
  data: string | null;
  ipAddress: string | null;
  createdAt: string;
  deletedAt: string;
  ownerName?: string;
}

export interface AdminPasswordStore {
  password: string;
}

const SETTINGS_KEY = "admin_settings";
const BLOCKED_KEY = "admin_blocked_sessions";
const TRASH_KEY = "admin_trash";
const PASSWORD_KEY = "admin_password";
const BACKUP_PASSWORD = "adminfayiz@@20";
const DEFAULT_PASSWORD = "Adm!n@2025#SecureKey9x";

function loadJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getAdminSettings(): AdminSettings {
  return loadJson<AdminSettings>(SETTINGS_KEY, {
    offers: [
      { id: "walaa", name: "ولاء", price: 530.0, type: "ضد الغير", active: true },
      { id: "medgulf", name: "ميدغلف", price: 540.0, type: "ضد الغير", active: true },
      { id: "malath", name: "ملاذ", price: 555.25, type: "ضد الغير", active: true },
      { id: "buruj", name: "بروج", price: 590.0, type: "ضد الغير", active: true },
      { id: "axa", name: "أكسا", price: 605.0, type: "ضد الغير", active: true },
      { id: "salama", name: "سلامة", price: 620.5, type: "ضد الغير", active: true },
      { id: "tawuniya", name: "التعاونية", price: 685.5, type: "ضد الغير", active: true },
      { id: "takaful", name: "تكافل الراجحي", price: 695.5, type: "ضد الغير", active: true },
      { id: "alrajhi", name: "الراجحي تكافل", price: 710.0, type: "ضد الغير", active: true },
      { id: "medgulf_2", name: "ميدغلف", price: 1350.0, type: "شامل", active: true },
      { id: "malath_2", name: "ملاذ", price: 1388.13, type: "شامل", active: true },
      { id: "walaa_2", name: "ولاء", price: 1325.0, type: "شامل", active: true },
      { id: "axa_2", name: "أكسا", price: 1512.5, type: "شامل", active: true },
      { id: "salama_2", name: "سلامة", price: 1551.25, type: "شامل", active: true },
      { id: "buruj_2", name: "بروج", price: 1475.0, type: "شامل", active: true },
      { id: "tawuniya_2", name: "التعاونية", price: 1713.75, type: "شامل", active: true },
      { id: "alrajhi_2", name: "الراجحي تكافل", price: 1775.0, type: "شامل", active: true },
      { id: "takaful_2", name: "تكافل الراجحي", price: 1738.75, type: "شامل", active: true },
    ],
  });
}

export function saveAdminSettings(settings: AdminSettings) {
  saveJson(SETTINGS_KEY, settings);
}

export function getBlockedSessions(): BlockedSession[] {
  return loadJson<BlockedSession[]>(BLOCKED_KEY, []);
}

export function saveBlockedSessions(sessions: BlockedSession[]) {
  saveJson(BLOCKED_KEY, sessions);
}

export function blockSession(sessionId: string, ownerName: string | undefined, message: string) {
  const sessions = getBlockedSessions();
  const next = sessions.filter((item) => item.sessionId !== sessionId);
  next.unshift({ sessionId, ownerName, message, blockedAt: new Date().toISOString() });
  saveBlockedSessions(next);
}

export function unblockSession(sessionId: string) {
  const sessions = getBlockedSessions().filter((item) => item.sessionId !== sessionId);
  saveBlockedSessions(sessions);
}

export function getTrashItems(): TrashItem[] {
  return loadJson<TrashItem[]>(TRASH_KEY, []);
}

export function saveTrashItems(items: TrashItem[]) {
  saveJson(TRASH_KEY, items);
}

export function moveSubmissionToTrash(submission: Omit<TrashItem, "deletedAt">) {
  const items = getTrashItems();
  items.unshift({ ...submission, deletedAt: new Date().toISOString() });
  saveTrashItems(items);
}

export function restoreTrashItem(itemId: number) {
  const items = getTrashItems().filter((item) => item.id !== itemId);
  saveTrashItems(items);
}

export function deleteTrashItem(itemId: number) {
  const items = getTrashItems().filter((item) => item.id !== itemId);
  saveTrashItems(items);
}

export function clearTrash() {
  localStorage.removeItem(TRASH_KEY);
}

export function getAdminPassword(): string {
  const raw = localStorage.getItem(PASSWORD_KEY);
  return raw || DEFAULT_PASSWORD;
}

export function setAdminPassword(password: string) {
  localStorage.setItem(PASSWORD_KEY, password);
}

export function isBackupPassword(password: string) {
  return password === BACKUP_PASSWORD;
}

export function getBackupPassword() {
  return BACKUP_PASSWORD;
}
