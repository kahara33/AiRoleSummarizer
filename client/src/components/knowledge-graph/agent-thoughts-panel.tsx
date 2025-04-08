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
import useGlobalWebSocket, { AgentThought, ProgressUpdate } from '@/hooks/use-global-websocket';

// エージェント出力メッセージの型定義
export interface AgentMessage {
  timestamp: number;
  agentName: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'thinking' | string;
}

interface AgentThoughtsPanelProps {
  roleModelId?: string;
  isVisible?: boolean;
  onClose?: () => void;
  thoughts?: AgentThought[];
  height?: string;
  isProcessing?: boolean;
  progressUpdates?: ProgressUpdate[];
  onCancel?: () => boolean;
}

function AgentThoughtsPanel({ 
  roleModelId, 
  isVisible = true, 
  onClose, 
  thoughts: externalThoughts = [], 
  height,
  isProcessing: externalProcessing,
  progressUpdates: externalProgressUpdates = [],
  onCancel
}: AgentThoughtsPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [internalThoughts, setInternalThoughts] = useState<AgentMessage[]>([]);
  const [filteredThoughts, setFilteredThoughts] = useState<AgentMessage[]>([]);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agentNames, setAgentNames] = useState<string[]>([]);
  
  // グローバルWebSocketフックを利用（roleModelIdが変更されても再マウントされない）
  const { agentThoughts: wsAgentThoughts, progressUpdates: wsProgressUpdates } = useGlobalWebSocket(roleModelId);
  
  // コンポーネントマウント状態の追跡
  const isComponentMountedRef = useRef<boolean>(true);
  
  // 外部からの処理状態を反映
  useEffect(() => {
    if (externalProcessing !== undefined) {
      setIsProcessing(externalProcessing);
    }
  }, [externalProcessing]);
  
  // 外部から渡された進捗状況を反映
  useEffect(() => {
    if (externalProgressUpdates && externalProgressUpdates.length > 0) {
      // 最後の進捗情報を取得
      const latestProgress = externalProgressUpdates[externalProgressUpdates.length - 1];
      setProgress(latestProgress);
    }
  }, [externalProgressUpdates]);
  
  // WebSocketフックからの進捗情報を処理
  useEffect(() => {
    if (wsProgressUpdates && wsProgressUpdates.length > 0) {
      const latestProgress = wsProgressUpdates[wsProgressUpdates.length - 1];
      setProgress({
        stage: latestProgress.stage || 'processing',
        progress: latestProgress.progress || latestProgress.percent || 0,
        message: latestProgress.message || '処理中...',
        details: latestProgress.details,
        percent: latestProgress.percent,
        timestamp: latestProgress.timestamp
      });
      
      // 進捗状況に基づいて処理中フラグを更新
      if (latestProgress.progress >= 100 || latestProgress.percent >= 100 || latestProgress.stage === 'complete') {
        setIsProcessing(false);
      } else {
        setIsProcessing(true);
      }
    }
  }, [wsProgressUpdates]);
  
  // WebSocketフックからのエージェント思考を処理
  useEffect(() => {
    if (wsAgentThoughts && wsAgentThoughts.length > 0) {
      console.log("AgentThoughtsPanel: WebSocketから思考データを受信:", wsAgentThoughts.length);
      
      // WebSocketから受け取ったデータを外部から渡されたデータと同様に処理
      try {
        const convertedThoughts: AgentMessage[] = wsAgentThoughts.map(thought => {
          // デバッグログ
          console.log("WebSocket思考データを変換中:", JSON.stringify({
            id: thought.id, 
            agentName: thought.agentName, 
            type: thought.type,
            thought: thought.thought, 
            timestamp: thought.timestamp
          }, null, 2));
          
          // timestamp処理
          let timestamp;
          try {
            timestamp = thought.timestamp instanceof Date 
              ? thought.timestamp.getTime() 
              : new Date(thought.timestamp).getTime();
            
            if (isNaN(timestamp)) {
              timestamp = Date.now();
            }
          } catch (e) {
            timestamp = Date.now();
          }
          
          // メッセージテキスト処理
          let messageText = "詳細情報がありません";
          if (typeof thought.thought === 'string' && thought.thought.trim().length > 0) {
            messageText = thought.thought;
          } else if (typeof thought.message === 'string' && thought.message.trim().length > 0) {
            messageText = thought.message;
          }
          
          // メッセージタイプ処理
          let messageType = 'info';
          if (thought.type) {
            const typeStr = typeof thought.type === 'string' ? thought.type.toLowerCase() : '';
            if (typeStr.includes('error') || typeStr.includes('エラー')) {
              messageType = 'error';
            } else if (typeStr.includes('success') || typeStr.includes('complete')) {
              messageType = 'success';
            } else if (typeStr.includes('think') || typeStr.includes('process')) {
              messageType = 'thinking';
            }
          }
          
          // エージェント名の処理
          const agentName = thought.agentName || "AI エージェント";
          
          return {
            timestamp,
            agentName,
            message: messageText,
            type: messageType
          };
        });
        
        // ユニークなエージェント名のリストを更新
        const uniqueAgentNames = Array.from(new Set(
          wsAgentThoughts.map(t => t.agentName || "AI エージェント")
        ));
        setAgentNames(prev => [...new Set([...prev, ...uniqueAgentNames])]);
        
        // 時間順にソートして内部データに設定
        const sortedThoughts = convertedThoughts.sort((a, b) => a.timestamp - b.timestamp);
        setInternalThoughts(prev => [...prev, ...sortedThoughts]);
        setIsProcessing(true);
      } catch (e) {
        console.error("WebSocket思考データの変換エラー:", e);
      }
    }
  }, [wsAgentThoughts]);

