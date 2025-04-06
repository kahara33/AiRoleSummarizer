import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, FileText } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

interface CreateCollectionPlanButtonProps {
  roleModelId: string;
  industryIds: string[];
  keywordIds: string[];
  disabled?: boolean;
  hasKnowledgeGraph: boolean;
}

type ProgressState = {
  message: string;
  progress: number;
  stage?: string;
  subStage?: string;
  error?: boolean;
  errorMessage?: string;
};

export default function CreateCollectionPlanButton({
  roleModelId,
  industryIds,
  keywordIds,
  disabled = false,
  hasKnowledgeGraph
}: CreateCollectionPlanButtonProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [openProgress, setOpenProgress] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState>({
    message: '準備しています...',
    progress: 0,
  });
  const { toast } = useToast();

  // WebSocket接続用URL
  const socketUrl = roleModelId ? 
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws?target=${roleModelId}` : 
    null;

  // WebSocketフックの使用
  const { isConnected, connect, disconnect } = useWebSocket(socketUrl, {
    onProgressUpdate: (data) => {
      setProgressState({
        message: data.message || '処理中...',
        progress: data.progress || 0,
        stage: data.stage,
        subStage: data.subStage,
      });
    },
    onError: (data) => {
      setProgressState(prev => ({
        ...prev,
        error: true,
        errorMessage: data.message || 'エラーが発生しました',
      }));
      
      toast({
        title: 'エラー',
        description: data.message || 'プラン作成中にエラーが発生しました',
        variant: 'destructive',
      });
      
      setIsCreating(false);
      setTimeout(() => {
        setOpenProgress(false);
        disconnect();
      }, 3000);
    },
    onCompletion: (data) => {
      setProgressState(prev => ({
        ...prev,
        progress: 100,
        message: '情報収集プランの作成が完了しました！',
      }));
      
      toast({
        title: '完了',
        description: '情報収集プランが正常に作成されました',
      });
      
      setIsCreating(false);
      setTimeout(() => {
        setOpenProgress(false);
        disconnect();
      }, 2000);
    },
  });

  // プラン作成の開始
  const handleCreatePlan = useCallback(async () => {
    if (!roleModelId || !industryIds.length || !keywordIds.length) {
      toast({
        title: '入力エラー',
        description: 'ロールモデル、業界、キーワードを選択してください',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);
      setOpenConfirm(false);
      setOpenProgress(true);
      
      // WebSocket接続
      connect();
      
      // APIリクエスト
      const response = await apiRequest('POST', `/api/role-models/${roleModelId}/information-collection-plans`, {
        roleModelId,
        industryIds,
        keywordIds,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '情報収集プランの作成に失敗しました');
      }
      
      // 202 Acceptedが返ってくる想定
      const data = await response.json();
      console.log('プラン作成開始:', data);
      
      // 進捗状況はWebSocketから取得するので、ここでは何もしない
    } catch (error) {
      console.error('プラン作成エラー:', error);
      
      setProgressState({
        message: '情報収集プラン作成中にエラーが発生しました',
        progress: 0,
        error: true,
        errorMessage: error instanceof Error ? error.message : '不明なエラー',
      });
      
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '情報収集プランの作成に失敗しました',
        variant: 'destructive',
      });
      
      setIsCreating(false);
      setTimeout(() => {
        setOpenProgress(false);
        disconnect();
      }, 3000);
    }
  }, [roleModelId, industryIds, keywordIds, connect, disconnect, toast]);

  // キャンセル処理
  const handleCancel = useCallback(() => {
    if (isCreating) {
      disconnect();
    }
    setOpenProgress(false);
    setIsCreating(false);
  }, [isCreating, disconnect]);

  // ボタンが無効かどうかの判定
  const buttonDisabled = disabled || !hasKnowledgeGraph || isCreating || !roleModelId || industryIds.length === 0 || keywordIds.length === 0;

  return (
    <>
      <Button
        onClick={() => setOpenConfirm(true)}
        disabled={buttonDisabled}
        className="flex items-center gap-2"
        variant={hasKnowledgeGraph ? "default" : "outline"}
      >
        {isCreating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        情報収集プラン作成
      </Button>

      {/* 確認ダイアログ */}
      <AlertDialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>情報収集プランを作成しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              選択した業界とキーワードに基づいて情報収集プランを作成します。
              このプロセスには数分かかる場合があります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreatePlan}>作成する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 進捗ダイアログ */}
      <Dialog open={openProgress} onOpenChange={setOpenProgress}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {progressState.error ? 'エラーが発生しました' : '情報収集プラン作成中'}
            </DialogTitle>
            <DialogDescription>
              {progressState.stage && `ステージ: ${progressState.stage}`}
              {progressState.subStage && ` - ${progressState.subStage}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Progress value={progressState.progress} className="h-2" />
            <p className="mt-2 text-sm text-muted-foreground">
              {progressState.message}
            </p>
            {progressState.errorMessage && (
              <p className="mt-2 text-sm text-destructive">
                {progressState.errorMessage}
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCancel}
            >
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}