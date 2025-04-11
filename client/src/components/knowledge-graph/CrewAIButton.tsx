import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { addSocketListener, removeSocketListener, initSocket } from '@/lib/socket';
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

  // WebSocketのメッセージでプロセス完了を検知するためのイベントリスナー
  useEffect(() => {
    if (!loading) return;
    
    // websocketの接続を確保
    console.log(`CrewAIButton: WebSocket接続を初期化 (roleModelId=${roleModelId})`);
    const socket = initSocket(roleModelId);
    
    // 進捗イベントハンドラ - 処理の完了やエラーを検知
    const handleProgressUpdate = (data: any) => {
      console.log('進捗更新を受信:', data);
      
      // データ構造の正規化（WebSocketメッセージ形式対応）
      const payload = data.payload || data;
      const targetRoleModelId = payload.roleModelId || (data.payload?.roleModelId);
      
      // roleModelIdが一致するメッセージのみ処理
      if (targetRoleModelId && targetRoleModelId !== roleModelId) {
        console.log(`別のロールモデル(${targetRoleModelId})向けの進捗メッセージを無視します`);
        return;
      }
      
      // 進捗値の抽出（複数のプロパティ名をサポート）
      const progressValue = payload.progress || payload.percent || 0;
      
      // 完了状態（進捗が95%以上）またはエラー状態のとき
      if (progressValue >= 95 || 
          payload.status === 'completed' || payload.status === 'error') {
        console.log('CrewAIプロセス完了またはエラー:', payload);
        
        // ローディング状態を解除
        setLoading(false);
        if (onComplete) onComplete();
        
        // 完了メッセージを表示（エラーの場合はすでに別のエラーメッセージが表示されているはず）
        if (payload.status !== 'error' && progressValue >= 95) {
          // 1秒後に成功メッセージを表示（他のエラーメッセージと重ならないようにするため）
          setTimeout(() => {
            toast({
              title: '処理完了',
              description: payload.message || '知識グラフの生成が完了しました。',
            });
          }, 1000);
        }
      }
      
      // 進捗状況を通知
      if (progressValue > 0 && progressValue < 95) {
        // 最初の進捗と中間段階の進捗のみトースト表示（頻繁なトーストを避けるため）
        if (progressValue === 10 || progressValue === 50) {
          toast({
            title: '処理中',
            description: payload.message || `知識グラフの生成中... ${progressValue}%完了`,
          });
        }
      }
    };

    // エラーイベントハンドラ
    const handleErrorMessage = (data: any) => {
      console.error('エラーメッセージを受信:', data);
      
      // データ構造の正規化（WebSocketメッセージ形式対応）
      const payload = data.payload || data;
      const targetRoleModelId = payload.roleModelId || (data.payload?.roleModelId);
      
      // roleModelIdが一致するメッセージのみ処理
      if (targetRoleModelId && targetRoleModelId !== roleModelId) return;
      
      // エラーメッセージを表示
      toast({
        title: 'エラー',
        description: payload.message || 'ナレッジグラフ生成中にエラーが発生しました',
        variant: 'destructive',
      });
      
      // ローディング状態を解除
      setLoading(false);
      if (onComplete) onComplete();
    };
    
    // 完了イベントハンドラ
    const handleCompletionMessage = (data: any) => {
      console.log('完了メッセージを受信:', data);
      
      // データ構造の正規化（WebSocketメッセージ形式対応）
      const payload = data.payload || data;
      const targetRoleModelId = payload.roleModelId || (data.payload?.roleModelId);
      
      // roleModelIdが一致するメッセージのみ処理
      if (targetRoleModelId && targetRoleModelId !== roleModelId) return;
      
      // 成功メッセージを表示
      toast({
        title: '処理完了',
        description: payload.message || 'ナレッジグラフの生成が完了しました',
      });
      
      // ローディング状態を解除
      setLoading(false);
      if (onComplete) onComplete();
    };
    
    // グラフ更新イベントハンドラ（グラフ更新があった場合も処理完了とみなす）
    const handleGraphUpdate = (data: any) => {
      console.log('グラフ更新メッセージを受信:', data);
      
      // データ構造の正規化（WebSocketメッセージ形式対応）
      const payload = data.payload || data;
      const targetRoleModelId = payload.roleModelId || (data.payload?.roleModelId);
      
      // roleModelIdが一致するメッセージのみ処理
      if (targetRoleModelId && targetRoleModelId !== roleModelId) return;
      
      // 更新タイプが「complete」の場合、処理完了とみなす
      if (payload.updateType === 'complete' || payload.updateType === 'improvement_complete') {
        console.log('グラフ更新完了メッセージを検出:', payload);
        
        // ローディング状態を解除
        setLoading(false);
        if (onComplete) onComplete();
        
        // 完了メッセージを表示
        toast({
          title: '処理完了',
          description: 'ナレッジグラフの生成と更新が完了しました',
        });
      }
    };

    // WebSocketリスナーを追加（複数のイベント名をサポート）
    addSocketListener('progress', handleProgressUpdate);
    addSocketListener('error', handleErrorMessage);
    addSocketListener('completion', handleCompletionMessage);
    addSocketListener('knowledge-graph-update', handleGraphUpdate);
    addSocketListener('knowledge_graph_update', handleGraphUpdate);
    addSocketListener('graph-update', handleGraphUpdate);
    
    // ポーリングによるフォールバック処理
    // WebSocketが機能しない場合に備えて、APIでの定期的な確認も行う
    const checkInterval = setInterval(async () => {
      if (!loading) {
        clearInterval(checkInterval);
        return;
      }
      
      try {
        // グラフの存在確認API
        const response = await fetch(`/api/knowledge-graph/${roleModelId}/exists`);
        if (response.ok) {
          const { exists } = await response.json();
          if (exists) {
            console.log('ポーリングによりグラフの存在を確認しました。処理を完了します。');
            setLoading(false);
            if (onComplete) onComplete();
            clearInterval(checkInterval);
            
            toast({
              title: '処理完了',
              description: 'ナレッジグラフの生成が完了しました',
            });
          }
        }
      } catch (error) {
        console.error('グラフ存在確認API呼び出しエラー:', error);
      }
    }, 10000); // 10秒ごとに確認
    
    // クリーンアップ関数
    return () => {
      removeSocketListener('progress', handleProgressUpdate);
      removeSocketListener('error', handleErrorMessage);
      removeSocketListener('completion', handleCompletionMessage);
      removeSocketListener('knowledge-graph-update', handleGraphUpdate);
      removeSocketListener('knowledge_graph_update', handleGraphUpdate);
      removeSocketListener('graph-update', handleGraphUpdate);
      clearInterval(checkInterval);
    };
  }, [loading, roleModelId, onComplete, toast]);

  // 現在のグラフをスナップショットとして保存
  const saveCurrentGraphAsSnapshot = async () => {
    try {
      const snapshotName = `生成前のグラフ - ${new Date().toLocaleString('ja-JP')}`;
      const response = await apiRequest(
        'POST',
        `/api/knowledge-graph/${roleModelId}/snapshots`,
        {
          name: snapshotName,
          description: 'CrewAI生成前の自動保存されたグラフ'
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'スナップショット保存エラー';
        
        try {
          // JSONとしてパースを試みる
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || 'スナップショット保存エラー';
        } catch (parseError) {
          // JSONでない場合はテキストをそのまま使用
          errorMessage = errorText || 'スナップショット保存エラー';
        }
        
        console.error('スナップショット保存エラー:', errorMessage);
        toast({
          title: 'スナップショット保存失敗',
          description: typeof errorMessage === 'string' ? errorMessage : 'スナップショット保存に失敗しました',
          variant: 'destructive',
        });
        // エラーがあっても続行
      } else {
        toast({
          title: 'スナップショット保存完了',
          description: '現在の知識グラフが保存されました。復元可能です。',
        });
      }
    } catch (error) {
      console.error('スナップショット保存中にエラーが発生しました:', error);
      toast({
        title: 'スナップショット保存エラー',
        description: error instanceof Error ? error.message : 'スナップショット保存中にエラーが発生しました',
        variant: 'destructive',
      });
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
        // エラーレスポンスをテキストとして読み込み
        const errorText = await response.text();
        let errorMessage = '知識グラフの生成に失敗しました';
        
        try {
          // JSONとしてパースを試みる
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || '知識グラフの生成に失敗しました';
        } catch (parseError) {
          // JSONでない場合はテキストをそのまま使用
          errorMessage = errorText || '知識グラフの生成に失敗しました';
        }
        
        throw new Error(errorMessage);
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