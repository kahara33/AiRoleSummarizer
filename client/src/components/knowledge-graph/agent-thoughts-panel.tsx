import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, X, Terminal, Cpu, Brain, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AgentThought {
  agentName: string;
  thoughts: string;
  timestamp: string;
}

interface ProgressUpdate {
  stage: string;
  progress: number;
  details?: any;
  timestamp: string;
}

interface AgentThoughtsPanelProps {
  roleModelId: string;
  isVisible: boolean;
  onClose: () => void;
}

const AgentThoughtsPanel: React.FC<AgentThoughtsPanelProps> = ({ 
  roleModelId, 
  isVisible,
  onClose 
}) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [currentProgress, setCurrentProgress] = useState<number>(0);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // アニメーションスタイル
  const fadeIn = 'animate-in fade-in duration-300';
  
  // WebSocketの接続を管理
  useEffect(() => {
    if (!isVisible) {
      return; // パネルが非表示の場合は接続しない
    }
    
    // WebSocket接続を初期化
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const newSocket = new WebSocket(wsUrl);
    
    newSocket.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      
      // 接続成功時にステータスメッセージを追加
      setThoughts(prev => [
        ...prev, 
        { 
          agentName: 'システム', 
          thoughts: 'AI処理の進捗状況パネルに接続しました。ロールモデルの分析が開始されると、リアルタイムで思考プロセスが表示されます。',
          timestamp: new Date().toISOString()
        }
      ]);
    };
    
    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received WebSocket message:', data);
        
        // メッセージタイプに応じた処理
        if (data.type === 'connection_established') {
          console.log('Connection confirmed with ID:', data.userId);
        } 
        else if (data.type === 'agent_thoughts' && data.roleModelId === roleModelId) {
          // エージェントの思考を追加
          setThoughts(prev => [...prev, {
            agentName: data.agentName,
            thoughts: data.thoughts,
            timestamp: data.timestamp
          }]);
        } 
        else if (data.type === 'progress_update' && data.roleModelId === roleModelId) {
          // 進捗更新を追加
          setProgressUpdates(prev => [...prev, {
            stage: data.stage,
            progress: data.progress,
            details: data.details,
            timestamp: data.timestamp
          }]);
          
          // 現在のステージと進捗を更新
          setCurrentStage(data.stage);
          setCurrentProgress(data.progress);
        } 
        else if (data.type === 'error' && data.roleModelId === roleModelId) {
          // エラーメッセージを追加
          setErrors(prev => [...prev, data.errorMessage]);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    newSocket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };
    
    newSocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
      setErrors(prev => [...prev, 'WebSocket接続エラーが発生しました。']);
    };
    
    setSocket(newSocket);
    
    // クリーンアップ関数
    return () => {
      if (newSocket && newSocket.readyState === WebSocket.OPEN) {
        newSocket.close();
      }
    };
  }, [roleModelId, isVisible]);
  
  // 自動スクロール
  useEffect(() => {
    if (autoScroll && scrollRef.current && thoughts.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts, autoScroll]);
  
  // エージェント名に対応するアイコンを取得
  const getAgentIcon = (agentName: string) => {
    const agentNameLower = agentName.toLowerCase();
    
    if (agentNameLower.includes('industry') || agentNameLower.includes('業界')) {
      return <Brain className="h-4 w-4 mr-1" />;
    } 
    else if (agentNameLower.includes('keyword') || agentNameLower.includes('キーワード')) {
      return <Terminal className="h-4 w-4 mr-1" />;
    } 
    else if (agentNameLower.includes('structure') || agentNameLower.includes('構造')) {
      return <Cpu className="h-4 w-4 mr-1" />;
    } 
    
    return <Terminal className="h-4 w-4 mr-1" />;
  };
  
  // 日付をフォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  };
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className={`fixed right-0 top-0 h-full z-50 w-80 md:w-96 lg:w-1/3 bg-background border-l border-border shadow-lg ${fadeIn}`}>
      <Card className="h-full flex flex-col rounded-none">
        <CardHeader className="pb-2 pt-3 px-4 flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              AIエージェント処理状況
              {!connected && <Loader2 className="h-4 w-4 ml-2 animate-spin text-muted-foreground" />}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {currentStage && (
            <div className="mt-1">
              <div className="flex items-center justify-between text-sm">
                <span>{currentStage}</span>
                <span>{currentProgress}%</span>
              </div>
              <div className="w-full bg-secondary h-1 mt-1 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-500" 
                  style={{ width: `${currentProgress}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between mt-2">
            <Toggle 
              pressed={autoScroll} 
              onPressedChange={setAutoScroll}
              size="sm"
              variant="outline"
              aria-label="自動スクロール"
              className="text-xs h-7"
            >
              自動スクロール
            </Toggle>
            
            <Badge variant="outline" className={connected ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}>
              {connected ? "接続中" : "未接続"}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 flex-grow overflow-hidden">
          <ScrollArea ref={scrollRef} className="h-full">
            <div className="p-4 space-y-3">
              {errors.length > 0 && (
                <div className="mb-4 space-y-2">
                  {errors.map((error, i) => (
                    <div key={i} className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-800 dark:text-red-400 flex items-start text-sm">
                      <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  ))}
                  <Separator />
                </div>
              )}
              
              {thoughts.map((thought, i) => (
                <div key={i} className="space-y-1 animate-in fade-in slide-in-from-right-3 duration-300">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="px-2 py-0 h-5 text-xs font-normal flex items-center">
                      {getAgentIcon(thought.agentName)}
                      {thought.agentName}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(thought.timestamp)}</span>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-md text-sm">
                    {thought.thoughts.split('\n').map((line, j) => (
                      <p key={j} className={line.trim() === '' ? 'h-2' : 'mb-1'}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
              
              {thoughts.length === 0 && !connected && (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Terminal className="h-10 w-10 mb-3 opacity-20" />
                  <p>WebSocket接続中...</p>
                  <p className="text-sm mt-1">AIエージェントの処理が開始されるのをお待ちください</p>
                </div>
              )}
              
              {thoughts.length === 0 && connected && (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Terminal className="h-10 w-10 mb-3 opacity-20" />
                  <p>AIエージェントからのデータを待機中...</p>
                  <p className="text-sm mt-1">ロールモデルの処理が開始されると、ここに思考プロセスが表示されます</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentThoughtsPanel;
