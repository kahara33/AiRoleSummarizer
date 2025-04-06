import dagre from 'dagre';
import { Edge, Node, Position } from 'reactflow';

// ノードの大きさを定義（より大きめに設定）
const nodeWidth = 220; // サイズを調整
const nodeHeight = 90; // サイズを調整
const DEFAULT_NODE_SPACING = 140; // ノード間の最小スペース

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
 * 重なりを回避するためのノード位置補正関数（強化版）
 * @param nodes 配置済みノードのリスト
 * @param nodeSize ノードのサイズ
 * @param padding ノード間の最小間隔
 * @returns 重なりを解消したノードリスト
 */
function preventNodeOverlap(
  nodes: Node[],
  nodeSize = { width: nodeWidth, height: nodeHeight },
  padding = DEFAULT_NODE_SPACING
): Node[] {
  if (nodes.length <= 1) return nodes;
  
  // 重なり検出の最大イテレーション数
  const MAX_ITERATIONS = 100; // より多くのイテレーションで確実に収束させる
  let iterations = 0;
  let hasOverlap = true;
  let overlapCount = 0;
  
  // ノードのコピーを作成
  const adjustedNodes = [...nodes];
  
  // 重なりの記録
  const overlapHistory: Record<string, number> = {};
  
  // 全てのノードの重なりが解消されるか、最大イテレーション数に達するまで繰り返す
  while (hasOverlap && iterations < MAX_ITERATIONS) {
    hasOverlap = false;
    overlapCount = 0;
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
        const minWidthDistance = (nodeSize.width + padding) / 1.8;
        const minHeightDistance = (nodeSize.height + padding) / 1.8;
        
        // X軸とY軸の重なりを検出
        const isOverlapX = dx < minWidthDistance;
        const isOverlapY = dy < minHeightDistance;
        
        // ノードペアのIDを作成（重なり履歴追跡用）
        const pairId = nodeA.id < nodeB.id 
          ? `${nodeA.id}-${nodeB.id}` 
          : `${nodeB.id}-${nodeA.id}`;
        
        // 両方の軸で重なっている場合、位置を調整
        if (isOverlapX && isOverlapY) {
          hasOverlap = true;
          overlapCount++;
          
          // この特定のペアで何回重なりが発生したかを追跡
          overlapHistory[pairId] = (overlapHistory[pairId] || 0) + 1;
          
          // 重なりの度合いを計算
          const overlapX = minWidthDistance - dx;
          const overlapY = minHeightDistance - dy;
          
          // レベルに基づく重み付け（親ノードは動かしにくく、子ノードは動かしやすく）
          const levelA = nodeA.data?.level || 0;
          const levelB = nodeB.data?.level || 0;
          const weightA = 1 - Math.min(0.7, levelA * 0.1); // レベルが高いほど重みが小さい
          const weightB = 1 - Math.min(0.7, levelB * 0.1);
          
          // 履歴に基づく追加の力（同じペアが繰り返し重なる場合は強く分離）
          const historyForce = Math.min(2, 1 + overlapHistory[pairId] * 0.1);
          
          // 重なりが少ない方向に優先的に移動
          if (overlapX < overlapY) {
            // X方向に分離
            const pushX = (overlapX / 2) * 1.5 * historyForce; // より強い力で分離
            if (nodeA.position.x < nodeB.position.x) {
              nodeA.position.x -= pushX * weightA;
              nodeB.position.x += pushX * weightB;
            } else {
              nodeA.position.x += pushX * weightA;
              nodeB.position.x -= pushX * weightB;
            }
          } else {
            // Y方向に分離
            const pushY = (overlapY / 2) * 1.5 * historyForce; // より強い力で分離
            if (nodeA.position.y < nodeB.position.y) {
              nodeA.position.y -= pushY * weightA;
              nodeB.position.y += pushY * weightB;
            } else {
              nodeA.position.y += pushY * weightA;
              nodeB.position.y -= pushY * weightB;
            }
          }
          
          // 強い重なりを解消するために、必要に応じて両方の軸で分離
          if (overlapX > minWidthDistance * 0.7 && overlapY > minHeightDistance * 0.7) {
            // 両方の軸で強い重なりがある場合
            const pushX = (overlapX / 2) * 1.2 * historyForce;
            const pushY = (overlapY / 2) * 1.2 * historyForce;
            
            if (nodeA.position.x < nodeB.position.x) {
              nodeA.position.x -= pushX * weightA * 0.5;
              nodeB.position.x += pushX * weightB * 0.5;
            } else {
              nodeA.position.x += pushX * weightA * 0.5;
              nodeB.position.x -= pushX * weightB * 0.5;
            }
            
            if (nodeA.position.y < nodeB.position.y) {
              nodeA.position.y -= pushY * weightA * 0.5;
              nodeB.position.y += pushY * weightB * 0.5;
            } else {
              nodeA.position.y += pushY * weightA * 0.5;
              nodeB.position.y -= pushY * weightB * 0.5;
            }
          }
        }
      }
    }
    
    // 収束判定の緩和：少数のノードの重なりだけが残っている場合は強制終了
    if (overlapCount <= 2 && iterations > 50) {
      console.log(`重なり解消を強制終了: ${overlapCount}個の重なりが残っています`);
      break;
    }
  }
  
  console.log(`重なり解消完了: ${iterations}回の反復、${overlapCount}個の重なりが残っています`);
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
  
  console.log('Applying improved hierarchical layout to', nodes.length, 'nodes');
  
  // 親子関係を検出
  const childrenMap: Record<string, string[]> = {};
  const parentMap: Record<string, string[]> = {};
  const edgeMap: Record<string, Edge[]> = {};
  
  // エッジを元に親子関係を構築
  edges.forEach((edge) => {
    // 親から子へのマッピング
    if (!childrenMap[edge.source]) {
      childrenMap[edge.source] = [];
    }
    childrenMap[edge.source].push(edge.target);
    
    // 子から親へのマッピング（逆関係）
    if (!parentMap[edge.target]) {
      parentMap[edge.target] = [];
    }
    parentMap[edge.target].push(edge.source);
    
    // エッジのマッピング
    if (!edgeMap[edge.source]) {
      edgeMap[edge.source] = [];
    }
    edgeMap[edge.source].push(edge);
  });
  
  // ルートノードを特定（親がいないノード）
  const childNodeIds = Object.values(childrenMap).flat();
  const rootNodeIds = nodes
    .map((node) => node.id)
    .filter((id) => !childNodeIds.includes(id) || !parentMap[id]);
  
  console.log('Root nodes:', rootNodeIds);
  
  // ルートノードからの距離を計算
  const nodeDistances: Record<string, number> = {};
  rootNodeIds.forEach((id) => {
    nodeDistances[id] = 0;
    calculateDistances(id, childrenMap, nodeDistances, 1);
  });
  
  // ノードの最大レベルを計算
  const maxLevel = Math.max(...Object.values(nodeDistances), 0);
  console.log(`Maximum hierarchy level: ${maxLevel}`);
  
  // ビューポートサイズに基づく配置計算
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const graphAreaWidth = windowWidth - 100;
  const graphAreaHeight = (windowHeight - 200);
  const verticalSpacing = graphAreaHeight / (maxLevel + 1);
  
  console.log(`Graph area: ${graphAreaWidth}x${graphAreaHeight}, vertical spacing: ${verticalSpacing}`);
  
  // 親ノードの位置を追跡（子ノードの配置に利用）
  const nodePositions: Record<string, { x: number, y: number }> = {};
  
  // 距離に基づいてY座標を決定し、階層レベルをノードのデータに追加
  const layoutedNodes = nodes.map((node) => {
    const level = nodeDistances[node.id] || 0;
    
    // Y座標はレベルに基づいて計算
    const y = level * verticalSpacing + 80; // 上部に余白を確保
    
    // レベルとデータを更新
    return {
      ...node,
      position: {
        x: node.position?.x || 0,
        y: y,
      },
      data: {
        ...node.data,
        level,
      },
    };
  });
  
  // 各レベルでノードをグループ化し、X座標を水平方向に分散
  const levelGroups: Record<number, Node[]> = {};
  layoutedNodes.forEach((node) => {
    const level = nodeDistances[node.id] || 0;
    if (!levelGroups[level]) {
      levelGroups[level] = [];
    }
    levelGroups[level].push(node);
  });
  
  // レベル別に配置（トップダウンで）
  Object.entries(levelGroups)
    .sort(([a], [b]) => parseInt(a) - parseInt(b)) // レベル順にソート
    .forEach(([levelStr, nodesInLevel]) => {
      const level = parseInt(levelStr);
      console.log(`Processing level ${level} with ${nodesInLevel.length} nodes`);
      
      // このレベルのノードの合計幅を計算
      const totalNodesWidth = nodesInLevel.length * nodeWidth;
      const totalSpacingWidth = (nodesInLevel.length - 1) * DEFAULT_NODE_SPACING;
      const levelTotalWidth = totalNodesWidth + totalSpacingWidth;
      
      // レベル全体を中央に配置
      const startX = (graphAreaWidth - levelTotalWidth) / 2;
      
      // 親ノードの下に子ノードを配置するよう工夫
      nodesInLevel.forEach((node, index) => {
        let preferredX;
        
        // 親ノードがある場合、その位置を優先
        const parents = parentMap[node.id] || [];
        if (parents.length > 0) {
          // 親ノードの平均X座標
          const parentPositions = parents
            .map(parentId => nodePositions[parentId])
            .filter(pos => pos !== undefined);
          
          if (parentPositions.length > 0) {
            // 親ノードの平均X座標
            const avgParentX = parentPositions.reduce((sum, pos) => sum + pos.x, 0) / parentPositions.length;
            preferredX = avgParentX;
          } else {
            // 親の位置が不明な場合は均等配置
            preferredX = startX + index * (nodeWidth + DEFAULT_NODE_SPACING);
          }
        } else {
          // 親がない場合は均等配置
          preferredX = startX + index * (nodeWidth + DEFAULT_NODE_SPACING);
        }
        
        // 最終的なX座標を設定
        node.position.x = preferredX;
        
        // このノードの位置を記録（子ノードの配置のため）
        nodePositions[node.id] = { x: node.position.x, y: node.position.y };
      });
      
      // 配置後の重なりを防ぐための調整（同一レベル内での調整）
      if (nodesInLevel.length > 1) {
        adjustSameLevel(nodesInLevel);
      }
    });
  
  // 最終的な重なり解消のための全体最適化
  return getImprovedLayoutedElements(layoutedNodes, edges, { 
    direction: 'TB', 
    nodesep: 180,    // より大きな水平間隔
    ranksep: 200,    // より大きな垂直間隔
    marginx: 50,
    marginy: 50 
  });
}

/**
 * 同一レベル内でのノードの重なりを解消する関数
 * @param nodes 同一レベルのノードリスト
 */
function adjustSameLevel(nodes: Node[]): void {
  // ノードをX座標でソート
  nodes.sort((a, b) => a.position.x - b.position.x);
  
  // 隣接するノード間の最小距離
  const minDistance = nodeWidth + 30;
  
  // 左から右に順番にノードの位置を調整
  for (let i = 1; i < nodes.length; i++) {
    const prevNode = nodes[i - 1];
    const currentNode = nodes[i];
    
    const actualDistance = currentNode.position.x - prevNode.position.x;
    
    // 距離が足りない場合は右に移動
    if (actualDistance < minDistance) {
      const adjustment = minDistance - actualDistance;
      currentNode.position.x += adjustment;
    }
  }
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