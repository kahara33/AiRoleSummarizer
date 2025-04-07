import React, { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import KnowledgeGraphViewer from '@/components/knowledge-graph/KnowledgeGraphViewer';
import MultiAgentChatPanel from '@/components/chat/MultiAgentChatPanel';
import CreateCollectionPlanButton from '@/components/collection-plan/CreateCollectionPlanButton';
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  FileText, 
  Calendar, 
  Settings, 
  FilePlus2, 
  ExternalLink 
} from 'lucide-react';

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
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [hasKnowledgeGraph, setHasKnowledgeGraph] = useState<boolean>(false);
  const { toast } = useToast();

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

  // サイドパネルの表示/非表示を切り替え
  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

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
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1"
                onClick={() => {
                  toast({
                    title: "新規プラン作成",
                    description: "新しい情報収集プランを作成します。"
                  });
                }}
              >
                <FilePlus2 className="h-4 w-4" />
                新規プラン作成
              </Button>
              
              {/* 情報収集プラン作成ボタン */}
              <div className="w-auto">
                <CreateCollectionPlanButton 
                  roleModelId={roleModelId}
                  industryIds={roleModel?.industries?.map((ind: any) => ind.id) || []}
                  keywordIds={roleModel?.keywords?.map((kw: any) => kw.id) || []}
                  disabled={isGenerating}
                  hasKnowledgeGraph={hasKnowledgeGraph}
                />
              </div>
            </>
          )}
          
          <button
            onClick={togglePanel}
            className={`px-3 py-1 rounded text-sm ${
              isPanelOpen
                ? 'bg-gray-200 text-gray-800'
                : 'bg-primary text-white'
            }`}
          >
            {isPanelOpen ? 'パネルを閉じる' : 'パネルを開く'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左側パネル: 情報収集プラン一覧とプラン詳細 */}
        {isPanelOpen && (
          <div className="w-1/4 border-r overflow-auto flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold mb-3">情報収集プラン</h2>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-2 py-1">プラン名</th>
                      <th className="text-left px-2 py-1">作成日</th>
                      <th className="text-left px-2 py-1">更新日</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockCollectionPlans.map((plan) => (
                      <tr 
                        key={plan.id}
                        className={`hover:bg-gray-50 cursor-pointer ${selectedPlan === plan.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedPlan(plan.id)}
                      >
                        <td className="px-2 py-1.5">{plan.name}</td>
                        <td className="px-2 py-1.5">{plan.createdAt}</td>
                        <td className="px-2 py-1.5">{plan.updatedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-4 flex-1 overflow-auto">
              <h2 className="text-lg font-semibold mb-3">プラン詳細</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-gray-500 mb-1">収集プラン</h3>
                  <p className="text-sm font-medium">{mockPlanDetails.name}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-500 mb-1">実行頻度</h3>
                  <p className="text-sm font-medium">{mockPlanDetails.status}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-500 mb-1">通知先</h3>
                  <p className="text-sm font-medium">{mockPlanDetails.completion}</p>
                </div>
                
                <div>
                  <h3 className="text-sm text-gray-500 mb-1">利用するツール</h3>
                  <div className="space-y-1">
                    {mockPlanDetails.tools.map((tool, index) => (
                      <div key={index} className="text-sm">{tool}</div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm text-gray-500">ソース</h3>
                    <Button variant="ghost" size="sm" onClick={handleAddSource}>
                      <Plus className="h-3.5 w-3.5" />
                      <span className="ml-1 text-xs">追加</span>
                    </Button>
                  </div>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-2 py-1">メディア</th>
                        <th className="text-left px-2 py-1 w-12">詳細</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockPlanDetails.sources.map((source) => (
                        <tr key={source.id} className="border-t">
                          <td className="px-2 py-1.5 truncate" style={{ maxWidth: "150px" }}>
                            {source.media}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 中央のメインコンテンツ */}
        <div className={`flex-1 transition-all duration-300 ${isPanelOpen ? 'w-3/4' : 'w-full'}`}>
          <Tabs defaultValue="knowledgeGraph" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b px-4">
              <TabsList className="bg-transparent h-10">
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
            <TabsContent value="knowledgeGraph" className="flex-1 h-full overflow-hidden">
              <KnowledgeGraphViewer
                roleModelId={roleModelId}
                width="100%"
                height="calc(100vh - 105px)"
                onGraphDataChange={setHasKnowledgeGraph}
              />
            </TabsContent>
            
            {/* 要約結果タブ */}
            <TabsContent value="summarizedResults" className="p-4">
              <div className="rounded-lg border p-4 h-[calc(100vh-130px)] overflow-auto">
                <div className="text-center text-gray-500 mt-10">
                  <p>要約結果は現在開発中です</p>
                  <p className="text-sm mt-2">情報収集プランを実行すると、ここに要約結果が表示されます</p>
                </div>
              </div>
            </TabsContent>
            
            {/* メモタブ */}
            <TabsContent value="memo" className="p-4">
              <div className="rounded-lg border p-4 h-[calc(100vh-130px)] overflow-auto">
                <div className="text-center text-gray-500 mt-10">
                  <p>メモ機能は現在開発中です</p>
                  <p className="text-sm mt-2">ここに重要な情報をメモすることができるようになります</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* 右側のマルチAIエージェントチャットパネル */}
        {isPanelOpen && (
          <div className="w-1/4 border-l">
            <div className="h-full flex flex-col">
              {/* マルチAIエージェントチャットパネル */}
              <div className="flex-1 overflow-hidden">
                <MultiAgentChatPanel roleModelId={roleModelId} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InformationDashboard;