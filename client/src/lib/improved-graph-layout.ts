import dagre from 'dagre';
import { Edge, Node, Position } from 'reactflow';

// ノードの大きさを定義（より大きめに設定）
const nodeWidth = 250; // サイズを拡張して文字が収まるようにする
const nodeHeight = 100; // サイズを拡張して文字が収まるようにする
const DEFAULT_NODE_SPACING = 180; // ノード間の最小スペースを大幅に増加

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
 * 重なりを回避するためのノード位置補正関数（大幅強化版）
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
  const MAX_ITERATIONS = 150; // より多くのイテレーションで確実に収束させる
  let iterations = 0;
  let hasOverlap = true;
  let overlapCount = 0;
  
  // ノードのコピーを作成
  const adjustedNodes = [...nodes];
  
  // 重なりの記録
  const overlapHistory: Record<string, number> = {};
  
  // 階層レベル別にノードをグループ化して処理する
  const levelGroups: Record<number, Node[]> = {};
  adjustedNodes.forEach(node => {
    const level = node.data?.level || 0;
    if (!levelGroups[level]) {
      levelGroups[level] = [];
    }
    levelGroups[level].push(node);
  });
  
  // まず同じレベル内でのノードの重なりを解消
  Object.values(levelGroups).forEach(nodesInLevel => {
    if (nodesInLevel.length > 1) {
      nodesInLevel.sort((a, b) => a.position.x - b.position.x);
      
      const minDistance = nodeSize.width + padding/2;
      // 横方向に十分なスペースを確保
      for (let i = 1; i < nodesInLevel.length; i++) {
        const prevNode = nodesInLevel[i-1];
        const currNode = nodesInLevel[i];
        
        if (currNode.position.x - prevNode.position.x < minDistance) {
          currNode.position.x = prevNode.position.x + minDistance + Math.random() * 20;
        }
      }
    }
  });
  
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
        
        // 同じ階層レベルのノード同士は特に重なりを厳しくチェック
        const bothSameLevel = nodeA.data?.level === nodeB.data?.level;
        
        // ノード間の距離を計算
        const dx = Math.abs(nodeA.position.x - nodeB.position.x);
        const dy = Math.abs(nodeA.position.y - nodeB.position.y);
        
        // ノードの最小必要間隔（同レベルなら大きめに）
        const levelMultiplier = bothSameLevel ? 1.0 : 0.8;
        const minWidthDistance = (nodeSize.width + padding) * levelMultiplier;
        const minHeightDistance = (nodeSize.height + padding/2) * levelMultiplier;
        
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
          const historyForce = Math.min(3, 1 + overlapHistory[pairId] * 0.2);
          
          // 同レベルノード間の重なりはより強力に解消
          const sameLayerMultiplier = bothSameLevel ? 1.5 : 1.0;
          
          // 最適な解消方向を決定 - 基本的にはより重なりが少ない方向に移動
          const moveDirectionX = overlapX < overlapY * 1.2; // X方向移動の判定基準
          
          // 同レベルのノードは基本的に横方向に分離（縦方向のレイアウトを維持）
          const preferHorizontalSeparation = bothSameLevel || Math.abs(levelA - levelB) <= 1;
          
          // ノードの階層レベル差が大きいならY方向に優先的に分離
          const levelDifference = Math.abs(levelA - levelB);
          const preferVerticalSeparation = levelDifference >= 2;
          
          // 最終的な移動方向の決定
          let moveInXDirection = moveDirectionX;
          if (preferHorizontalSeparation) moveInXDirection = true;
          if (preferVerticalSeparation) moveInXDirection = false;
          
          // 重なりが少ない方向を優先して移動、かつ特定の条件に基づいて方向を調整
          if (moveInXDirection) {
            // X方向に分離
            const pushX = (overlapX * 0.6 + 5) * historyForce * sameLayerMultiplier;
            if (nodeA.position.x < nodeB.position.x) {
              nodeA.position.x -= pushX * weightA;
              nodeB.position.x += pushX * weightB;
            } else {
              nodeA.position.x += pushX * weightA;
              nodeB.position.x -= pushX * weightB;
            }
            
            // 完全な重なりの場合、Y方向にもわずかに移動
            if (Math.abs(nodeA.position.y - nodeB.position.y) < 10) {
              const smallPushY = 5 * historyForce;
              nodeA.position.y -= smallPushY * weightA;
              nodeB.position.y += smallPushY * weightB;
            }
          } else {
            // Y方向に分離
            const pushY = (overlapY * 0.6 + 5) * historyForce;
            if (nodeA.position.y < nodeB.position.y) {
              nodeA.position.y -= pushY * weightA;
              nodeB.position.y += pushY * weightB;
            } else {
              nodeA.position.y += pushY * weightA;
              nodeB.position.y -= pushY * weightB;
            }
            
            // 完全な重なりの場合、X方向にもわずかに移動
            if (Math.abs(nodeA.position.x - nodeB.position.x) < 10) {
              const smallPushX = 5 * historyForce;
              nodeA.position.x -= smallPushX * weightA;
              nodeB.position.x += smallPushX * weightB;
            }
          }
          
          // 強い重なり（中心点が近すぎる）の場合は両方の軸で分離
          const centerDistanceSquared = dx*dx + dy*dy;
          if (centerDistanceSquared < (nodeSize.width * 0.4) * (nodeSize.width * 0.4)) {
            // 両方の軸で分離する
            const emergencyForce = historyForce * 2.0;
            // ランダム要素を加えて同じ方向への蓄積を防止
            const randomAngle = Math.random() * Math.PI * 2;
            const pushX = Math.cos(randomAngle) * 15 * emergencyForce;
            const pushY = Math.sin(randomAngle) * 15 * emergencyForce;
            
            nodeA.position.x -= pushX * weightA;
            nodeA.position.y -= pushY * weightA;
            nodeB.position.x += pushX * weightB;
            nodeB.position.y += pushY * weightB;
          }
          
          // かなり繰り返し重なっているペアの場合、より激しく分離
          if (overlapHistory[pairId] > 10) {
            const desperateForce = Math.min(5, overlapHistory[pairId] * 0.3);
            const extraPushX = (Math.random() * 2 - 1) * 20 * desperateForce;
            const extraPushY = (Math.random() * 2 - 1) * 20 * desperateForce;
            
            nodeA.position.x += extraPushX * weightA;
            nodeA.position.y += extraPushY * weightA;
            nodeB.position.x -= extraPushX * weightB;
            nodeB.position.y -= extraPushY * weightB;
            
            console.log(`Desperate separation for pair ${pairId}`);
          }
        }
      }
    }
    
    // 収束判定の緩和：少数のノードの重なりだけが残っている場合は強制終了
    if (overlapCount <= Math.min(3, adjustedNodes.length * 0.05) && iterations > 80) {
      console.log(`重なり解消を強制終了: ${overlapCount}個の重なりが残っています`);
      break;
    }
    
    // イテレーションカウンタを表示（デバッグ用）
    if (iterations % 20 === 0) {
      console.log(`重なり解消中: ${iterations}回の反復、残り${overlapCount}個の重なり`);
    }
  }
  
  // 最後に各ノードレベル内で横並びを整える
  Object.values(levelGroups).forEach(nodesInLevel => {
    if (nodesInLevel.length > 2) {
      nodesInLevel.sort((a, b) => a.position.x - b.position.x);
      
      // 横方向の均等配置を試みる
      const leftmost = nodesInLevel[0].position.x;
      const rightmost = nodesInLevel[nodesInLevel.length - 1].position.x;
      const totalWidth = rightmost - leftmost;
      const idealSpacing = totalWidth / (nodesInLevel.length - 1);
      
      // 理想的なスペーシングが十分な大きさならば適用
      if (idealSpacing > nodeSize.width * 1.2) {
        for (let i = 1; i < nodesInLevel.length - 1; i++) {
          const idealX = leftmost + idealSpacing * i;
          // 現在位置から少しだけ理想位置に近づける（完全に移動させない）
          const currNode = nodesInLevel[i];
          currNode.position.x = currNode.position.x * 0.7 + idealX * 0.3;
        }
      }
    }
  });
  
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
 * 階層的レイアウトを大幅に改良したバージョン
 * 親子関係があるノードを階層的に配置し、重なりを効果的に解消
 * @param nodes ノードリスト
 * @param edges エッジリスト
 * @returns 階層的にレイアウトされたノードとエッジ
 */
