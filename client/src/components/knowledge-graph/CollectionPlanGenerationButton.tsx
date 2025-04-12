import { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useKnowledgeGraphGeneration } from '@/hooks/use-knowledge-graph-generation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';

interface CollectionPlanGenerationButtonProps {
  roleModelId: string;
  industry?: string;
  initialKeywords?: string[];
  className?: string;
  hasKnowledgeGraph?: boolean;
  disabled?: boolean;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

/**
 * 情報収集プラン生成ボタン（CrewAIを使用）
 * 既存のナレッジグラフをベースに情報収集プランのみを作成
 */
export default function CollectionPlanGenerationButton({
  roleModelId,
  industry = '',
  initialKeywords = [],
  className = '',
  hasKnowledgeGraph = false,
  disabled = false,
  onGeneratingChange
}: CollectionPlanGenerationButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [showNoGraphDialog, setShowNoGraphDialog] = useState(false);
  const { toast } = useToast();
  
  const { 
    connect,
    sendMessage,
    isConnected, 
    progressUpdates,
    sendCancelOperationRequest,
    cancelOperation,
    sendCreateKnowledgeGraphRequest
  } = useKnowledgeGraphGeneration();
  
  // コンポーネントのマウント時にWebSocketを接続
  useEffect(() => {
    if (roleModelId) {
      console.log('CollectionPlanGenerationButton: WebSocket接続を開始します', roleModelId);
      connect(roleModelId);
    }
  }, [roleModelId, connect]);

  // WebSocketからの進捗状況更新を処理するエフェクト
  useEffect(() => {
    if (progressUpdates.length > 0) {
      const latestUpdate = progressUpdates[progressUpdates.length - 1];
      if (latestUpdate && typeof latestUpdate.progress === 'number') {
        setProgress(latestUpdate.progress);
      }
      if (latestUpdate && latestUpdate.message) {
        setStatusMessage(latestUpdate.message);
      }
    }
  }, [progressUpdates]);
  
  // 生成状態が変更されたときに親コンポーネントに通知
  useEffect(() => {
    if (onGeneratingChange) {
      onGeneratingChange(isGenerating);
    }
  }, [isGenerating, onGeneratingChange]);

  // 情報収集プラン生成を開始する関数
  const handleStartGeneration = useCallback(async () => {
    if (!roleModelId) {
      toast({
        title: "エラー",
        description: "ロールモデルIDが指定されていません",
        variant: "destructive",
      });
      return;
    }

    if (!hasKnowledgeGraph) {
      // グラフが存在しない場合は警告ダイアログを表示
      setShowNoGraphDialog(true);
      return;
    }

    await startGeneration();
  }, [roleModelId, hasKnowledgeGraph]);

  // 実際の生成プロセスを開始
  const startGeneration = async () => {
    try {
      setIsGenerating(true);
      setProgress(0);
      setStatusMessage('情報収集プラン生成を開始しています...');

      // WebSocket接続が確立されているか確認
      if (!isConnected) {
        toast({
          title: "接続エラー",
          description: "サーバーへの接続が確立されていません。ページを再読み込みして再試行してください。",
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }

      // 情報収集プラン生成リクエストを送信
      console.log('情報収集プラン生成リクエスト送信:', roleModelId);
      
      // 共通関数が利用可能ならそちらを使う
      if (typeof sendCreateKnowledgeGraphRequest === 'function') {
        sendCreateKnowledgeGraphRequest({
          roleModelId,  // 明示的にroleModelIdを渡す
          includeCollectionPlan: true, 
          industry: industry || '一般',
          keywords: initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ'],
          useExistingGraph: true // 既存のナレッジグラフを使用
        });
      } else {
        // フォールバック: 直接メッセージを送信
        sendMessage('create_collection_plan', {
          roleModelId,  // roleModelIdを必ず含める
          industry: industry || '一般',
          keywords: initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ'],
          useExistingGraph: true  // 既存のナレッジグラフを使用
        });
      }

      console.log('業界:', industry || '一般');
      console.log('キーワード:', initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ']);
      
    } catch (error) {
      console.error('情報収集プラン生成リクエストエラー:', error);
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
      // 新しく追加した共通キャンセル機能を優先使用
      if (typeof cancelOperation === 'function') {
        const cancelled = cancelOperation();
        if (cancelled) {
          console.log('キャンセル操作が正常に実行されました');
        } else {
          // フォールバックとして専用の関数を使用
          sendCancelOperationRequest('collection_plan');
        }
      } else {
        // 専用の関数を使用してキャンセルリクエストを送信
        sendCancelOperationRequest('collection_plan');
      }
      
      // UI状態をリセット
      setIsGenerating(false);
      setProgress(0);
      setStatusMessage('');
      
      toast({
        title: "キャンセル完了",
        description: "処理がキャンセルされました",
      });
    } catch (error) {
      console.error('キャンセル処理エラー:', error);
      toast({
        title: "エラー",
        description: "キャンセル処理中にエラーが発生しました",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      {isGenerating ? (
        <div className={`flex flex-col gap-2 p-4 rounded-lg border ${className}`}>
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="font-medium">処理中: {statusMessage}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCancel}
            className="mt-2 w-full"
          >
            キャンセル
          </Button>
        </div>
      ) : (
        <Button
          className={`gap-2 ${className}`}
          onClick={handleStartGeneration}
          disabled={disabled || !hasKnowledgeGraph}
          variant="outline"
        >
          <FileSpreadsheet className="h-5 w-5" />
          情報収集プラン作成
        </Button>
      )}

      {/* ナレッジグラフなし警告ダイアログ */}
      <AlertDialog open={showNoGraphDialog} onOpenChange={setShowNoGraphDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ナレッジグラフが存在しません</AlertDialogTitle>
            <AlertDialogDescription>
              情報収集プランを生成するには、先にナレッジグラフを作成する必要があります。「ナレッジグラフ＆情報収集プラン生成」ボタンを使用して、両方同時に作成することをお勧めします。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowNoGraphDialog(false)}>
              了解
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}