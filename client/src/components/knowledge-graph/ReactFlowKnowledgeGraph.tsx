import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background, 
  Controls, 
  Edge, 
  MarkerType, 
  MiniMap, 
  Node,
  NodeTypes,
  EdgeTypes,
  applyEdgeChanges,
  applyNodeChanges,
  ReactFlowProvider,
  Panel,
  NodeChange,
  EdgeChange,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { getLayoutedElements } from '@/lib/graph-layout';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { KnowledgeNode, KnowledgeEdge } from '@shared/schema';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

// カスタムノードとエッジのインポート
import ConceptNode from '../nodes/ConceptNode';
import DataFlowEdge from '../edges/DataFlowEdge';

// ノードタイプとエッジタイプの登録
const nodeTypes: NodeTypes = {
  concept: ConceptNode
};

const edgeTypes: EdgeTypes = {
  dataFlow: DataFlowEdge
};

interface ReactFlowKnowledgeGraphProps {
  roleModelId: string;
  onNodeClick?: (node: KnowledgeNode) => void;
  width?: number;
  height?: number;
}

// 実際のグラフ描画コンポーネント
const ReactFlowGraphContent: React.FC<ReactFlowKnowledgeGraphProps> = ({
  roleModelId,
  onNodeClick,
  width = 800,
  height = 600
}) => {
  // React Flowインスタンス
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  
  // ステート
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ノードデータの取得
  const { data: knowledgeNodes = [] } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-nodes`);
      const data = await res.json() as KnowledgeNode[];
      console.log('Fetched nodes:', data.length);
      return data;
    },
    enabled: !!roleModelId
  });
  
  // エッジデータの取得
  const { data: knowledgeEdges = [] } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/knowledge-edges`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-edges`);
      const data = await res.json() as KnowledgeEdge[];
      console.log('Fetched edges:', data.length);
      return data;
    },
    enabled: !!roleModelId
  });

  // サンプルノード（データがない場合用）
  const sampleNodes: KnowledgeNode[] = [
    {
      id: 'root',
      name: 'AIエンジニア',
      type: 'root',
      level: 0,
      color: '#FF5733',
      parentId: null,
      roleModelId,
      description: 'AIエンジニアのルートノード',
      createdAt: new Date()
    },
    {
      id: 'sample1',
      name: 'データ処理',
      type: 'concept',
      level: 1,
      color: '#33A8FF',
      parentId: 'root',
      roleModelId,
      description: 'データの前処理と分析',
      createdAt: new Date()
    },
    {
      id: 'sample2',
      name: 'モデル開発',
      type: 'concept',
      level: 1,
      color: '#33FF57',
      parentId: 'root',
      roleModelId,
      description: '機械学習モデルの開発',
      createdAt: new Date()
    }
  ];
  
  // サンプルエッジ（データがない場合用）
  const sampleEdges: KnowledgeEdge[] = [
    {
      id: 'edge1',
      sourceId: 'root',
      targetId: 'sample1',
      label: 'CONTAINS',
      strength: 2,
      roleModelId
    },
    {
      id: 'edge2',
      sourceId: 'root',
      targetId: 'sample2',
      label: 'CONTAINS',
      strength: 2,
      roleModelId
    }
  ];
  
  // ノードとエッジからグラフデータを生成
  useEffect(() => {
    try {
      setLoading(true);
      
      // 実際のデータまたはサンプルデータを使用
      const effectiveNodes = knowledgeNodes.length > 0 ? knowledgeNodes : sampleNodes;
      const effectiveEdges = knowledgeEdges.length > 0 ? knowledgeEdges : sampleEdges;
      
      console.log('処理するノード数:', effectiveNodes.length);
      console.log('処理するエッジ数:', effectiveEdges.length);
      
      // ノードの変換
      const graphNodes: Node[] = effectiveNodes.map(node => ({
        id: node.id,
        type: 'concept',
        // 初期位置（レイアウトで上書きされる）
        position: { x: 0, y: 0 },
        data: {
          label: node.name,
          description: node.description || '',
          type: node.type || 'concept',
          level: node.level || 0,
          importance: node.level === 0 ? 5 : Math.max(1, 4 - node.level),
          color: node.color || undefined
        }
      }));
      
      // エッジの変換
      const graphEdges: Edge[] = effectiveEdges.map(edge => ({
        id: edge.id,
        source: edge.sourceId || '',
        target: edge.targetId || '',
        type: 'dataFlow',
        animated: edge.label === 'TASK_FLOW',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
        },
        data: {
          label: edge.label || 'RELATED_TO',
          type: edge.label?.toLowerCase().replace(/_/g, '_') || 'related_to',
          strength: edge.strength || 1
        }
      }));
      
      console.log('生成したノード数:', graphNodes.length);
      console.log('生成したエッジ数:', graphEdges.length);
      
      // 親子関係からエッジを生成（親子関係がない場合でも追加）
      const parentChildEdges: Edge[] = effectiveNodes
        .filter(node => node.parentId)
        .map(node => ({
          id: `pc-${node.id}`,
          source: node.parentId!,
          target: node.id,
          type: 'dataFlow',
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
          },
          data: {
            label: 'CONTAINS',
            type: 'contains',
            strength: 2
          }
        }));
      
      // 親子関係のエッジを追加
      if (parentChildEdges.length > 0) {
        graphEdges.push(...parentChildEdges);
      }
      
      // レイアウトを適用
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        graphNodes, 
        graphEdges, 
        'TB'
      );
      
      // 状態を更新
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      
    } catch (error) {
      console.error('グラフの生成中にエラーが発生しました:', error);
      setError('グラフの描画に失敗しました。');
      toast({
        title: 'エラー',
        description: 'グラフの描画に失敗しました。',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [knowledgeNodes, knowledgeEdges, roleModelId]);
  
  // ノード変更ハンドラ
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);
  
  // エッジ変更ハンドラ
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds));
  }, []);
  
  // ノードクリックハンドラ
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (!onNodeClick) return;
    
    // クリックされたノードのKnowledgeNodeを検索
    const knowledgeNode = knowledgeNodes.find(kn => kn.id === node.id);
    if (knowledgeNode) {
      onNodeClick(knowledgeNode);
    }
  }, [onNodeClick, knowledgeNodes]);
  
  // レイアウト再計算
  const recalculateLayout = useCallback(() => {
    if (nodes.length === 0) return;
    
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, 'TB');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    // レイアウト適用後にビューをフィット
    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 100);
  }, [nodes, edges, fitView]);
  
  // ノードが変更されたらビューをフィット
  useEffect(() => {
    if (nodes.length > 0 && !loading) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.2 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodes, loading, fitView]);
  
  // ローディング中表示
  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ width, height }}>
        <div>グラフデータを読み込み中...</div>
      </div>
    );
  }
  
  // エラー表示
  if (error) {
    return (
      <div className="flex justify-center items-center" style={{ width, height }}>
        <div>エラー: {error}</div>
      </div>
    );
  }
  
  return (
    <div style={{ width, height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        
        <Panel position="top-right">
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="icon" onClick={() => zoomIn()}>
              <ZoomIn size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={() => zoomOut()}>
              <ZoomOut size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={recalculateLayout}>
              <RefreshCw size={16} />
            </Button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

// ReactFlowProviderでラップしたエクスポート用コンポーネント
const ReactFlowKnowledgeGraph: React.FC<ReactFlowKnowledgeGraphProps> = (props) => {
  return (
    <div style={{ width: props.width || 800, height: props.height || 600 }} className="border rounded-md overflow-hidden">
      <ReactFlowProvider>
        <ReactFlowGraphContent {...props} />
      </ReactFlowProvider>
    </div>
  );
};

export default ReactFlowKnowledgeGraph;