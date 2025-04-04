/**
 * WebSocketサーバー
 * リアルタイムな処理状況の共有と通信を担当
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'cookie';
import cookie from 'cookie-parser';
import { verifySession } from './auth';
import { ProgressUpdate, AgentThought } from './agents/types';

// WebSocketコネクション管理
const userConnections = new Map<string, WebSocket[]>();
const roleModelConnections = new Map<string, WebSocket[]>();

// WebSocketサーバーの初期化と設定
export function initWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  console.log('WebSocket server initialized');
  
  // 接続イベントのハンドリング
  wss.on('connection', async (ws, req) => {
    try {
      // クッキーからセッションIDを取得
      const cookieHeader = req.headers.cookie;
      if (!cookieHeader) {
        console.error('No cookie found in WebSocket connection request');
        ws.close(1008, 'Authentication required');
        return;
      }
      
      const cookies = parse(cookieHeader);
      const sessionId = cookies['connect.sid'];
      
      if (!sessionId) {
        console.error('No session ID found in cookies');
        ws.close(1008, 'Authentication required');
        return;
      }
      
      // セッションからユーザーIDを検証
      const userId = await verifySession(sessionId);
      
      if (!userId) {
        console.error('Invalid session');
        ws.close(1008, 'Invalid session');
        return;
      }
      
      console.log(`WebSocket connection established for user: ${userId}`);
      
      // クエリパラメータから役割モデルIDを取得
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const roleModelId = url.searchParams.get('roleModelId');
      
      // ユーザー接続を保存
      if (!userConnections.has(userId)) {
        userConnections.set(userId, []);
      }
      userConnections.get(userId)?.push(ws);
      
      // 役割モデル接続を保存（指定がある場合）
      if (roleModelId) {
        if (!roleModelConnections.has(roleModelId)) {
          roleModelConnections.set(roleModelId, []);
        }
        roleModelConnections.get(roleModelId)?.push(ws);
        
        console.log(`Associated with role model: ${roleModelId}`);
      }
      
      // WebSocketにユーザーIDと役割モデルIDを関連付け
      (ws as any).userId = userId;
      (ws as any).roleModelId = roleModelId;
      
      // 接続確認メッセージを送信
      ws.send(JSON.stringify({
        type: 'connection',
        data: {
          userId,
          roleModelId,
          timestamp: Date.now(),
          message: 'WebSocket connection established'
        }
      }));
      
      // 接続切断時の処理
      ws.on('close', () => {
        console.log(`WebSocket connection closed for user: ${userId}`);
        
        // ユーザー接続から削除
        const userWsList = userConnections.get(userId);
        if (userWsList) {
          const index = userWsList.indexOf(ws);
          if (index !== -1) {
            userWsList.splice(index, 1);
          }
          
          if (userWsList.length === 0) {
            userConnections.delete(userId);
          }
        }
        
        // 役割モデル接続から削除
        if (roleModelId) {
          const roleModelWsList = roleModelConnections.get(roleModelId);
          if (roleModelWsList) {
            const index = roleModelWsList.indexOf(ws);
            if (index !== -1) {
              roleModelWsList.splice(index, 1);
            }
            
            if (roleModelWsList.length === 0) {
              roleModelConnections.delete(roleModelId);
            }
          }
        }
      });
      
      // エラーハンドリング
      ws.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
      });
      
      // メッセージ受信ハンドリング（将来の拡張用）
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log(`Received message from user ${userId}:`, data);
          
          // メッセージタイプに応じた処理をここに実装
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
    } catch (error) {
      console.error('Error in WebSocket connection:', error);
      ws.close(1011, 'Server error');
    }
  });
  
  return wss;
}

/**
 * 指定されたユーザーに処理進捗状況を送信
 */
export function sendProgressUpdate(
  userId: string,
  roleModelId: string,
  stage: string,
  progress: number,
  data?: any
): void {
  const update: ProgressUpdate = {
    userId,
    roleModelId,
    stage,
    progress,
    data
  };
  
  // ユーザー宛の接続に送信
  const userWsList = userConnections.get(userId);
  if (userWsList && userWsList.length > 0) {
    const message = JSON.stringify({
      type: 'progress',
      data: update
    });
    
    userWsList.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
  
  // 役割モデル宛の接続に送信
  const roleModelWsList = roleModelConnections.get(roleModelId);
  if (roleModelWsList && roleModelWsList.length > 0) {
    const message = JSON.stringify({
      type: 'progress',
      data: update
    });
    
    roleModelWsList.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

/**
 * 指定されたユーザーにエージェントの思考を送信
 */
export function sendAgentThoughts(
  userId: string,
  roleModelId: string,
  agentName: string,
  thought: string
): void {
  const agentThought: AgentThought = {
    userId,
    roleModelId,
    agentName,
    thought,
    timestamp: Date.now()
  };
  
  // ユーザー宛の接続に送信
  const userWsList = userConnections.get(userId);
  if (userWsList && userWsList.length > 0) {
    const message = JSON.stringify({
      type: 'agent_thought',
      data: agentThought
    });
    
    userWsList.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
  
  // 役割モデル宛の接続に送信
  const roleModelWsList = roleModelConnections.get(roleModelId);
  if (roleModelWsList && roleModelWsList.length > 0) {
    const message = JSON.stringify({
      type: 'agent_thought',
      data: agentThought
    });
    
    roleModelWsList.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}