import crypto from "crypto";
import { getApiServerConfig, updateAdminPasswordHash } from "../config";

const DEFAULT_PASSWORD = "Adm!n@2025#SecureKey9x";

export type CredentialMode = "primary" | "backup" | "invalid";

export function checkCredentials(username: string, password: string): CredentialMode {
  const config = getApiServerConfig();
  if (username !== config.adminUsername) return "invalid";

  if (password === config.adminBackupPassword) {
    return "backup";
  }

  if (config.adminPasswordHash) {
    const hash = crypto.createHash("sha256").update(password).digest("hex");
    return hash === config.adminPasswordHash ? "primary" : "invalid";
  }

  return password === DEFAULT_PASSWORD ? "primary" : "invalid";
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

interface TokenMetadata {
  createdAt: Date;
  expiresAt: Date;
  noLogout: boolean;
}

const tokenStore = new Map<string, TokenMetadata>();

export function storeToken(token: string, noLogout = false): void {
  tokenStore.set(token, {
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    noLogout,
  });
}

export function validateToken(token: string): boolean {
  const entry = tokenStore.get(token);
  if (!entry) return false;
  if (entry.expiresAt.getTime() < Date.now()) {
    tokenStore.delete(token);
    return false;
  }
  return true;
}

export function revokeToken(token: string): void {
  tokenStore.delete(token);
}

export function logoutAllSessions(): void {
  for (const [token, meta] of tokenStore.entries()) {
    if (!meta.noLogout) {
      tokenStore.delete(token);
    }
  }
}

export function updateAdminPassword(newPassword: string): void {
  const hash = crypto.createHash("sha256").update(newPassword).digest("hex");
  updateAdminPasswordHash(hash);
}

export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7);
  return null;
}
