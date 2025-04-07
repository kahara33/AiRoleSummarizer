import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Plus, ChevronDown, ChevronUp, ExternalLink, Info, Settings } from 'lucide-react';
import { SourcesList } from '@/components/collection-plan/sources-list';
import { CollectionPlanPanel } from '@/components/collection-plan/collection-plan-panel';
import { CollectionPlanDialog } from '@/components/collection-plan/collection-plan-dialog';
import { SummaryPanel } from '@/components/summary/summary-panel';
import { SummaryDetailView } from '@/components/summary/summary-detail-view';

interface NotebookPageProps {
  roleModelId: string;
}

export default function NotebookPage({ roleModelId }: NotebookPageProps) {
  // 状態管理
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [isCollapsedTop, setIsCollapsedTop] = useState(false);
  const [isCreatePlanDialogOpen, setIsCreatePlanDialogOpen] = useState(false);

  // ロールモデルデータの取得
  const { data: roleModel } = useQuery<{ name: string; description: string }>({
    queryKey: ['/api/role-models', roleModelId],
    enabled: !!roleModelId,
    // デフォルト値を設定
    initialData: { name: 'ロールモデル', description: '' },
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ヘッダー部分 */}
      <div className="bg-background p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{roleModel.name}</h1>
            <p className="text-muted-foreground mt-1">{roleModel.description}</p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Info className="h-4 w-4 mr-2" />
              詳細
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              設定
            </Button>
          </div>
        </div>
      </div>

      {/* 2段構成レイアウト */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* 上段：情報収集プラン管理エリア */}
        <div 
          className={`border-b transition-all duration-300 ${
            isCollapsedTop ? 'h-12' : 'h-72'
          }`}
        >
          {isCollapsedTop ? (
            <div className="flex items-center justify-between p-3">
              <h2 className="font-semibold">情報収集プラン</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsCollapsedTop(false)}
              >
                <ChevronDown className="h-4 w-4 mr-2" />
                展開
              </Button>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-3 border-b">
                <h2 className="font-semibold">情報収集プラン</h2>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsCreatePlanDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    新規プラン
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsCollapsedTop(true)}
                  >
                    <ChevronUp className="h-4 w-4 mr-2" />
                    折りたたむ
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <CollectionPlanPanel 
                  onSelectPlan={setSelectedPlanId}
                  selectedPlanId={selectedPlanId}
                />
              </div>
            </div>
          )}
        </div>

        {/* 下段：情報閲覧エリア */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="sources" className="h-full flex flex-col">
            <div className="px-4 border-b">
              <TabsList className="mt-2">
                <TabsTrigger value="sources">収集ソース</TabsTrigger>
                <TabsTrigger value="summaries">要約結果</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent 
              value="sources" 
              className="flex-1 p-4 overflow-auto"
            >
              <SourcesList 
                planId={selectedPlanId} 
                executionId={currentExecutionId || undefined}
              />
            </TabsContent>
            
            <TabsContent 
              value="summaries" 
              className="flex-1 overflow-hidden"
            >
              {selectedSummaryId ? (
                <SummaryDetailView 
                  summaryId={selectedSummaryId}
                  onBack={() => setSelectedSummaryId(null)}
                />
              ) : (
                <div className="p-4 h-full overflow-auto">
                  <SummaryPanel 
                    planId={selectedPlanId}
                    onSelectSummary={setSelectedSummaryId}
                    selectedSummaryId={selectedSummaryId}
                    onViewExecution={setCurrentExecutionId}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ダイアログ */}
      <CollectionPlanDialog
        open={isCreatePlanDialogOpen}
        onOpenChange={setIsCreatePlanDialogOpen}
        roleModelId={roleModelId}
      />
    </div>
  );
}