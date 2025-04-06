import React, { useState } from 'react';

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import KnowledgeGraphViewer from '@/components/knowledge-graph/KnowledgeGraphViewer';
import ChatPanel from '@/components/chat/ChatPanel';
import CreateCollectionPlanButton from '@/components/collection-plan/CreateCollectionPlanButton';
import { KnowledgeNode } from '@shared/schema';
import { useToast } from "@/hooks/use-toast";


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
      <div className="bg-white border-b px-4 py-2 flex justify-between items-center">
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
            <div className="w-48">
              <CreateCollectionPlanButton 
                roleModelId={roleModelId}
                industryIds={roleModel?.industries?.map((ind: any) => ind.id) || []}
                keywordIds={roleModel?.keywords?.map((kw: any) => kw.id) || []}
                disabled={isGenerating}
                hasKnowledgeGraph={hasKnowledgeGraph}
              />
            </div>
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
        <div
          className={`flex-1 transition-all duration-300 ${
            isPanelOpen ? 'w-2/3' : 'w-full'
          }`}
        >
          <KnowledgeGraphViewer
            roleModelId={roleModelId}
            onNodeSelect={handleNodeSelect}
            width="100%"
            height="calc(100vh - 50px)"
            onGraphDataChange={setHasKnowledgeGraph}
          />
        </div>

        {isPanelOpen && (
          <div className="w-1/3 border-l p-3">
            <ChatPanel
              selectedNode={selectedNode}
              height={selectedNode ? 'calc(100vh - 360px)' : 'calc(100vh - 110px)'}
            />

            {selectedNode && (
              <div className="mt-3 border rounded-md p-3">
                <h3 className="font-semibold text-lg mb-2">ノード情報</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500">ID:</span>
                    <span className="ml-2 text-sm">{selectedNode.id}</span>
                  </div>
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
                  {selectedNode.parentId && (
                    <div>
                      <span className="text-sm text-gray-500">親ノード:</span>
                      <span className="ml-2 text-sm">
                        {selectedNode.parentId}
                      </span>
                    </div>
                  )}
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
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraphPage;