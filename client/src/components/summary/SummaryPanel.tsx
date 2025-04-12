import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Calendar, Tag, FileJson, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// 要約データの型定義
interface CollectionSummary {
  id: string;
  collectionPlanId: string;
  executionId: string;
  title: string;
  content: string;
  tags?: string[];
  insights?: string[];
  generatedAt: string;
  metadata?: Record<string, any>;
}

interface SummaryPanelProps {
  roleModelId: string;
  selectedNodeId?: string | null;
}

export default function SummaryPanel({ roleModelId, selectedNodeId }: SummaryPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('recent');
  const [selectedSummary, setSelectedSummary] = useState<CollectionSummary | null>(null);

  // 通常は最新のサマリーを取得
  const { data: recentSummaries, isLoading: isLoadingRecent } = useQuery<CollectionSummary[]>({
    queryKey: [`/api/role-models/${roleModelId}/collection-summaries`],
    enabled: !!roleModelId && activeTab === 'recent',
  });

  // 選択されたノードに関連するサマリーを取得
  const { data: nodeSummaries, isLoading: isLoadingNodeSummaries } = useQuery<CollectionSummary[]>({
    queryKey: [`/api/knowledge-library/node-summaries/${roleModelId}/${selectedNodeId}`],
    enabled: !!roleModelId && !!selectedNodeId && activeTab === 'byNode',
  });

  // 現在のタブに基づいてサマリーリストを決定
  const summaries = activeTab === 'recent' ? recentSummaries : nodeSummaries;
  const isLoading = activeTab === 'recent' ? isLoadingRecent : isLoadingNodeSummaries;

  // 最初のサマリーを自動選択
  useEffect(() => {
    if (summaries && summaries.length > 0 && !selectedSummary) {
      setSelectedSummary(summaries[0]);
    }
  }, [summaries]);

  // タブ切り替え時に選択をリセット
  useEffect(() => {
    setSelectedSummary(null);
  }, [activeTab]);

  // 選択されたノードが変更されたとき、ノード関連タブに切り替え
  useEffect(() => {
    if (selectedNodeId) {
      setActiveTab('byNode');
    }
  }, [selectedNodeId]);

  // 日付フォーマット
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '日付なし';
    }
  };

  // マークダウンを簡易レンダリング（改行やリンク変換）
  const renderMarkdown = (text: string) => {
    // URLを検出してリンクに変換
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const withLinks = text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">${url}</a>`;
    });
    
    // 改行を<br>タグに変換
    const withLineBreaks = withLinks.replace(/\n/g, '<br>');
    
    return { __html: withLineBreaks };
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center px-4 py-2 border-b">
        <h3 className="text-base font-medium">情報要約</h3>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="h-8">
            <TabsTrigger value="recent" className="text-xs px-2 py-1 h-6">最新レポート</TabsTrigger>
            <TabsTrigger 
              value="byNode" 
              className="text-xs px-2 py-1 h-6"
              disabled={!selectedNodeId}
            >
              ノード関連
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* サマリーリスト */}
        <div className="w-64 border-r bg-gray-50 flex flex-col h-full">
          <div className="p-2 border-b">
            <h4 className="text-sm font-medium">
              {activeTab === 'recent' ? '最新のレポート' : 'ノード関連レポート'}
            </h4>
          </div>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-2 border rounded bg-white">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : summaries?.length ? (
              <div className="space-y-1 p-2">
                {summaries.map((summary) => (
                  <div
                    key={summary.id}
                    className={`p-2 border rounded cursor-pointer hover:bg-blue-50 transition-colors ${
                      selectedSummary?.id === summary.id ? 'bg-blue-100 border-blue-300' : 'bg-white'
                    }`}
                    onClick={() => setSelectedSummary(summary)}
                  >
                    <div className="text-sm font-medium truncate">{summary.title}</div>
                    <div className="text-xs text-gray-500 flex items-center mt-1">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(summary.generatedAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                {activeTab === 'recent' 
                  ? 'レポートが見つかりません。情報収集プランを実行してレポートを生成してください。' 
                  : selectedNodeId 
                    ? 'このノードに関連するレポートはありません。' 
                    : 'ナレッジグラフからノードを選択してください。'}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* サマリー詳細 */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {selectedSummary ? (
            <div className="flex-1 flex flex-col">
              <div className="border-b px-4 py-2 flex justify-between items-center">
                <h4 className="text-base font-medium">{selectedSummary.title}</h4>
                <div className="text-xs text-gray-500">
                  {formatDate(selectedSummary.generatedAt)}
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {/* サマリーコンテンツ */}
                  <div className="text-sm leading-relaxed">
                    <div dangerouslySetInnerHTML={renderMarkdown(selectedSummary.content)} />
                  </div>

                  {/* インサイト（存在する場合） */}
                  {selectedSummary.insights && selectedSummary.insights.length > 0 && (
                    <div className="mt-6">
                      <h5 className="text-sm font-medium mb-2 flex items-center">
                        <FileJson className="h-4 w-4 mr-1" />
                        主要インサイト
                      </h5>
                      <div className="space-y-2">
                        {selectedSummary.insights.map((insight, idx) => (
                          <div key={idx} className="flex items-start">
                            <span className="text-blue-500 font-bold mr-2">•</span>
                            <span className="text-sm">{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* タグ（存在する場合） */}
                  {selectedSummary.tags && selectedSummary.tags.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h5 className="text-sm font-medium mb-2 flex items-center">
                        <Tag className="h-4 w-4 mr-1" />
                        タグ
                      </h5>
                      <div className="flex flex-wrap gap-1">
                        {selectedSummary.tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* メタデータ（存在する場合） */}
                  {selectedSummary.metadata && Object.keys(selectedSummary.metadata).length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <h5 className="text-sm font-medium mb-2">メタデータ</h5>
                      <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-x-auto">
                        {JSON.stringify(selectedSummary.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50 p-4">
              <div className="text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium">レポートが選択されていません</h3>
                <p className="text-sm text-gray-500 mt-1">
                  左側のリストからレポートを選択するか、新しい情報収集を実行してください。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}