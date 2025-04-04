import { useState } from "react";
import IndustrySelector from "./industry-selector";
import SelectedIndustries from "./selected-industries";

interface IndustrySelectionContainerProps {
  initialSelectedIndustries?: string[];
  onIndustriesChange?: (selectedIndustries: string[]) => void;
  maxSelections?: number;
}

export default function IndustrySelectionContainer({
  initialSelectedIndustries = [],
  onIndustriesChange,
  maxSelections = 10
}: IndustrySelectionContainerProps) {
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(initialSelectedIndustries);

  // 業界の選択・解除処理
  const handleSelectIndustry = (industryId: string, selected: boolean) => {
    let newSelectedIndustries: string[];
    
    if (selected) {
      // 最大選択数を超える場合は追加しない
      if (selectedIndustries.length >= maxSelections) {
        return;
      }
      newSelectedIndustries = [...selectedIndustries, industryId];
    } else {
      newSelectedIndustries = selectedIndustries.filter(id => id !== industryId);
    }
    
    setSelectedIndustries(newSelectedIndustries);
    
    // 親コンポーネントに変更を通知
    if (onIndustriesChange) {
      onIndustriesChange(newSelectedIndustries);
    }
  };

  // 選択済み業界の削除処理
  const handleRemoveIndustry = (industryId: string) => {
    const newSelectedIndustries = selectedIndustries.filter(id => id !== industryId);
    setSelectedIndustries(newSelectedIndustries);
    
    // 親コンポーネントに変更を通知
    if (onIndustriesChange) {
      onIndustriesChange(newSelectedIndustries);
    }
  };

  return (
    <div className="w-full">
      <div className="space-y-6">
        <IndustrySelector
          selectedIndustries={selectedIndustries}
          onSelectIndustry={handleSelectIndustry}
          maxHeight="400px"
          title={`業界カテゴリー選択 (最大${maxSelections}件)`}
        />
        
        <SelectedIndustries
          selectedIndustryIds={selectedIndustries}
          onRemoveIndustry={handleRemoveIndustry}
          maxHeight="100px"
        />
      </div>
    </div>
  );
}