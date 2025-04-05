import React, { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';

const DataFlowEdge: React.FC<EdgeProps> = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style = {},
  label,
}) => {
  // エッジのパスを計算
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // データの流れの強さに基づくスタイリング
  const getEdgeStrengthStyle = () => {
    const strength = data?.strength || 1;
    
    // 強さに応じて線の太さを調整
    const strokeWidth = Math.max(1, Math.min(5, 1 + strength * 0.5));
    
    // 強さに応じて色を調整（弱い: 薄い青、強い: 濃い青）
    const intensity = Math.max(0.4, Math.min(0.9, 0.4 + strength * 0.1));
    const strokeColor = `rgba(59, 130, 246, ${intensity})`;
    
    return {
      strokeWidth,
      stroke: strokeColor,
    };
  };

  const strengthStyle = getEdgeStrengthStyle();
  const mergedStyle = { ...style, ...strengthStyle };

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path transition-all duration-300"
        d={edgePath}
        markerEnd={markerEnd}
        style={mergedStyle}
      />
      
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              // 背景を追加して可読性を向上
              background: 'rgba(255, 255, 255, 0.7)',
              padding: '2px 4px',
              borderRadius: 4,
              pointerEvents: 'all',
              // アニメーションされたエッジの場合、特別なスタイル
              boxShadow: data?.animated ? '0 0 5px rgba(59, 130, 246, 0.5)' : 'none',
            }}
            className="nodrag nopan text-xs"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(DataFlowEdge);