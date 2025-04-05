import React from 'react';
import { KnowledgeNode } from '@shared/schema';
import SimpleGraph from './SimpleGraph';

// 非常にシンプルなグラフコンポーネントを使用する完全にReactベースの実装

interface ReactFlowKnowledgeGraphProps {
  roleModelId: string;
  onNodeClick?: (node: KnowledgeNode) => void;
  width?: number;
  height?: number;
}

/**
 * このコンポーネントは非常にシンプルなSVGベースのグラフを表示します
 * ReactFlowやその他の外部ライブラリには依存しません
 */
const ReactFlowKnowledgeGraph: React.FC<ReactFlowKnowledgeGraphProps> = (props) => {
  const { width = 800, height = 600 } = props;
  
  return (
    <div 
      style={{ width, height }} 
      className="border rounded-md overflow-hidden shadow-sm"
    >
      <SimpleGraph width={width} height={height} />
    </div>
  );
};

export default ReactFlowKnowledgeGraph;