import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import KnowledgeGraphViewer from '@/components/knowledge-graph/KnowledgeGraphViewer';
import { useToast } from "@/hooks/use-toast";
import MultiAgentChatPanel from '@/components/chat/MultiAgentChatPanel';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket-fixed';
import AgentConversation from '@/components/agent-activity/AgentConversation';
import type { ProgressUpdate } from '@/hooks/use-multi-agent-websocket-fixed';
import { 
  Plus, 
  FileText,
  RefreshCw,
  BrainCircuit,
  Sparkles,
} from 'lucide-react';

const InformationDashboard: React.FC<{ id?: string }> = () => {
  const params = useParams();
  const { id } = params;
  const roleModelId = id || 'default';
  const [activeTab, setActiveTab] = useState<string>('knowledgeGraph');
  const [hasKnowledgeGraph, setHasKnowledgeGraph] = useState<boolean>(false);
  const [showAIThoughts, setShowAIThoughts] = useState<boolean>(false);
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
    sendMessage, 
    connect, 
    isProcessing, 
    progressUpdates,
  } = useMultiAgentWebSocket();
  
  // ダミーデータ（左メニュー表示用）
  const plans = [
    { id: 'plan1', name: 'プラン1', createdAt: '2025/3/7', updatedAt: '2025/4/7' },
    { id: 'plan2', name: 'プラン2', createdAt: '2025/3/15', updatedAt: '2025/4/5' },
  ];
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  
  // roleModelIdが設定されたらWebSocketを接続
  useEffect(() => {
    if (roleModelId && !isConnected) {
      console.log('WebSocketを接続します: roleModelId =', roleModelId);
      connect(roleModelId);
    }
  }, [roleModelId, isConnected, connect]);
  
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
      setShowAIThoughts(true);
      if (!isConnected && roleModelId) {
        connect(roleModelId);
      }
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
    if (plans.length > 0 && !selectedPlan) {
      setSelectedPlan(plans[0].id);
    }
  }, [selectedPlan]);

  return (
    <div className="flex flex-col h-screen">
      {/* ヘッダー */}
      <div className="bg-white p-4 border-b">
        <h1 className="text-xl font-semibold">情報整理ダッシュボード（{roleModel?.name || 'ロール定義名'}）</h1>
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左サイドバー - 情報収集プラン */}
        <div className="w-56 border-r bg-slate-50 flex flex-col">
          <div className="p-4 flex justify-between items-center border-b">
            <h2 className="text-sm font-medium">情報収集プラン</h2>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="text-xs">
                <tr>
                  <th className="text-left p-2">プラン名</th>
                  <th className="text-left p-2">作成日</th>
                  <th className="text-left p-2">更新日</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {plans.map((plan) => (
                  <tr 
                    key={plan.id} 
                    className={`hover:bg-gray-100 cursor-pointer ${selectedPlan === plan.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    <td className="p-2">プラン{plan.id.replace('plan', '')}</td>
                    <td className="p-2">{plan.createdAt}</td>
                    <td className="p-2">{plan.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* メインコンテンツエリア */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* タブナビゲーション */}
          <div className="border-b bg-white">
            <div className="flex justify-between items-center px-4 py-2">
              <Tabs 
                value={activeTab} 
                onValueChange={setActiveTab}
                className="w-full"
              >
                <div className="flex justify-between items-center">
                  <TabsList>
                    <TabsTrigger value="knowledgeGraph" className="text-sm">
                      ナレッジグラフ
                    </TabsTrigger>
                    <TabsTrigger value="details" className="text-sm">
                      詳細情報
                    </TabsTrigger>
                    <TabsTrigger value="memo" className="text-sm">
                      メモ
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="flex gap-2">
                    {(roleModelId && roleModelId !== 'default') && (
                      <Button 
                        variant="default" 
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          generateGraphMutation.mutate();
                        }}
                        disabled={generateGraphMutation.isPending}
                      >
                        {generateGraphMutation.isPending ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            処理中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            CrewAIでナレッジグラフと情報収集プランを生成
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8"
                      onClick={() => setShowAIThoughts(!showAIThoughts)}
                    >
                      <BrainCircuit className="h-4 w-4 mr-1" />
                      マルチエージェント思考
                    </Button>
                  </div>
                </div>
              </Tabs>
            </div>
          </div>
            
          {/* タブコンテンツ */}
          <div className="flex-1 overflow-hidden bg-gray-50">
            <TabsContent value="knowledgeGraph" className="h-full p-0 m-0 relative">
              {(roleModelId && roleModelId !== 'default') ? (
                <KnowledgeGraphViewer 
                  roleModelId={roleModelId} 
                  onGraphDataChange={(hasData) => setHasKnowledgeGraph(hasData)}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <FileText className="h-16 w-16 mb-4 opacity-20" />
                  <p>ロールモデルが選択されていません</p>
                </div>
              )}
              
              {/* エージェント思考パネル (右サイドバー) */}
              {showAIThoughts && (
                <div className="absolute right-0 top-0 w-64 h-full bg-white border-l shadow-lg z-10">
                  <div className="flex justify-between items-center p-2 border-b">
                    <h3 className="text-sm font-medium">AIエージェント思考</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => setShowAIThoughts(false)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </Button>
                  </div>
                  
                  <div className="h-[calc(100%-40px)] overflow-hidden">
                    <AgentConversation 
                      roleModelId={roleModelId}
                      height="100%"
                    />
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="details" className="h-full p-4">
              <div className="bg-white p-4 rounded-lg h-full">
                <h2 className="text-lg font-semibold mb-4">詳細情報</h2>
                <p>このタブは開発中です。</p>
              </div>
            </TabsContent>
            
            <TabsContent value="memo" className="h-full p-4">
              <div className="bg-white p-4 rounded-lg h-full">
                <h2 className="text-lg font-semibold mb-4">メモ</h2>
                <p>このタブは開発中です。</p>
              </div>
            </TabsContent>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InformationDashboard;
