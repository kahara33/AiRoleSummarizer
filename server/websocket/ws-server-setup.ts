import { Server as HttpServer } from 'http';
import { Express } from 'express';
import http from 'http';
import { initWebSocketServer } from './ws-server';
import { setupWebSocketIntegration } from './ws-integration';

// ExpressアプリケーションとHttpServerを使用してWebSocketサーバーを設定する関数
export function setupWebSocketServer(app: Express, existingServer?: HttpServer): HttpServer {
  // 既存のサーバーを使用するか、新しいサーバーを作成
  const server = existingServer || http.createServer(app);
  
  // WebSocketサーバーの初期化
  console.log('WebSocketサーバーを初期化しています...');
  
  try {
    // 開発モードでの特別設定
    if (process.env.NODE_ENV !== 'production') {
      console.log('開発モードでWebSocketサーバーを設定します');
    }
    
    // WebSocketサーバーの初期化
    initWebSocketServer(server);
    
    // WebSocketの統合機能のセットアップ
    setupWebSocketIntegration(server);
    
    console.log('WebSocketサーバーが設定されました');
  } catch (error) {
    console.error('WebSocketサーバー設定エラー:', error);
  }
  
  return server;
}