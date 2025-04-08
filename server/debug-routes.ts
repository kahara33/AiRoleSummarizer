import { Express, Request, Response } from 'express';
import { sendAgentThoughts, sendProgressUpdate } from './websocket';

export function registerDebugRoutes(app: Express) {
  // 基本的なデバッグエンドポイント
  app.get('/api/debug', (req, res) => {
    res.json({
      message: 'Debug endpoint is working',
      env: process.env.NODE_ENV,
      session: req.session
    });
  });

  // AIエージェント思考のテスト用エンドポイント
  app.post('/api/debug/send-agent-thought', (req: Request, res: Response) => {
    const { agentName, thought, roleModelId, type } = req.body;
    
    if (!agentName || !thought || !roleModelId) {
      return res.status(400).json({ 
        success: false, 
        message: '必須パラメータが不足しています。agentName, thought, roleModelId を指定してください。'
      });
    }
    
    try {
      // テスト用のエージェント思考を送信
      sendAgentThoughts(
        agentName,
        thought,
        roleModelId,
        {
          type: type || 'debug',
          timestamp: new Date().toISOString(),
          id: Math.random().toString(36).substring(2, 15)
        }
      );
      
      // 進捗状況も送信（テスト用）
      sendProgressUpdate({
        message: `テスト進捗: ${agentName}からのメッセージ`,
        percent: 50, // テスト用の進捗率
        roleModelId
      });
      
      console.log(`テスト思考を送信しました: ${agentName} - ${thought.substring(0, 30)}...`);
      
      res.json({ 
        success: true, 
        message: 'テスト思考を送信しました',
        details: {
          agentName,
          thoughtPreview: thought.substring(0, 30) + '...',
          roleModelId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('テスト思考送信エラー:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // AIエージェントシミュレーション用エンドポイント
  app.post('/api/debug/simulate-agents', async (req: Request, res: Response) => {
    const { roleModelId, industry } = req.body;
    
    if (!roleModelId) {
      return res.status(400).json({ 
        success: false, 
        message: '必須パラメータが不足しています。roleModelId を指定してください。'
      });
    }
    
    try {
      // テストヘルパーをインポート
      const { simulateAgentProcess } = await import('./websocket/test-helper');
      
      // シミュレーションを非同期で開始
      console.log(`エージェントシミュレーションを開始: roleModelId=${roleModelId}`);
      
      // 非同期でシミュレーションを開始し、レスポンスは即時返す
      simulateAgentProcess(roleModelId, industry || '人工知能')
        .then(() => {
          console.log('エージェントシミュレーションが完了しました');
        })
        .catch((error: any) => {
          console.error('エージェントシミュレーションエラー:', error);
        });
      
      res.json({ 
        success: true, 
        message: 'エージェントシミュレーションを開始しました',
        details: {
          roleModelId,
          industry: industry || '人工知能',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('エージェントシミュレーション開始エラー:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}