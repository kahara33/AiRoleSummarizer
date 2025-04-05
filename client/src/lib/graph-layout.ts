import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

// 型定義が見つからない場合のワークアラウンド
declare module 'dagre' {}

// dagreを使ったグラフレイアウト
export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = 'TB'
) => {
  // 新しいdagreグラフを作成
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // グラフの向きを設定（TB=上から下、LR=左から右）
  dagreGraph.setGraph({ rankdir: direction });
  
  // まずノードをグラフに追加、各ノードのサイズを設定
  nodes.forEach((node) => {
    const dimensions = getNodeDimensions(node);
    dagreGraph.setNode(node.id, dimensions);
  });
  
  // エッジをグラフに追加
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  
  // レイアウトの計算
  dagre.layout(dagreGraph);
  
  // 計算結果を新しいノード配列に反映
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const dimensions = getNodeDimensions(node);
    
    // 位置を更新（ノードの中心に配置）
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - dimensions.width / 2,
        y: nodeWithPosition.y - dimensions.height / 2,
      },
    };
  });
  
  return { nodes: layoutedNodes, edges };
};

// ノードタイプに基づいてサイズを計算
const getNodeDimensions = (node: Node) => {
  // ノードタイプに基づいてサイズを計算
  const nodeType = node.type || 'default';
  const nodeData: any = node.data || {};
  
  // 重要度に基づいてサイズを調整
  const importance = nodeData.importance || 1;
  const scaling = Math.sqrt(importance) * 0.5;
  
  switch (nodeType) {
    case 'concept':
      return { width: 120 + scaling * 20, height: 40 + scaling * 10 };
    case 'agent':
      return { width: 180, height: 80 };
    default:
      return { width: 120, height: 40 };
  }
};

// 階層構造を考慮したカスタムレイアウト
export const getHierarchicalLayout = (
  nodes: Node[],
  edges: Edge[],
  centerX: number,
  centerY: number
) => {
  // レベルごとにノードをグループ化
  const nodesByLevel: Record<number, Node[]> = {};
  
  nodes.forEach((node) => {
    const level = (node.data?.level || 0) as number;
    if (!nodesByLevel[level]) {
      nodesByLevel[level] = [];
    }
    nodesByLevel[level].push(node);
  });
  
  // レベルを昇順でソート
  const sortedLevels = Object.keys(nodesByLevel)
    .map(Number)
    .sort((a, b) => a - b);
  
  // 各レベルに対して水平配置、最上位（レベル0）は中心に
  const layoutedNodes = [...nodes];
  
  // 最大レベルと合計レベル数を計算
  const maxLevel = sortedLevels.length > 0 ? sortedLevels[sortedLevels.length - 1] : 0;
  const totalLevels = maxLevel + 1;
  
  // 垂直方向のステップを計算
  const verticalStep = totalLevels > 1 ? 150 : 0;
  
  // 各レベルのノードを配置
  sortedLevels.forEach((level) => {
    const nodesInLevel = nodesByLevel[level];
    const levelNodeCount = nodesInLevel.length;
    
    // 水平方向のステップを計算
    const horizontalStep = levelNodeCount > 1 ? 180 : 0;
    
    // 中心からのオフセットを計算
    const startX = centerX - (horizontalStep * (levelNodeCount - 1)) / 2;
    const levelY = centerY + level * verticalStep;
    
    // レベル内のノードを水平に並べる
    nodesInLevel.forEach((node, index) => {
      const nodeIndex = layoutedNodes.findIndex((n) => n.id === node.id);
      if (nodeIndex !== -1) {
        layoutedNodes[nodeIndex] = {
          ...node,
          position: {
            x: startX + index * horizontalStep,
            y: levelY,
          },
        };
      }
    });
  });
  
  return { nodes: layoutedNodes, edges };
};