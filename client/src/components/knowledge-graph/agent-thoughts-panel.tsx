import React, { useState, useEffect } from 'react';
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
  
  // WebSocketの設定
  useEffect(() => {
    if (!isVisible || !roleModelId) return;
    
    // WebSocketコネクション初期化
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connected for agent thoughts');
      // 役割モデルID購読
      socket.send(JSON.stringify({
        type: 'subscribe_role_model',
        payload: { roleModelId }
      }));
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'agent_thoughts') {
          // 新しい思考を追加
          const newThought: AgentMessage = {
            timestamp: data.payload.timestamp,
            agentName: data.payload.agentName,
            message: data.payload.message,
            type: data.payload.type || 'info'
          };
          
          setLocalThoughts(prev => [...prev, newThought]);
        } else if (data.type === 'progress_update') {
          // 進捗状況更新は現在この実装では扱っていない
          console.log('Progress update received:', data.payload);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected for agent thoughts');
    };
    
    // クリーンアップ
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'unsubscribe_role_model',
          payload: { roleModelId }
        }));
        socket.close();
      }
    };
  }, [roleModelId, isVisible]);
  
  // 受け取ったthoughtsとローカルで保存したthoughtsをマージ
  useEffect(() => {
    const safeThoughts = thoughts || [];
    const allThoughts = [...safeThoughts, ...localThoughts];
    
    // タイムスタンプでソート
    allThoughts.sort((a, b) => a.timestamp - b.timestamp);
    
    if (activeTab === 'all') {
      setFilteredThoughts(allThoughts);
    } else {
      setFilteredThoughts(allThoughts.filter(thought => thought.agentName === activeTab));
    }
  }, [activeTab, thoughts, localThoughts]);
  
  // エージェント名のユニークリストを作成
  const agentNames = Array.from(
    new Set([...(thoughts || []), ...localThoughts].map(t => t.agentName))
  );
  
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
    <Card className="w-full h-full flex flex-col absolute top-12 right-0 z-10 shadow-lg max-w-md">
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
            {agentNames.map(agent => (
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