import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { USER_ROLES } from "@shared/schema";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// ハッシュ化のためのヘルパー関数
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// システム管理者ユーザーを初期化する関数
async function initializeAdminUser() {
  try {
    // すでに管理者ユーザーが存在するか確認
    const existingAdmin = await storage.getUserByEmail('k.harada@everys.jp');
    
    if (existingAdmin) {
      log('管理者ユーザーが既に存在しています');
      return;
    }
    
    // パスワードをハッシュ化
    const hashedPassword = await hashPassword('3Bdf902@5155');
    
    // 管理者ユーザーを作成
    const adminUser = await storage.createUser({
      email: 'k.harada@everys.jp',
      name: '原田一樹',
      password: hashedPassword,
      role: USER_ROLES.SYSTEM_ADMIN
    });
    
    log('システム管理者ユーザーを初期化しました:', adminUser.id);
  } catch (error) {
    console.error('管理者ユーザーの初期化中にエラーが発生しました:', error);
  }
}

(async () => {
  // サーバー起動前に管理者ユーザーを初期化
  await initializeAdminUser();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
