import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface CrewAIButtonProps {
  roleModelId: string;
  onStart?: () => void;
  onComplete?: () => void;
}

export function CrewAIButton({ roleModelId, onStart, onComplete }: CrewAIButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerateWithCrewAI = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      if (onStart) onStart();
      
      // CrewAIを使用した知識グラフ生成APIを呼び出す
      const response = await apiRequest(
        'POST',
        `/api/knowledge-graph/generate-with-crewai/${roleModelId}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '知識グラフの生成に失敗しました');
      }
      
      toast({
        title: 'マルチエージェント処理開始',
        description: 'CrewAIを使用した知識グラフの生成を開始しました。生成が完了するまでお待ちください。',
      });
      
      // APIリクエスト自体は成功しているが、処理はWebSocketで非同期に続くため
      // ボタンの状態はAPI呼び出し完了時点ではリセットしない
      // WebSocket側のイベントハンドラで完了またはエラー発生時にリセットされる
    } catch (error) {
      console.error('CrewAIによる知識グラフ生成エラー:', error);
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '知識グラフの生成に失敗しました',
        variant: 'destructive',
      });
      
      // APIリクエスト自体が失敗した場合は即座にローディング状態をリセット
      setLoading(false);
      if (onComplete) onComplete();
    }
  };

  return (
    <Button
      onClick={handleGenerateWithCrewAI}
      disabled={loading}
      className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          マルチエージェント処理中...
        </>
      ) : (
        'CrewAIで知識グラフを生成'
      )}
    </Button>
  );
}