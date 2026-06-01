// Local-only admin auth helper. No external API required.

export function getToken(): string | null {
  return localStorage.getItem("admin_token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("admin_token", token);
  } else {
    localStorage.removeItem("admin_token");
  }
}

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Adm!n@2025#SecureKey9x";

export function checkAdminCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function logoutAdmin() {
  setToken(null);
}

// NOTE: This app is local-only now. No backend API client initialization.
