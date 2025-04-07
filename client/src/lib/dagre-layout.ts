import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

export interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'RL' | 'BT';
  nodeSep?: number;
  rankSep?: number;
  marginX?: number;
  marginY?: number;
  nodeWidth?: number;
  nodeHeight?: number;
}

/**
 * dagreを使用して自動レイアウトを生成する関数
 * @param nodes レイアウトするノード
 * @param edges レイアウトするエッジ
 * @param options レイアウトオプション
 * @returns 位置が設定されたノードとエッジ
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
) {
  // デフォルト値の設定
  const {
    direction = 'TB',
    nodeSep = 50,
    rankSep = 100,
    marginX = 20,
    marginY = 20,
    nodeWidth = 180,
    nodeHeight = 60,
  } = options;

  // dagreグラフの初期化
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // グラフの方向とノード間隔の設定
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    marginx: marginX,
    marginy: marginY,
  });

  // ノードの追加
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.width || nodeWidth,
      height: node.height || nodeHeight,
    });
  });

  // エッジの追加
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // レイアウトの計算
  dagre.layout(dagreGraph);

  // 計算された位置をノードに適用
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.width || nodeWidth) / 2,
        y: nodeWithPosition.y - (node.height || nodeHeight) / 2,
      },
      // カスタムメタデータを追加
      data: {
        ...node.data,
        layoutLevel: nodeWithPosition.y, // レイアウトの階層位置
      },
    };
  });

  // レイアウト結果を返す（エッジは変更なし）
  return { nodes: layoutedNodes, edges };
}

/**
 * 階層タイプのグラフに特化したレイアウトを生成する関数
 * @param nodes レイアウトするノード
 * @param edges レイアウトするエッジ
 * @returns 位置が設定されたノードとエッジ
 */
export function getHierarchicalLayout(
  nodes: Node[],
  edges: Edge[]
) {
  // レベル情報を使ってより良いレイアウトを作成
  const levelMap = new Map<number, Node[]>();
  
  // ノードをレベルごとに分類
  nodes.forEach((node) => {
    const level = node.data?.level || 0;
    if (!levelMap.has(level)) {
      levelMap.set(level, []);
    }
    levelMap.get(level)?.push(node);
  });
  
  // レベルの順序を取得
  const levels = Array.from(levelMap.keys()).sort((a, b) => a - b);
  
  // 新しいノードとエッジの配列を作成
  const layoutedNodes: Node[] = [];
  
  // 各レベルを処理
  levels.forEach((level, levelIndex) => {
    const nodesInLevel = levelMap.get(level) || [];
    const levelWidth = Math.max(nodesInLevel.length * 200, 800);
    const levelY = levelIndex * 200 + 100;
    
    // 各ノードを配置
    nodesInLevel.forEach((node, nodeIndex) => {
      const nodeCount = nodesInLevel.length;
      const nodeX = (nodeIndex + 0.5) * (levelWidth / Math.max(nodeCount, 1));
      
      layoutedNodes.push({
        ...node,
        position: { x: nodeX, y: levelY },
      });
    });
  });
  
  return { nodes: layoutedNodes, edges };
}

/**
 * ノードの階層構造を分析し、親子関係を反映したレイアウトを生成する高度な関数
 * @param nodes レイアウトするノード
 * @param edges レイアウトするエッジ
 * @returns 位置が設定されたノードとエッジ
 */
export function getAdvancedHierarchicalLayout(
  nodes: Node[],
  edges: Edge[]
) {
  // まず基本的なdagreレイアウトを適用
  const { nodes: baseLayoutNodes } = getLayoutedElements(nodes, edges, {
    direction: 'TB',
    nodeSep: 80,
    rankSep: 150,
    nodeWidth: 180,
    nodeHeight: 60,
  });
  
  // エッジから親子関係を構築
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();
  
  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;
    
    // 子ノードのリストを構築
    if (!childrenMap.has(source)) {
      childrenMap.set(source, []);
    }
    childrenMap.get(source)?.push(target);
    
    // 親ノードの参照を構築
    parentMap.set(target, source);
  });
  
  // 親の下に子ノードを配置するようにレイアウトを微調整
  const finalNodes = baseLayoutNodes.map((node) => {
    const children = childrenMap.get(node.id) || [];
    const parent = parentMap.get(node.id);
    
    // 親がいる場合は親の下に配置
    if (parent) {
      const parentNode = baseLayoutNodes.find((n) => n.id === parent);
      if (parentNode) {
        // 親の下に配置（多少のオフセット）
        return {
          ...node,
          position: {
            x: node.position.x,
            y: parentNode.position.y + 150, // 親の下に固定距離で配置
          },
        };
      }
    }
    
    return node;
  });
  
  return { nodes: finalNodes, edges };
}