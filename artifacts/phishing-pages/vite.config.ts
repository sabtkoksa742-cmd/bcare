import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getNetworkHost() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const addrs = interfaces[name];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return "localhost";
}

const rawPort = process.env.PORT || "4173";
const port = Number(rawPort);
const networkHost = process.env.VITE_HMR_HOST || getNetworkHost();

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";
// في الإنتاج، استخدم relative path `/api` للتوافق مع HTTPS
// في التطوير، استخدم absolute URL فقط إذا تم تعيينها بشكل صريح
const apiBaseUrl = process.env.VITE_API_BASE_URL || (process.env.NODE_ENV === "production" ? "/api" : `http://${process.env.VITE_API_HOST || networkHost}:${process.env.VITE_API_PORT || "5000"}/api`);

export default defineConfig({
  base: basePath,
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiBaseUrl),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@assets": path.resolve(__dirname, "src/assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(__dirname),
  build: {
    target: "es2017",
    cssTarget: "chrome61",
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    origin: process.env.VITE_ORIGIN || `http://${networkHost}:${port}`,
    hmr: {
      protocol: "ws",
      host: networkHost,
      clientPort: port,
      port,
    },
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
