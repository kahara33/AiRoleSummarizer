import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESMでの__dirnameの代替
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// server/routes.tsのパス
const routesPath = path.join(process.cwd(), 'server/routes.ts');

// ファイル内容を読み込む
let content = fs.readFileSync(routesPath, 'utf-8');

// 複数のパターンを修正
const patterns = [
  // パターン1: shared/isSharedフィールドの長い判定
  {
    regex: /\/\/ 組織内共有の場合は、shared\/isSharedフィールドと組織IDをチェック\s+const tableColumns = Object\.keys\(roleModels?\);\s+const hasIsSharedField = tableColumns\.includes\('isShared'\);\s+const hasSharedField = tableColumns\.includes\('shared'\);\s+\s+const isShared = hasIsSharedField \? roleModel\.isShared === 1 :\s+hasSharedField \? roleModel\.shared === true : false;/g,
    replacement: '// 組織内共有の場合は、isSharedフィールドと組織IDをチェック\n      const isShared = roleModel.isShared === 1;'
  },
  // パターン2: roleModel.sharedの参照
  {
    regex: /roleModel\.shared/g,
    replacement: 'roleModel.isShared'
  },
  // パターン3: node.roleModel.sharedの参照
  {
    regex: /node\.roleModel\.shared/g,
    replacement: 'node.roleModel.isShared'
  }
];

// 各パターンで置換
patterns.forEach(({ regex, replacement }) => {
  content = content.replace(regex, replacement);
});

// 修正内容をファイルに書き戻す
fs.writeFileSync(routesPath, content, 'utf-8');

console.log('修正完了しました！');
