import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import KnowledgeGraphViewer from '@/components/knowledge-graph/KnowledgeGraphViewer';
import { useToast } from "@/hooks/use-toast";
import MultiAgentChatPanel from '@/components/chat/MultiAgentChatPanel';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket';
import { CreateCollectionPlanWithCrewAIButton } from '@/components/knowledge-graph/CreateCollectionPlanWithCrewAIButton';
import { 
  Plus, 
  FileText, 
  ExternalLink, 
  RefreshCw,
  BrainCircuit,
  Sparkles,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

// モックデータ
const mockCollectionPlans = [
  { id: 'plan1', name: 'プラン1', createdAt: '2025/3/7', updatedAt: '2025/4/7' },
  { id: 'plan2', name: 'プラン2', createdAt: '2025/3/15', updatedAt: '2025/4/5' },
];

// プラン詳細のモックデータ
const mockPlanDetails = {
  name: '収集プラン',
  status: '実行単位',
  completion: '通知先',
  tools: ['Google', 'RSS'],
  sources: [
    { id: 'source1', media: 'https://example.com/news' },
    { id: 'source2', media: 'https://example.org/blog' }
  ]
};

interface InformationDashboardProps {
  id?: string;
}

const InformationDashboard: React.FC<InformationDashboardProps> = () => {
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
  const { messages, agentThoughts, isConnected, sendMessage: send } = useMultiAgentWebSocket();
  
  // エージェントの思考が届いたらパネルを表示
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
    // チャットメッセージを送信
    send('chat_message', {
      roleModelId,
      message
    });
  };
  
  // CrewAIで知識グラフを生成する関数
  const generateGraphMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/knowledge-graph/generate/${roleModelId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "プロセス開始",
        description: "CrewAIによるナレッジグラフと情報収集プランの生成を開始しました。しばらくお待ちください。"
      });
      setShowAgentPanel(true); // エージェントパネルを表示
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "知識グラフの生成に失敗しました。",
        variant: "destructive"
      });
    }
  });

  // プランが選択されたときの処理
  useEffect(() => {
    if (mockCollectionPlans.length > 0 && !selectedPlan) {
      setSelectedPlan(mockCollectionPlans[0].id);
    }
  }, [selectedPlan]);

  // 新規ソース追加関数
  const handleAddSource = () => {
    toast({
      title: "新規ソース追加",
      description: "新しい情報ソースを追加する機能は開発中です。"
    });
  };

  // エージェントパネルを表示するヘルパー関数
  const showAgentPanelHandler = useCallback(() => {
    setShowAgentPanel(true);
  }, []);
  
  return (
    <div className="flex flex-col h-screen overflow-hidden panel-container">
      <div className="bg-white border-b px-4 py-0.5 flex justify-between items-center">
        <h1 className="text-base font-semibold">
          情報整理ダッシュボード（{roleModel?.name || 'ロール定義名'}）
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
                        
                        if (newState) {
                          toast({
                            title: "パネルを最小化",
                            description: "情報収集プランパネルを最小化しました"
                          });
                        } else {
                          toast({
                            title: "パネルを展開",
                            description: "情報収集プランパネルを展開しました"
                          });
                        }
                      }}
                      title={leftPanelCollapsed ? "パネルを展開" : "パネルを最小化"}
                    >
                      {leftPanelCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  <div className="flex-1 overflow-auto p-4">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left px-2 py-0.5 font-medium text-xs">プラン名</th>
                          <th className="text-left px-2 py-0.5 font-medium text-xs">作成日</th>
                          <th className="text-left px-2 py-0.5 font-medium text-xs">更新日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mockCollectionPlans.map((plan) => (
                          <tr 
                            key={plan.id}
                            className={`hover:bg-gray-100 cursor-pointer ${selectedPlan === plan.id ? 'bg-blue-50' : ''}`}
                            onClick={() => setSelectedPlan(plan.id)}
                          >
                            <td className="px-2 py-0.5 border-t border-gray-200 text-xs">プラン{plan.id.replace('plan', '')}</td>
                            <td className="px-2 py-0.5 border-t border-gray-200 text-xs">{plan.createdAt}</td>
                            <td className="px-2 py-0.5 border-t border-gray-200 text-xs">{plan.updatedAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t mt-2 overflow-auto">
                    <div className="px-4 py-3 bg-white">
                      <h2 className="font-semibold text-sm">プラン詳細</h2>
                    </div>
                    <div className="p-4 space-y-2">
                      <div>
                        <h3 className="text-sm font-medium">収集プラン</h3>
                        <p className="text-sm">{mockPlanDetails.name}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium">実行頻度</h3>
                        <p className="text-sm">{mockPlanDetails.status}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium">通知先</h3>
                        <p className="text-sm">{mockPlanDetails.completion}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium">利用するツール</h3>
                        <div className="space-y-0.5 mt-1">
                          {mockPlanDetails.tools.map((tool, index) => (
                            <div key={index} className="text-sm">{tool}</div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex items-center justify-between mt-2">
                          <table className="w-full text-xs mt-1 border-collapse border">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="text-left px-2 py-0.5 font-medium text-xs">ソース</th>
                                <th className="text-left px-1 py-0.5 font-medium w-10 text-center text-xs">詳細</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mockPlanDetails.sources.map((source) => (
                                <tr key={source.id} className="border-t">
                                  <td className="px-2 py-0.5 truncate text-xs" style={{ maxWidth: "120px" }}>
                                    メディア https://
                                  </td>
                                  <td className="px-1 py-0.5 text-center">
                                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="text-right mt-1">
                          <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={handleAddSource}>
                            <Plus className="h-3 w-3 mr-1" />
                            追加
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
              <PanelResizeHandle className="w-1.5 bg-gray-200 hover:bg-blue-500 transition-colors duration-200 cursor-col-resize" />
            </>
          )}

          {/* メインコンテンツエリア */}
          <Panel 
            id="main-panel"
            defaultSize={showAgentPanel ? 50 : 80}
            className={`flex flex-col z-10 ${mainPanelMaximized ? 'flex-grow' : ''}`}
          >
            <Tabs defaultValue="knowledgeGraph" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b bg-white flex justify-between items-center px-4 py-3">
                <TabsList className="h-8 border-b-0 bg-transparent">
                  <TabsTrigger value="knowledgeGraph" className="data-[state=active]:bg-white">
                    ナレッジグラフ
                  </TabsTrigger>
                  <TabsTrigger value="summarizedResults" className="data-[state=active]:bg-white">
                    要約結果
                  </TabsTrigger>
                  <TabsTrigger value="memo" className="data-[state=active]:bg-white">
                    メモ
                  </TabsTrigger>
                </TabsList>
                
                <div className="flex items-center gap-2">
                  {/* CrewAIボタンと情報収集プラン作成ボタン - 順序変更 */}
                  {activeTab === 'knowledgeGraph' && roleModelId !== 'default' && (
                    <>
                      <Button
                        onClick={() => generateGraphMutation.mutate()}
                        disabled={generateGraphMutation.isPending}
                        variant="outline"
                        className="text-sm"
                        size="sm"
                      >
                        <Sparkles className="h-4 w-4 mr-1 text-purple-600" />
                        {generateGraphMutation.isPending ? "生成中..." : "CrewAIでナレッジグラフと情報収集プランを生成"}
                      </Button>
                      
                      {/* 情報収集プラン作成ボタン - 単独コンポーネント化してここに配置 */}
                      <CreateCollectionPlanWithCrewAIButton 
                        size="sm"
                        variant="outline"
                        className="text-sm"
                        onStart={showAgentPanelHandler}
                        defaultKeywords={roleModel?.keywords || []}
                        defaultIndustry={roleModel?.industry || ''}
                      />
                    </>
                  )}
                </div>
              </div>
              
              {/* ナレッジグラフタブ */}
              <TabsContent value="knowledgeGraph" className="flex-1 h-full overflow-hidden p-0 m-0">
                <div className="p-2">
                  <KnowledgeGraphViewer
                    roleModelId={roleModelId}
                    width="100%"
                    height="calc(100vh - 130px)"
                    onGraphDataChange={setHasKnowledgeGraph}
                  />
                </div>
              </TabsContent>
              
              {/* 要約結果タブ */}
              <TabsContent value="summarizedResults" className="p-0 m-0">
                <div className="p-6">
                  <div className="h-[calc(100vh-160px)] overflow-auto">
                    <div className="text-center text-gray-500 mt-20">
                      <p>要約結果は現在開発中です</p>
                      <p className="text-sm mt-2">情報収集プランを実行すると、ここに要約結果が表示されます</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              {/* メモタブ */}
              <TabsContent value="memo" className="p-0 m-0">
                <div className="p-6">
                  <div className="h-[calc(100vh-160px)] overflow-auto">
                    <div className="text-center text-gray-500 mt-20">
                      <p>メモ機能は現在開発中です</p>
                      <p className="text-sm mt-2">ここに重要な情報をメモすることができるようになります</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Panel>
          
          {/* 右側パネルが最小化されているときのアイコン */}
          {!showAgentPanel && (
            <div className="w-8 border-l bg-gray-50 flex flex-col items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 mt-2" 
                onClick={() => {
                  setShowAgentPanel(true);
                  // メインパネルが最大化されていたら元に戻す
                  if (mainPanelMaximized) {
                    setMainPanelMaximized(false);
                  }
                  toast({
                    title: "パネルを展開",
                    description: "AIエージェント思考パネルを展開しました"
                  });
                }}
                title="AIエージェントパネルを表示"
              >
                <BrainCircuit className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* 右側パネル: マルチAIエージェント思考パネル */}
          {showAgentPanel && (
            <>
              <PanelResizeHandle className="w-1.5 bg-gray-200 hover:bg-blue-500 transition-colors duration-200 cursor-col-resize" />
              <Panel 
                id="right-panel"
                defaultSize={30} 
                minSize={20} 
                className="border-l relative z-10"
                onResize={(size) => {
                  // パネルのサイズが10%以下になったら自動的に最小化
                  if (size < 8 && showAgentPanel) {
                    setShowAgentPanel(false);
                    toast({
                      title: "パネルを最小化",
                      description: "AIエージェント思考パネルを最小化しました"
                    });
                  }
                }}
              >
                <div className="h-full flex flex-col bg-gray-50">
                  {/* 右パネルのヘッダーは削除 - MultiAgentChatPanelのヘッダーだけを使用 */}
                  
                  <div className="flex-1 overflow-hidden">
                    <MultiAgentChatPanel 
                      roleModelId={roleModelId} 
                      messages={messages.map(msg => ({
                        id: crypto.randomUUID(),
                        content: typeof msg.payload === 'string' ? msg.payload : 
                               typeof msg.payload?.message === 'string' ? msg.payload.message : 
                               JSON.stringify(msg.payload),
                        sender: msg.type === 'chat_message' && msg.payload?.roleModelId ? 'ai' : 'user',
                        timestamp: new Date(msg.timestamp || Date.now())
                      }))}
                      agentThoughts={agentThoughts.map(thought => ({
                        id: crypto.randomUUID(),
                        agentName: thought.agentName || 'Agent',
                        agentType: 'agent',
                        thought: thought.thought || '',
                        timestamp: new Date(thought.timestamp || Date.now())
                      }))}
                      onSendMessage={handleSendMessage}
                    />
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

export default InformationDashboard;