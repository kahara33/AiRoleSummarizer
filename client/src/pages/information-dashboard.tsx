import React, { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useQuery } from "@tanstack/react-query";
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
  BrainCircuit
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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
  const { toast } = useToast();

  // WebSocketメッセージを処理
  const { messages, agentThoughts, isConnected, send } = useWebSocket(roleModelId);
  
  // エージェントの思考が届いたらパネルを表示
  useEffect(() => {
    if (agentThoughts.length > 0) {
      setShowAgentPanel(true);
    }
  }, [agentThoughts]);
  
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
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b px-4 py-2 flex justify-between items-center">
        <h1 className="text-xl font-semibold">
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
                onClick={() => setShowAgentPanel(!showAgentPanel)}
                title={showAgentPanel ? "AIエージェントパネルを非表示" : "AIエージェントパネルを表示"}
              >
                <BrainCircuit className={`h-4 w-4 ${showAgentPanel ? 'text-purple-600' : ''}`} />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左側パネル: 情報収集プラン一覧とプラン詳細 */}
        <div className="w-64 border-r overflow-auto flex flex-col bg-gray-50">
          <div className="p-3 border-b bg-white">
            <h2 className="font-semibold">情報収集プラン</h2>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-2 py-1 font-medium">プラン名</th>
                  <th className="text-left px-2 py-1 font-medium">作成日</th>
                  <th className="text-left px-2 py-1 font-medium">更新日</th>
                </tr>
              </thead>
              <tbody>
                {mockCollectionPlans.map((plan) => (
                  <tr 
                    key={plan.id}
                    className={`hover:bg-gray-100 cursor-pointer ${selectedPlan === plan.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    <td className="px-2 py-1.5 border-t border-gray-200">プラン{plan.id.replace('plan', '')}</td>
                    <td className="px-2 py-1.5 border-t border-gray-200">{plan.createdAt}</td>
                    <td className="px-2 py-1.5 border-t border-gray-200">{plan.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t mt-4">
            <div className="p-3 bg-white">
              <h2 className="font-semibold">プラン詳細</h2>
            </div>
            <div className="p-3 space-y-2">
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
                        <th className="text-left px-2 py-1 font-medium">ソース</th>
                        <th className="text-left px-1 py-1 font-medium w-10 text-center">詳細</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockPlanDetails.sources.map((source) => (
                        <tr key={source.id} className="border-t">
                          <td className="px-2 py-1 truncate" style={{ maxWidth: "120px" }}>
                            メディア https://
                          </td>
                          <td className="px-1 py-0.5 text-center">
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
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

        {/* メインコンテンツエリア */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="knowledgeGraph" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b bg-white">
              <TabsList className="h-10 border-b-0 bg-transparent">
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
            </div>
            
            {/* ナレッジグラフタブ */}
            <TabsContent value="knowledgeGraph" className="flex-1 h-full overflow-hidden p-0 m-0">
              <KnowledgeGraphViewer
                roleModelId={roleModelId}
                width="100%"
                height="calc(100vh - 87px)"
                onGraphDataChange={setHasKnowledgeGraph}
              />
            </TabsContent>
            
            {/* 要約結果タブ */}
            <TabsContent value="summarizedResults" className="p-0 m-0">
              <div className="h-[calc(100vh-87px)] overflow-auto">
                <div className="text-center text-gray-500 mt-20">
                  <p>要約結果は現在開発中です</p>
                  <p className="text-sm mt-2">情報収集プランを実行すると、ここに要約結果が表示されます</p>
                </div>
              </div>
            </TabsContent>
            
            {/* メモタブ */}
            <TabsContent value="memo" className="p-0 m-0">
              <div className="h-[calc(100vh-87px)] overflow-auto">
                <div className="text-center text-gray-500 mt-20">
                  <p>メモ機能は現在開発中です</p>
                  <p className="text-sm mt-2">ここに重要な情報をメモすることができるようになります</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* 右側パネル: マルチAIエージェント思考パネル */}
        {showAgentPanel && (
          <div className="w-72 border-l flex flex-col bg-gray-50">
            <div className="p-3 border-b bg-white flex justify-between items-center">
              <div className="flex items-center">
                <BrainCircuit className="h-4 w-4 mr-2 text-purple-600" />
                <h2 className="font-semibold">マルチAIエージェント思考</h2>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0" 
                onClick={() => setShowAgentPanel(false)}
              >
                &times;
              </Button>
            </div>
            
            <div className="flex-1 overflow-auto">
              <MultiAgentChatPanel 
                roleModelId={roleModelId} 
                messages={messages}
                agentThoughts={agentThoughts}
                onSendMessage={handleSendMessage}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InformationDashboard;