export function getImprovedHierarchicalLayout(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  if (!nodes.length) return { nodes, edges };
  
  console.log('Applying enhanced hierarchical layout to', nodes.length, 'nodes and', edges.length, 'edges');
  
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
    if (!childrenMap[edge.source].includes(edge.target)) {
      childrenMap[edge.source].push(edge.target);
    }
    
    // 子から親へのマッピング（逆関係）
    if (!parentMap[edge.target]) {
      parentMap[edge.target] = [];
    }
    if (!parentMap[edge.target].includes(edge.source)) {
      parentMap[edge.target].push(edge.source);
    }
    
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
  
  // ルートノードがなければ最初のノードをルートとして扱う
  if (rootNodeIds.length === 0 && nodes.length > 0) {
    rootNodeIds.push(nodes[0].id);
    console.log('No root nodes found, using the first node as root:', nodes[0].id);
  } else {
    console.log('Root nodes:', rootNodeIds);
  }
  
  // 各ノードの階層レベルを計算
  const nodeDistances: Record<string, number> = {};
  rootNodeIds.forEach((id) => {
    nodeDistances[id] = 0;
    calculateDistances(id, childrenMap, nodeDistances, 1);
  });
  
  // 全てのノードに階層レベルが割り当てられていることを確認
  // 孤立したノードはレベル0とする
  nodes.forEach(node => {
    if (nodeDistances[node.id] === undefined) {
      nodeDistances[node.id] = 0;
      console.log(`Isolated node detected: ${node.id}, assigned to level 0`);
    }
  });
  
  // ノードの最大レベルを計算
  const maxLevel = Math.max(...Object.values(nodeDistances), 0);
  console.log(`Maximum hierarchy level: ${maxLevel}`);
  
  // 各レベルにおけるノード数をカウント
  const levelNodeCounts: Record<number, number> = {};
  Object.values(nodeDistances).forEach(level => {
    levelNodeCounts[level] = (levelNodeCounts[level] || 0) + 1;
  });
  
  // 最も多くのノードを持つレベルを特定
  let maxNodesInLevel = 0;
  let levelWithMostNodes = 0;
  
  Object.entries(levelNodeCounts).forEach(([levelStr, count]) => {
    const level = parseInt(levelStr);
    if (count > maxNodesInLevel) {
      maxNodesInLevel = count;
      levelWithMostNodes = level;
    }
  });
  
  console.log(`Level ${levelWithMostNodes} has the most nodes: ${maxNodesInLevel}`);
  
  // 画面サイズに基づくレイアウト計算
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  
  // グラフ表示領域のサイズを計算
  const graphAreaWidth = windowWidth - 150; // 余白を確保
  const graphAreaHeight = windowHeight - 250; // ヘッダーなどの領域を考慮
  
  // レベル間の垂直間隔を計算（最大レベル数に基づく）
  const verticalSpacing = Math.max(
    180, // 最小間隔
    Math.min(300, graphAreaHeight / (maxLevel + 1)) // 最大間隔を制限
  );
  
  console.log(`Graph area: ${graphAreaWidth}x${graphAreaHeight}, vertical spacing: ${verticalSpacing}`);
  
  // 距離に基づいてY座標を決定し、階層レベルをノードのデータに追加
  const layoutedNodes = nodes.map((node) => {
    const level = nodeDistances[node.id] || 0;
    
    // Y座標はレベルに基づいて計算（上部に余白を確保）
    const y = level * verticalSpacing + 100;
    
    // ランダム要素で初期位置を少しずらす（重なり防止の初期処理）
    const randomOffset = (Math.random() - 0.5) * 50;
    
    // レベルとデータを更新
    return {
      ...node,
      position: {
        x: (node.position?.x || 0) + randomOffset, // 初期位置にランダム要素を追加
        y,
      },
      data: {
        ...node.data,
        level,
      },
    };
  });
  
  // 各レベルでノードをグループ化
  const levelGroups: Record<number, Node[]> = {};
  layoutedNodes.forEach((node) => {
    const level = nodeDistances[node.id] || 0;
    if (!levelGroups[level]) {
      levelGroups[level] = [];
    }
    levelGroups[level].push(node);
  });
  
  // 親ノードの位置を記録（子ノードの配置に使用）
  const nodePositions: Record<string, { x: number, y: number }> = {};
  
  // レベル別に配置（トップダウンで）
  Object.entries(levelGroups)
    .sort(([a], [b]) => parseInt(a) - parseInt(b)) // レベル順にソート
    .forEach(([levelStr, nodesInLevel]) => {
      const level = parseInt(levelStr);
      console.log(`Processing level ${level} with ${nodesInLevel.length} nodes`);
      
      // レベル内のノードをID順にソート（安定したレイアウトのため）
      nodesInLevel.sort((a, b) => a.id.localeCompare(b.id));
      
      // 最適な横幅を計算（ノード数に応じて調整）
      const idealSpacing = Math.max(
        nodeWidth + 50, // 最小スペース
        Math.min(nodeWidth + 250, graphAreaWidth / Math.min(nodesInLevel.length, 5)) // 最大スペースを制限
      );
      
      // このレベルの理想的な合計幅を計算
      const idealLevelWidth = nodesInLevel.length * idealSpacing;
      const startX = Math.max(100, (graphAreaWidth - idealLevelWidth) / 2); // 中央配置
      
      // 初期X座標を設定（親ノードとの関係を考慮）
      nodesInLevel.forEach((node, index) => {
        // 親ノードがある場合はその位置を考慮
        const parents = parentMap[node.id] || [];
        
        if (parents.length > 0) {
          // 親ノードの位置を取得
          const parentPositions = parents
            .map(pid => nodePositions[pid])
            .filter(pos => pos !== undefined);
          
          if (parentPositions.length > 0) {
            // 親ノードの平均X座標を計算
            const avgParentX = parentPositions.reduce((sum, pos) => sum + pos.x, 0) / parentPositions.length;
            
            // 親の下に配置
            node.position.x = avgParentX + (Math.random() - 0.5) * 50; // 少しランダム要素を追加
          } else {
            // 親の位置が不明な場合は均等配置
            node.position.x = startX + index * idealSpacing;
          }
        } else {
          // 親がない場合は均等配置
          node.position.x = startX + index * idealSpacing;
        }
        
        // 位置を記録
        nodePositions[node.id] = { x: node.position.x, y: node.position.y };
      });
      
      // 同じレベル内のノードの重なりを解消
      if (nodesInLevel.length > 1) {
        adjustHorizontalPositions(nodesInLevel, idealSpacing);
      }
    });
  
  // 最終的な重なり解消アルゴリズムを適用
  let finalNodes = preventNodeOverlap(layoutedNodes, {
    width: nodeWidth,
    height: nodeHeight
  }, DEFAULT_NODE_SPACING);
  
  // エッジを適切に接続
  const finalEdges = edges.map(edge => {
    const sourceNode = finalNodes.find(n => n.id === edge.source);
    const targetNode = finalNodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) {
      return edge;
    }
    
    // ノード間の方向に基づいてハンドル位置を決定
    const sourceLevel = nodeDistances[edge.source] || 0;
    const targetLevel = nodeDistances[edge.target] || 0;
    
    // レベルに基づく接続点を設定
    if (sourceLevel < targetLevel) {
      // 親から子への接続
      return {
        ...edge,
        sourceHandle: Position.Bottom,
        targetHandle: Position.Top
      };
    } else if (sourceLevel > targetLevel) {
      // 子から親への逆方向接続
      return {
        ...edge,
        sourceHandle: Position.Top,
        targetHandle: Position.Bottom
      };
    } else {
      // 同じレベル内の接続
      const isSourceLeft = sourceNode.position.x < targetNode.position.x;
      return {
        ...edge,
        sourceHandle: isSourceLeft ? Position.Right : Position.Left,
        targetHandle: isSourceLeft ? Position.Left : Position.Right
      };
    }
  });
  
  console.log('Hierarchical layout completed');
  return { nodes: finalNodes, edges: finalEdges };
}

