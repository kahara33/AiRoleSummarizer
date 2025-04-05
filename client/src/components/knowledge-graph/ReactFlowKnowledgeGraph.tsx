import { useCallback, useEffect, useRef, useState } from 'react';
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
  useReactFlow,
  Panel,
  NodeChange,
  EdgeChange
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { getLayoutedElements, getHierarchicalLayout } from '@/lib/graph-layout';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { KnowledgeNode, KnowledgeEdge } from '@shared/schema';
import { ZoomIn, ZoomOut, RefreshCw, LayoutGrid, Layers } from 'lucide-react';

// カスタムノードとエッジのインポート
import ConceptNode from '../nodes/ConceptNode';
import AgentNode from '../nodes/AgentNode';
import DataFlowEdge from '../edges/DataFlowEdge';

// ノードタイプとエッジタイプの登録
const nodeTypes: NodeTypes = {
  concept: ConceptNode,
  agent: AgentNode
};

const edgeTypes: EdgeTypes = {
  dataFlow: DataFlowEdge
};

interface ReactFlowKnowledgeGraphProps {
  roleModelId: string;
  onNodeClick?: (node: KnowledgeNode) => void;
  onNodeCreate?: (parentNode?: KnowledgeNode) => void;
  onNodeExpand?: (node: KnowledgeNode) => void;
  width?: number;
  height?: number;
}

const ReactFlowKnowledgeGraph: React.FC<ReactFlowKnowledgeGraphProps> = ({
  roleModelId,
  onNodeClick,
  onNodeCreate,
  onNodeExpand,
  width = 800,
  height = 600
}) => {
  // React Flowインスタンスの参照
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  
  // ノードとエッジの状態
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // レイアウトモード
  const [layoutMode, setLayoutMode] = useState<'dagre' | 'hierarchical'>('dagre');
  
  // グラフデータの取得
  const { data: knowledgeNodes = [] } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-nodes`);
      return await res.json() as KnowledgeNode[];
    },
    enabled: !!roleModelId
  });
  
  const { data: knowledgeEdges = [] } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/knowledge-edges`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-edges`);
      return await res.json() as KnowledgeEdge[];
    },
    enabled: !!roleModelId
  });
  
  // グラフデータの変換
  useEffect(() => {
    try {
      setLoading(true);
      
      // ノードの変換
      const graphNodes: Node[] = knowledgeNodes.map(node => ({
        id: node.id,
        type: 'concept', // ConceptNodeを使用
        position: { x: 0, y: 0 }, // 初期位置（レイアウトで調整される）
        data: {
          label: node.name,
          description: node.description || '',
          type: node.type || 'concept',
          level: node.level || 0,
          importance: node.level === 0 ? 5 : Math.max(1, 4 - node.level), // レベルに基づく重要度
          color: node.color || undefined,
          // キーワードはここでは設定しない（実際のデータにはないため）
        }
      }));
      
      // エッジの変換
      const graphEdges: Edge[] = [];
      
      // 親子関係のエッジを追加
      const parentChildEdges: Edge[] = knowledgeNodes
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
      
      graphEdges.push(...parentChildEdges);
      
      // 明示的なエッジを追加
      const explicitEdges: Edge[] = knowledgeEdges.map(edge => ({
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
      
      graphEdges.push(...explicitEdges);
      
      console.log('グラフノード:', graphNodes.length, 'グラフエッジ:', graphEdges.length);
      
      // レイアウトを適用
      const initialElements = layoutMode === 'dagre'
        ? getLayoutedElements(graphNodes, graphEdges, 'TB')
        : getHierarchicalLayout(graphNodes, graphEdges, width / 2, height / 4);
      
      setNodes(initialElements.nodes);
      setEdges(initialElements.edges);
    } catch (e) {
      console.error('グラフデータの変換エラー:', e);
      setError('グラフデータの処理中にエラーが発生しました。');
      toast({
        title: 'エラー',
        description: 'グラフデータの処理中にエラーが発生しました。',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [knowledgeNodes, knowledgeEdges, layoutMode, width, height]);
  
  // ビューのフィット（ノードが更新されたとき）
  useEffect(() => {
    if (nodes.length > 0 && !loading) {
      // 少し遅延を入れてレイアウト完了後にフィット
      const timer = setTimeout(() => {
        fitView({ padding: 0.2, includeHiddenNodes: false });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [nodes, loading, fitView]);
  
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
    
    // KnowledgeNode型に変換
    const knowledgeNode = knowledgeNodes.find(kn => kn.id === node.id);
    if (knowledgeNode) {
      onNodeClick(knowledgeNode);
    }
  }, [onNodeClick, knowledgeNodes]);
  
  // レイアウトの変更
  const changeLayout = useCallback((mode: 'dagre' | 'hierarchical') => {
    setLayoutMode(mode);
  }, []);
  
  // レイアウトの再計算
  const recalculateLayout = useCallback(() => {
    if (nodes.length === 0) return;
    
    const layouted = layoutMode === 'dagre'
      ? getLayoutedElements(nodes, edges, 'TB')
      : getHierarchicalLayout(nodes, edges, width / 2, height / 4);
    
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    
    // 少し遅延を入れてレイアウト完了後にフィット
    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 100);
  }, [nodes, edges, layoutMode, width, height, fitView]);
  
  if (loading) {
    return (
      <div style={{ width, height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div>データを読み込み中...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ width, height, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
        
        <Panel position="top-right">
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            <Button variant="outline" size="icon" onClick={() => zoomIn()}>
              <ZoomIn size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={() => zoomOut()}>
              <ZoomOut size={16} />
            </Button>
            <Button variant="outline" size="icon" onClick={recalculateLayout}>
              <RefreshCw size={16} />
            </Button>
            <Button
              variant={layoutMode === 'dagre' ? 'default' : 'outline'}
              size="icon"
              onClick={() => changeLayout('dagre')}
            >
              <LayoutGrid size={16} />
            </Button>
            <Button
              variant={layoutMode === 'hierarchical' ? 'default' : 'outline'}
              size="icon"
              onClick={() => changeLayout('hierarchical')}
            >
              <Layers size={16} />
            </Button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default ReactFlowKnowledgeGraph;