import { Server as HttpServer } from 'http';
import { Express } from 'express';
import http from 'http';
import { initWebSocket } from '../websocket-new';
import { setupWebSocketIntegration } from './ws-integration';

// ExpressアプリケーションとHttpServerを使用してWebSocketサーバーを設定する関数
export function setupWebSocketServer(app: Express, server?: HttpServer): HttpServer {
  // HttpServerがない場合は新しく作成
  const httpServer = server || http.createServer(app);
  
  try {
    // WebSocketサーバーの初期化（新しい実装を使用）
    initWebSocket(httpServer);
    
    // WebSocketの統合機能のセットアップ
    setupWebSocketIntegration(httpServer);
    
    console.log('WebSocketサーバーが設定されました');
  } catch (error) {
    console.error('WebSocketサーバーの設定中にエラーが発生しました:', error);
  }
  
  return httpServer;
}