/**
 * 同一レベル内でのノードの水平位置を均等に調整（重なり防止）
 * @param nodes 同一レベルのノードリスト
 * @param idealSpacing 理想的なノード間隔
 */
function adjustHorizontalPositions(nodes: Node[], idealSpacing: number): void {
  // X座標でソート
  nodes.sort((a, b) => a.position.x - b.position.x);
  
  // 最小間隔（ノード幅+マージン）
  const minSpacing = nodeWidth * 1.2;
  
  // 重なりを検出して修正
  for (let i = 1; i < nodes.length; i++) {
    const prevNode = nodes[i-1];
    const currNode = nodes[i];
    
    const currentSpacing = currNode.position.x - prevNode.position.x;
    
    // 間隔が最小間隔より小さい場合は調整
    if (currentSpacing < minSpacing) {
      // 現在のノードを右に移動
      currNode.position.x = prevNode.position.x + minSpacing;
    }
  }
  
  // 均等配置に近づける調整
  if (nodes.length >= 3) {
    const leftMost = nodes[0].position.x;
    const rightMost = nodes[nodes.length - 1].position.x;
    const totalWidth = rightMost - leftMost;
    
    // 十分な幅がある場合のみ均等化を試みる
    if (totalWidth > nodes.length * minSpacing * 1.2) {
      const equalSpacing = totalWidth / (nodes.length - 1);
      
      // 両端以外のノードの位置を調整（部分的に均等化）
      for (let i = 1; i < nodes.length - 1; i++) {
        const idealX = leftMost + equalSpacing * i;
        // 現在位置と理想位置を混合（完全に均等にするのではなく、少しずつ調整）
        nodes[i].position.x = nodes[i].position.x * 0.7 + idealX * 0.3;
      }
    }
  }
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