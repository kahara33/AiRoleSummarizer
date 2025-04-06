import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, FileText } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useWebSocket } from '../../hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { initSocket, addSocketListener, removeSocketListener } from '@/lib/socket';
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

interface CreateCollectionPlanButtonProps {
  roleModelId: string;
  industryIds: string[];
  keywordIds: string[];
  disabled?: boolean;
  hasKnowledgeGraph: boolean;
}

export default function CreateCollectionPlanButton({
  roleModelId,
  industryIds,
  keywordIds,
  disabled = false,
  hasKnowledgeGraph,
}: CreateCollectionPlanButtonProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // WebSocketのURL生成関数
  const getCorrectSocketUrl = (id: string) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws?roleModelId=${id}`;
  };

  // WebSocket接続用URL
  const socketUrl = roleModelId ? 
    getCorrectSocketUrl(roleModelId) : 
    null;

  // WebSocketフックの使用
  const { isConnected, connect, disconnect } = useWebSocket(socketUrl, {
    onProgressUpdate: (data: Record<string, any>) => {
      console.log('プラン作成進捗:', data);
      if (typeof data.progress === 'number') {
        setProgress(data.progress);
      }
      
      // 進捗が100%に達したら完了とみなす
      if (data.progress >= 100) {
        toast({
          title: '完了',
          description: '情報収集プランが正常に作成されました',
        });
        setIsCreating(false);
        setTimeout(() => disconnect(), 1000);
      }
    },
    onError: (data: Record<string, any>) => {
      toast({
        title: 'エラー',
        description: data.message || 'プラン作成中にエラーが発生しました',
        variant: 'destructive',
      });
      
      setIsCreating(false);
      disconnect();
    },
    onCompletion: (data: Record<string, any>) => {
      toast({
        title: '完了',
        description: '情報収集プランが正常に作成されました',
      });
      
      setIsCreating(false);
      disconnect();
    },
  });

  // 直接WebSocketライブラリでイベントを監視
  useEffect(() => {
    if (!isCreating || !roleModelId) return;

    // プログレス更新ハンドラ
    const handleProgress = (data: any) => {
      console.log('Socket.ts経由の進捗更新:', data);
      if (data.roleModelId === roleModelId && typeof data.progress === 'number') {
        setProgress(data.progress);
        
        // 進捗が100%に達したら完了とみなす
        if (data.progress >= 100) {
          toast({
            title: '完了',
            description: '情報収集プランが正常に作成されました',
          });
          setIsCreating(false);
        }
      }
    };

    // エラーハンドラ
    const handleError = (data: any) => {
      console.log('Socket.ts経由のエラー:', data);
      if (data.roleModelId === roleModelId) {
        toast({
          title: 'エラー',
          description: data.message || 'プラン作成中にエラーが発生しました',
          variant: 'destructive',
        });
        setIsCreating(false);
      }
    };

    // 完了ハンドラ
    const handleCompletion = (data: any) => {
      console.log('Socket.ts経由の完了:', data);
      if (data.roleModelId === roleModelId) {
        toast({
          title: '完了',
          description: '情報収集プランが正常に作成されました',
        });
        setIsCreating(false);
      }
    };

    // socket.tsのWebSocketにリスナーを追加
    initSocket(roleModelId);
    addSocketListener('progress', handleProgress);
    addSocketListener('error', handleError);
    addSocketListener('completion', handleCompletion);

    return () => {
      // クリーンアップ
      removeSocketListener('progress', handleProgress);
      removeSocketListener('error', handleError);
      removeSocketListener('completion', handleCompletion);
    };
  }, [isCreating, roleModelId, toast]);

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
      setProgress(0);
      
      // WebSocketの両方の方法で接続を確保
      connect();
      initSocket(roleModelId);
      
      // プラン作成開始のトースト表示
      toast({
        title: '情報収集プラン作成',
        description: '情報収集プランの作成を開始しました。進捗状況はAIエージェント対話パネルで確認できます。',
      });
      
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
      
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : '情報収集プランの作成に失敗しました',
        variant: 'destructive',
      });
      
      setIsCreating(false);
      disconnect();
    }
  }, [roleModelId, industryIds, keywordIds, connect, disconnect, toast]);

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
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress > 0 ? `${Math.round(progress)}%` : '処理中...'}
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            情報収集プラン作成
          </>
        )}
      </Button>

      {/* 確認ダイアログ */}
      <AlertDialog open={openConfirm} onOpenChange={setOpenConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>情報収集プランを作成しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              選択した業界とキーワードに基づいて情報収集プランを作成します。
              このプロセスには数分かかる場合があります。
              進捗状況はAIエージェント対話パネルに表示されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreatePlan}>作成する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}