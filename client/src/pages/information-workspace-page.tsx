import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import KnowledgeGraphViewer from '@/components/knowledge-graph/KnowledgeGraphViewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SourcesList } from '@/components/collection-plan/sources-list';
import { CollectionPlanPanel } from '@/components/collection-plan/collection-plan-panel';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'wouter';
import ChatPanel from '@/components/chat/ChatPanel';

export default function InformationWorkspacePage() {
  const params = useParams();
  const roleModelId = params.id || '';

  // サイドパネルの状態
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  
  // 選択されたプランとサマリー
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  
  // 実行ID
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);

  // ロールモデルの取得
  const { data: roleModel } = useQuery({
    queryKey: ['/api/role-models', roleModelId],
    enabled: !!roleModelId,
  });

  // 左パネルの幅
  const leftPanelWidth = leftPanelCollapsed ? '50px' : '300px';
  
  // 右パネルの幅
  const rightPanelWidth = rightPanelCollapsed ? '50px' : '300px';

  return (
    <div className="flex h-screen">
      {/* 左側パネル - 情報収集プラン */}
      <div 
        className="flex flex-col border-r transition-all duration-300 ease-in-out bg-background"
        style={{ width: leftPanelWidth }}
      >
        {leftPanelCollapsed ? (
          <div className="flex flex-col h-full">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-none h-12"
              onClick={() => setLeftPanelCollapsed(false)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="rotate-90 whitespace-nowrap text-muted-foreground font-medium">
                情報収集プラン
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b">
              <h2 className="font-semibold">情報収集プラン</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLeftPanelCollapsed(true)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <CollectionPlanPanel 
                onSelectPlan={setSelectedPlanId}
                selectedPlanId={selectedPlanId}
              />
            </div>
          </div>
        )}
      </div>

      {/* 中央エリア - メインコンテンツ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <h1 className="font-bold">
            {roleModel?.name || 'ロールモデル'} {' '}
            <span className="text-muted-foreground font-normal">
              - 情報収集ワークスペース
            </span>
          </h1>
        </div>
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* タブベースのコンテンツエリア */}
          <Tabs defaultValue="sources" className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b px-4">
              <TabsList className="mt-2">
                <TabsTrigger value="sources">情報ソース</TabsTrigger>
                <TabsTrigger value="summaries">要約結果</TabsTrigger>
                <TabsTrigger value="knowledge-graph">ナレッジグラフ</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent 
              value="sources" 
              className="flex-1 p-4 overflow-auto"
            >
              <SourcesList 
                planId={selectedPlanId} 
                executionId={currentExecutionId}
              />
            </TabsContent>
            
            <TabsContent 
              value="summaries" 
              className="flex-1 p-4 overflow-auto"
            >
              <SummaryPanel 
                planId={selectedPlanId}
                onSelectSummary={setSelectedSummaryId}
                selectedSummaryId={selectedSummaryId}
                onViewExecution={setCurrentExecutionId}
              />
            </TabsContent>
            
            <TabsContent 
              value="knowledge-graph" 
              className="flex-1 overflow-hidden"
            >
              <KnowledgeGraphViewer 
                roleModelId={roleModelId}
                width="100%"
                height="100%"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* 右側パネル - AIエージェント */}
      <div 
        className="flex flex-col border-l transition-all duration-300 ease-in-out bg-background"
        style={{ width: rightPanelWidth }}
      >
        {rightPanelCollapsed ? (
          <div className="flex flex-col h-full">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-none h-12"
              onClick={() => setRightPanelCollapsed(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="rotate-90 whitespace-nowrap text-muted-foreground font-medium">
                AIエージェント
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b">
              <h2 className="font-semibold">AIエージェント</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRightPanelCollapsed(true)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                roleModelId={roleModelId}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}