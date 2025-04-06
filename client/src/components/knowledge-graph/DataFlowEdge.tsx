import React from 'react';
import { EdgeProps, getSmoothStepPath, EdgeLabelRenderer } from 'reactflow';

const DataFlowEdge = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  label,
  selected,
}: EdgeProps) => {
  // エッジのパスを計算
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // エッジの強度（太さ）を決定
  const strength = data?.strength || 1;
  const strokeWidth = 1 + strength * 0.5;

  // エッジのデフォルトスタイル
  const defaultStyle = {
    strokeWidth,
    stroke: selected ? '#ff0072' : '#b1b1b7',
    ...style,
  };

  // 選択されたときのスタイル
  const selectedStyle = {
    ...defaultStyle,
    stroke: '#ff0072',
    strokeWidth: strokeWidth + 1,
    filter: 'drop-shadow(0 0 2px #ff0072)',
  };

  return (
    <>
      <path
        id={id}
        style={selected ? selectedStyle : defaultStyle}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 11,
              fontWeight: 500,
              background: 'rgba(255, 255, 255, 0.85)',
              padding: '2px 4px',
              borderRadius: '4px',
              border: '1px solid #e2e2e2',
              pointerEvents: 'all',
              opacity: selected ? 1 : 0.7,
              transition: 'opacity 0.3s, transform 0.3s',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default DataFlowEdge;