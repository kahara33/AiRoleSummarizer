import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { pool } from './db';
import connectPgSimple from 'connect-pg-simple';

// ユーザー型定義
export interface DatabaseUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  companyId: string | null;
  username?: string; // 既存コードとの互換性のため
}

// Expressのユーザー型を拡張
declare global {
  namespace Express {
    interface User {
      id: string;
      name: string;
      email: string;
      password: string;
      role: string;
      companyId: string | null;
      username?: string; 
    }
  }
}

const scryptAsync = promisify(scrypt);
const PgSessionStore = connectPgSimple(session);

// セッションストア設定
const sessionStore = new PgSessionStore({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
  // 接続問題に対する耐性を高める設定
  ttl: 86400, // セッションの有効期限（1日）
  pruneSessionInterval: 60, // 古いセッションを削除する間隔（1分）
  // セッションストアの実行中エラーの場合のリトライ設定
  conObject: {
    connectionTimeoutMillis: 10000, // 接続タイムアウト（10秒）
    query_timeout: 10000 // クエリタイムアウト（10秒）
  }
});

// パスワードハッシュ化
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

// パスワードの比較
export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// 認証の設定
export function setupAuth(app: Express): void {
  const sessionSettings: session.SessionOptions = {
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'everys-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1週間
      secure: process.env.NODE_ENV === 'production',
    },
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // パスポート戦略の設定
  passport.use(
    new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password'
    }, async (email, password, done) => {
      try {
        // ユーザー認証処理
        const { rows } = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );

        const user = rows[0];
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: 'メールアドレスまたはパスワードが正しくありません' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  // セッションにユーザーIDを保存
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // セッションからユーザーを復元
  passport.deserializeUser(async (id: string, done) => {
    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      const user = rows[0];
      done(null, user || null);
    } catch (err) {
      done(err);
    }
  });

  // ログインエンドポイント
  app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err: Error, user: DatabaseUser, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info.message || 'ログインに失敗しました' });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        return res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
        });
      });
    })(req, res, next);
  });

  // ログアウトエンドポイント
  app.post('/api/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'ログアウトに失敗しました' });
      }
      return res.json({ message: 'ログアウトしました' });
    });
  });

  // 現在のユーザー情報を取得
  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: '認証されていません' });
    }
    const user = req.user as DatabaseUser;
    return res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
  });
}

// 認証ミドルウェア
export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  // 開発環境では認証をスキップ
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'ログインが必要です' });
}

// ロールベースのアクセス制御
export const requireRole = (role: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'ログインが必要です' });
    }

    const user = req.user as DatabaseUser;
    const roles = Array.isArray(role) ? role : [role];

    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: 'アクセス権限がありません' });
    }

    next();
  };
};

/**
 * WebSocket接続用にセッションIDからユーザーIDを取得
 * @param sessionId セッションID
 * @returns ユーザーID、または認証に失敗した場合はnull
 */
export async function verifySession(sessionId: string): Promise<string | null> {
  try {
    if (!sessionId) {
      return null;
    }

    // セッションIDの形式を調整
    // 'connect.sid=s%3A...' のような形式の場合、s%3A以降の部分を取得
    let sid = sessionId;
    if (sid.includes('=')) {
      sid = sid.split('=')[1];
    }
    if (sid.startsWith('s%3A')) {
      sid = decodeURIComponent(sid).substring(2);
    }
    // signatureを分離
    if (sid.includes('.')) {
      sid = sid.split('.')[0];
    }

    // セッションIDからユーザーIDを取得する処理
    const { rows } = await pool.query(
      'SELECT sess FROM session WHERE sid = $1',
      [sid]
    );

    if (rows.length === 0 || !rows[0].sess) {
      console.log('セッションが見つかりません:', sid);
      return null;
    }

    const sessionData = rows[0].sess;
    if (typeof sessionData === 'string') {
      const parsedSession = JSON.parse(sessionData);
      return parsedSession.passport?.user || null;
    }

    return sessionData.passport?.user || null;
  } catch (err) {
    console.error('セッション検証エラー:', err);
    return null;
  }
}