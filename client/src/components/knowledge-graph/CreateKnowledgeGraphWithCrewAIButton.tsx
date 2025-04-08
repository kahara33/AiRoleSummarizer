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
    progressUpdates 
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
    if (!isConnected) {
      toast({
        title: 'WebSocket接続エラー',
        description: 'サーバーに接続できません。ページを再読み込みしてください。',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsGenerating(true);
      setProgress(5); // 初期値として5%の進行状況を設定
      setStatusMessage('処理を開始しています...');
      
      // WebSocketメッセージを送信してナレッジグラフ生成を開始
      sendWebSocketMessage('create_knowledge_graph', {
        industry: industry || '一般',
        keywords: initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ'],
        sources: [],
        constraints: [],
        requirements: []
      });
      
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
    // 現在はキャンセル機能は実装されていないため、フロントエンドの状態のみリセット
    // 将来的にはサーバーサイドのキャンセル機能も実装する
    setIsGenerating(false);
    setProgress(0);
    setStatusMessage('');
    toast({
      title: '処理中断',
      description: '処理がキャンセルされました。サーバー側の処理は完了まで続行される場合があります。',
    });
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
