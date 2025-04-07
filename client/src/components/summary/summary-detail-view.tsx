import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ExternalLink, ThumbsUp, ThumbsDown, Share, Bookmark, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface SummaryDetailViewProps {
  summaryId: string;
  onBack: () => void;
}

interface SourceReference {
  id: string;
  title: string;
  url: string;
  relevanceScore: number;
}

interface Summary {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  sourceReferences: SourceReference[];
  feedback: number;
  tags: { id: string; name: string; category: string }[];
}

export function SummaryDetailView({ summaryId, onBack }: SummaryDetailViewProps) {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<number | null>(null);

  // 要約データの取得
  const { data: summary, isLoading, error } = useQuery<Summary>({
    queryKey: ['/api/summaries', summaryId],
    queryFn: async () => {
      if (!summaryId) throw new Error('サマリーIDが指定されていません');
      const res = await apiRequest('GET', `/api/summaries/${summaryId}`);
      return await res.json();
    },
    enabled: !!summaryId,
  });

  // フィードバックの送信
  const sendFeedback = async (value: number) => {
    try {
      await apiRequest('POST', `/api/summaries/${summaryId}/feedback`, { feedback: value });
      setFeedback(value);
      toast({
        title: 'フィードバックを送信しました',
        description: 'ご意見ありがとうございます',
      });
    } catch (error) {
      toast({
        title: 'エラー',
        description: 'フィードバックの送信に失敗しました',
        variant: 'destructive',
      });
    }
  };

  // アクションボタン
  const ActionButtons = () => (
    <div className="flex items-center space-x-2 mt-4">
      <Button
        variant={feedback === 1 ? "default" : "outline"}
        size="sm"
        onClick={() => sendFeedback(1)}
        disabled={feedback !== null}
      >
        <ThumbsUp className="h-4 w-4 mr-1" />
        役立つ
      </Button>
      <Button
        variant={feedback === -1 ? "default" : "outline"}
        size="sm"
        onClick={() => sendFeedback(-1)}
        disabled={feedback !== null}
      >
        <ThumbsDown className="h-4 w-4 mr-1" />
        改善が必要
      </Button>
      <Button variant="outline" size="sm">
        <Share className="h-4 w-4 mr-1" />
        共有
      </Button>
      <Button variant="outline" size="sm">
        <Bookmark className="h-4 w-4 mr-1" />
        保存
      </Button>
    </div>
  );

  // ローディング表示
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <Skeleton className="h-8 w-64 ml-2" />
        </div>
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // エラー表示
  if (error || !summary) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
        </div>
        <div className="text-center p-8">
          <p className="text-destructive font-medium">要約データの取得に失敗しました</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            要約一覧に戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 h-full overflow-auto">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <h2 className="text-xl font-semibold ml-2">{summary.title}</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          {new Date(summary.createdAt).toLocaleString('ja-JP')}
        </div>
      </div>

      {/* タグ一覧 */}
      {summary.tags && summary.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.tags.map((tag) => (
            <Badge key={tag.id} variant="outline">
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* コンテンツタブ */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">要約</TabsTrigger>
          <TabsTrigger value="sources">情報ソース ({summary.sourceReferences?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="bg-card p-4 rounded-md border">
            <div 
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: summary.content.replace(/\n/g, '<br/>') }}
            />
          </div>
          <ActionButtons />
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <div className="space-y-3">
            {summary.sourceReferences?.length === 0 ? (
              <div className="text-center p-6 bg-muted/50 rounded-lg">
                <p className="text-muted-foreground">この要約には情報ソースが関連付けられていません</p>
              </div>
            ) : (
              summary.sourceReferences?.map((source) => (
                <Card key={source.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{source.title}</h3>
                        <p className="text-sm text-muted-foreground truncate mt-1" title={source.url}>
                          {source.url}
                        </p>
                      </div>
                      <div className="flex items-center">
                        {source.relevanceScore > 0 && (
                          <Badge variant={source.relevanceScore > 3 ? "default" : "outline"} className="mr-2">
                            関連度: {source.relevanceScore.toFixed(1)}
                          </Badge>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => window.open(source.url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}