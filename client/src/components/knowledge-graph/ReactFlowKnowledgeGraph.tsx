import React, { useEffect, useState } from 'react';
import { KnowledgeNode } from '@shared/schema';

// ReactFlowをnpmパッケージから使用する代わりに、CDNから直接スクリプトとして読み込む
// React Flowのスクリプトが外部から読み込まれるまでに時間がかかる可能性があるので、その対策を含める

interface ReactFlowKnowledgeGraphProps {
  roleModelId: string;
  onNodeClick?: (node: KnowledgeNode) => void;
  width?: number;
  height?: number;
}

// 純粋なHTMLとJSを使って実装するグラフビューア
const PureHtmlGraph: React.FC<{ width: number, height: number }> = ({ width, height }) => {
  // ページが読み込まれたときに実行
  useEffect(() => {
    // SVGでシンプルなグラフを描画
    const container = document.getElementById('graph-container');
    if (container) {
      container.innerHTML = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <!-- 中央の円 -->
          <circle cx="${width/2}" cy="${height/3}" r="40" fill="#3b82f6" />
          <text x="${width/2}" y="${height/3}" text-anchor="middle" dy=".3em" fill="white" font-size="14px">AIエンジニア</text>
          
          <!-- 左の円 -->
          <circle cx="${width/3}" cy="${2*height/3}" r="35" fill="#10b981" />
          <text x="${width/3}" y="${2*height/3}" text-anchor="middle" dy=".3em" fill="white" font-size="12px">データ分析</text>
          
          <!-- 右の円 -->
          <circle cx="${2*width/3}" cy="${2*height/3}" r="35" fill="#8b5cf6" />
          <text x="${2*width/3}" y="${2*height/3}" text-anchor="middle" dy=".3em" fill="white" font-size="12px">モデル開発</text>
          
          <!-- 中央から左へのライン -->
          <line x1="${width/2}" y1="${height/3 + 30}" x2="${width/3}" y2="${2*height/3 - 30}" 
                stroke="#64748b" stroke-width="2" />
          
          <!-- 中央から右へのライン -->
          <line x1="${width/2}" y1="${height/3 + 30}" x2="${2*width/3}" y2="${2*height/3 - 30}" 
                stroke="#64748b" stroke-width="2" />
                
          <!-- 矢印のマーカー -->
          <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                  refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
        </svg>
      `;
    }
  }, [width, height]);

  return (
    <div 
      id="graph-container" 
      style={{ 
        width, 
        height, 
        backgroundColor: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666'
      }}>
        <span>グラフを描画中...</span>
      </div>
    </div>
  );
};

// メインコンポーネント
const ReactFlowKnowledgeGraph: React.FC<ReactFlowKnowledgeGraphProps> = (props) => {
  const { width = 800, height = 600 } = props;
  
  return (
    <div 
      style={{ width, height }} 
      className="border rounded-md overflow-hidden shadow-sm"
    >
      <PureHtmlGraph width={width} height={height} />
    </div>
  );
};

export default ReactFlowKnowledgeGraph;