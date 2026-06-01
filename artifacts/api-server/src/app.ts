import express, { type Express } from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const uiDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "phishing-pages", "dist");
const hasUiDist = fs.existsSync(uiDist);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (hasUiDist) {
  // تشغيل الملفات الثابتة للموقع تلقائياً من مسارها الأصلي
  app.use(express.static(uiDist));
  
  // دالة توجيه آمنة 100% وبدون نجمات لعدم إسقاط Express 5
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(uiDist, 'index.html'));
    }
    next();
  });
}

export default app;
