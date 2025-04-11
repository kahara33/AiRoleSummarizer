/**
 * デバッグ用のエージェントメッセージ送信ヘルパー
 * ナレッジグラフの自動生成およびエージェント思考可視化のためのメッセージを生成します
 */

import { v4 as uuidv4 } from 'uuid';
import { sendAgentThoughts, sendProgressUpdate } from '../websocket-new';

/**
 * 単一のデバッグメッセージを送信
 */
export function sendDebugAgentThought(
  roleModelId: string, 
  message: string = "デバッグメッセージ：WebSocket通信が正常に機能しています。"
): void {
  sendAgentThoughts(
    'システム',
    message,
    roleModelId,
    {
      id: uuidv4(),
      step: 'debug',
      timestamp: new Date().toISOString()
    }
  );
}

// 注: sendRoleModelDemoThoughts 関数は削除されました
// エラー発生後もダミー応答が表示される問題を解決するため
export function sendRoleModelDemoThoughts(roleModelId: string, roleName: string): void {
  // この関数は空の実装に変更されました - ダミーレスポンスを生成しません
  console.log('ダミー思考プロセス生成はスキップされました');
}