import { useState, useEffect } from 'react';
import KnowledgeGraphGenerationButton from './KnowledgeGraphGenerationButton';
import CollectionPlanGenerationButton from './CollectionPlanGenerationButton';

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
  
  // WebSocketからの進捗情報を利用するためのステート
  const [graphProgress, setGraphProgress] = useState(0);
  const [planProgress, setPlanProgress] = useState(0);

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