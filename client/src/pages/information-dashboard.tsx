import React, { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import KnowledgeGraphViewer from '@/components/knowledge-graph/KnowledgeGraphViewer';
import CreateCollectionPlanButton from '@/components/collection-plan/CreateCollectionPlanButton';
import { useToast } from "@/hooks/use-toast";
import MultiAgentChatPanel from '@/components/chat/MultiAgentChatPanel';
import { useWebSocket } from '@/hooks/use-multi-agent-websocket';
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
import { Separator } from '@/components/ui/separator';
// react-resizable-panelsのインポート
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

// モックデータ（後で実装時に置き換える）
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

  // WebSocketメッセージを処理
  const { messages, agentThoughts, isConnected, send } = useWebSocket(roleModelId);
  
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
    send({
      type: 'chat_message',
      payload: {
        roleModelId,
        message
      }
    });
  };
  
  // CrewAIで知識グラフを生成する関数
  const generateGraphMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/knowledge-graph/generate/${roleModelId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "知識グラフ生成開始",
        description: "CrewAIによる知識グラフの生成を開始しました。しばらくお待ちください。"
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

  // ロールモデルデータのフェッチ
  const { data: roleModel } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}`);
      return await res.json();
    },
    enabled: !!roleModelId && roleModelId !== 'default'
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

  return (
    <div className="flex flex-col h-screen overflow-hidden panel-container">
      <div className="bg-white border-b px-4 py-0.5 flex justify-between items-center">
        <h1 className="text-base font-semibold">
          情報整理ダッシュボード（{roleModel?.name || 'ロール定義名'}）
        </h1>
        <div className="flex items-center gap-2">
          {roleModelId !== 'default' && (
            <>
              {/* 情報収集プラン作成ボタン */}
              <CreateCollectionPlanButton 
                roleModelId={roleModelId}
                industryIds={roleModel?.industries?.map((ind: any) => ind.id) || []}
                keywordIds={roleModel?.keywords?.map((kw: any) => kw.id) || []}
                disabled={false}
                hasKnowledgeGraph={hasKnowledgeGraph}
              />
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
        <PanelGroup direction="horizontal" className="relative">
          {/* 左側パネルが最小化されているときのアイコン */}
          {leftPanelCollapsed && (
            <div className="w-8 border-r bg-gray-50 flex flex-col items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 mt-2" 
                onClick={() => {
                  setLeftPanelCollapsed(false);
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
          <Panel 
            defaultSize={20} 
            minSize={leftPanelCollapsed ? 0 : 15} 
            maxSize={leftPanelCollapsed ? 0 : 30} 
            className={`border-r ${leftPanelCollapsed ? 'hidden' : ''}`}
            collapsible={true}
          >
            <div className="h-full overflow-hidden flex flex-col bg-gray-50">
              <div className="px-4 py-3 border-b bg-white flex justify-between items-center">
                <h2 className="font-semibold text-sm">情報収集プラン</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 w-5 p-0" 
                  onClick={() => {
                    setLeftPanelCollapsed(!leftPanelCollapsed);
                    if (!leftPanelCollapsed) {
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

          {/* メインコンテンツエリア */}
          <Panel 
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
                  {/* CrewAIで知識グラフを生成するボタン */}
                  {activeTab === 'knowledgeGraph' && roleModelId !== 'default' && (
                    <Button
                      onClick={() => generateGraphMutation.mutate()}
                      disabled={generateGraphMutation.isPending}
                      variant="outline"
                      className="text-sm"
                      size="sm"
                    >
                      <Sparkles className="h-4 w-4 mr-1 text-purple-600" />
                      {generateGraphMutation.isPending ? "生成中..." : "CrewAIで知識グラフを生成"}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* ナレッジグラフタブ */}
              <TabsContent value="knowledgeGraph" className="flex-1 h-full overflow-hidden p-0 m-0">
                <div className="p-4">
                  <KnowledgeGraphViewer
                    roleModelId={roleModelId}
                    width="100%"
                    height="calc(100vh - 128px)"
                    onGraphDataChange={setHasKnowledgeGraph}
                  />
                </div>
              </TabsContent>
              
              {/* 要約結果タブ */}
              <TabsContent value="summarizedResults" className="p-0 m-0">
                <div className="p-4">
                  <div className="h-[calc(100vh-128px)] overflow-auto">
                    <div className="text-center text-gray-500 mt-20">
                      <p>要約結果は現在開発中です</p>
                      <p className="text-sm mt-2">情報収集プランを実行すると、ここに要約結果が表示されます</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              {/* メモタブ */}
              <TabsContent value="memo" className="p-0 m-0">
                <div className="p-4">
                  <div className="h-[calc(100vh-128px)] overflow-auto">
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
                defaultSize={30} 
                minSize={20} 
                className="border-l relative z-10"
              >
                <div className="h-full flex flex-col bg-gray-50">
                  {/* 右パネルのヘッダーは削除 - MultiAgentChatPanelのヘッダーだけを使用 */}
                  
                  <div className="flex-1 overflow-hidden p-2">
                    <MultiAgentChatPanel 
                      roleModelId={roleModelId} 
                      messages={messages}
                      agentThoughts={agentThoughts}
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