import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, ExternalLink, ThumbsUp, ThumbsDown, Share, BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';

interface SummaryDetailViewProps {
  summaryId: string;
  onBack: () => void;
}

interface Summary {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  feedback: number;
  tags: { id: string; name: string; category: string }[];
  sources: { id: string; title: string; url: string; type: string }[];
}

export function SummaryDetailView({ summaryId, onBack }: SummaryDetailViewProps) {
  // サマリーデータの取得
  const { data: summary, isLoading, error } = useQuery<Summary>({
    queryKey: ['/api/summaries', summaryId],
    enabled: !!summaryId,
  });

  // フィードバック送信のミューテーション
  const sendFeedback = async (value: number) => {
    try {
      await apiRequest('POST', `/api/summaries/${summaryId}/feedback`, {
        value: value
      });
    } catch (error) {
      console.error('Failed to send feedback:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 h-full overflow-auto">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
        </div>
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-4 w-1/2 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-4 h-full overflow-auto">
        <div className="flex items-center mb-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              サマリーの読み込み中にエラーが発生しました。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 h-full overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendFeedback(1)}
            className={summary.feedback === 1 ? 'bg-green-50' : ''}
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            役立つ
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendFeedback(-1)}
            className={summary.feedback === -1 ? 'bg-red-50' : ''}
          >
            <ThumbsDown className="h-4 w-4 mr-2" />
            改善が必要
          </Button>
          <Button variant="outline" size="sm">
            <Share className="h-4 w-4 mr-2" />
            共有
          </Button>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-2">{summary.title}</h1>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {summary.tags && summary.tags.map(tag => (
          <Badge key={tag.id} variant="secondary">
            {tag.name}
          </Badge>
        ))}
      </div>
      
      <div className="text-sm text-muted-foreground mb-4">
        作成日: {new Date(summary.createdAt).toLocaleString('ja-JP')}
        {summary.updatedAt !== summary.createdAt && (
          <> | 更新日: {new Date(summary.updatedAt).toLocaleString('ja-JP')}</>
        )}
      </div>

      <Separator className="my-4" />
      
      <div className="prose prose-sm dark:prose-invert max-w-none mb-8 whitespace-pre-wrap">
        {summary.content}
      </div>
      
      {summary.sources && summary.sources.length > 0 && (
        <>
          <Separator className="my-4" />
          
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">参照ソース</h2>
            <div className="space-y-2">
              {summary.sources.map(source => (
                <div key={source.id} className="flex items-start justify-between p-3 border rounded-md">
                  <div>
                    <div className="font-medium">{source.title}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-md">{source.url}</div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      開く
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}