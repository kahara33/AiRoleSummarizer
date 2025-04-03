import { storage } from './server/storage.js';
import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function createAdminUser() {
  try {
    // 指定されたメールアドレスでユーザーが既に存在するか確認
    const existingUser = await storage.getUserByEmail('k.harada@everys.jp');
    
    if (existingUser) {
      console.log('ユーザーはすでに存在します:', existingUser);
      return;
    }
    
    // パスワードをハッシュ化
    const hashedPassword = await hashPassword('3Bdf902@5155');
    
    // 新しい管理者ユーザーを作成
    const adminUser = await storage.createUser({
      email: 'k.harada@everys.jp',
      name: '原田一樹',
      password: hashedPassword
    });
    
    console.log('管理者ユーザーが正常に作成されました:', adminUser);
  } catch (error) {
    console.error('管理者ユーザーの作成中にエラーが発生しました:', error);
  }
}

createAdminUser();