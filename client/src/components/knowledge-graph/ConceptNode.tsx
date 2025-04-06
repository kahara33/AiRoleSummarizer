import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

// カスタムコンセプトノードコンポーネント
const ConceptNode = memo(({ data, selected }: NodeProps) => {
  // ノードの基本スタイル
  const nodeStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '8px',
    border: `2px solid ${data.color || '#1a192b'}`,
    boxShadow: selected ? '0 0 0 2px #ff0072' : 'none',
    width: '220px',
    height: 'auto',
    fontSize: '12px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    backgroundColor: data.color || '#fff',
    color: getContrastColor(data.color || '#1a192b'),
    transition: 'all 0.3s ease',
    transform: selected ? 'scale(1.05)' : 'scale(1)',
    zIndex: selected ? 10 : 0,
  };

  // ノードレベルに基づくアイコンの選択
  const getNodeIcon = () => {
    const level = data.level || 0;
    
    if (level === 0) return '🔍'; // ルートノード
    if (level === 1) return '🌐'; // 主要カテゴリ
    if (level === 2) return '📚'; // サブカテゴリ
    return '📝'; // その他
  };

  return (
    <div style={nodeStyle}>
      {/* 上部ハンドル - 接続ポイント */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: data.color || '#1a192b', width: '8px', height: '8px' }}
      />
      
      {/* ノードのコンテンツ */}
      <div style={{ marginBottom: '5px', fontSize: '18px' }}>
        {getNodeIcon()}
      </div>
      
      <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>
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
          maxWidth: '200px'
        }}>
          {data.description}
        </div>
      )}

      {/* タイプ表示 */}
      <div style={{ 
        marginTop: '5px', 
        backgroundColor: 'rgba(255, 255, 255, 0.2)', 
        padding: '2px 5px', 
        borderRadius: '4px', 
        fontSize: '10px'
      }}>
        {data.type || 'concept'}
      </div>
      
      {/* 下部ハンドル - 接続ポイント */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: data.color || '#1a192b', width: '8px', height: '8px' }}
      />
    </div>
  );
});

// テキスト色のコントラスト計算（背景色に基づいて白または黒を選択）
function getContrastColor(hexColor: string): string {
  // カラーコードからRGB値を取得
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // YIQ方式で明るさを計算
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  // 明るさに基づいて白または黒を返す
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

export default ConceptNode;