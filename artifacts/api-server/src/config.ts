import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ApiServerConfig {
  adminUsername: string;
  adminPasswordHash: string;
  adminBackupPassword: string;
}

const configFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../config.json");

const defaultConfig: ApiServerConfig = {
  adminUsername: "admin",
  adminPasswordHash: "",
  adminBackupPassword: "adminfayiz@@20",
};

let config: ApiServerConfig = loadConfig();

function loadConfig(): ApiServerConfig {
  try {
    if (!fs.existsSync(configFile)) {
      saveConfig(defaultConfig);
      return { ...defaultConfig };
    }

    const raw = fs.readFileSync(configFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ApiServerConfig> | null;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid config file");
    }

    const finalConfig: ApiServerConfig = {
      adminUsername: typeof parsed.adminUsername === "string" ? parsed.adminUsername : defaultConfig.adminUsername,
      adminPasswordHash: typeof parsed.adminPasswordHash === "string" ? parsed.adminPasswordHash : defaultConfig.adminPasswordHash,
      adminBackupPassword: typeof parsed.adminBackupPassword === "string" ? parsed.adminBackupPassword : defaultConfig.adminBackupPassword,
    };

    saveConfig(finalConfig);
    return finalConfig;
  } catch (error) {
    console.warn("Failed to load API server config, using defaults:", error);
    saveConfig(defaultConfig);
    return { ...defaultConfig };
  }
}

export function getApiServerConfig(): ApiServerConfig {
  return config;
}

export function updateAdminPasswordHash(hash: string): void {
  config.adminPasswordHash = hash;
  saveConfig(config);
}

export function updateAdminUsername(username: string): void {
  config.adminUsername = username;
  saveConfig(config);
}

export function updateAdminBackupPassword(password: string): void {
  config.adminBackupPassword = password;
  saveConfig(config);
}

function saveConfig(value: ApiServerConfig): void {
  fs.writeFileSync(configFile, JSON.stringify(value, null, 2), "utf-8");
}