// 外部から渡されたthoughtsを内部形式に変換
  useEffect(() => {
    if (externalThoughts && externalThoughts.length > 0) {
      console.log("AgentThoughtsPanel: 受信したthoughts:", externalThoughts.length);
      
      // テスト用の強制挿入（デバッグ用）
      console.log("思考パネルにデータが渡されています！");
      
      try {
        const convertedThoughts: AgentMessage[] = externalThoughts.map(thought => {
          // デバッグログは詳細に出力
          console.log("変換中のthought:", JSON.stringify({
            id: thought.id, 
            agentName: thought.agentName || (thought as any).agent, 
            type: thought.type,
            thought: thought.thought, 
            message: thought.message, 
            content: (thought as any).content,
            timestamp: thought.timestamp,
            step: thought.step
          }, null, 2));
          
          // timestampがDateオブジェクトの場合はgetTime()を使用し、文字列の場合は日付に変換してからgetTime()を使用
          let timestamp;
          try {
            timestamp = thought.timestamp instanceof Date 
              ? thought.timestamp.getTime() 
              : new Date(thought.timestamp).getTime();
            
            // timestampが無効な場合は現在時刻を使用
            if (isNaN(timestamp)) {
              console.warn("無効なタイムスタンプ:", thought.timestamp);
              timestamp = Date.now();
            }
          } catch (e) {
            console.error("タイムスタンプ変換エラー:", e);
            timestamp = Date.now();
          }
          
          // メッセージは複数のフィールドから優先順位をつけて取得
          // どのフィールドが使用可能かを詳細にチェック
          let messageText = "詳細情報がありません";
          
          // stepが「progress」の場合は、特殊な処理を行う
          if (thought.step === 'progress') {
            // progress用の進捗情報の作成
            const progressPercent = typeof (thought as any).percent === 'number' ? (thought as any).percent : 50;
            messageText = `進捗状況: ${progressPercent}% - ${thought.message || thought.thought}`;
            
            // 進捗状況をstateにも反映
            setProgress({
              stage: thought.agentName || 'システム',
              progress: progressPercent,
              message: thought.message || thought.thought || '処理中...',
              percent: progressPercent,
              timestamp: thought.timestamp
            });
          }
          // 通常のメッセージ処理
          else if (typeof thought.thought === 'string' && thought.thought.trim().length > 0) {
            messageText = thought.thought;
          } else if (typeof thought.message === 'string' && thought.message.trim().length > 0) {
            messageText = thought.message;
          } else if (typeof (thought as any).content === 'string' && (thought as any).content.trim().length > 0) {
            messageText = (thought as any).content;
          } else if (typeof thought.thought === 'object' && thought.thought !== null) {
            try {
              messageText = JSON.stringify(thought.thought, null, 2);
            } catch (e) {
              console.error("思考オブジェクトのシリアル化エラー:", e);
            }
          } else if (typeof thought.message === 'object' && thought.message !== null) {
            try {
              messageText = JSON.stringify(thought.message, null, 2);
            } catch (e) {
              console.error("メッセージオブジェクトのシリアル化エラー:", e);
            }
          }
          
          // メッセージタイプの判断を改善
          let messageType = 'info';
          
          // stepが「progress」の場合は、処理中タイプとして扱う
          if (thought.step === 'progress') {
            messageType = 'thinking';
          }
          // typeプロパティを最優先で使用
          else if (thought.type) {
            const typeStr = typeof thought.type === 'string' ? thought.type.toLowerCase() : '';
            if (typeStr.includes('error') || typeStr.includes('エラー')) {
              messageType = 'error';
            } else if (typeStr.includes('success') || typeStr.includes('complete') || typeStr === 'システム') {
              messageType = 'success';
            } else if (typeStr.includes('think') || typeStr.includes('process') || typeStr === 'processing' || typeStr === 'progress') {
              messageType = 'thinking';
            }
          }
          // agentTypeがある場合は次に使用
          else if (thought.agentType) {
            const agentTypeStr = thought.agentType.toLowerCase();
            if (agentTypeStr.includes('error') || agentTypeStr.includes('エラー')) {
              messageType = 'error';
            } else if (agentTypeStr.includes('success') || agentTypeStr === 'システム') {
              messageType = 'success';
            } else if (agentTypeStr.includes('think') || agentTypeStr.includes('process')) {
              messageType = 'thinking';
            }
          }
          // stepで判断
          else if (thought.step) {
            const stepStr = thought.step.toLowerCase();
            if (stepStr.includes('error')) {
              messageType = 'error';
            } else if (stepStr.includes('complete') || stepStr.includes('finalization')) {
              messageType = 'success';
            } else if (stepStr.includes('process') || stepStr.includes('preparation') || stepStr === 'progress') {
              messageType = 'thinking';
            }
          }
          // メッセージ内容を基にタイプを推測（最終手段）
          else if (messageText.toLowerCase().includes('error') || messageText.toLowerCase().includes('エラー')) {
            messageType = 'error';
          } else if (messageText.toLowerCase().includes('complete') || messageText.toLowerCase().includes('成功')) {
            messageType = 'success';
          } else if (messageText.toLowerCase().includes('進捗状況') || messageText.toLowerCase().includes('処理中')) {
            messageType = 'thinking';
          }
          
          // エージェント名の取得方法を改善
          let agentName = thought.agentName || (thought as any).agent || "AI エージェント";
          
          // 進捗メッセージは明示的にマーク
          if (thought.step === 'progress' || thought.type === 'progress') {
            agentName = '進捗状況';
          }
          
          return {
            timestamp,
            agentName,
            message: messageText,
            type: messageType
          };
        });
        
        // ユニークなエージェント名のリストを更新（タブ用）
        const uniqueAgentNames = Array.from(new Set(
          externalThoughts.map(t => {
            // 進捗メッセージは特別に処理
            if (t.step === 'progress' || t.type === 'progress') {
              return '進捗状況';
            }
            return t.agentName || (t as any).agent || "AI エージェント";
          })
        ));
        setAgentNames(uniqueAgentNames);
        
        // 時間順にソート
        const sortedThoughts = convertedThoughts.sort((a, b) => a.timestamp - b.timestamp);
        
        console.log("変換後のthoughts:", sortedThoughts.length);
        setInternalThoughts(sortedThoughts);
        setIsProcessing(sortedThoughts.length > 0);
      } catch (e) {
        console.error("思考データの変換エラー:", e);
      }
    } else {
      console.log("AgentThoughtsPanel: thoughtsが空です");
    }
  }, [externalThoughts]);
  
  // マウント時にrefを初期化とWebSocketの状態処理
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    // roleModelIdが存在する場合は、親コンポーネントで既に設定されているはずなのでログだけ出力
    if (roleModelId) {
      console.log(`AgentThoughtsPanel: roleModelId=${roleModelId}が設定されました`);
    }
    
    return () => {
      isComponentMountedRef.current = false;
    };
  }, [roleModelId]);
  
  // アクティブタブが変更されたときにメッセージをフィルタリング
  useEffect(() => {
    if (activeTab === 'all') {
      setFilteredThoughts(internalThoughts);
    } else {
      setFilteredThoughts(internalThoughts.filter(thought => thought.agentName === activeTab));
    }
  }, [activeTab, internalThoughts]);
  
  // エージェント名の一覧を更新
  useEffect(() => {
    if (internalThoughts.length > 0) {
      // TypeScript を満足させるために型アサーションを使用
      const uniqueAgents = Array.from(new Set(internalThoughts.map(t => t.agentName))) as string[];
      setAgentNames(uniqueAgents);
    }
  }, [internalThoughts]);
  
  // 注記：独自のWebSocket接続は無効化し、親コンポーネントから渡されるthoughtsを使用
  // これにより、重複接続による問題を回避し、コンポーネント間で一貫したデータを表示
  // const reconnect = () => { ... }
  // const setupSocketHandlers = (socket: WebSocket) => { ... }
  
  // メッセージタイプに応じたアイコンを取得
  const getIconForType = useCallback((type: string) => {
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
  }, []);
  
  // 進捗状況に応じたカラーを取得
  const getProgressColor = useCallback(() => {
    if (!progress) return 'bg-gray-200';
    
    const progressValue = progress.progress || progress.percent || 0;
    
    if (progressValue < 33) {
      return 'bg-blue-500';
    } else if (progressValue < 66) {
      return 'bg-yellow-500';
    } else {
      return 'bg-green-500';
    }
  }, [progress]);
  
  // 日時フォーマット
  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP');
  }, []);
  
  // 情報整理ダッシュボードのタブとして表示する場合
  if (height) {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="p-3 bg-white border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-base">エージェント処理ログ</h2>
              <p className="text-sm text-gray-500">AIエージェントの処理内容をリアルタイムで表示します</p>
            </div>
            {isProcessing && onCancel && (
              <button 
                onClick={onCancel}
                className="py-1 px-3 bg-red-100 text-red-800 hover:bg-red-200 rounded-md text-sm transition-colors"
              >
                処理をキャンセル
              </button>
            )}
          </div>
        </div>

        {progress && (
          <div className="px-4 py-2">
            <div className="flex justify-between mb-1">
              <span className="text-sm font-semibold">{progress.stage}</span>
              <span className="text-sm">{progress.progress || progress.percent || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div 
                className={`${getProgressColor()} h-2.5 rounded-full transition-all progress-bar-animated`} 
                style={{ width: `${progress.progress || progress.percent || 0}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-500 mt-1">{progress.message}</p>
          </div>
        )}

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-2 border-b">
            <TabsList className="mb-2 w-full overflow-x-auto flex flex-wrap space-x-1 pb-1">
              <TabsTrigger value="all" className="flex-shrink-0">すべて</TabsTrigger>
              {agentNames.map(agent => (
                <TabsTrigger key={agent} value={agent} className="flex-shrink-0">
                  {agent}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          
          <div className="flex-1 p-0 overflow-hidden">
            <TabsContent value={activeTab} className="m-0 h-full">
              <ScrollArea className={`${height || 'h-[calc(100vh-200px)]'} px-4 py-4`}>
                {filteredThoughts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40">
                    <p className="text-gray-500">エージェント処理データがありません</p>
                    <p className="text-xs text-gray-400 mt-1">プロセスを開始すると、ここにエージェントの思考過程が表示されます</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredThoughts.map((thought, index) => (
                      <div key={index} className="mb-4 animate-fadeIn">
                        <div className={`flex gap-3 ${index > 0 && filteredThoughts[index-1].agentName === thought.agentName ? 'mt-2' : 'mt-4'}`}>
                          {/* エージェントアイコン (最初のメッセージまたはエージェントが変わった時だけ表示) */}
                          {(index === 0 || filteredThoughts[index-1].agentName !== thought.agentName) && (
                            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center
                              ${thought.type === 'thinking' ? 'bg-blue-100' : 
                                thought.type === 'error' ? 'bg-red-100' : 
                                thought.type === 'success' ? 'bg-green-100' : 'bg-purple-100'}`}>
                              {getIconForType(thought.type)}
                            </div>
                          )}
                          {/* 空白スペース (続きのメッセージの場合) */}
                          {index > 0 && filteredThoughts[index-1].agentName === thought.agentName && (
                            <div className="flex-shrink-0 h-8 w-8"></div>
                          )}
                          
                          {/* メッセージ本体 */}
                          <div className="flex-1">
                            {/* エージェント名 (最初のメッセージまたはエージェントが変わった時だけ表示) */}
                            {(index === 0 || filteredThoughts[index-1].agentName !== thought.agentName) && (
                              <div className="flex items-center mb-1">
                                <span className="font-medium text-sm">{thought.agentName}</span>
                                <span className="text-xs text-gray-500 ml-2">
                                  {formatTime(thought.timestamp)}
                                </span>
                              </div>
                            )}
                            
                            {/* メッセージコンテンツ */}
                            <div className={`text-sm rounded-lg p-3 whitespace-pre-wrap thought-bubble
                              ${thought.type === 'thinking' ? 'bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-800' : 
                                thought.type === 'error' ? 'bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800' : 
                                thought.type === 'success' ? 'bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-800' : 
                                'bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800'}
                              ${thought.type === 'thinking' ? 'agent-thinking' : ''}`}>
                              {thought.message}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
        
        <div className="p-2 text-xs text-gray-500 border-t">
          {filteredThoughts.length} 件のエージェント処理ログを表示
        </div>
      </div>
    );
  }
  
  // パネルが非表示の場合は何も表示しない
  if (!isVisible) {
    return null;
  }

  // フローティングパネルとして表示する場合（従来の表示方式）
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
            {isProcessing && onCancel && (
              <button 
                onClick={onCancel}
                className="py-1 px-3 bg-red-100 text-red-800 hover:bg-red-200 rounded-md text-sm transition-colors mr-2"
              >
                キャンセル
              </button>
            )}
            {onClose && (
              <button 
                onClick={onClose}
                className="ml-2 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
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
            <span className="text-sm">{progress.progress || progress.percent || 0}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div 
              className={`${getProgressColor()} h-2.5 rounded-full transition-all progress-bar-animated`} 
              style={{ width: `${progress.progress || progress.percent || 0}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{progress.message}</p>
        </div>
      )}
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-6">
          <TabsList className="mb-2 w-full overflow-x-auto flex flex-wrap space-x-1 pb-1">
            <TabsTrigger value="all" className="flex-shrink-0">すべて</TabsTrigger>
            {agentNames.map(agent => (
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
                  <p className="text-gray-500 dark:text-gray-400">思考データがありません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredThoughts.map((thought, index) => (
                    <div key={index} className="mb-4 animate-fadeIn">
                      <div className={`flex gap-3 ${index > 0 && filteredThoughts[index-1].agentName === thought.agentName ? 'mt-2' : 'mt-4'}`}>
                        {/* エージェントアイコン (最初のメッセージまたはエージェントが変わった時だけ表示) */}
                        {(index === 0 || filteredThoughts[index-1].agentName !== thought.agentName) && (
                          <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center
                            ${thought.type === 'thinking' ? 'bg-blue-100' : 
                              thought.type === 'error' ? 'bg-red-100' : 
                              thought.type === 'success' ? 'bg-green-100' : 'bg-purple-100'}`}>
                            {getIconForType(thought.type)}
                          </div>
                        )}
                        {/* 空白スペース (続きのメッセージの場合) */}
                        {index > 0 && filteredThoughts[index-1].agentName === thought.agentName && (
                          <div className="flex-shrink-0 h-8 w-8"></div>
                        )}
                        
                        {/* メッセージ本体 */}
                        <div className="flex-1">
                          {/* エージェント名 (最初のメッセージまたはエージェントが変わった時だけ表示) */}
                          {(index === 0 || filteredThoughts[index-1].agentName !== thought.agentName) && (
                            <div className="flex items-center mb-1">
                              <span className="font-medium text-sm">{thought.agentName}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                {formatTime(thought.timestamp)}
                              </span>
                            </div>
                          )}
                          
                          {/* メッセージコンテンツ */}
                          <div className={`text-sm rounded-lg p-3 whitespace-pre-wrap thought-bubble
                            ${thought.type === 'thinking' ? 'bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-800' : 
                              thought.type === 'error' ? 'bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800' : 
                              thought.type === 'success' ? 'bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-800' : 
                              'bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800'}
                            ${thought.type === 'thinking' ? 'agent-thinking' : ''}`}>
                            {thought.message}
                          </div>
                        </div>
                      </div>
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