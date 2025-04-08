import React from 'react';
import { Switch, Route, useLocation } from 'wouter';
import WebsocketDebug from './WebsocketDebug';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * デバッグツール一覧ページ
 */
export default function DebugPage() {
  // パスに基づいて適切なコンポーネントを表示
  const [location] = useLocation();
  
  // デバッグツールのURLパスを確認
  if (location === '/debug/websocket') {
    return <WebsocketDebug />;
  }
  
  // メインのデバッグページを表示（ツール一覧）
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">デバッグツール</h1>
      <p className="mb-8 text-muted-foreground">
        開発およびデバッグに使用できるツールです。<br />
        注意: これらのツールは開発環境でのみ使用してください。
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>WebSocket デバッグ</CardTitle>
            <CardDescription>
              WebSocket通信とエージェント思考メッセージのテスト
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground mb-4">
              エージェント間通信をテストし、WebSocketメッセージの送受信を確認できます。
              シミュレーションモードではエージェントの思考プロセス全体をテストできます。
            </p>
            <Button 
              onClick={() => window.location.href = '/debug/websocket'}
              className="w-full"
            >
              WebSocketデバッグを開く
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}