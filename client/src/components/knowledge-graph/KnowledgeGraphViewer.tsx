import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeTypes,
  EdgeTypes,
  NodeChange,
  EdgeChange,
  ConnectionLineType,
  ReactFlowProvider,
  OnConnect,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { KnowledgeNode } from '@shared/schema';
import { getHierarchicalLayout } from '@/lib/graph-layout';
import { initSocket, addSocketListener, removeSocketListener } from '@/lib/socket';
import ConceptNode from '@/components/nodes/ConceptNode';
import AgentNode from '@/components/nodes/AgentNode';
import DataFlowEdge from '@/components/edges/DataFlowEdge';

interface KnowledgeGraphViewerProps {
  roleModelId: string;
  onNodeSelect?: (node: KnowledgeNode) => void;
  width?: string | number;
  height?: string | number;
}

// カスタムノードタイプの定義
const nodeTypes: NodeTypes = {
  concept: ConceptNode,
  agent: AgentNode,
};

// カスタムエッジタイプの定義
const edgeTypes: EdgeTypes = {
  dataFlow: DataFlowEdge,
};

const KnowledgeGraphViewer: React.FC<KnowledgeGraphViewerProps> = ({
  roleModelId,
  onNodeSelect,
  width = '100%',
  height = '600px',
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // サーバーからグラフデータを取得
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/knowledge-graph/${roleModelId}`);
      
      if (!response.ok) {
        throw new Error(`グラフデータの取得に失敗しました: ${response.statusText}`);
      }
      
      const graphData = await response.json();
      
      if (!graphData || !graphData.nodes || !graphData.edges) {
        throw new Error('無効なグラフデータ形式です');
      }
      
      // ReactFlowノードへの変換
      const flowNodes: Node[] = graphData.nodes.map((node: any) => ({
        id: node.id,
        type: node.type === 'agent' ? 'agent' : 'concept',
        position: { x: 0, y: 0 }, // 初期位置はレイアウト計算で上書き
        data: {
          ...node,
          label: node.name,
        },
      }));
      
      // ReactFlowエッジへの変換
      const flowEdges: Edge[] = graphData.edges.map((edge: any) => ({
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target,
        type: 'dataFlow',
        animated: edge.type === 'data-flow',
        label: edge.label || '',
        data: {
          strength: edge.strength || 1,
        },
      }));
      
      // グラフのレイアウトを計算
      const { nodes: layoutedNodes, edges: layoutedEdges } = getHierarchicalLayout(
        flowNodes,
        flowEdges
      );
      
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setLoading(false);
    } catch (err) {
      console.error('グラフデータの取得エラー:', err);
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setLoading(false);
    }
  }, [roleModelId, setNodes, setEdges]);

  // グラフデータの初期ロード
  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // WebSocketリスナーのセットアップ
  useEffect(() => {
    const socket = initSocket();
    
    // グラフ更新のイベントハンドラ
    const handleGraphUpdate = (data: any) => {
      if (data.roleModelId === roleModelId) {
        fetchGraphData();
      }
    };
    
    // イベントリスナーの登録
    addSocketListener('knowledge-graph-update', handleGraphUpdate);
    
    return () => {
      // イベントリスナーの解除
      removeSocketListener('knowledge-graph-update', handleGraphUpdate);
    };
  }, [roleModelId, fetchGraphData]);

  // ノード選択のハンドラ
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (onNodeSelect) {
        onNodeSelect(node.data as KnowledgeNode);
      }
    },
    [onNodeSelect]
  );

  // ノードの変更を処理
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  // エッジの変更を処理
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  // 接続の処理（必要な場合）
  const handleConnect: OnConnect = useCallback(
    (connection) => {
      // 必要に応じて接続を処理（現在は読み取り専用なので不要）
    },
    []
  );

  return (
    <div style={{ width, height }}>
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500 bg-red-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">エラーが発生しました</h3>
            <p>{error}</p>
            <button
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg"
              onClick={fetchGraphData}
            >
              再試行
            </button>
          </div>
        </div>
      ) : (
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeClick={handleNodeClick}
            onConnect={handleConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionLineType={ConnectionLineType.SmoothStep}
            fitView
            attributionPosition="bottom-right"
          >
            <Background color="#aaa" gap={16} />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={(node) => {
                return node.data?.color || '#1a192b';
              }}
            />
          </ReactFlow>
        </ReactFlowProvider>
      )}
    </div>
  );
};

export default KnowledgeGraphViewer;