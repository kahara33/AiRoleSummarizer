/**
 * デバッグ用のルート
 * 本番環境では無効化することを推奨
 */

import { Express } from 'express';
import { sendDebugAgentThought, sendRoleModelDemoThoughts } from './websocket/debug-message-helper';

export function registerDebugRoutes(app: Express): void {
  // WebSocketデバッグ用のエンドポイント
  app.post('/api/debug/send-test-message', async (req, res) => {
    try {
      const { roleModelId, message } = req.body;
      
      if (!roleModelId) {
        return res.status(400).json({ error: 'roleModelIdが必要です' });
      }
      
      console.log(`デバッグメッセージ送信: roleModelId=${roleModelId}, message=${message || 'デフォルトメッセージ'}`);
      
      // デバッグメッセージを送信
      sendDebugAgentThought(roleModelId, message || 'これはWebSocketテストメッセージです');
      
      // デモ思考も送信
      if (req.body.sendDemo) {
        sendRoleModelDemoThoughts(roleModelId, req.body.roleName || 'テスト役割');
      }
      
      return res.json({ 
        success: true, 
        message: 'テストメッセージが送信されました' 
      });
    } catch (error) {
      console.error('デバッグメッセージ送信エラー:', error);
      return res.status(500).json({ error: '処理中にエラーが発生しました' });
    }
  });
  
  // エージェント思考のテスト用エンドポイント
  app.get('/api/debug/test-agent-thoughts/:roleModelId', (req, res) => {
    const { roleModelId } = req.params;
    if (!roleModelId) {
      return res.status(400).json({ error: 'roleModelIdが必要です' });
    }
    
    console.log(`テストエージェント思考送信: roleModelId=${roleModelId}`);
    
    // 単一のデバッグメッセージを送信
    sendDebugAgentThought(roleModelId, 'これはWebSocketテストメッセージです');
    
    // デモ思考プロセスを送信
    sendRoleModelDemoThoughts(roleModelId, 'テスト役割');
    
    return res.json({
      success: true,
      message: 'テストエージェント思考が送信されました'
    });
  });
}