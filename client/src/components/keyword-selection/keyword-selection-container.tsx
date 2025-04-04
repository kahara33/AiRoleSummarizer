import { useState } from "react";
import KeywordSearch from "./keyword-search";
import SelectedKeywords from "./selected-keywords";

interface KeywordSelectionContainerProps {
  initialSelectedKeywords?: string[];
  onKeywordsChange?: (selectedKeywords: string[]) => void;
  maxSelections?: number;
}

export default function KeywordSelectionContainer({
  initialSelectedKeywords = [],
  onKeywordsChange,
  maxSelections = 20
}: KeywordSelectionContainerProps) {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(initialSelectedKeywords);

  // キーワードの選択・解除処理
  const handleSelectKeyword = (keywordId: string, selected: boolean) => {
    let newSelectedKeywords: string[];
    
    if (selected) {
      // 最大選択数を超える場合は追加しない
      if (selectedKeywords.length >= maxSelections) {
        return;
      }
      newSelectedKeywords = [...selectedKeywords, keywordId];
    } else {
      newSelectedKeywords = selectedKeywords.filter(id => id !== keywordId);
    }
    
    setSelectedKeywords(newSelectedKeywords);
    
    // 親コンポーネントに変更を通知
    if (onKeywordsChange) {
      onKeywordsChange(newSelectedKeywords);
    }
  };

  // 選択済みキーワードの削除処理
  const handleRemoveKeyword = (keywordId: string) => {
    const newSelectedKeywords = selectedKeywords.filter(id => id !== keywordId);
    setSelectedKeywords(newSelectedKeywords);
    
    // 親コンポーネントに変更を通知
    if (onKeywordsChange) {
      onKeywordsChange(newSelectedKeywords);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-6">
        <div className="w-full">
          <KeywordSearch
            selectedKeywords={selectedKeywords}
            onSelectKeyword={handleSelectKeyword}
            maxHeight="300px"
            title={`キーワード検索・選択 (最大${maxSelections}件)`}
          />
        </div>
        <div className="w-full">
          <SelectedKeywords
            selectedKeywordIds={selectedKeywords}
            onRemoveKeyword={handleRemoveKeyword}
            maxHeight="300px"
          />
        </div>
      </div>
    </div>
  );
}