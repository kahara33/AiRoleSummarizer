// システム管理者ユーザーを作成するための簡易スクリプト
const crypto = require('crypto');
const { promisify } = require('util');
const fetch = require('node-fetch');

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function createAdminUser() {
  try {
    // 認証用の管理者ユーザー情報
    const hashedPassword = await hashPassword('3Bdf902@5155');
    
    // APIリクエストで新規ユーザーを作成
    const response = await fetch('http://localhost:5000/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'k.harada@everys.jp',
        name: '原田一樹',
        password: '3Bdf902@5155', // パスワードは平文で送信（APIでハッシュ化される）
        role: 'system_admin'
      }),
    });
    
    if (response.ok) {
      const user = await response.json();
      console.log('管理者ユーザーが正常に作成されました:', user);
    } else {
      const errorData = await response.text();
      console.error('管理者ユーザー作成中にエラーが発生しました:', errorData);
    }
  } catch (error) {
    console.error('スクリプト実行中にエラーが発生しました:', error);
  }
}

createAdminUser();