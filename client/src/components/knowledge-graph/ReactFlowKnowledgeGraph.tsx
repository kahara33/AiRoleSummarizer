import React, { useState } from 'react';
import { KnowledgeNode } from '@shared/schema';
import SimpleGraph from './SimpleGraph';
import TextBasedGraph from './TextBasedGraph';
import { Button } from '@/components/ui/button';
import { List, BarChart } from 'lucide-react';

// 表示モードの選択肢
type ViewMode = 'simple' | 'text';

interface ReactFlowKnowledgeGraphProps {
  roleModelId: string;
  onNodeClick?: (node: KnowledgeNode) => void;
  width?: number;
  height?: number;
}

/**
 * このコンポーネントはグラフ表示とテキスト表示を切り替えられます
 * グラフ表示が機能しない場合のフォールバックとして、テキストベースの表示も実装しています
 */
const ReactFlowKnowledgeGraph: React.FC<ReactFlowKnowledgeGraphProps> = (props) => {
  const { roleModelId, width = 800, height = 600 } = props;
  const [viewMode, setViewMode] = useState<ViewMode>('text');
  
  return (
    <div 
      style={{ width, height }} 
      className="border rounded-md overflow-hidden shadow-sm"
    >
      {/* 表示切り替えボタン */}
      <div className="flex justify-end p-2 bg-gray-50 border-b">
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'simple' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setViewMode('simple')}
          >
            <BarChart className="h-4 w-4 mr-2" />
            グラフ表示
          </Button>
          <Button 
            variant={viewMode === 'text' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setViewMode('text')}
          >
            <List className="h-4 w-4 mr-2" />
            テキスト表示
          </Button>
        </div>
      </div>
      
      {/* 表示モードに応じたコンポーネント */}
      <div className="h-[calc(100%-48px)]">
        {viewMode === 'simple' ? (
          <SimpleGraph width={width} height={height - 48} />
        ) : (
          <TextBasedGraph roleModelId={roleModelId} width={width} height={height - 48} />
        )}
      </div>
    </div>
  );
};

export default ReactFlowKnowledgeGraph;