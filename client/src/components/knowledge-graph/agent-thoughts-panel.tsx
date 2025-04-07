import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, CheckCircle, Brain } from 'lucide-react';

// エージェント出力メッセージの型定義
export interface AgentMessage {
  timestamp: number;
  agentName: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'thinking';
}

// 進捗状況の型定義
export interface ProgressUpdate {
  stage: string;
  progress: number;
  message: string;
  details?: any;
}

interface AgentThoughtsPanelProps {
  roleModelId: string;
  isVisible: boolean;
  onClose: () => void;
  thoughts?: AgentMessage[];
  progress?: ProgressUpdate;
  isProcessing?: boolean;
}

export function AgentThoughtsPanel({ roleModelId, isVisible, onClose, thoughts = [], progress, isProcessing = false }: AgentThoughtsPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [filteredThoughts, setFilteredThoughts] = useState<AgentMessage[]>([]);
  const [localThoughts, setLocalThoughts] = useState<AgentMessage[]>([]);
  
  // WebSocketインスタンスをrefに保存して、コンポーネントのライフサイクル全体で管理
  const socketRef = useRef<WebSocket | null>(null);
  const isComponentMountedRef = useRef<boolean>(true);
  
  // 前回のpropsを保存するためのref
  const prevPropsRef = useRef<{
    thoughts: AgentMessage[];
    activeTab: string;
    localThoughts: AgentMessage[];
  }>({
    thoughts: [],
    activeTab: 'all',
    localThoughts: []
  });
  
  // マウント時にrefを初期化
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    return () => {
      // アンマウント時にフラグをfalseに設定
      isComponentMountedRef.current = false;
    };
  }, []);
  
  // フィルタリングロジックを関数として定義
  // useMemoを使用して依存関係が変更された場合のみ再計算
  const filteredThoughtsMemo = useMemo(() => {
    console.log('Recalculating filtered thoughts');
    
    // ローカルのコピーを作成
    const mergedThoughts = [...(thoughts || []), ...localThoughts];
    
    // タイムスタンプでソート
    mergedThoughts.sort((a, b) => a.timestamp - b.timestamp);
    
    // 現在のタブに応じてフィルタリング
    return activeTab === 'all' 
      ? mergedThoughts 
      : mergedThoughts.filter(thought => thought.agentName === activeTab);
  }, [activeTab, localThoughts, thoughts]);
  
  // filteredThoughtsMemoの変更を検出し、stateを更新
  useEffect(() => {
    setFilteredThoughts(filteredThoughtsMemo);
    
    // 前回のpropsを更新
    prevPropsRef.current = {
      thoughts: thoughts || [],
      activeTab,
      localThoughts
    };
  }, [filteredThoughtsMemo]);
  
  // WebSocket接続の管理
  useEffect(() => {
    // パネルが非表示またはroleModelIdが無効な場合は何もしない
    if (!isVisible || !roleModelId) return;
    
    // 新しい表示状態になったらローカルthoughtsをリセット
    setLocalThoughts([]);
    
    // WebSocket接続を開始
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Creating WebSocket connection to ${wsUrl}`);
    
    const newSocket = new WebSocket(wsUrl);
    socketRef.current = newSocket;
    
    // 再接続機能のための変数
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 2000; // ms
    
    // 再接続機能
    const reconnect = () => {
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS && isComponentMountedRef.current) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        
        setTimeout(() => {
          if (isComponentMountedRef.current) {
            console.log('Reconnecting WebSocket...');
            const newSocket = new WebSocket(wsUrl);
            socketRef.current = newSocket;
            setupSocketHandlers(newSocket);
          }
        }, RECONNECT_DELAY);
      } else {
        console.log('Maximum reconnection attempts reached or component unmounted');
      }
    };
    
    // WebSocketイベントハンドラを設定する関数
    const setupSocketHandlers = (socket: WebSocket) => {
      socket.onopen = () => {
        console.log('WebSocket connected for agent thoughts');
        reconnectAttempts = 0; // 接続成功時に再接続カウンターをリセット
        
        // コンポーネントがマウントされている場合のみ実行
        if (isComponentMountedRef.current && socket.readyState === 1) {
          try {
            console.log(`Subscribing to role model ${roleModelId}`);
            socket.send(JSON.stringify({
              type: 'subscribe_role_model',
              payload: { roleModelId }
            }));
            
            // 定期的なping送信で接続を維持
            const pingInterval = setInterval(() => {
              if (socket.readyState === 1) { // WebSocket.OPEN = 1
                try {
                  socket.send(JSON.stringify({ type: 'ping', payload: {} }));
                } catch (err) {
                  console.error('Error sending ping:', err);
                  clearInterval(pingInterval);
                }
              } else {
                clearInterval(pingInterval);
              }
            }, 30000); // 30秒ごと
            
            // クリーンアップのために保存（型アサーションを使用）
            (socket as any).pingInterval = pingInterval;
          } catch (err) {
            console.error('Error sending subscription message:', err);
          }
        }
      };
      
      socket.onmessage = (event) => {
        if (!isComponentMountedRef.current) return;
        
        try {
          console.log('Raw WebSocket message received:', event.data.substring(0, 100) + (event.data.length > 100 ? '...' : ''));
          
          // JSONパースを安全に行う
          let data;
          try {
            data = JSON.parse(event.data);
          } catch (parseError) {
            console.error('Invalid JSON in WebSocket message:', parseError);
            return;
          }
          
          // 受信データの基本構造を検証
          if (!data || typeof data !== 'object' || !data.type) {
            console.error('Invalid message structure:', data);
            return;
          }
          
          console.log('WebSocket message received:', data.type, data);
          
          // メッセージタイプに応じた処理
          switch (data.type) {
            case 'agent_thoughts':
              if (!data.payload) {
                console.error('Missing payload in agent_thoughts message');
                return;
              }
              
              console.log('Agent thought received in detail:', data.payload);
              
              // 新しい思考オブジェクトを作成
              const newThought: AgentMessage = {
                timestamp: data.payload.timestamp || Date.now(),
                agentName: data.payload.agentName || 'Unknown',
                message: data.payload.message || '',
                type: data.payload.type || 'info'
              };
              
              // React の状態更新を安全に行う
              if (isComponentMountedRef.current) {
                // 重複チェックと状態更新のバッチ処理
                setLocalThoughts(prev => {
                  // メモリ使用量を管理するための制限（最大100項目）
                  const limitedPrev = prev.length > 90 ? prev.slice(-90) : prev;
                  
                  // 重複チェック - タイムスタンプとエージェント名の組み合わせで判断
                  const isDuplicate = limitedPrev.some(thought => 
                    thought.timestamp === newThought.timestamp && 
                    thought.agentName === newThought.agentName && 
                    thought.message === newThought.message
                  );
                  
                  if (isDuplicate) {
                    console.log('Duplicate thought detected, skipping');
                    return limitedPrev;
                  }
                  
                  console.log('Adding new thought to state:', newThought);
                  return [...limitedPrev, newThought];
                });
              }
              break;
              
            case 'progress_update':
            case 'progress':
              console.log('Progress update received:', data);
              
              // プログレスデータを抽出
              const progressData = data.payload || data;
              
              if (progressData && typeof progressData === 'object') {
                console.log('Progress data received:', progressData);
                // このバージョンでは進捗状況は外部から受け取るだけ
                // 独自の進捗更新ロジックはこのコンポーネントには含まれていない
              }
              break;
              
            case 'pong':
              console.log('Pong received');
              break;
              
            case 'connected':
              console.log('Connection confirmed:', data.payload);
              break;
              
            case 'subscription_success':
              console.log('Subscription success:', data.payload);
              break;
              
            case 'error':
              console.error('Error from server:', data.payload?.error || 'Unknown error');
              break;
              
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      socket.onclose = (event) => {
        console.log(`WebSocket disconnected for agent thoughts: code=${event.code}, reason=${event.reason}`);
        
        // pingIntervalを停止
        if ((socket as any).pingInterval) {
          clearInterval((socket as any).pingInterval);
        }
        
        // 非正常な切断の場合は再接続を試みる
        if (event.code !== 1000 && event.code !== 1001) {
          reconnect();
        }
      };
    };
    
    // WebSocketハンドラを設定
    setupSocketHandlers(newSocket);
    
    // クリーンアップ関数
    return () => {
      try {
        const socket = socketRef.current;
        if (socket) {
          // pingIntervalを停止
          if ((socket as any).pingInterval) {
            clearInterval((socket as any).pingInterval);
          }
          
          if (socket.readyState === 1) {
            socket.send(JSON.stringify({
              type: 'unsubscribe_role_model',
              payload: { roleModelId }
            }));
            socket.close(1000, 'Component unmounted');
          }
        }
        socketRef.current = null;
      } catch (e) {
        console.error('Error during WebSocket cleanup:', e);
      }
    };
  }, [roleModelId, isVisible, progress]); // 依存配列を修正
  
  // このアプローチは重要: 通常の変数としてレンダリング時に直接計算する
  // useStateやuseEffectに依存しないため、更新深度の問題を回避
  const uniqueAgentNames = (() => {
    const agentNameSet = new Set<string>();
    
    // 両方のソースからエージェント名を収集
    [...(thoughts || []), ...localThoughts].forEach(t => {
      if (t.agentName) agentNameSet.add(t.agentName);
    });
    
    return Array.from(agentNameSet);
  })();
  
  // メッセージタイプに応じたアイコンを取得
  const getIconForType = (type: string) => {
    switch (type) {
      case 'thinking':
        return <Brain className="h-4 w-4 text-purple-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'info':
      default:
        return <Brain className="h-4 w-4 text-blue-500" />;
    }
  };
  
  // 進捗状況に応じたカラーを取得
  const getProgressColor = () => {
    if (!progress) return 'bg-gray-200';
    
    if (progress.progress < 33) {
      return 'bg-blue-500';
    } else if (progress.progress < 66) {
      return 'bg-yellow-500';
    } else {
      return 'bg-green-500';
    }
  };
  
  // 日時フォーマット
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP');
  };
  
  // パネルが非表示の場合は何も表示しない
  if (!isVisible) {
    return null;
  }

  return (
    <Card className="fixed right-4 top-20 h-[calc(100vh-120px)] flex flex-col z-50 shadow-lg w-96">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle>エージェント思考パネル</CardTitle>
          <div className="flex items-center gap-2">
            {isProcessing && (
              <div className="flex items-center">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span className="text-sm">処理中...</span>
              </div>
            )}
            <button 
              onClick={onClose}
              className="ml-2 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <CardDescription>
          AIエージェントの思考プロセスをリアルタイムで観察できます
        </CardDescription>
      </CardHeader>
      
      {progress && (
        <div className="px-6 py-2">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-semibold">{progress.stage}</span>
            <span className="text-sm">{progress.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`${getProgressColor()} h-2.5 rounded-full transition-all`} 
              style={{ width: `${progress.progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 mt-1">{progress.message}</p>
        </div>
      )}
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-6">
          <TabsList className="mb-2 w-full overflow-x-auto flex flex-wrap space-x-1 pb-1">
            <TabsTrigger value="all" className="flex-shrink-0">すべて</TabsTrigger>
            {uniqueAgentNames.map(agent => (
              <TabsTrigger key={agent} value={agent} className="flex-shrink-0">
                {agent}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        
        <CardContent className="flex-1 p-0">
          <TabsContent value={activeTab} className="m-0 h-full">
            <ScrollArea className="h-[calc(100vh-300px)] px-6 pb-4">
              {filteredThoughts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40">
                  <p className="text-gray-500">思考データがありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredThoughts.map((thought, index) => (
                    <div key={index} className="border p-3 rounded-md">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center">
                          {getIconForType(thought.type)}
                          <Badge variant="outline" className={`ml-2 ${
                            thought.type === 'thinking' ? 'bg-blue-100 text-blue-800 border-blue-300' : 
                            thought.type === 'error' ? 'bg-red-100 text-red-800 border-red-300' :
                            thought.type === 'success' ? 'bg-green-100 text-green-800 border-green-300' : ''
                          }`}>
                            {thought.agentName}
                          </Badge>
                          {thought.type === 'thinking' && (
                            <div className="ml-2 inline-flex">
                              <span className="animate-ping h-2 w-2 rounded-full bg-blue-400 opacity-75 mr-1"></span>
                              <span className="animate-ping h-2 w-2 rounded-full bg-blue-400 opacity-75 mr-1" style={{ animationDelay: '0.2s' }}></span>
                              <span className="animate-ping h-2 w-2 rounded-full bg-blue-400 opacity-75" style={{ animationDelay: '0.4s' }}></span>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTime(thought.timestamp)}
                        </span>
                      </div>
                      <p className={`text-sm whitespace-pre-wrap ${
                        thought.message.includes('\n') ? 'bg-gray-50 dark:bg-gray-900 rounded p-2' : ''
                      }`}>
                        {thought.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </CardContent>
      </Tabs>
      
      <CardFooter className="pt-2 pb-4 text-xs text-muted-foreground">
        {filteredThoughts.length} 件の思考データを表示しています
      </CardFooter>
    </Card>
  );
}

export default AgentThoughtsPanel;