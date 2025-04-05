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
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, ZapIcon } from 'lucide-react';

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

  // AIによるグラフ生成
  const [generating, setGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [agentMessages, setAgentMessages] = useState<{agent: string, message: string, timestamp: string}[]>([]);

  // AI生成リクエスト
  const generateKnowledgeGraph = useCallback(async () => {
    try {
      setGenerating(true);
      setProgress(0);
      setProgressMessage('知識グラフの生成を開始しています...');
      setAgentMessages([]);
      
      // 生成リクエストを送信
      const response = await fetch(`/api/knowledge-graph/generate/${roleModelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`知識グラフの生成リクエストに失敗しました: ${response.statusText}`);
      }
      
      // WebSocketで進捗が通知されるので、レスポンスは特に処理しない
      
    } catch (err) {
      console.error('知識グラフ生成エラー:', err);
      setProgressMessage(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setGenerating(false);
    }
  }, [roleModelId]);

  // WebSocketから進捗と結果を受信
  useEffect(() => {
    if (!roleModelId) return;
    
    const socket = initSocket();
    
    // 進捗更新リスナー
    const handleProgress = (data: any) => {
      if (data.roleModelId === roleModelId) {
        setProgress(data.progress);
        setProgressMessage(data.message);
        
        // 完了時
        if (data.progress >= 100) {
          setTimeout(() => {
            setGenerating(false);
            fetchGraphData();
          }, 1000);
        }
      }
    };
    
    // エージェント思考リスナー
    const handleAgentThoughts = (data: any) => {
      if (data.roleModelId === roleModelId) {
        setAgentMessages(prev => [
          ...prev, 
          {
            agent: data.agentName, 
            message: data.thoughts,
            timestamp: data.timestamp
          }
        ]);
      }
    };
    
    // イベントリスナーの登録
    addSocketListener('progress', handleProgress);
    addSocketListener('agent_thoughts', handleAgentThoughts);
    
    return () => {
      // イベントリスナーの解除
      removeSocketListener('progress', handleProgress);
      removeSocketListener('agent_thoughts', handleAgentThoughts);
    };
  }, [roleModelId, fetchGraphData]);

  return (
    <div className="flex flex-col w-full" style={{ height }}>
      <div className="flex justify-between items-center mb-2 px-4 py-2 bg-muted/50 rounded-lg">
        <h3 className="text-lg font-semibold">知識グラフビューワー</h3>
        {!generating && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <ZapIcon className="w-4 h-4" />
                AIで生成
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>知識グラフの自動生成</AlertDialogTitle>
                <AlertDialogDescription>
                  AIを使用して知識グラフを自動的に生成します。ロールモデル、業界、キーワードから情報を分析し、階層的な知識グラフを生成します。
                  <br /><br />
                  この処理には数分かかることがあります。進捗はリアルタイムで表示されます。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={generateKnowledgeGraph}>生成開始</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      
      {generating ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white/50 rounded-lg p-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <div className="w-full max-w-md">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">{progressMessage}</span>
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          {agentMessages.length > 0 && (
            <div className="mt-8 w-full max-w-md">
              <h4 className="text-md font-medium mb-2">AI思考プロセス:</h4>
              <div className="bg-muted/30 rounded-lg p-4 max-h-60 overflow-y-auto text-sm">
                {agentMessages.map((msg, idx) => (
                  <div key={idx} className="mb-3 last:mb-0">
                    <div className="font-semibold text-primary">{msg.agent}</div>
                    <div className="whitespace-pre-line">{msg.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500 bg-red-50 p-4 rounded-lg max-w-md">
            <h3 className="font-semibold mb-2">エラーが発生しました</h3>
            <p>{error}</p>
            <Button
              className="mt-4"
              onClick={fetchGraphData}
            >
              再試行
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1">
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
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraphViewer;