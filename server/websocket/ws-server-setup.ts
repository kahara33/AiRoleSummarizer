import { Server as HttpServer } from 'http';
import { Express } from 'express';
import http from 'http';
import { initWebSocketServer, getWebSocketServer } from './ws-server';
import { setupWebSocketIntegration } from './ws-integration';

// シングルトンパターンでWebSocketサーバーのセットアップ状態を管理
let isWebSocketServerSetup = false;

// ExpressアプリケーションとHttpServerを使用してWebSocketサーバーを設定する関数
export function setupWebSocketServer(app: Express, existingServer?: HttpServer): HttpServer {
  // 既存のサーバーを使用するか、新しいサーバーを作成
  const server = existingServer || http.createServer(app);
  
  // 既に設定済みの場合は早期リターン
  if (isWebSocketServerSetup && getWebSocketServer()) {
    console.log('WebSocketサーバーは既に初期化されています');
    return server;
  }
  
  // WebSocketサーバーの初期化
  console.log('WebSocketサーバーを初期化しています...');
  
  try {
    // 開発モードでの特別設定
    if (process.env.NODE_ENV !== 'production') {
      console.log('開発モードでWebSocketサーバーを設定します');
    }
    
    // WebSocketサーバーの初期化（一度だけ）
    initWebSocketServer(server);
    
    // WebSocketの統合機能のセットアップ
    setupWebSocketIntegration(server);
    
    // 設定済みフラグを設定
    isWebSocketServerSetup = true;
    
    console.log('WebSocketサーバーが設定されました');
  } catch (error) {
    console.error('WebSocketサーバー設定エラー:', error);
  }
  
  return server;
}