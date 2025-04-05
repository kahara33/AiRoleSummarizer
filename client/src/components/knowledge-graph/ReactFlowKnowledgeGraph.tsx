import React from 'react';
import { KnowledgeNode } from '@shared/schema';
import GraphContainer from '../graph/GraphContainer';

interface ReactFlowKnowledgeGraphProps {
  roleModelId: string;
  onNodeClick?: (node: KnowledgeNode) => void;
  width?: number;
  height?: number;
}

/**
 * D3.jsを使用した知識グラフビジュアライゼーション
 */
const ReactFlowKnowledgeGraph: React.FC<ReactFlowKnowledgeGraphProps> = (props) => {
  const { roleModelId, onNodeClick, width = 800, height = 600 } = props;
  
  return (
    <GraphContainer 
      roleModelId={roleModelId} 
      width={width} 
      height={height} 
    />
  );
};

export default ReactFlowKnowledgeGraph;