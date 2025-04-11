import { Server as HttpServer } from 'http';
import { Express } from 'express';
import http from 'http';
import { initWebSocket } from '../websocket-new';
import { setupWebSocketIntegration } from './ws-integration';

// ExpressアプリケーションとHttpServerを使用してWebSocketサーバーを設定する関数
export function setupWebSocketServer(app: Express): HttpServer {
  // HttpServerの作成
  const server = http.createServer(app);
  
  // WebSocketサーバーの初期化（新しい実装を使用）
  initWebSocket(server);
  
  // WebSocketの統合機能のセットアップ
  setupWebSocketIntegration(server);
  
  console.log('WebSocketサーバーが設定されました');
  
  return server;
}