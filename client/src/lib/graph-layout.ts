import dagre from 'dagre';
import { Edge, Node, Position } from 'reactflow';

const nodeWidth = 180;
const nodeHeight = 60;

export interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'RL' | 'BT';
  nodeWidth?: number;
  nodeHeight?: number;
  rankdir?: 'TB' | 'LR' | 'RL' | 'BT';
  align?: 'UL' | 'UR' | 'DL' | 'DR';
  nodesep?: number;
  ranksep?: number;
  marginx?: number;
  marginy?: number;
}

/**
 * グラフのレイアウトを自動計算
 * @param nodes ノードリスト
 * @param edges エッジリスト
 * @param options レイアウトオプション
 * @returns 位置情報が追加されたノードとエッジ
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  if (!nodes.length) return { nodes, edges };

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const defaultOptions: LayoutOptions = {
    direction: 'TB',
    nodeWidth: nodeWidth,
    nodeHeight: nodeHeight,
    rankdir: 'TB',
    align: 'UL',
    nodesep: 80,
    ranksep: 100,
    marginx: 20,
    marginy: 20,
  };

  const layoutOptions = { ...defaultOptions, ...options };
  dagreGraph.setGraph(layoutOptions);

  // ノードをグラフに追加
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: layoutOptions.nodeWidth,
      height: layoutOptions.nodeHeight,
    });
  });

  // エッジをグラフに追加
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // レイアウト計算
  dagre.layout(dagreGraph);

  // ノードに位置情報を設定
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // 階層に基づく追加のスタイル設定
    let levelBasedStyle = {};
    if (node.data && typeof node.data.level === 'number') {
      // レベルに基づいてサイズやスタイルを調整
      const scale = Math.max(0.8, 1 - node.data.level * 0.05);
      levelBasedStyle = {
        style: {
          ...node.style,
          transform: `scale(${scale})`,
        },
      };
    }

    return {
      ...node,
      ...levelBasedStyle,
      position: {
        x: nodeWithPosition.x - layoutOptions.nodeWidth! / 2 + (layoutOptions.marginx || 0),
        y: nodeWithPosition.y - layoutOptions.nodeHeight! / 2 + (layoutOptions.marginy || 0),
      },
    };
  });

  // エッジのハンドルの位置を設定
  const layoutedEdges = edges.map((edge) => {
    // エッジの方向に基づいてハンドルの位置を決定
    const sourceNode = layoutedNodes.find((n) => n.id === edge.source);
    const targetNode = layoutedNodes.find((n) => n.id === edge.target);
    
    if (!sourceNode || !targetNode) {
      return edge;
    }

    const sourceX = sourceNode.position.x + layoutOptions.nodeWidth! / 2;
    const sourceY = sourceNode.position.y + layoutOptions.nodeHeight! / 2;
    const targetX = targetNode.position.x + layoutOptions.nodeWidth! / 2;
    const targetY = targetNode.position.y + layoutOptions.nodeHeight! / 2;

    // エッジの方向を計算
    const isHorizontal = Math.abs(targetX - sourceX) > Math.abs(targetY - sourceY);
    const isSourceLeft = sourceX < targetX;
    const isSourceAbove = sourceY < targetY;

    let sourcePosition: Position;
    let targetPosition: Position;

    if (isHorizontal) {
      sourcePosition = isSourceLeft ? Position.Right : Position.Left;
      targetPosition = isSourceLeft ? Position.Left : Position.Right;
    } else {
      sourcePosition = isSourceAbove ? Position.Bottom : Position.Top;
      targetPosition = isSourceAbove ? Position.Top : Position.Bottom;
    }

    return {
      ...edge,
      sourceHandle: sourcePosition,
      targetHandle: targetPosition,
    };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
}

/**
 * 階層的レイアウトを作成
 * 親子関係があるノードを階層的に配置
 * @param nodes ノードリスト
 * @param edges エッジリスト
 * @returns 階層的にレイアウトされたノードとエッジ
 */
export function getHierarchicalLayout(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  // 親子関係を検出
  const childrenMap: Record<string, string[]> = {};
  const edgeMap: Record<string, Edge[]> = {};
  
  // エッジを元に親子関係を構築
  edges.forEach((edge) => {
    if (!childrenMap[edge.source]) {
      childrenMap[edge.source] = [];
    }
    childrenMap[edge.source].push(edge.target);
    
    if (!edgeMap[edge.source]) {
      edgeMap[edge.source] = [];
    }
    edgeMap[edge.source].push(edge);
  });
  
  // ルートノードを特定
  const childNodeIds = Object.values(childrenMap).flat();
  const rootNodeIds = nodes
    .map((node) => node.id)
    .filter((id) => !childNodeIds.includes(id));
  
  // ルートノードからの距離を計算
  const nodeDistances: Record<string, number> = {};
  rootNodeIds.forEach((id) => {
    nodeDistances[id] = 0;
    calculateDistances(id, childrenMap, nodeDistances, 1);
  });
  
  // 距離に基づいてY座標を決定
  const layoutedNodes = nodes.map((node) => {
    const distance = nodeDistances[node.id] || 0;
    return {
      ...node,
      position: {
        x: node.position?.x || 0,
        y: distance * 150,
      },
      data: {
        ...node.data,
        level: distance,
      },
    };
  });
  
  // 各レベルでX座標を水平方向に分散
  const levelGroups: Record<number, Node[]> = {};
  layoutedNodes.forEach((node) => {
    const level = nodeDistances[node.id] || 0;
    if (!levelGroups[level]) {
      levelGroups[level] = [];
    }
    levelGroups[level].push(node);
  });
  
  Object.entries(levelGroups).forEach(([level, nodesInLevel]) => {
    const levelWidth = nodesInLevel.length * (nodeWidth + 40);
    const startX = -levelWidth / 2;
    
    nodesInLevel.forEach((node, index) => {
      node.position.x = startX + index * (nodeWidth + 40);
    });
  });
  
  // 最終的なレイアウト計算
  return getLayoutedElements(layoutedNodes, edges, { direction: 'TB', nodesep: 80, ranksep: 150 });
}

/**
 * ノードからの距離を再帰的に計算
 * @param nodeId ノードID
 * @param childrenMap 親子関係のマップ
 * @param distances 距離の記録オブジェクト
 * @param currentDistance 現在の距離
 */
function calculateDistances(
  nodeId: string,
  childrenMap: Record<string, string[]>,
  distances: Record<string, number>,
  currentDistance: number
): void {
  const children = childrenMap[nodeId] || [];
  
  children.forEach((childId) => {
    if (distances[childId] === undefined || distances[childId] < currentDistance) {
      distances[childId] = currentDistance;
      calculateDistances(childId, childrenMap, distances, currentDistance + 1);
    }
  });
}