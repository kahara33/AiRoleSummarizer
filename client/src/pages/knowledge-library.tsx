import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import KnowledgeGraphViewer from '@/components/knowledge-graph/KnowledgeGraphViewer';
import { useToast } from "@/hooks/use-toast";
import MultiAgentChatPanel from '@/components/chat/MultiAgentChatPanel';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket-fixed';
import AgentConversation from '@/components/agent-activity/AgentConversation';
import InformationPlanList from '@/components/collection-plan/InformationPlanList';
import InformationPlanDetail from '@/components/collection-plan/InformationPlanDetail';

import type { ProgressUpdate } from '@/hooks/use-multi-agent-websocket-fixed';
// UIコンポーネントではなく、直接ボタンを使用
import { 
  Plus, 
  FileText, 
  ExternalLink, 
  RefreshCw,
  BrainCircuit,
  Sparkles,
  Maximize2,
  Minimize2,
  Send,
  Search
} from 'lucide-react';
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

interface KnowledgeLibraryProps {
  id?: string;
}

const KnowledgeLibrary: React.FC<KnowledgeLibraryProps> = () => {
  const params = useParams();
  const { id } = params;
  const roleModelId = id || 'default';
  const [activeTab, setActiveTab] = useState<string>('knowledgeGraph');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [hasKnowledgeGraph, setHasKnowledgeGraph] = useState<boolean>(false);
  const [showAgentPanel, setShowAgentPanel] = useState<boolean>(true); // デフォルトで表示
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState<boolean>(false);
  const [mainPanelMaximized, setMainPanelMaximized] = useState<boolean>(false);
  const { toast } = useToast();

  // ロールモデルデータを取得
  const { data: roleModel } = useQuery<any>({
    queryKey: [`/api/role-models/${roleModelId}`],
    enabled: roleModelId !== 'default',
  });
  
  // WebSocketメッセージを処理
  const { 
    agentThoughts, 
    isConnected, 
    sendMessage: send, 
    connect, 
    isProcessing, 
    progressUpdates,
    forceResetProcessing
  } = useMultiAgentWebSocket();
  
  // KnowledgeGraphViewerからのデータ有無状態を更新する関数
  const handleKnowledgeGraphData = (hasData: boolean) => {
    setHasKnowledgeGraph(hasData);
  };
  
  // チャットメッセージ用の状態
  const [messages, setMessages] = useState<any[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  
  // roleModelIdが設定されたらWebSocketを接続
  useEffect(() => {
    if (roleModelId && !isConnected) {
      console.log('WebSocketを接続します: roleModelId =', roleModelId);
      connect(roleModelId);
    }
    
    // コンポーネントがアンマウントされたときにクリーンアップ
    return () => {
      console.log('ナレッジライブラリのWebSocket接続をクリーンアップします');
    };
  }, [roleModelId, isConnected, connect]);
  
  // 定期的にWebSocket接続を確認し、切断されていたら再接続
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (roleModelId && !isConnected) {
        console.log('WebSocket接続が切断されています。再接続を試みます...');
        connect(roleModelId);
      }
    }, 10000); // 10秒ごとに確認
    
    return () => clearInterval(checkInterval);
  }, [roleModelId, isConnected, connect]);
  
  // エージェントの思考が届いたらパネルを表示する
  useEffect(() => {
    if (agentThoughts.length > 0) {
      setShowAgentPanel(true);
    }
  }, [agentThoughts]);
  
  // パネルのサイズを調整する
  useEffect(() => {
    // 両方のパネルが閉じられている場合はメインパネルを100%にする
    if (leftPanelCollapsed && !showAgentPanel) {
      setMainPanelMaximized(true);
    } else if (!leftPanelCollapsed || showAgentPanel) {
      // どちらかのパネルが表示されたらメインパネルの最大化を解除
      setMainPanelMaximized(false);
    }
    
    // 必要があればリサイズイベントを強制的に発火させる
    window.dispatchEvent(new Event('resize'));
  }, [leftPanelCollapsed, showAgentPanel]);
  
  // メインパネルが最大化されている場合は他のパネルを閉じる
  useEffect(() => {
    if (mainPanelMaximized) {
      setLeftPanelCollapsed(true);
      setShowAgentPanel(false);
    }
  }, [mainPanelMaximized]);
  
  // メッセージ送信関数
  const handleSendMessage = (message: string) => {
    if (!send || !roleModelId) return;
    
    // チャットメッセージを送信
    send('chat_message', {
      roleModelId,
      message
    });
    
    console.log("ユーザーメッセージを送信:", message);
  };
  
  // AI知識ライブラリを生成する関数
  const generateKnowledgeLibraryMutation = useMutation({
    mutationFn: async () => {
      // WebSocketが切断されている場合は再接続
      if (!isConnected && roleModelId && roleModelId !== 'default') {
        console.log(`WebSocketを接続: ${roleModelId}`);
        connect(roleModelId);
        
        // WebSocket接続をしっかり確立するために少し待機
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // エージェントパネルを確実に表示
      setShowAgentPanel(true);
      
      // AIエージェント間の対話シミュレーション
      if (send) {
        console.log("エージェント間対話シミュレーションを開始");
        
        const agents = [
          { name: "オーケストレーター", type: "orchestrator" },
          { name: "戦略プランナー", type: "strategy_planner" },
          { name: "検索スペシャリスト", type: "search_specialist" },
          { name: "コンテンツアナリスト", type: "content_analyst" },
          { name: "ナレッジアーキテクト", type: "knowledge_architect" },
          { name: "レポートライター", type: "report_writer" }
        ];
        
        const thoughts = [
          "ナレッジライブラリのプロセスを開始します。各エージェントに役割を割り当てました。",
          "業界・キーワードから最適な情報収集戦略を設計しています。exa search APIの利用計画を立案中です。",
          "最適な検索クエリを構築中です。exa search APIパラメータを最適化しています。",
          "検索結果の詳細分析を行っています。重要情報の抽出と構造化を進めています。",
          "情報のナレッジグラフへの統合を行っています。エンティティ関係のマッピングを進めています。",
          "収集情報からレポートを作成しています。ユーザー好みに合わせた情報をキュレーションしています。"
        ];
        
        let delay = 500;
        agents.forEach((agent, index) => {
          setTimeout(() => {
            // エージェント思考メッセージ
            send('agent_thoughts', {
              id: `generated-thought-${index + 1}`,
              roleModelId: roleModelId,
              agentName: agent.name,
              agentType: agent.type,
              thought: thoughts[index],
              message: thoughts[index],
              type: "thinking",
              timestamp: new Date().toISOString()
            });
            
            // 少し遅れて進捗更新
            setTimeout(() => {
              send('progress', {
                roleModelId: roleModelId,
                stage: `プロセス進行中`,
                progress: Math.min(15 * (index + 1), 90),
                message: `プロセスが${Math.min(15 * (index + 1), 90)}%完了しました`,
                details: { step: agent.type },
                percent: Math.min(15 * (index + 1), 90)
              });
            }, 300);
          }, delay);
          
          delay += 1500; // 次のエージェントのディレイを増加
        });
        
        // 最後に成功メッセージ
        setTimeout(() => {
          send('agent_thoughts', {
            id: "generated-thought-completion",
            roleModelId: roleModelId,
            agentName: "オーケストレーター",
            agentType: "orchestrator",
            thought: "全エージェントの処理が完了しました。ナレッジライブラリと情報収集プランが正常に生成されました。",
            message: "処理完了: ナレッジライブラリと情報収集プランが生成されました。",
            type: "success",
            timestamp: new Date().toISOString()
          });
          
          // 完了進捗
          send('progress', {
            roleModelId: roleModelId,
            stage: "完了",
            progress: 100,
            message: "処理が完了しました",
            details: { step: "completion" },
            percent: 100
          });
        }, delay + 1000);
      }
      
      // 実際のAPIを呼び出す
      return apiRequest("POST", `/api/knowledge-library/generate/${roleModelId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "プロセス開始",
        description: "AI知識ライブラリの生成を開始しました。進捗状況はエージェントパネルで確認できます。"
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "AI知識ライブラリの生成に失敗しました。",
        variant: "destructive"
      });
    }
  });

  // 情報収集プランのステート
  const [selectedPlanData, setSelectedPlanData] = useState<any>(null);

  // プランが選択されたときの処理
  const handlePlanSelect = (plan: any) => {
    setSelectedPlan(plan.id);
    setSelectedPlanData(plan);
  };

  // 新規検索の実行
  const handleExaSearch = () => {
    toast({
      title: "Exa Search API実行",
      description: "Exa検索を実行します。結果は情報収集プランに反映されます。"
    });
    
    // TODO: Exa Search API実装
  };

  // エージェントパネルを表示するヘルパー関数
  const showAgentPanelHandler = useCallback(() => {
    setShowAgentPanel(true);
    
    // WebSocketが切断されている場合は再接続
    if (!isConnected && roleModelId) {
      console.log('WebSocketを再接続します');
      connect(roleModelId);
    }
  }, [isConnected, roleModelId, connect]);
  
  return (
    <div className="flex flex-col h-screen overflow-hidden panel-container">
      <div className="bg-white border-b px-4 py-0.5 flex justify-between items-center">
        <h1 className="text-base font-semibold">
          ナレッジライブラリ（{roleModel?.name || 'ロール定義名'}）
        </h1>
        <div className="flex items-center gap-2">
          {roleModelId !== 'default' && (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                className="px-2"
                onClick={() => {
                  toast({
                    title: "最新情報に更新",
                    description: "最新のデータに更新しました"
                  });
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="px-2"
                onClick={() => {
                  setShowAgentPanel(!showAgentPanel);
                  if (showAgentPanel) {
                    toast({
                      title: "パネルを最小化",
                      description: "AIエージェント思考パネルを最小化しました"
                    });
                  } else {
                    toast({
                      title: "パネルを表示",
                      description: "AIエージェント思考パネルを表示しました"
                    });
                  }
                }}
                title={showAgentPanel ? "AIエージェントパネルを最小化" : "AIエージェントパネルを表示"}
              >
                {showAgentPanel ? 
                  <BrainCircuit className="h-4 w-4 text-purple-600" /> : 
                  <BrainCircuit className="h-4 w-4" />
                }
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden panel-container">
        <PanelGroup direction="horizontal" className="relative" id="panel-group-main">
          {/* 左側パネルが最小化されているときのアイコン */}
          {leftPanelCollapsed && (
            <div className="w-8 border-r bg-gray-50 flex flex-col items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 mt-2" 
                onClick={() => {
                  // 最小化状態を解除
                  setLeftPanelCollapsed(false);
                  // メインパネルが最大化されていた場合は元に戻す
                  if (mainPanelMaximized) {
                    setMainPanelMaximized(false);
                  }
                  toast({
                    title: "パネルを展開",
                    description: "情報収集プランパネルを展開しました"
                  });
                }}
                title="パネルを展開"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* 左側パネル: 情報収集プラン一覧とプラン詳細 */}
          {!leftPanelCollapsed && (
            <>
              <Panel
                id="left-panel"
                defaultSize={20} 
                minSize={15} 
                maxSize={30}
                className="border-r"
                onResize={(size) => {
                  // パネルのサイズがminWidthよりも小さくなったら自動的に最小化
                  if (size < 8 && !leftPanelCollapsed) {
                    setLeftPanelCollapsed(true);
                    toast({
                      title: "パネルを最小化",
                      description: "情報収集プランパネルを最小化しました"
                    });
                  }
                }}
              >
                <div className="h-full overflow-hidden flex flex-col bg-gray-50">
                  <div className="px-4 py-3 border-b bg-white flex justify-between items-center">
                    <h2 className="font-semibold text-sm">情報収集プラン</h2>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 w-5 p-0" 
                      onClick={() => {
                        const newState = !leftPanelCollapsed;
                        setLeftPanelCollapsed(newState);
                        
                        // パネルを展開する場合は、メインパネルが最大化されていたら元に戻す
                        if (!newState && mainPanelMaximized) {
                          setMainPanelMaximized(false);
                        }
                        
                        toast({
                          title: newState ? "パネルを最小化" : "パネルを展開",
                          description: newState ? "情報収集プランパネルを最小化しました" : "情報収集プランパネルを展開しました"
                        });
                      }}
                      title={leftPanelCollapsed ? "パネルを展開" : "パネルを最小化"}
                    >
                      {leftPanelCollapsed ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  <div className="flex-1 overflow-auto">
                    {/* 情報収集プラン一覧 */}
                    {!selectedPlan ? (
                      <div className="h-full">
                        <InformationPlanList 
                          roleModelId={roleModelId}
                          onSelectPlan={handlePlanSelect}
                        />
                        
                        {/* Exa検索ボタン */}
                        <div className="p-3 border-t">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full" 
                            onClick={handleExaSearch}
                          >
                            <Search className="mr-2 h-4 w-4" />
                            Exa検索を実行
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* プラン詳細 */
                      <div className="h-full">
                        <InformationPlanDetail
                          plan={selectedPlanData}
                          onBack={() => setSelectedPlan(null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
              
              <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors" />
            </>
          )}
          
          {/* 中央パネル: ナレッジグラフ、要約、メモ */}
          <Panel id="main-panel" defaultSize={leftPanelCollapsed && !showAgentPanel ? 100 : 50}>
            <div className="h-full flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <div className="bg-white px-4 border-b flex justify-between items-center">
                  <TabsList>
                    <TabsTrigger value="knowledgeGraph">ナレッジグラフ</TabsTrigger>
                    <TabsTrigger value="summary">要約</TabsTrigger>
                    <TabsTrigger value="notes">メモ</TabsTrigger>
                  </TabsList>
                  
                  <div className="flex items-center space-x-1">
                    {activeTab === 'knowledgeGraph' && roleModelId !== 'default' && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className={`text-xs ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => generateKnowledgeLibraryMutation.mutate()}
                        disabled={isProcessing || generateKnowledgeLibraryMutation.isPending}
                        title="AI知識ライブラリを生成"
                      >
                        {isProcessing || generateKnowledgeLibraryMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                            処理中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-3 w-3" />
                            AI生成
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => {
                        setMainPanelMaximized(!mainPanelMaximized);
                        toast({
                          title: mainPanelMaximized ? "通常表示" : "最大化表示",
                          description: mainPanelMaximized ? "パネルを通常サイズに戻しました" : "メインパネルを最大化しました"
                        });
                      }}
                      title={mainPanelMaximized ? "通常表示に戻す" : "最大化表示"}
                    >
                      {mainPanelMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto">
                  <TabsContent value="knowledgeGraph" className="h-full m-0 p-0 data-[state=active]:flex-1">
                    {roleModelId !== 'default' ? (
                      <KnowledgeGraphViewer 
                        roleModelId={roleModelId}
                        onDataStatus={handleKnowledgeGraphData}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center bg-gray-50">
                        <div className="text-center p-4">
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <h3 className="text-lg font-medium">ロールが選択されていません</h3>
                          <p className="text-sm text-gray-500 mt-1">ロールモデルを選択して、ナレッジグラフを表示します。</p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="summary" className="h-full m-0 data-[state=active]:flex-1">
                    <div className="h-full flex flex-col p-4">
                      <h3 className="text-base font-medium mb-2">情報要約</h3>
                      {roleModelId !== 'default' ? (
                        <div className="flex-1 overflow-auto bg-white p-4 rounded-md border">
                          {/* 要約コンテンツ - 今後実装 */}
                          <p className="text-gray-500">要約は生成中または未生成です。AIエージェントによる要約生成をお待ちください。</p>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center bg-gray-50">
                          <div className="text-center p-4">
                            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <h3 className="text-lg font-medium">ロールが選択されていません</h3>
                            <p className="text-sm text-gray-500 mt-1">ロールモデルを選択して、要約を表示します。</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="notes" className="h-full m-0 data-[state=active]:flex-1">
                    <div className="h-full flex flex-col p-4">
                      <h3 className="text-base font-medium mb-2">メモ</h3>
                      <div className="flex-1 mb-4">
                        <Textarea 
                          placeholder="メモを入力..."
                          className="h-full resize-none"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button variant="default" size="sm">
                          保存
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </Panel>
          
          {/* 右側パネル: AIエージェント活動エリア */}
          {showAgentPanel && (
            <>
              <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors" />
              
              <Panel id="right-panel" defaultSize={30} minSize={20} maxSize={50}>
                <div className="h-full overflow-hidden flex flex-col border-l">
                  <div className="px-4 py-3 border-b bg-white flex justify-between items-center">
                    <h2 className="font-semibold text-sm">AIエージェント活動</h2>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 w-5 p-0" 
                      onClick={() => {
                        setShowAgentPanel(false);
                        toast({
                          title: "パネルを最小化",
                          description: "AIエージェント活動パネルを最小化しました"
                        });
                      }}
                      title="パネルを最小化"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 overflow-auto">
                    <AgentConversation 
                      agentThoughts={agentThoughts}
                      progressUpdates={progressUpdates}
                      isProcessing={isProcessing}
                      roleModelId={roleModelId}
                      className="h-full"
                    />
                  </div>
                  
                  <div className="p-3 border-t">
                    <div className="relative">
                      <Textarea 
                        placeholder="メッセージを入力..."
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        className="pr-12 resize-none"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (userInput.trim()) {
                              handleSendMessage(userInput.trim());
                              setUserInput('');
                            }
                          }
                        }}
                      />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="absolute right-1 bottom-1"
                        onClick={() => {
                          if (userInput.trim()) {
                            handleSendMessage(userInput.trim());
                            setUserInput('');
                          }
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
};

export default KnowledgeLibrary;