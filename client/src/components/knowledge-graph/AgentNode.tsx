import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Brain } from 'lucide-react';

// エージェントノードコンポーネント
const AgentNode = memo(({ data, selected }: NodeProps) => {
  // ノードの基本スタイル
  const nodeStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '12px',
    border: `2px solid #7b2cbf`,
    boxShadow: selected ? '0 0 0 2px #ff0072' : '0 4px 12px rgba(0, 0, 0, 0.15)',
    width: '220px',
    height: 'auto',
    fontSize: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    background: 'linear-gradient(135deg, #5a189a 0%, #7b2cbf 100%)',
    color: '#ffffff',
    transition: 'all 0.3s ease',
    transform: selected ? 'scale(1.05)' : 'scale(1)',
    zIndex: selected ? 10 : 0,
  };

  // エージェントタイプに基づくアイコンの選択
  const getAgentIcon = () => {
    const type = data.agentType || '';
    
    if (type.includes('industry')) return '🏭';
    if (type.includes('keyword')) return '🔑';
    if (type.includes('structure')) return '🏗️';
    return '🤖';
  };

  return (
    <div style={nodeStyle}>
      {/* 上部ハンドル - 接続ポイント */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#9d4edd', width: '8px', height: '8px' }}
      />
      
      {/* ノードのコンテンツ */}
      <div style={{ 
        marginBottom: '5px', 
        fontSize: '24px', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '50%',
        width: '40px',
        height: '40px'
      }}>
        {getAgentIcon()}
      </div>
      
      <div style={{ 
        fontWeight: 'bold', 
        marginBottom: '5px', 
        fontSize: '14px',
        background: 'rgba(0, 0, 0, 0.2)',
        padding: '3px 8px',
        borderRadius: '12px',
        width: '100%'
      }}>
        {data.label || data.name}
      </div>
      
      {data.description && (
        <div style={{ 
          fontSize: '11px', 
          opacity: 0.9, 
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          maxWidth: '200px',
          margin: '5px 0'
        }}>
          {data.description}
        </div>
      )}

      {/* ステータス表示 */}
      <div style={{ 
        marginTop: '5px', 
        backgroundColor: 'rgba(255, 255, 255, 0.3)', 
        padding: '3px 8px', 
        borderRadius: '10px', 
        fontSize: '10px',
        fontWeight: 'bold',
        letterSpacing: '0.5px'
      }}>
        {data.status || 'アクティブ'}
      </div>
      
      {/* 下部ハンドル - 接続ポイント */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#9d4edd', width: '8px', height: '8px' }}
      />
    </div>
  );
});

export default AgentNode;