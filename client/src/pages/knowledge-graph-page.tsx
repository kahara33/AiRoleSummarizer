import React, { useState } from 'react';

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import KnowledgeGraphViewer from '@/components/knowledge-graph/KnowledgeGraphViewer';
import MultiAgentChatPanel from '@/components/chat/MultiAgentChatPanel';
import CreateCollectionPlanButton from '@/components/collection-plan/CreateCollectionPlanButton';
import { CrewAIButton } from '@/components/knowledge-graph/CrewAIButton';
import { KnowledgeNode } from '@shared/schema';
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";


interface KnowledgeGraphPageProps {
  id?: string;
}

const KnowledgeGraphPage: React.FC<KnowledgeGraphPageProps> = ({ id }) => {
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [hasKnowledgeGraph, setHasKnowledgeGraph] = useState<boolean>(false);
  const roleModelId = id || 'default';
  const { toast } = useToast();

  // Fetch role model data to get industries and keywords
  const { data: roleModel } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}`);
      return await res.json();
    },
    enabled: !!roleModelId && roleModelId !== 'default'
  });

  // ノード選択時の処理
  const handleNodeSelect = (node: KnowledgeNode) => {
    setSelectedNode(node);
    setIsPanelOpen(true);
  };

  // サイドパネルの表示/非表示を切り替え
  const togglePanel = () => {
    setIsPanelOpen(!isPanelOpen);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b px-4 py-2 flex justify-between items-center h-14">
        <h1 className="text-xl font-semibold">
          ナレッジグラフビューアー
          {selectedNode && (
            <span className="ml-2 text-sm text-gray-500">
              - {selectedNode.name}を選択中
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          {roleModelId !== 'default' && (
            <>
              {/* CrewAIでナレッジグラフを作成ボタン */}
              <div className="w-auto">
                <CrewAIButton 
                  roleModelId={roleModelId}
                  onStart={() => setIsGenerating(true)}
                  onComplete={() => setIsGenerating(false)}
                />
              </div>

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

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-56px)]">
        <div
          className={`flex-1 transition-all duration-300 h-full ${
            isPanelOpen ? 'w-2/3' : 'w-full'
          }`}
        >
          <KnowledgeGraphViewer
            roleModelId={roleModelId}
            onNodeSelect={handleNodeSelect}
            width="100%"
            height="100%"
            onGraphDataChange={setHasKnowledgeGraph}
          />
        </div>

        {isPanelOpen && (
          <div className="w-1/3 border-l">
            <div className="h-full flex flex-col">
              {/* マルチAIエージェントチャットパネル */}
              <div className="flex-1 overflow-hidden">
                <MultiAgentChatPanel roleModelId={roleModelId} />
              </div>

              {/* ノード情報パネル（選択時のみ表示） */}
              {selectedNode && (
                <div className="border-t p-3">
                  <h3 className="font-semibold text-lg mb-2">ノード情報</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-500">名前:</span>
                      <span className="ml-2 text-sm font-medium">
                        {selectedNode.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">レベル:</span>
                      <span className="ml-2 text-sm">{selectedNode.level}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">タイプ:</span>
                      <span className="ml-2 text-sm">{selectedNode.type}</span>
                    </div>
                    {selectedNode.description && (
                      <div>
                        <span className="text-sm text-gray-500">説明:</span>
                        <p className="mt-1 text-sm bg-gray-50 p-2 rounded">
                          {selectedNode.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraphPage;