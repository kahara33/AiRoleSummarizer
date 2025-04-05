import { useState, memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Brain, Database, Book, Lightbulb, Code, Hash, FileText } from 'lucide-react';

interface ConceptNodeData {
  label: string;
  description?: string;
  type?: string;
  level?: number;
  importance?: number;
  color?: string;
  keywords?: string[];
}

function getNodeIcon(type?: string) {
  switch (type?.toLowerCase()) {
    case 'concept':
      return <Brain className="w-4 h-4 mr-1" />;
    case 'data':
      return <Database className="w-4 h-4 mr-1" />;
    case 'resource':
      return <Book className="w-4 h-4 mr-1" />;
    case 'idea':
      return <Lightbulb className="w-4 h-4 mr-1" />;
    case 'tool':
      return <Code className="w-4 h-4 mr-1" />;
    case 'keyword':
      return <Hash className="w-4 h-4 mr-1" />;
    default:
      return <FileText className="w-4 h-4 mr-1" />;
  }
}

function getNodeColor(color?: string, type?: string): string {
  if (color) return color;
  
  switch (type?.toLowerCase()) {
    case 'concept':
      return '#3b82f6'; // ブルー
    case 'data':
      return '#10b981'; // エメラルド
    case 'resource':
      return '#f59e0b'; // アンバー
    case 'idea':
      return '#8b5cf6'; // バイオレット
    case 'tool':
      return '#ef4444'; // レッド
    case 'keyword':
      return '#14b8a6'; // ティール
    default:
      return '#6b7280'; // グレー
  }
}

// ノードのサイズを重要度に応じて計算
function getNodeSize(importance?: number): { width: number, height: number } {
  const baseSize = 120;
  const baseHeight = 40;
  const factor = importance || 1;
  
  return {
    width: Math.max(baseSize, baseSize * Math.sqrt(factor / 3)),
    height: Math.max(baseHeight, baseHeight * Math.sqrt(factor / 3))
  };
}

const ConceptNode = ({ data, selected }: NodeProps<ConceptNodeData>) => {
  const [showDescription, setShowDescription] = useState(false);
  
  const nodeColor = getNodeColor(data.color, data.type);
  const nodeIcon = getNodeIcon(data.type);
  const { width, height } = getNodeSize(data.importance);
  
  return (
    <>
      {/* インプットハンドル（上部） */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: nodeColor, width: 8, height: 8 }}
      />
      
      {/* ノード本体 */}
      <div
        style={{ width: `${width}px`, height: `${height}px` }}
        className={`flex items-center justify-center rounded-md border-2 transition-all duration-200 ${
          selected ? 'shadow-lg border-primary' : 'shadow border-transparent'
        }`}
        onClick={() => setShowDescription(!showDescription)}
      >
        {/* ノードの内容 */}
        <div
          className="flex flex-col items-center justify-center p-2 w-full h-full rounded"
          style={{ backgroundColor: nodeColor, color: 'white' }}
        >
          <div className="flex items-center justify-center text-center font-medium truncate w-full">
            {nodeIcon}
            <span className="truncate max-w-full">{data.label}</span>
          </div>
          
          {/* 説明（ホバー時に表示） */}
          {showDescription && data.description && (
            <div className="absolute bottom-full left-0 w-48 bg-gray-800 text-white text-xs rounded p-2 shadow-lg mb-2 z-10">
              {data.description}
            </div>
          )}
        </div>
      </div>
      
      {/* アウトプットハンドル（下部） */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: nodeColor, width: 8, height: 8 }}
      />
    </>
  );
};

export default memo(ConceptNode);