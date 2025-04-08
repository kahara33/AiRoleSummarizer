import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AgentConversation from '@/components/agent-activity/AgentConversation';
import { Separator } from '@/components/ui/separator';
import MainLayout from '@/components/layout/MainLayout';
import { Loader2 } from 'lucide-react';

/**
 * WebSocketデバッグツール
 * エージェント活動の可視化とデバッグのためのテストツール
 */
const WebSocketDebugTool: React.FC = () => {
  const [roleModelId, setRoleModelId] = useState<string>('');
  const [agentName, setAgentName] = useState<string>('ドメイン分析エージェント');
  const [messageContent, setMessageContent] = useState<string>('');
  const [messageType, setMessageType] = useState<string>('thinking');
  const [industryType, setIndustryType] = useState<string>('人工知能');
  const [debugMode, setDebugMode] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responseMessage, setResponseMessage] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // ページロード時にモックロールモデルIDを取得
  useEffect(() => {
    const fetchMockRoleModelId = async () => {
      try {
        const response = await fetch('/api/debug/get-mock-role-model-id');
        const data = await response.json();
        
        if (data.success && data.roleModelId) {
          setRoleModelId(data.roleModelId);
          addLog(`モックロールモデルIDを取得しました: ${data.roleModelId}`);
        } else {
          addLog('モックロールモデルIDの取得に失敗しました');
        }
      } catch (error) {
        console.error('APIエラー:', error);
        addLog(`APIエラー: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    fetchMockRoleModelId();
  }, []);

  // ログを追加する関数
  const addLog = (message: string) => {
    setLogs(prevLogs => [...prevLogs, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // ログが追加されたらスクロールを一番下に移動
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // 単一のエージェント思考をテストとして送信
  const sendTestThought = async () => {
    if (!roleModelId) {
      addLog('エラー: ロールモデルIDが設定されていません');
      return;
    }

    if (!messageContent.trim()) {
      addLog('エラー: メッセージ内容が空です');
      return;
    }

    setIsLoading(true);
    addLog(`テスト思考の送信開始: ${agentName} - ${messageType}`);

    try {
      const response = await fetch('/api/debug/send-agent-thought', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentName,
          thought: messageContent,
          roleModelId,
          type: messageType,
          debug: debugMode
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResponseMessage(`送信成功: ${data.message}`);
        addLog(`テスト思考を送信しました: ${agentName} - ${messageType}`);
      } else {
        setResponseMessage(`エラー: ${data.message || '不明なエラー'}`);
        addLog(`テスト思考の送信に失敗: ${data.message || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('APIエラー:', error);
      setResponseMessage(`APIエラー: ${error instanceof Error ? error.message : String(error)}`);
      addLog(`APIエラー: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // エージェントシミュレーションを開始
  const startAgentSimulation = async () => {
    if (!roleModelId) {
      addLog('エラー: ロールモデルIDが設定されていません');
      return;
    }

    setIsLoading(true);
    addLog(`エージェントシミュレーションの開始: 業界=${industryType}, デバッグモード=${debugMode}`);

    try {
      const response = await fetch('/api/debug/simulate-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roleModelId,
          industry: industryType,
          debug: debugMode
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResponseMessage(`シミュレーション開始: ${data.message}`);
        addLog(`エージェントシミュレーションを開始しました: ${data.message}`);
      } else {
        setResponseMessage(`エラー: ${data.message || '不明なエラー'}`);
        addLog(`エージェントシミュレーションの開始に失敗: ${data.message || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('APIエラー:', error);
      setResponseMessage(`APIエラー: ${error instanceof Error ? error.message : String(error)}`);
      addLog(`APIエラー: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout hideHeader={true}>
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* グローバルヘッダー - メインデザインに合わせる */}
          <header className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Link to="/">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">E</span>
                    </div>
                    <span className="ml-2 font-bold text-lg">EVERYS</span>
                  </div>
                </Link>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-bold text-gray-900">WebSocketデバッグツール</h1>
              </div>
            </div>
          </header>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 左側のコントロールパネル */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="bg-white shadow-sm border border-gray-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">接続設定</CardTitle>
                  <CardDescription className="text-xs">WebSocket接続とテストの基本設定</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="role-model-id">ロールモデルID</Label>
                    <Input
                      id="role-model-id"
                      value={roleModelId}
                      onChange={(e) => setRoleModelId(e.target.value)}
                      placeholder="ロールモデルIDを入力"
                    />
                  </div>

                  <div className="flex items-center space-x-2 mt-4">
                    <Switch
                      id="debug-mode"
                      checked={debugMode}
                      onCheckedChange={setDebugMode}
                    />
                    <Label htmlFor="debug-mode">デバッグモード</Label>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="single" className="w-full">
                <TabsList className="grid grid-cols-2 w-full mb-4">
                  <TabsTrigger value="single">単一メッセージ</TabsTrigger>
                  <TabsTrigger value="simulation">シミュレーション</TabsTrigger>
                </TabsList>
                
                <TabsContent value="single">
                  <Card className="bg-white shadow-sm border border-gray-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">単一エージェントメッセージ</CardTitle>
                      <CardDescription className="text-xs">特定のエージェントからのテストメッセージを送信</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="agent-name">エージェント名</Label>
                        <Select
                          value={agentName}
                          onValueChange={setAgentName}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="エージェントを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ドメイン分析エージェント">ドメイン分析エージェント</SelectItem>
                            <SelectItem value="トレンド調査エージェント">トレンド調査エージェント</SelectItem>
                            <SelectItem value="コンテキストマッピングエージェント">コンテキストマッピングエージェント</SelectItem>
                            <SelectItem value="プラン戦略エージェント">プラン戦略エージェント</SelectItem>
                            <SelectItem value="クリティカルシンカー">クリティカルシンカー</SelectItem>
                            <SelectItem value="オーケストレーター">オーケストレーター</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="message-type">メッセージタイプ</Label>
                        <Select
                          value={messageType}
                          onValueChange={setMessageType}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="タイプを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="thinking">思考中</SelectItem>
                            <SelectItem value="thought">思考結果</SelectItem>
                            <SelectItem value="action">アクション</SelectItem>
                            <SelectItem value="result">結果</SelectItem>
                            <SelectItem value="success">成功</SelectItem>
                            <SelectItem value="error">エラー</SelectItem>
                            <SelectItem value="info">情報</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="message-content">メッセージ内容</Label>
                        <Textarea
                          id="message-content"
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          placeholder="メッセージ内容を入力"
                          rows={6}
                        />
                      </div>
                    </CardContent>
                    <CardFooter className="bg-white p-4">
                      <Button 
                        onClick={sendTestThought} 
                        disabled={isLoading || !roleModelId}
                        className="w-full"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            送信中...
                          </>
                        ) : 'テストメッセージを送信'}
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
                
                <TabsContent value="simulation">
                  <Card className="bg-white shadow-sm border border-gray-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">エージェントシミュレーション</CardTitle>
                      <CardDescription className="text-xs">複数エージェントの自動プロセスをシミュレート</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="industry-type">業界タイプ</Label>
                        <Select
                          value={industryType}
                          onValueChange={setIndustryType}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="業界を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="人工知能">人工知能 (AI)</SelectItem>
                            <SelectItem value="金融テクノロジー">金融テクノロジー (FinTech)</SelectItem>
                            <SelectItem value="医療">医療・ヘルスケア</SelectItem>
                            <SelectItem value="電気自動車">電気自動車 (EV)</SelectItem>
                            <SelectItem value="再生可能エネルギー">再生可能エネルギー</SelectItem>
                            <SelectItem value="eコマース">eコマース</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-white p-4">
                      <Button 
                        onClick={startAgentSimulation} 
                        disabled={isLoading || !roleModelId}
                        className="w-full"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            開始中...
                          </>
                        ) : 'シミュレーションを開始'}
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* ログとレスポンス */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-white shadow-sm border border-gray-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">APIレスポンス</CardTitle>
                    <CardDescription className="text-xs">最後のAPIリクエスト結果</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto">
                      <p className="font-mono text-xs whitespace-pre-wrap">
                        {responseMessage || 'レスポンスはまだありません'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white shadow-sm border border-gray-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">デバッグログ</CardTitle>
                    <CardDescription className="text-xs">操作とイベントの記録</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="bg-gray-100 p-3 rounded-md max-h-40 overflow-y-auto">
                      {logs.length > 0 ? (
                        logs.map((log, index) => (
                          <p key={index} className="font-mono text-xs mb-1">{log}</p>
                        ))
                      ) : (
                        <p className="text-gray-500 text-xs">ログはまだありません</p>
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 右側のエージェント会話表示 */}
            <div className="lg:col-span-7">
              <Card className="bg-white shadow-sm border border-gray-200 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">AIエージェントとの協調</CardTitle>
                  <CardDescription className="text-xs">AIエージェント間の対話を通じて知識構造を構築していきます</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[70vh] bg-white rounded-md overflow-hidden">
                    <AgentConversation roleModelId={roleModelId} height="100%" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <Separator className="my-6" />
          
          <div className="text-xs text-gray-500 text-center mb-4">
            <p>デバッグモードでは認証がバイパスされ、詳細なログが出力されます。</p>
            <p>このツールは開発環境でのみ使用してください。</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default WebSocketDebugTool;