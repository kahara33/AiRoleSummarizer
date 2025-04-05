import React from 'react';

interface SimpleGraphProps {
  width?: number;
  height?: number;
}

/**
 * 最もシンプルなSVGベースのグラフ表示コンポーネント
 */
export default function SimpleGraph({ width = 800, height = 600 }: SimpleGraphProps) {
  // 円のサイズ
  const rootRadius = 40;
  const nodeRadius = 35;
  
  // 座標計算
  const centerX = width / 2;
  const centerY = height / 3;
  const leftX = width / 3;
  const rightX = 2 * width / 3;
  const bottomY = 2 * height / 3;

  return (
    <div style={{ width, height, border: '1px solid #ddd', overflow: 'hidden' }}>
      <svg width={width} height={height}>
        {/* ルートノード */}
        <circle cx={centerX} cy={centerY} r={rootRadius} fill="#3b82f6" />
        <text 
          x={centerX} 
          y={centerY} 
          textAnchor="middle" 
          dominantBaseline="middle" 
          fill="white" 
          fontSize="14px"
        >
          AIエンジニア
        </text>
        
        {/* 左のノード */}
        <circle cx={leftX} cy={bottomY} r={nodeRadius} fill="#10b981" />
        <text 
          x={leftX} 
          y={bottomY} 
          textAnchor="middle" 
          dominantBaseline="middle" 
          fill="white" 
          fontSize="12px"
        >
          データ分析
        </text>
        
        {/* 右のノード */}
        <circle cx={rightX} cy={bottomY} r={nodeRadius} fill="#8b5cf6" />
        <text 
          x={rightX} 
          y={bottomY} 
          textAnchor="middle" 
          dominantBaseline="middle" 
          fill="white" 
          fontSize="12px"
        >
          モデル開発
        </text>
        
        {/* 中央から左へのライン */}
        <line 
          x1={centerX} 
          y1={centerY + rootRadius} 
          x2={leftX} 
          y2={bottomY - nodeRadius} 
          stroke="#64748b" 
          strokeWidth="2" 
        />
        
        {/* 中央から右へのライン */}
        <line 
          x1={centerX} 
          y1={centerY + rootRadius} 
          x2={rightX} 
          y2={bottomY - nodeRadius} 
          stroke="#64748b" 
          strokeWidth="2" 
        />
        
        {/* 線の端に矢印を表示 */}
        <defs>
          <marker 
            id="arrowhead" 
            markerWidth="10" 
            markerHeight="7" 
            refX="0" 
            refY="3.5" 
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}