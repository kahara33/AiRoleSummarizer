import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, ThumbsUp, Tag, ExternalLink, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SummaryPanelProps {
  planId: string | null;
  onSelectSummary: (summaryId: string) => void;
  selectedSummaryId: string | null;
  onViewExecution?: (executionId: string) => void;
}

interface Summary {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  executionId: string;
  feedback: number;
  tags: { id: string; name: string; category: string }[];
}

export function SummaryPanel({
  planId,
  onSelectSummary,
  selectedSummaryId,
  onViewExecution
}: SummaryPanelProps) {
  const [viewMode, setViewMode] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');

  // 要約一覧の取得
  const { data: summaries, isLoading, error } = useQuery<Summary[]>({
    queryKey: ['/api/summaries', planId, viewMode],
    queryFn: async () => {
      if (!planId) return [];
      const url = `/api/summaries?planId=${planId}${viewMode !== 'all' ? `&type=${viewMode}` : ''}`;
      const res = await apiRequest('GET', url);
      return await res.json();
    },
    enabled: !!planId,
  });

  // ローディング表示
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">要約一覧</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">要約一覧</h2>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-destructive">要約データの取得に失敗しました</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              再読み込み
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // プランが選択されていない場合
  if (!planId) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">情報収集プランを選択してください</p>
      </div>
    );
  }

  // 要約がない場合
  if (summaries?.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">要約一覧</h2>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              まだ要約がありません。情報収集を実行すると、ここに要約が表示されます。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">要約一覧</h2>
        <Tabs defaultValue="all" onValueChange={(v) => setViewMode(v as any)}>
          <TabsList>
            <TabsTrigger value="all">すべて</TabsTrigger>
            <TabsTrigger value="daily">日次</TabsTrigger>
            <TabsTrigger value="weekly">週次</TabsTrigger>
            <TabsTrigger value="monthly">月次</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-4">
        {summaries?.map((summary) => (
          <Card 
            key={summary.id} 
            className={`cursor-pointer transition-colors ${
              selectedSummaryId === summary.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
            }`}
            onClick={() => onSelectSummary(summary.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{summary.title}</CardTitle>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  {new Date(summary.createdAt).toLocaleDateString('ja-JP')}
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {summary.tags?.slice(0, 3).map((tag) => (
                  <Badge key={tag.id} variant="outline" className="text-xs">
                    {tag.name}
                  </Badge>
                ))}
                {summary.tags?.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{summary.tags.length - 3}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-3">
                {summary.content.substring(0, 200)}...
              </p>
            </CardContent>
            <CardFooter className="border-t pt-3 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                {summary.feedback > 0 && (
                  <div className="flex items-center text-green-500">
                    <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">フィードバック済み</span>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                {onViewExecution && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="flex items-center text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewExecution(summary.executionId);
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    情報ソース
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex items-center text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSummary(summary.id);
                  }}
                >
                  詳細を見る
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}