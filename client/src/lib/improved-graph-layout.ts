import dagre from 'dagre';
import { Edge, Node, Position } from 'reactflow';

// ノードの大きさを定義（より大きめに設定）
const nodeWidth = 240;
const nodeHeight = 100;

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
 * 重なりを回避するためのノード位置補正関数
 * @param nodes 配置済みノードのリスト
 * @param nodeSize ノードのサイズ
 * @param padding ノード間の最小間隔
 * @returns 重なりを解消したノードリスト
 */
function preventNodeOverlap(
  nodes: Node[],
  nodeSize = { width: nodeWidth, height: nodeHeight },
  padding = 50
): Node[] {
  // 重なり検出の最大イテレーション数
  const MAX_ITERATIONS = 50;
  let iterations = 0;
  let hasOverlap = true;
  
  // ノードのコピーを作成
  const adjustedNodes = [...nodes];
  
  // 全てのノードの重なりが解消されるか、最大イテレーション数に達するまで繰り返す
  while (hasOverlap && iterations < MAX_ITERATIONS) {
    hasOverlap = false;
    iterations++;
    
    // 全てのノードのペアについて重なりをチェック
    for (let i = 0; i < adjustedNodes.length; i++) {
      for (let j = i + 1; j < adjustedNodes.length; j++) {
        const nodeA = adjustedNodes[i];
        const nodeB = adjustedNodes[j];
        
        // ノード間の距離を計算
        const dx = Math.abs(nodeA.position.x - nodeB.position.x);
        const dy = Math.abs(nodeA.position.y - nodeB.position.y);
        
        // ノードの最小必要間隔
        const minWidthDistance = (nodeSize.width + padding) / 2;
        const minHeightDistance = (nodeSize.height + padding) / 2;
        
        // X軸とY軸の重なりを検出
        const isOverlapX = dx < minWidthDistance;
        const isOverlapY = dy < minHeightDistance;
        
        // 両方の軸で重なっている場合、位置を調整
        if (isOverlapX && isOverlapY) {
          hasOverlap = true;
          
          // 重なりの度合いを計算
          const overlapX = minWidthDistance - dx;
          const overlapY = minHeightDistance - dy;
          
          // 重なりが少ない方向に優先的に移動
          if (overlapX < overlapY) {
            // X方向に分離
            const pushX = (overlapX / 2) * 1.2; // 少し余裕を持たせる
            if (nodeA.position.x < nodeB.position.x) {
              nodeA.position.x -= pushX;
              nodeB.position.x += pushX;
            } else {
              nodeA.position.x += pushX;
              nodeB.position.x -= pushX;
            }
          } else {
            // Y方向に分離
            const pushY = (overlapY / 2) * 1.2; // 少し余裕を持たせる
            if (nodeA.position.y < nodeB.position.y) {
              nodeA.position.y -= pushY;
              nodeB.position.y += pushY;
            } else {
              nodeA.position.y += pushY;
              nodeB.position.y -= pushY;
            }
          }
        }
      }
    }
  }
  
  console.log(`Overlap resolution completed after ${iterations} iterations`);
  return adjustedNodes;
}

/**
 * グラフのレイアウトを自動計算
 * @param nodes ノードリスト
 * @param edges エッジリスト
 * @param options レイアウトオプション
 * @returns 位置情報が追加されたノードとエッジ
 */
export function getImprovedLayoutedElements(
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
    nodesep: 100, // より大きな間隔に設定
    ranksep: 150, // より大きな間隔に設定
    marginx: 40,
    marginy: 40,
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
  let layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // 階層に基づく追加のスタイル設定（必要に応じて）
    let levelBasedStyle = {};
    if (node.data && typeof node.data.level === 'number') {
      // レベルに基づいて僅かにサイズ調整
      const scale = Math.max(0.9, 1 - node.data.level * 0.02);
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
  
  // 重なりを解消
  layoutedNodes = preventNodeOverlap(layoutedNodes, {
    width: layoutOptions.nodeWidth!,
    height: layoutOptions.nodeHeight!
  }, 80); // 80pxの最小間隔を確保

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
 * 階層的レイアウトを改良して作成
 * 親子関係があるノードを階層的に配置し、重なりを解消
 * @param nodes ノードリスト
 * @param edges エッジリスト
 * @returns 階層的にレイアウトされたノードとエッジ
 */
export function getImprovedHierarchicalLayout(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  if (!nodes.length) return { nodes, edges };
  
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
        y: distance * 200, // より大きな垂直間隔
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
    const levelWidth = nodesInLevel.length * (nodeWidth + 150); // より大きな間隔
    const startX = -levelWidth / 2;
    
    nodesInLevel.forEach((node, index) => {
      // 大きな間隔を確保
      node.position.x = startX + index * (nodeWidth + 150);
      
      // 各レベルに少量のランダムな変位を加える
      // ただし、重なりが発生しない程度に小さくする
      const jitterX = Math.random() * 30 - 15;
      const jitterY = Math.random() * 30 - 15;
      node.position.x += jitterX;
      node.position.y += jitterY;
    });
  });
  
  // dagreレイアウトで全体の配置を最適化
  return getImprovedLayoutedElements(layoutedNodes, edges, { 
    direction: 'TB', 
    nodesep: 200,    // 大きな水平間隔
    ranksep: 250,    // 大きな垂直間隔
    marginx: 50,
    marginy: 50 
  });
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