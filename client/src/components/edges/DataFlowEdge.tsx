import { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';

interface DataFlowEdgeData {
  label?: string;
  type?: string;
  strength?: number;
}

const DataFlowEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style = {},
  animated
}: EdgeProps<DataFlowEdgeData>) => {
  // エッジタイプに基づくスタイル
  const getEdgeStyle = (type?: string, strength = 1) => {
    const baseThickness = Math.max(1, Math.min(4, strength)); // 太さ制限
    
    switch (type?.toLowerCase()) {
      case 'contains':
        return {
          stroke: '#3b82f6', // ブルー
          strokeWidth: baseThickness + 1,
          strokeDasharray: '0'
        };
      case 'depends_on':
        return {
          stroke: '#ef4444', // レッド
          strokeWidth: baseThickness,
          strokeDasharray: '0'
        };
      case 'related_to':
        return {
          stroke: '#10b981', // グリーン
          strokeWidth: baseThickness,
          strokeDasharray: '0'
        };
      case 'task_flow':
        return {
          stroke: '#8b5cf6', // パープル
          strokeWidth: baseThickness,
          strokeDasharray: '5,5'
        };
      default:
        return {
          stroke: '#64748b', // スレート
          strokeWidth: baseThickness,
          strokeDasharray: '0'
        };
    }
  };
  
  // ベースとなるエッジスタイルを取得
  const edgeStyle = getEdgeStyle(data?.type, data?.strength);
  
  // アニメーションスタイルを適用
  const animationStyle = animated ? {
    animation: 'flow 20s linear infinite',
    strokeDasharray: '15,10',
    animationDuration: '3s'
  } : {};
  
  // ベジエカーブを生成
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  
  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          ...edgeStyle,
          ...style,
          ...animationStyle,
        }}
      />
      
      {/* エッジラベル */}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              // エッジと同じ色でラベルを表示
              backgroundColor: edgeStyle.stroke,
              color: 'white',
              padding: '2px 4px',
              borderRadius: 4,
              fontWeight: 500,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(DataFlowEdge);