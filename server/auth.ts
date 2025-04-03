import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  console.log("認証システムをセットアップしています...");
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: false, // 開発環境ではfalse
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password',
    }, async (email, password, done) => {
      try {
        console.log("Passport認証開始:", { email });
        const user = await storage.getUserByEmail(email);
        
        if (!user) {
          console.log("ユーザーが見つかりません:", { email });
          return done(null, false, { message: "ユーザーが見つかりません" });
        }
        
        console.log("ユーザーが見つかりました。パスワード検証中:", { id: user.id, email: user.email });
        const isValidPassword = await comparePasswords(password, user.password);
        
        if (!isValidPassword) {
          console.log("パスワードが一致しません:", { email });
          return done(null, false, { message: "パスワードが正しくありません" });
        }
        
        console.log("認証成功:", { id: user.id, email: user.email });
        return done(null, user);
      } catch (error) {
        console.error("認証プロセスでエラーが発生:", error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Admin APIエンドポイントは別途実装します

  app.post("/api/login", (req, res, next) => {
    console.log("ログインリクエスト受信:", { email: req.body.email });
    
    passport.authenticate("local", (err: Error, user: SelectUser, info: any) => {
      if (err) {
        console.error("ログイン認証エラー:", err);
        return next(err);
      }
      if (!user) {
        console.log("ユーザー認証失敗:", { email: req.body.email });
        return res.status(401).json({ message: "Invalid email or password" });
      }
      
      console.log("ユーザー認証成功、セッション作成中:", { id: user.id, email: user.email });
      req.login(user, (err) => {
        if (err) {
          console.error("セッション作成エラー:", err);
          return next(err);
        }
        console.log("ログイン完了、レスポンス送信:", { id: user.id, email: user.email });
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // ロールベースの認可ミドルウェアはここには含めない
}

// 別途エクスポート
export const requireRole = (role: string | string[]) => {
  const roleArray = Array.isArray(role) ? role : [role];
  
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "認証が必要です" });
    }

    if (!roleArray.includes(req.user.role)) {
      return res.status(403).json({ message: "この操作を行う権限がありません" });
    }

    next();
  };
}