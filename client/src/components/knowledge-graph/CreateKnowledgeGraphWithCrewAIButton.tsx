import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket';

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
  const { toast } = useToast();
  const { sendMessage: sendWebSocketMessage, isConnected } = useMultiAgentWebSocket();

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
      
      // WebSocketメッセージを送信してナレッジグラフ生成を開始
      sendWebSocketMessage('create_knowledge_graph', {
        industry: industry || '一般',
        keywords: initialKeywords.length > 0 ? initialKeywords : ['情報収集', 'ナレッジグラフ'],
        sources: [],
        constraints: [],
        requirements: []
      });
      
      toast({
        title: 'ナレッジグラフの生成を開始しました',
        description: 'マルチエージェントがナレッジグラフを生成しています...',
      });
      
    } catch (error) {
      console.error('ナレッジグラフ生成リクエストエラー:', error);
      toast({
        title: 'エラー',
        description: '操作中にエラーが発生しました。もう一度お試しください。',
        variant: 'destructive',
      });
    } finally {
      // 生成プロセスは非同期に進行するため、ボタンはすぐに再利用可能にする
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleCreateKnowledgeGraph}
      disabled={isGenerating || !isConnected}
      className={`bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 ${className}`}
    >
      {isGenerating ? (
        <>
          <span className="animate-pulse">生成中...</span>
        </>
      ) : (
        <>
          CrewAIでナレッジグラフを生成
        </>
      )}
    </Button>
  );
}