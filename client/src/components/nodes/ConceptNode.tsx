import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Brain, FileText, Zap, Database, Search, Lightbulb } from 'lucide-react';

const ConceptNode: React.FC<NodeProps> = ({ data, isConnectable }) => {
  // ノードタイプに基づくスタイリング
  const getNodeStyles = () => {
    const typeColors: Record<string, { bg: string; border: string; icon: JSX.Element }> = {
      concept: {
        bg: 'bg-blue-50',
        border: 'border-blue-300',
        icon: <Lightbulb size={16} className="text-blue-500" />,
      },
      industry: {
        bg: 'bg-purple-50',
        border: 'border-purple-300',
        icon: <Brain size={16} className="text-purple-500" />,
      },
      technology: {
        bg: 'bg-green-50',
        border: 'border-green-300',
        icon: <Zap size={16} className="text-green-500" />,
      },
      company: {
        bg: 'bg-amber-50',
        border: 'border-amber-300',
        icon: <Database size={16} className="text-amber-500" />,
      },
      keyword: {
        bg: 'bg-cyan-50',
        border: 'border-cyan-300',
        icon: <Search size={16} className="text-cyan-500" />,
      },
      document: {
        bg: 'bg-gray-50',
        border: 'border-gray-300',
        icon: <FileText size={16} className="text-gray-500" />,
      },
    };

    return typeColors[data.type] || typeColors.concept;
  };

  const { bg, border, icon } = getNodeStyles();

  // レベルに基づく透明度調整
  const getOpacityByLevel = () => {
    const level = data.level || 0;
    // レベルが上がるほど透明になる（ただし最小0.6）
    return Math.max(0.6, 1 - level * 0.1);
  };

  const opacity = getOpacityByLevel();

  return (
    <div
      className={`px-4 py-2 rounded-lg shadow-md border ${border} ${bg}`}
      style={{
        width: 180,
        opacity,
        transition: 'all 0.3s ease',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-blue-400"
      />
      <div className="flex items-center">
        <div className="p-1.5 rounded-full bg-white mr-2">{icon}</div>
        <div className="font-semibold text-sm truncate" title={data.label}>
          {data.label}
        </div>
      </div>
      {data.description && (
        <div className="mt-1 text-xs text-gray-500 line-clamp-2" title={data.description}>
          {data.description}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-blue-400"
      />
    </div>
  );
};

export default memo(ConceptNode);