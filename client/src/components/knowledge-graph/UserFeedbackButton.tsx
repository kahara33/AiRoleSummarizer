import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare } from 'lucide-react';
import { useUnifiedWebSocket } from '@/hooks/use-unified-websocket';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface UserFeedbackButtonProps {
  roleModelId: string;
  industry?: string;
  disabled?: boolean;
  className?: string;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

/**
 * ユーザーフィードバック収集ボタン
 * サンプル要約を生成して表示し、ユーザーからフィードバックを収集
 */
export default function UserFeedbackButton({
  roleModelId,
  industry = '',
  disabled = false,
  className = '',
  onGeneratingChange
}: UserFeedbackButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  
  const { toast } = useToast();
  
  const { 
    connect,
    sendMessage,
    isConnected, 
    progressUpdates,
    sendUserFeedback,
    sendCancelOperationRequest,
    cancelOperation
  } = useUnifiedWebSocket();
  
  // コンポーネントのマウント時にWebSocketを接続
  useEffect(() => {
    if (roleModelId && !isConnected) {
      console.log('UserFeedbackButton: WebSocket接続を開始します', roleModelId);
      connect(roleModelId);
    }
  }, [roleModelId, isConnected, connect]);
  
  // WebSocketからの進捗更新を監視
  useEffect(() => {
    if (progressUpdates && progressUpdates.length > 0) {
      const latestUpdate = progressUpdates[progressUpdates.length - 1];
      
      // このコンポーネントに関連する進捗のみを処理
      if (latestUpdate.data?.status === 'awaiting_feedback' || 
          latestUpdate.data?.status === 'completed' || 
          latestUpdate.data?.samples) {
        // Nullチェックして数値を確実に渡す
        if (typeof latestUpdate.progress === 'number') {
          setProgress(latestUpdate.progress);
        }
        setStatusMessage(latestUpdate.message);
        
        // 完了またはエラー時の状態リセット
        if (latestUpdate.progress === 100 || latestUpdate.progress === 0 || 
            latestUpdate.data?.status === 'completed' || latestUpdate.data?.status === 'error') {
          setTimeout(() => {
            setIsGenerating(false);
            
            // 親コンポーネントに状態変更を通知
            if (onGeneratingChange) {
              onGeneratingChange(false);
            }
          }, 1000);
        }
      }
    }
  }, [progressUpdates, onGeneratingChange]);
  
  // 生成状態が変化したら親コンポーネントに通知
  useEffect(() => {
    if (onGeneratingChange) {
      onGeneratingChange(isGenerating);
    }
  }, [isGenerating, onGeneratingChange]);
  
  // フィードバックリクエストを送信する関数
  const handleStartFeedbackCollection = () => {
    try {
      setIsGenerating(true);
      setProgress(5);
      setStatusMessage('要約サンプルを生成しています...');
      
      // ユーザーフィードバックリクエストを送信
      sendUserFeedback({
        feedbackType: 'REQUEST_SAMPLES',
        topic: industry || 'AI',
        data: {
          topic: industry || 'AI',
          requestType: 'summary_samples'
        }
      });
      
      toast({
        title: "フィードバック収集開始",
        description: "要約サンプルを生成しています。チャットパネルをご確認ください。",
      });
      
      console.log('要約サンプル生成リクエスト送信:', industry || 'AI');
      
    } catch (error) {
      console.error('要約サンプル生成リクエストエラー:', error);
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
      // 共通キャンセル機能を使用
      if (typeof cancelOperation === 'function') {
        const cancelled = cancelOperation();
        if (cancelled) {
          console.log('キャンセル操作が正常に実行されました');
        } else {
          // フォールバックとして専用の関数を使用
          sendCancelOperationRequest('user_feedback');
        }
      } else {
        // 専用の関数を使用してキャンセルリクエスト
        sendCancelOperationRequest('user_feedback');
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`${className}`}>
            {!isGenerating ? (
              <Button
                variant="outline"
                size="sm"
                className="text-xs flex items-center space-x-1 h-8"
                onClick={handleStartFeedbackCollection}
                disabled={disabled || !roleModelId}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                <span>要約サンプル評価</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-xs flex items-center space-x-1 h-8 bg-secondary"
                onClick={handleCancel}
              >
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                <span className="whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                  {progress > 0 ? `${progress}%` : '処理中...'}
                </span>
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            要約サンプルを生成し、好みの要約タイプをフィードバックすることで、情報収集プランを最適化します
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}