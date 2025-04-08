import React, { useState, useEffect } from 'react';
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket-fixed';
import { AlertCircle, CheckCircle, RefreshCcw } from 'lucide-react';

function getAgentColor(agentType: string | undefined): string {
  switch (agentType) {
    case 'domain_analyst':
      return 'bg-blue-500';
    case 'trend_researcher':
      return 'bg-purple-500';
    case 'context_mapper':
      return 'bg-green-500';
    case 'plan_strategist':
      return 'bg-amber-500';
    case 'critical_thinker':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

export default function DebugPage() {
  const [roleModelId, setRoleModelId] = useState<string>('c2466ca7-5308-4b47-b7e7-5b4849409df2'); // デフォルトのロールモデルID
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<string>('ping');
  const [logs, setLogs] = useState<string[]>([]);

  const {
    isConnected,
    connecting,
    error,
    connect,
    disconnect,
    sendMessage,
    agentThoughts,
    progressUpdates,
    isProcessing,
    clearMessages
  } = useMultiAgentWebSocket();

  // ロゴメッセージを追加
  const addLog = (logMessage: string) => {
    setLogs(prev => [logMessage, ...prev].slice(0, 50)); // 最大50件のログを保持
  };

  // 接続状態変更時のログ追加
  useEffect(() => {
    if (isConnected) {
      addLog(`✅ WebSocket接続完了: ${new Date().toLocaleTimeString()}`);
    } else if (!isConnected && !connecting) {
      addLog(`❌ WebSocket切断: ${new Date().toLocaleTimeString()}`);
    }
  }, [isConnected, connecting]);

  // エラーメッセージのログ追加
  useEffect(() => {
    if (error) {
      addLog(`⚠️ エラー: ${error} - ${new Date().toLocaleTimeString()}`);
    }
  }, [error]);

  // サーバーからのメッセージをログに追加
  useEffect(() => {
    if (agentThoughts.length > 0) {
      const latestThought = agentThoughts[agentThoughts.length - 1];
      addLog(`📝 エージェント思考 (${latestThought.agentName}): ${latestThought.thought.substring(0, 100)}...`);
    }
  }, [agentThoughts]);

  useEffect(() => {
    if (progressUpdates.length > 0) {
      const latestProgress = progressUpdates[progressUpdates.length - 1];
      addLog(`📊 進捗更新 (${latestProgress.percent}%): ${latestProgress.message}`);
    }
  }, [progressUpdates]);

  const handleConnect = () => {
    if (roleModelId) {
      addLog(`🔌 WebSocket接続試行中... roleModelId=${roleModelId}`);
      connect(roleModelId);
    } else {
      addLog('❌ ロールモデルIDが設定されていません');
    }
  };

  const handleDisconnect = () => {
    addLog('🔌 WebSocket切断試行中...');
    disconnect();
  };

  const handleSendMessage = () => {
    if (!isConnected) {
      addLog('❌ WebSocketが接続されていないため、メッセージを送信できません');
      return;
    }

    addLog(`📤 メッセージ送信: type=${messageType}, message=${message}`);
    const result = sendMessage(messageType, { message });
    
    if (result) {
      addLog('✅ メッセージ送信成功');
    } else {
      addLog('❌ メッセージ送信失敗');
    }
  };

  const handleClearMessages = () => {
    clearMessages();
    addLog('🧹 メッセージをクリア');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">WebSocketデバッグページ</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader>
            <CardTitle>WebSocket接続</CardTitle>
            <CardDescription>WebSocketサーバーとの接続管理</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ロールモデルID</label>
                <Input
                  value={roleModelId}
                  onChange={(e) => setRoleModelId(e.target.value)}
                  placeholder="ロールモデルIDを入力"
                  className="w-full"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">接続状態:</span>
                {connecting ? (
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                    <RefreshCcw className="h-3 w-3 mr-1 animate-spin" />
                    接続中...
                  </Badge>
                ) : isConnected ? (
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    接続済み
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-100 text-red-800">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    未接続
                  </Badge>
                )}
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>エラー</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              onClick={handleConnect} 
              disabled={isConnected || connecting}
              variant="default"
            >
              接続
            </Button>
            <Button 
              onClick={handleDisconnect} 
              disabled={!isConnected}
              variant="outline"
            >
              切断
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>メッセージ送信</CardTitle>
            <CardDescription>WebSocketサーバーへのテストメッセージ送信</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">メッセージタイプ</label>
                <Input
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value)}
                  placeholder="ping"
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">メッセージ内容</label>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="メッセージを入力"
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              onClick={handleSendMessage} 
              disabled={!isConnected}
              variant="default"
            >
              送信
            </Button>
            <Button 
              onClick={handleClearMessages}
              variant="outline"
            >
              メッセージクリア
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>エージェント思考</CardTitle>
            <CardDescription>受信したエージェント思考メッセージ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {agentThoughts.length === 0 ? (
                <p className="text-gray-500 italic">エージェント思考メッセージはまだありません</p>
              ) : (
                agentThoughts.map((thought) => (
                  <div key={thought.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <Badge className={`${getAgentColor(thought.agentType)} mr-2`}>
                          {thought.agentName}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(thought.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <Badge variant="outline">{thought.step}</Badge>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{thought.thought}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>進捗更新</CardTitle>
            <CardDescription>受信した進捗更新メッセージ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {progressUpdates.length === 0 ? (
                <p className="text-gray-500 italic">進捗更新メッセージはまだありません</p>
              ) : (
                progressUpdates.map((progress, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">
                        {progress.percent}%
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(progress.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{progress.message}</p>
                    {progress.details && (
                      <p className="text-xs text-gray-600 mt-1">{JSON.stringify(progress.details)}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>デバッグログ</CardTitle>
          <CardDescription>WebSocket操作のログ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 rounded-lg p-3 max-h-60 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500 italic">ログはまだありません</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-sm font-mono mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => setLogs([])}
            variant="outline"
            size="sm"
          >
            ログクリア
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}