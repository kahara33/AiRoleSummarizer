import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Search, FileText, Eye } from 'lucide-react';
import { CollectionSummary } from '@shared/schema';

interface SummaryPanelProps {
  planId: string | null;
  selectedSummaryId: string | null;
  onSelectSummary: (summaryId: string | null) => void;
  onViewExecution: (executionId: string | null) => void;
}

export function SummaryPanel({ 
  planId, 
  selectedSummaryId,
  onSelectSummary,
  onViewExecution
}: SummaryPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // 要約結果の取得
  const { data: summaries, isLoading } = useQuery({
    queryKey: ['/api/collection-summaries', planId],
    queryFn: async () => {
      if (!planId) return [];
      
      const res = await apiRequest('GET', `/api/collection-summaries?planId=${planId}`);
      return await res.json();
    },
    enabled: !!planId,
  });

  // 選択された要約の詳細取得
  const { data: summaryDetail } = useQuery({
    queryKey: ['/api/collection-summaries', selectedSummaryId],
    queryFn: async () => {
      if (!selectedSummaryId) return null;
      
      const res = await apiRequest('GET', `/api/collection-summaries/${selectedSummaryId}`);
      return await res.json();
    },
    enabled: !!selectedSummaryId,
  });

  // 検索フィルター
  const filteredSummaries = summaries ? summaries.filter((summary: CollectionSummary) => {
    return !searchTerm || summary.title.toLowerCase().includes(searchTerm.toLowerCase());
  }) : [];

  // ソース表示ハンドラー
  const handleViewSources = (executionId: string) => {
    onViewExecution(executionId);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full">
      {/* 要約リスト */}
      <div className="col-span-1 md:col-span-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="要約を検索..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : !planId ? (
            <div className="text-center p-8 bg-muted/50 rounded-lg">
              情報収集プランを選択してください
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="text-center p-8 bg-muted/50 rounded-lg">
              {searchTerm ? '検索条件に一致する要約はありません' : 'このプランの要約結果はまだありません'}
            </div>
          ) : (
            filteredSummaries.map((summary: CollectionSummary) => (
              <Card 
                key={summary.id}
                className={`cursor-pointer hover:border-primary/50 transition-colors ${
                  summary.id === selectedSummaryId ? 'border-primary' : ''
                }`}
                onClick={() => onSelectSummary(summary.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{summary.title}</CardTitle>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center text-xs text-muted-foreground mb-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(summary.generatedAt).toLocaleString('ja-JP')}
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground">
                    <FileText className="h-3 w-3 mr-1" />
                    情報ソース: {summary.sourceIds?.length || 0}件
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <div className="flex flex-wrap gap-1">
                    {summary.keyTopics?.slice(0, 3).map((topic, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {topic}
                      </Badge>
                    ))}
                    {summary.keyTopics?.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{summary.keyTopics.length - 3}
                      </Badge>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))
          )}
        </div>
      </div>
      
      {/* 要約詳細 */}
      <div className="col-span-1 md:col-span-8 border rounded-lg overflow-hidden">
        {!selectedSummaryId ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">要約を選択してください</h3>
            <p className="text-muted-foreground mt-2">
              左側のリストから要約を選択すると、ここに詳細が表示されます
            </p>
          </div>
        ) : !summaryDetail ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b bg-muted/30">
              <h2 className="text-xl font-semibold">{summaryDetail.title}</h2>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-1" />
                  {new Date(summaryDetail.generatedAt).toLocaleString('ja-JP')}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                  onClick={() => handleViewSources(summaryDetail.executionId)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  情報ソースを表示
                </Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {summaryDetail.keyTopics?.map((topic, index) => (
                  <Badge key={index} variant="secondary">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex-1 p-4 overflow-auto">
              <div className="prose max-w-none">
                {summaryDetail.content.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}