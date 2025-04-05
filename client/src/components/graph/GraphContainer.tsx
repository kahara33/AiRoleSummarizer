import React, { useState } from 'react';
import KnowledgeGraph from './KnowledgeGraph';
import { KnowledgeNode } from '@shared/schema';

interface GraphContainerProps {
  roleModelId: string;
  width?: number;
  height?: number;
}

const GraphContainer: React.FC<GraphContainerProps> = ({
  roleModelId,
  width = 800,
  height = 600
}) => {
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);

  const handleNodeClick = (node: KnowledgeNode) => {
    setSelectedNode(node);
  };

  return (
    <div className="flex flex-col rounded-lg border overflow-hidden" style={{ width, height }}>
      <div className="flex-1 relative">
        <KnowledgeGraph 
          roleModelId={roleModelId} 
          width={width} 
          height={selectedNode ? height - 150 : height}
          onNodeClick={handleNodeClick}
        />
      </div>
      
      {selectedNode && (
        <div className="bg-white p-4 border-t h-[150px] overflow-auto">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{selectedNode.name}</h3>
              <div className="text-sm text-gray-500">レベル: {selectedNode.level}</div>
            </div>
            <button 
              onClick={() => setSelectedNode(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
          
          {selectedNode.description && (
            <div className="mt-2">
              <div className="text-sm text-gray-700">{selectedNode.description}</div>
            </div>
          )}
          
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedNode.type && (
              <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                <span className="font-medium">タイプ:</span> {selectedNode.type}
              </div>
            )}
            {selectedNode.parentId && (
              <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                <span className="font-medium">親ノード:</span> {selectedNode.parentId}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphContainer;