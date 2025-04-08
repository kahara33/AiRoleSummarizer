import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket';
import { Loader2, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface CreateKnowledgeGraphWithCrewAIButtonProps {
  roleModelId: string;
  industry?: string;
  initialKeywords?: string[];
  className?: string;
}

export default function CreateKnowledgeGraphWithCrewAIButton({
  roleModelId,
  industry = '',
  initialKeywords = [],
  className = '',
}: CreateKnowledgeGraphWithCrewAIButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const { toast } = useToast();
  const { 
    sendMessage: sendWebSocketMessage, 
    isConnected, 
    progressUpdates,
    sendCreateKnowledgeGraphRequest,
    sendCancelOperationRequest
  } = useMultiAgentWebSocket();

  // 進行状況の更新を監視
  useEffect(() => {
    if (progressUpdates.length > 0) {
      const latestUpdate = progressUpdates[progressUpdates.length - 1];
      if (latestUpdate.roleModelId === roleModelId) {
        setProgress(latestUpdate.percent);
        setStatusMessage(latestUpdate.message);
        
        // 進行状況が100%に達したらボタンを再有効化
        if (latestUpdate.percent >= 100) {
          setTimeout(() => {
            setIsGenerating(false);
            setProgress(0);
            setStatusMessage('');
            toast({
              title: '処理完了',
              description: 'ナレッジグラフと情報収集プランの生成が完了しました。',
              variant: 'default',
            });
          }, 1000);
        }

        // エラーが発生した場合（progressが0%に戻った場合）
        if (latestUpdate.percent === 0 && isGenerating) {
          setIsGenerating(false);
          setProgress(0);
          toast({
            title: 'エラー',
            description: latestUpdate.message || '処理中にエラーが発生しました。',
            variant: 'destructive',
          });
        }
      }
    }
  }, [progressUpdates, roleModelId, isGenerating, toast]);

  const handleCreateKnowledgeGraph = async () => {
    // すでに生成中の場合は処理を実行しない
    if (isGenerating) {
      console.log('すでに処理中のため、リクエストをスキップします');
      return;
    }
    
    // WebSocket接続状態をチェック
    console.log('WebSocket接続状態:', isConnected);
    if (!isConnected) {
      toast({
        title: 'WebSocket接続エラー',
        description: 'サーバーに接続できません。ページを再読み込みしてください。',
        variant: 'destructive',
      });
      return;
    }

    try {
      // UI状態を更新
      console.log('処理開始: ナレッジグラフ生成');
      setIsGenerating(true);
      setProgress(5); // 初期値として5%の進行状況を設定
      setStatusMessage('処理を開始しています...');
      
      // 専用の関数を使用してナレッジグラフ生成を開始
      const params = {
        industry: industry || '一般',
        keywords: initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ'],
        sources: [],
        constraints: [],
        requirements: []
      };
      console.log('リクエストパラメータ:', params);
      
      // WebSocketメッセージを送信
      sendCreateKnowledgeGraphRequest(params);
      
      toast({
        title: 'プロセス開始',
        description: 'マルチエージェントがナレッジグラフと情報収集プランを生成しています...',
      });
      
    } catch (error) {
      console.error('ナレッジグラフ生成リクエストエラー:', error);
      toast({
        title: 'エラー',
        description: '操作中にエラーが発生しました。もう一度お試しください。',
        variant: 'destructive',
      });
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // 処理をキャンセルする関数
  const handleCancel = () => {
    try {
      // 専用の関数を使用してキャンセルリクエストを送信
      sendCancelOperationRequest('knowledge_graph');
      
      // UI状態をリセット
      setIsGenerating(false);
      setProgress(0);
      setStatusMessage('');
      
      toast({
        title: '処理中断',
        description: 'リクエストがキャンセルされました',
      });
    } catch (error) {
      console.error('キャンセル処理エラー:', error);
      
      // エラー発生時も状態をリセット
      setIsGenerating(false);
      setProgress(0);
      
      toast({
        title: 'エラー',
        description: 'キャンセル処理中にエラーが発生しました。画面を更新してください。',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="w-full">
      <Button
        onClick={handleCreateKnowledgeGraph}
        disabled={isGenerating || !isConnected}
        className={`w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 ${className}`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span>生成中...</span>
          </>
        ) : (
          <>
            CrewAIでナレッジグラフと情報収集プランを生成
          </>
        )}
      </Button>
      
      {isGenerating && (
        <div className="mt-2 relative">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">{statusMessage || '処理中...'}</span>
            <span className="text-sm">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <Button 
            variant="outline" 
            size="sm" 
            className="absolute -top-1 right-0 h-6 w-6 p-0 rounded-full"
            onClick={handleCancel}
          >
            <X className="h-3 w-3" />
            <span className="sr-only">キャンセル</span>
          </Button>
        </div>
      )}
    </div>
  );
}
