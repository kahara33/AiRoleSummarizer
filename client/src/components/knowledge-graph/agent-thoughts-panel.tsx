import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  // マージされた思考を保存するために新しいrefを追加
  const mergedThoughtsRef = useRef<AgentMessage[]>([]);
  
  // マウント時にrefを初期化
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    return () => {
      // アンマウント時にフラグをfalseに設定
      isComponentMountedRef.current = false;
    };
  }, []);
  
  // フィルタリングロジックを関数として抽出 - useEffectの外部で定義
  const updateFilteredThoughts = useCallback((localThoughts: AgentMessage[], externalThoughts: AgentMessage[], activeTab: string) => {
    // ローカルのコピーを作成して、状態更新の無限ループを防ぐ
    const mergedThoughts = [...(externalThoughts || []), ...localThoughts];
    
    // タイムスタンプでソート
    mergedThoughts.sort((a, b) => a.timestamp - b.timestamp);
    mergedThoughtsRef.current = mergedThoughts;
    
    // 現在のタブに応じてフィルタリング
    const filtered = activeTab === 'all' 
      ? mergedThoughts 
      : mergedThoughts.filter(thought => thought.agentName === activeTab);
    
    // 1回の更新で済ませる
    setFilteredThoughts(filtered);
  }, []);
  
  // activeTab, localThoughts, thoughtsが変更されたときにフィルタリングを更新
  useEffect(() => {
    updateFilteredThoughts(localThoughts, thoughts || [], activeTab);
  }, [activeTab, updateFilteredThoughts, localThoughts, thoughts]);
  
  // WebSocket接続の管理
  useEffect(() => {
    // パネルが非表示またはroleModelIdが無効な場合は何もしない
    if (!isVisible || !roleModelId) return;
    
    // 新しい表示状態になったらローカルthoughtsをリセット
    setLocalThoughts([]);
    
    // WebSocket接続を開始
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const newSocket = new WebSocket(wsUrl);
    socketRef.current = newSocket;
    
    // WebSocketイベントハンドラを設定
    newSocket.onopen = () => {
      console.log('WebSocket connected for agent thoughts');
      
      // コンポーネントがマウントされている場合のみ実行
      if (isComponentMountedRef.current && newSocket.readyState === 1) {
        try {
          newSocket.send(JSON.stringify({
            type: 'subscribe_role_model',
            payload: { roleModelId }
          }));
        } catch (err) {
          console.error('Error sending subscription message:', err);
        }
      }
    };
    
    newSocket.onmessage = (event) => {
      if (!isComponentMountedRef.current) return;
      
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'agent_thoughts') {
          const newThought: AgentMessage = {
            timestamp: data.payload.timestamp || Date.now(),
            agentName: data.payload.agentName || 'Unknown',
            message: data.payload.message || '',
            type: data.payload.type || 'info'
          };
          
          // この関数形式によりステート更新は常に最新の状態に基づいて行われる
          setLocalThoughts(prev => {
            const newThoughts = [...prev, newThought];
            return newThoughts;
          });
        } else if (data.type === 'progress_update') {
          console.log('Progress update received:', data.payload);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    newSocket.onclose = () => {
      console.log('WebSocket disconnected for agent thoughts');
    };
    
    // クリーンアップ関数
    return () => {
      try {
        const socket = socketRef.current;
        if (socket && socket.readyState === 1) {
          socket.send(JSON.stringify({
            type: 'unsubscribe_role_model',
            payload: { roleModelId }
          }));
          socket.close();
        }
        socketRef.current = null;
      } catch (e) {
        console.error('Error during WebSocket cleanup:', e);
      }
    };
  }, [roleModelId, isVisible, thoughts, activeTab, updateFilteredThoughts]); // 依存配列を修正
  
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
          <TabsList className="mb-2">
            <TabsTrigger value="all">すべて</TabsTrigger>
            {uniqueAgentNames.map(agent => (
              <TabsTrigger key={agent} value={agent}>
                {agent}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        
        <CardContent className="flex-1 p-0">
          <TabsContent value={activeTab} className="m-0 h-full">
            <ScrollArea className="h-[calc(100%-2rem)] px-6 pb-4">
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
                          <Badge variant="outline" className="ml-2">
                            {thought.agentName}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatTime(thought.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
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