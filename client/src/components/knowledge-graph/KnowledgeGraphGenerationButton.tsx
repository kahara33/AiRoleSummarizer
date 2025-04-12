import { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket-fixed';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';

interface KnowledgeGraphGenerationButtonProps {
  roleModelId: string;
  industry?: string;
  initialKeywords?: string[];
  className?: string;
  hasKnowledgeGraph?: boolean;
  disabled?: boolean;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

/**
 * ナレッジグラフ生成ボタン（CrewAIを使用）
 * すべてのエージェントを起動して、ナレッジグラフとコレクションプランの両方を作成
 */
export default function KnowledgeGraphGenerationButton({
  roleModelId,
  industry = '',
  initialKeywords = [],
  className = '',
  hasKnowledgeGraph = false,
  disabled = false,
  onGeneratingChange
}: KnowledgeGraphGenerationButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();
  
  const { 
    sendMessage,
    isConnected, 
    progressUpdates,
    sendCreateKnowledgeGraphRequest,
    sendCancelOperationRequest,
    cancelOperation
  } = useMultiAgentWebSocket();

  // WebSocketからの進捗状況更新を処理するエフェクト
  useState(() => {
    if (progressUpdates.length > 0) {
      const latestUpdate = progressUpdates[progressUpdates.length - 1];
      if (latestUpdate && typeof latestUpdate.progress === 'number') {
        setProgress(latestUpdate.progress);
      }
      if (latestUpdate && latestUpdate.message) {
        setStatusMessage(latestUpdate.message);
      }
    }
  });
  
  // 生成状態が変更されたときに親コンポーネントに通知
  useEffect(() => {
    if (onGeneratingChange) {
      onGeneratingChange(isGenerating);
    }
  }, [isGenerating, onGeneratingChange]);

  // ナレッジグラフ生成を開始する関数
  const handleStartGeneration = useCallback(async () => {
    if (!roleModelId) {
      toast({
        title: "エラー",
        description: "ロールモデルIDが指定されていません",
        variant: "destructive",
      });
      return;
    }

    if (hasKnowledgeGraph) {
      // 既にグラフが存在する場合は確認ダイアログを表示
      setShowConfirmDialog(true);
      return;
    }

    await startGeneration();
  }, [roleModelId, hasKnowledgeGraph]);

  // 実際の生成プロセスを開始
  const startGeneration = async () => {
    try {
      setIsGenerating(true);
      setProgress(0);
      setStatusMessage('ナレッジグラフ生成を開始しています...');

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

      // ナレッジグラフ生成リクエストを送信
      console.log('ナレッジグラフ生成リクエスト送信:', roleModelId);
      
      // 共通関数が利用可能ならそちらを使う
      if (typeof sendCreateKnowledgeGraphRequest === 'function') {
        sendCreateKnowledgeGraphRequest({
          includeCollectionPlan: true,  // ナレッジグラフ生成と情報収集プラン生成の両方を行う
          industry: industry || '一般',
          keywords: initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ'],
        });
      } else {
        // フォールバック: 直接メッセージを送信
        sendMessage('create_knowledge_graph', {
          includeCollectionPlan: true,
          industry: industry || '一般',
          keywords: initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ'],
        });
      }

      console.log('業界:', industry || '一般');
      console.log('キーワード:', initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ']);
      
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
      // 新しく追加した共通キャンセル機能を優先使用
      if (typeof cancelOperation === 'function') {
        const cancelled = cancelOperation();
        if (cancelled) {
          console.log('キャンセル操作が正常に実行されました');
        } else {
          // フォールバックとして専用の関数を使用
          sendCancelOperationRequest('knowledge_graph');
        }
      } else {
        // 専用の関数を使用してキャンセルリクエストを送信
        sendCancelOperationRequest('knowledge_graph');
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
          disabled={disabled}
        >
          <BrainCircuit className="h-5 w-5" />
          ナレッジグラフ＆情報収集プラン生成
        </Button>
      )}

      {/* 上書き確認ダイアログ */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>既存のナレッジグラフを上書きしますか？</AlertDialogTitle>
            <AlertDialogDescription>
              既にナレッジグラフが存在します。新しく生成すると既存のデータは上書きされます。続行しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={startGeneration}>
              続行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}