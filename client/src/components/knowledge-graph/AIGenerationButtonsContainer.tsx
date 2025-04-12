import { useState, useEffect } from 'react';
import KnowledgeGraphGenerationButton from './KnowledgeGraphGenerationButton';
import CollectionPlanGenerationButton from './CollectionPlanGenerationButton';
import { useKnowledgeGraphGeneration } from '@/hooks/use-knowledge-graph-generation';

interface AIGenerationButtonsContainerProps {
  roleModelId: string;
  industry?: string;
  initialKeywords?: string[];
  hasKnowledgeGraph?: boolean;
  className?: string;
}

/**
 * AI生成ボタンのコンテナコンポーネント
 * ナレッジグラフ＆情報収集プラン生成ボタンと情報収集プラン生成ボタンを管理
 */
export default function AIGenerationButtonsContainer({
  roleModelId,
  industry = '',
  initialKeywords = [],
  hasKnowledgeGraph = false,
  className = ''
}: AIGenerationButtonsContainerProps) {
  // どちらかが生成中かどうかのフラグ
  const [isAnyGenerating, setIsAnyGenerating] = useState(false);
  
  // ボタン状態を管理
  const [graphGenerationActive, setGraphGenerationActive] = useState(false);
  const [planGenerationActive, setPlanGenerationActive] = useState(false);
  
  // WebSocket接続を確立
  const { connect, isConnected } = useKnowledgeGraphGeneration();
  
  // コンポーネントマウント時に接続を確保（roleModelIdが変更されたときに再実行）
  useEffect(() => {
    if (roleModelId && !isConnected) {
      console.log('AIGenerationButtonsContainer: WebSocket接続を開始します', roleModelId);
      connect(roleModelId);
    }
  }, [roleModelId, isConnected, connect]);

  // ボタン間で状態を共有
  useEffect(() => {
    setIsAnyGenerating(graphGenerationActive || planGenerationActive);
  }, [graphGenerationActive, planGenerationActive]);

  // グラフ生成ボタンでのステートチェンジハンドラ
  const handleGraphGenerationStateChange = (isGenerating: boolean) => {
    setGraphGenerationActive(isGenerating);
  };

  // プラン生成ボタンでのステートチェンジハンドラ
  const handlePlanGenerationStateChange = (isGenerating: boolean) => {
    setPlanGenerationActive(isGenerating);
  };

  return (
    <div className={`flex flex-col sm:flex-row gap-2 ${className}`}>
      <KnowledgeGraphGenerationButton
        roleModelId={roleModelId}
        industry={industry}
        initialKeywords={initialKeywords}
        hasKnowledgeGraph={hasKnowledgeGraph}
        disabled={isAnyGenerating}
        onGeneratingChange={handleGraphGenerationStateChange}
      />
      
      <CollectionPlanGenerationButton
        roleModelId={roleModelId}
        industry={industry}
        initialKeywords={initialKeywords}
        hasKnowledgeGraph={hasKnowledgeGraph}
        disabled={isAnyGenerating}
        onGeneratingChange={handlePlanGenerationStateChange}
      />
    </div>
  );
}