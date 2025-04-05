import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Search, Brain, Network, Share2, BarChart3 } from 'lucide-react';

const AgentNode: React.FC<NodeProps> = ({ data, isConnectable }) => {
  // エージェントタイプに基づくスタイリング
  const getAgentStyles = () => {
    const agentColors: Record<string, { bg: string; border: string; icon: JSX.Element }> = {
      'industry-analysis': {
        bg: 'bg-blue-50',
        border: 'border-blue-300',
        icon: <Search size={18} className="text-blue-500" />,
      },
      'keyword-expansion': {
        bg: 'bg-purple-50',
        border: 'border-purple-300',
        icon: <Brain size={18} className="text-purple-500" />,
      },
      'structuring': {
        bg: 'bg-green-50',
        border: 'border-green-300',
        icon: <Network size={18} className="text-green-500" />,
      },
      'knowledge-graph': {
        bg: 'bg-orange-50',
        border: 'border-orange-300',
        icon: <Share2 size={18} className="text-orange-500" />,
      },
      'orchestrator': {
        bg: 'bg-red-50',
        border: 'border-red-300',
        icon: <BarChart3 size={18} className="text-red-500" />,
      },
    };

    return (
      agentColors[data.agentType] || {
        bg: 'bg-gray-50',
        border: 'border-gray-300',
        icon: <Brain size={18} className="text-gray-500" />,
      }
    );
  };

  const { bg, border, icon } = getAgentStyles();

  // エージェントのステータスに基づく表示
  const getStatusIndicator = () => {
    const status = data.status || 'idle';
    const statusColors: Record<string, string> = {
      active: 'bg-green-500',
      processing: 'bg-blue-500 animate-pulse',
      idle: 'bg-gray-400',
      error: 'bg-red-500',
      completed: 'bg-teal-500',
    };

    return (
      <div className="absolute -top-1 -right-1">
        <div
          className={`w-3 h-3 rounded-full ${statusColors[status]}`}
          title={`ステータス: ${status}`}
        ></div>
      </div>
    );
  };

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-md border ${border} ${bg} relative`}
      style={{
        width: 180,
        transition: 'all 0.3s ease',
      }}
    >
      {getStatusIndicator()}
      
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-purple-400"
      />
      
      <div className="flex items-center">
        <div className="p-1.5 rounded-full bg-white mr-2">{icon}</div>
        <div className="font-semibold text-sm" title={data.label}>
          {data.label}
        </div>
      </div>
      
      {data.progress !== undefined && (
        <div className="mt-2">
          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${data.progress}%` }}
            ></div>
          </div>
          <div className="text-right text-xs mt-0.5 text-gray-500">
            {data.progress}%
          </div>
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="w-2 h-2 bg-purple-400"
      />
      
      {/* サイドハンドル（必要に応じて） */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        isConnectable={isConnectable}
        className="w-2 h-2 bg-purple-400"
      />
      
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        isConnectable={isConnectable}
        className="w-2 h-2 bg-purple-400"
      />
    </div>
  );
};

export default memo(AgentNode);