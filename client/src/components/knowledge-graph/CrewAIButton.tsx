import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent,
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';

interface CrewAIButtonProps {
  roleModelId: string;
  onStart?: () => void;
  onComplete?: () => void;
  hasKnowledgeGraph?: boolean; // 現在グラフが存在するか
}

export function CrewAIButton({ roleModelId, onStart, onComplete, hasKnowledgeGraph = false }: CrewAIButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();

  // 現在のグラフをスナップショットとして保存
  const saveCurrentGraphAsSnapshot = async () => {
    try {
      const snapshotName = `生成前のグラフ - ${new Date().toLocaleString('ja-JP')}`;
      const response = await apiRequest(
        'POST',
        `/api/knowledge-graph/snapshots/${roleModelId}`,
        {
          name: snapshotName,
          description: 'CrewAI生成前の自動保存されたグラフ'
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('スナップショット保存エラー:', errorData);
        // エラーがあっても続行
      } else {
        toast({
          title: 'スナップショット保存完了',
          description: '現在の知識グラフが保存されました。復元可能です。',
        });
      }
    } catch (error) {
      console.error('スナップショット保存中にエラーが発生しました:', error);
      // エラーがあっても続行
    }
  };

  const handleGenerateWithCrewAI = async () => {
    if (loading) return;
    
    try {
      // 既存のグラフがある場合はスナップショットを保存
      if (hasKnowledgeGraph) {
        await saveCurrentGraphAsSnapshot();
      }
      
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

  const openConfirmDialog = () => {
    // 既存のグラフがある場合は確認ダイアログを表示
    if (hasKnowledgeGraph) {
      setShowConfirmDialog(true);
    } else {
      // グラフがない場合は直接実行
      handleGenerateWithCrewAI();
    }
  };

  return (
    <>
      <Button
        onClick={openConfirmDialog}
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

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>グラフ生成の確認</AlertDialogTitle>
            <AlertDialogDescription>
              現在の知識グラフを上書きします。現在のグラフはスナップショットとして保存されるため、後で復元することができます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowConfirmDialog(false);
                handleGenerateWithCrewAI();
              }}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
            >
              続行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}