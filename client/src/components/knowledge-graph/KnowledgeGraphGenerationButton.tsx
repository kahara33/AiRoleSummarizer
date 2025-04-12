import { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, BrainCircuit, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedWebSocket } from '@/hooks/use-unified-websocket';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
    connect,
    sendMessage,
    isConnected, 
    progressUpdates,
    sendCreateKnowledgeGraphRequest,
    sendCancelOperationRequest,
    cancelOperation
  } = useUnifiedWebSocket();
  
  // コンポーネントのマウント時にWebSocketを接続（roleModelIdが変更されたときに再実行）
  useEffect(() => {
    if (roleModelId && !isConnected) {
      console.log('KnowledgeGraphGenerationButton: WebSocket接続を開始します', roleModelId);
      connect(roleModelId);
    }
  }, [roleModelId, isConnected, connect]);

  // ユーザーフィードバック用の状態
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [summarySamples, setSummarySamples] = useState<any[]>([]);
  const [selectedSamples, setSelectedSamples] = useState<string[]>([]);
  
  // WebSocketからの進捗状況更新を処理するエフェクト
  useEffect(() => {
    if (progressUpdates.length > 0) {
      const latestUpdate = progressUpdates[progressUpdates.length - 1];
      if (latestUpdate && typeof latestUpdate.progress === 'number') {
        setProgress(latestUpdate.progress);
        
        // ユーザーフィードバック待ちの状態を処理
        if (latestUpdate.data?.status === 'waiting_for_user_input' && 
            latestUpdate.data?.summarySamples && 
            latestUpdate.data.summarySamples.length > 0) {
          setSummarySamples(latestUpdate.data.summarySamples);
          setShowFeedbackDialog(true);
        }
        
        // 進捗が100%に達した場合、生成が完了したと判断
        if (latestUpdate.progress === 100) {
          setTimeout(() => {
            setIsGenerating(false);
            setShowFeedbackDialog(false); // フィードバックダイアログを閉じる
            toast({
              title: "処理完了",
              description: "ナレッジグラフと情報収集プランの生成が完了しました",
            });
            // 1秒後にページをリロードして新しいグラフを表示
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }, 1000); // 1秒待ってから完了させる
        }
      }
      if (latestUpdate && latestUpdate.message) {
        setStatusMessage(latestUpdate.message);
      }
    }
  }, [progressUpdates, toast]);
  
  // ユーザーのサンプル選択を処理し、フィードバックを送信する関数
  const handleFeedbackSubmit = () => {
    if (selectedSamples.length === 0) {
      toast({
        title: "選択が必要です",
        description: "少なくとも1つのサンプルを選択してください",
        variant: "destructive",
      });
      return;
    }
    
    // 選択されたサンプルに基づいてフィードバックを送信
    try {
      const selectedSampleObjects = summarySamples.filter(sample => 
        selectedSamples.includes(sample.id)
      );
      
      sendMessage('user_feedback', {
        feedbackType: 'summary_preference',
        data: {
          preferredSamples: selectedSampleObjects,
          mainTopic: industry || 'AI',
        }
      });
      
      toast({
        title: "フィードバック送信完了",
        description: `${selectedSamples.length}つの要約タイプが選択されました。処理を続行します。`,
      });
      
      // フィードバックダイアログを閉じる
      setShowFeedbackDialog(false);
      
    } catch (error) {
      console.error('フィードバック送信エラー:', error);
      toast({
        title: "エラー",
        description: "フィードバックの送信中にエラーが発生しました",
        variant: "destructive",
      });
    }
  };
  
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

      // 上書き処理を行うことを明示的に表示
      if (hasKnowledgeGraph) {
        setStatusMessage('既存のナレッジグラフを上書きしています...');
      }

      // ナレッジグラフ生成リクエストを送信
      console.log('ナレッジグラフ生成リクエスト送信:', roleModelId);
      
      // 詳細なデバッグログを追加
      console.log('ナレッジグラフ生成: sendCreateKnowledgeGraphRequest 関数の有無:', typeof sendCreateKnowledgeGraphRequest);
      console.log('WebSocket接続状態:', isConnected ? '接続済み' : '未接続');
      
      const messagePayload = {
        roleModelId,  // 明示的にroleModelIdを渡す
        includeCollectionPlan: true,  // ナレッジグラフ生成と情報収集プラン生成の両方を行う
        industry: industry || '一般',
        keywords: initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ'],
        useExistingGraph: false,  // 既存グラフを使用せず新規に生成
      };
      
      console.log('送信するペイロード:', messagePayload);
      
      // 共通関数が利用可能ならそちらを使う
      if (typeof sendCreateKnowledgeGraphRequest === 'function') {
        const success = sendCreateKnowledgeGraphRequest(messagePayload);
        console.log('ナレッジグラフ生成リクエスト送信結果:', success ? '成功' : '失敗');
      } else {
        // フォールバック: 直接メッセージを送信
        const success = sendMessage('create_knowledge_graph', messagePayload);
        console.log('フォールバックメッセージ送信結果:', success ? '成功' : '失敗');
      }

      console.log('業界:', industry || '一般');
      console.log('キーワード:', initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ']);
      console.log('上書きモード:', true);
      
      // 確認ダイアログを閉じる
      setShowConfirmDialog(false);
      
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

  // サンプル選択の切り替え処理
  const toggleSampleSelection = (id: string) => {
    setSelectedSamples(current => 
      current.includes(id) 
        ? current.filter(sampleId => sampleId !== id)
        : [...current, id]
    );
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

      {/* ユーザーフィードバックダイアログ */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>要約タイプの選択</DialogTitle>
            <DialogDescription>
              以下の要約タイプの中から、あなたが最も役立つと思うものを選択してください。
              選択したタイプが情報収集プランの最適化に活用されます。
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {summarySamples.map((sample) => (
              <Card 
                key={sample.id} 
                className={`cursor-pointer transition-all ${selectedSamples.includes(sample.id) ? 'ring-2 ring-primary' : 'hover:bg-secondary/10'}`}
                onClick={() => toggleSampleSelection(sample.id)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{sample.name}</CardTitle>
                    <Checkbox 
                      checked={selectedSamples.includes(sample.id)}
                      onCheckedChange={() => toggleSampleSelection(sample.id)}
                      className="ml-2"
                    />
                  </div>
                  <CardDescription>{sample.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{sample.sample}</p>
                </CardContent>
                <CardFooter className="justify-end">
                  {selectedSamples.includes(sample.id) && (
                    <div className="flex items-center text-primary text-sm font-medium">
                      <Check className="w-4 h-4 mr-1" />
                      選択中
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
          
          <DialogFooter>
            <Button onClick={handleFeedbackSubmit} className="w-full sm:w-auto">
              選択を確定して続行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}