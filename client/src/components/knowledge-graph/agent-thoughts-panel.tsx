import React, { useState, useEffect, useRef } from 'react';
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
}

interface AgentThoughtsPanelProps {
  roleModelId: string;
  isVisible: boolean;
  onClose: () => void;
}

export function AgentThoughtsPanel({ roleModelId, isVisible, onClose }: AgentThoughtsPanelProps) {
  const [thoughts, setThoughts] = useState<AgentMessage[]>([]);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // WebSocketインスタンスをrefに保存
  const socketRef = useRef<WebSocket | null>(null);
  const isComponentMountedRef = useRef<boolean>(true);
  
  // マウント時にrefを初期化
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);
  
  // WebSocket接続の管理
  useEffect(() => {
    if (!isVisible || !roleModelId) return;
    
    // 表示開始時に状態をリセット
    setThoughts([]);
    setProgress(null);
    
    // WebSocket接続を開始
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Creating WebSocket connection to ${wsUrl}`);
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;
    
    socket.onopen = () => {
      console.log('WebSocket connected for agent thoughts');
      
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        try {
          console.log(`Subscribing to role model ${roleModelId}`);
          socketRef.current.send(JSON.stringify({
            type: 'subscribe_role_model',
            payload: { roleModelId }
          }));
        } catch (err) {
          console.error('Error sending subscription message:', err);
        }
      }
    };
    
    socket.onmessage = (event) => {
      if (!isComponentMountedRef.current) return;
      
      try {
        console.log('WebSocket message received:', event.data);
        
        const data = JSON.parse(event.data);
        
        if (data.type === 'agent_thoughts') {
          const newThought: AgentMessage = {
            timestamp: data.payload.timestamp || Date.now(),
            agentName: data.payload.agentName || 'System',
            message: data.payload.message || '',
            type: data.payload.type || 'info'
          };
          
          setThoughts(prev => [...prev, newThought]);
        } 
        else if (data.type === 'progress_update' || data.type === 'progress') {
          const progressData = data.payload || data;
          
          if (progressData && typeof progressData.progress === 'number') {
            setProgress({
              stage: progressData.stage || '処理中',
              progress: progressData.progress,
              message: progressData.message || ''
            });
            
            setIsProcessing(progressData.progress < 100);
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected for agent thoughts');
    };
    
    // クリーンアップ関数
    return () => {
      try {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: 'unsubscribe_role_model',
            payload: { roleModelId }
          }));
          socketRef.current.close();
        }
        socketRef.current = null;
      } catch (e) {
        console.error('Error during WebSocket cleanup:', e);
      }
    };
  }, [roleModelId, isVisible]);
  
  // メッセージタイプに応じたアイコンを取得
  const getIconForType = (type: string) => {
    switch (type) {
      case 'thinking':
        return <Brain className="h-4 w-4 text-blue-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
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
      
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[calc(100vh-250px)] px-6 pb-4">
          {thoughts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40">
              <p className="text-gray-500">思考データがありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {thoughts.map((thought, index) => (
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
                  <p className="text-sm whitespace-pre-wrap">
                    {thought.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      <CardFooter className="pt-2 pb-4 text-xs text-muted-foreground">
        {thoughts.length} 件の思考データを表示しています
      </CardFooter>
    </Card>
  );
}

export default AgentThoughtsPanel;