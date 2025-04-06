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
import { getImprovedHierarchicalLayout, getImprovedLayoutedElements } from '@/lib/improved-graph-layout';
import { initSocket, addSocketListener, removeSocketListener, sendSocketMessage } from '@/lib/socket';
import ConceptNode from '@/components/nodes/ConceptNode';
import AgentNode from '@/components/nodes/AgentNode';
import DataFlowEdge from '@/components/edges/DataFlowEdge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, ZapIcon } from 'lucide-react';
import { CrewAIButton } from './CrewAIButton';

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
      
      console.log('Received graph data:', graphData);
      
      // ReactFlowノードへの変換
      // レベルごとにノードをグループ化
      const nodesByLevel: Record<number, any[]> = {};
      graphData.nodes.forEach((node: any) => {
        const level = node.level || 0;
        if (!nodesByLevel[level]) {
          nodesByLevel[level] = [];
        }
        nodesByLevel[level].push(node);
      });
      
      // グラフ全体の設定
      const graphAreaWidth = window.innerWidth - 100; // 余白を考慮
      const graphAreaHeight = window.innerHeight - 150; // 余白を考慮
      const centerX = graphAreaWidth / 2;
      const centerY = 150; // 上から少し下にずらす
      
      // 階層ごとの設定
      const levelHeight = 250; // 階層間の垂直距離
      const minHorizontalSpacing = 350; // ノード間の最小水平距離
      
      // カラーマップ（レベルごとに異なる色を割り当て）
      const colorMap = [
        '#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0', 
        '#4895ef', '#560bad', '#480ca8', '#b5179e', '#3f37c9'
      ];
      
      // ノードの初期位置を計算
      const flowNodes: Node[] = graphData.nodes.map((node: any) => {
        // レベルとインデックスを取得
        const level = node.level || 0;
        const nodesInThisLevel = nodesByLevel[level] ? nodesByLevel[level].length : 0;
        
        // このレベルでのインデックスを取得
        const index = nodesByLevel[level] ? nodesByLevel[level].indexOf(node) : 0;
        
        // 水平方向の配置計算
        let x;
        let y;
        
        if (level === 0) {
          // ルートノードは中央上部に配置
          x = centerX;
          y = 100;
        } else if (nodesInThisLevel === 1) {
          // 1つしかない場合は親の下に直接配置
          const parentId = node.parentId;
          const parentNode = parentId ? graphData.nodes.find((n: any) => n.id === parentId) : null;
          const parentIndex = parentNode ? 
            (nodesByLevel[parentNode.level || 0] ? nodesByLevel[parentNode.level || 0].indexOf(parentNode) : 0) : 
            0;
          
          // 親ノードの位置に基づいて配置
          x = parentNode ? (centerX + (parentIndex - (nodesByLevel[parentNode.level || 0].length - 1) / 2) * minHorizontalSpacing) : centerX;
          y = centerY + level * levelHeight;
        } else {
          // 複数ある場合は均等に配置
          const sectionWidth = Math.max(minHorizontalSpacing * (nodesInThisLevel - 1), graphAreaWidth * 0.8);
          x = centerX - sectionWidth / 2 + index * (sectionWidth / (nodesInThisLevel - 1));
          y = centerY + level * levelHeight;
        }
        
        // ノードのタイプと階層に基づいて色を設定
        const color = colorMap[level % colorMap.length];
        
        return {
          id: node.id,
          type: node.type === 'agent' ? 'agent' : 'concept',
          position: { x, y },
          data: {
            ...node,
            label: node.name,
            color: node.color || color,
          },
          style: {
            background: node.color || color,
            borderColor: color,
          },
        };
      });
      
      console.log('Created flow nodes:', flowNodes);
      
      // エッジデータのチェックと修正
      const validEdges = graphData.edges.filter((edge: any) => {
        // sourceとtargetが存在するノードを参照しているか確認
        const sourceExists = flowNodes.some(node => node.id === edge.source || node.id === edge.sourceId);
        const targetExists = flowNodes.some(node => node.id === edge.target || node.id === edge.targetId);
        
        if (!sourceExists || !targetExists) {
          console.warn('Skipping invalid edge:', edge);
          return false;
        }
        return true;
      });
      
      // ReactFlowエッジへの変換
      const flowEdges: Edge[] = validEdges.map((edge: any) => {
        // sourceIdとtargetIdの優先的な使用 (PostgreSQLから取得した場合)
        const source = edge.sourceId || edge.source;
        const target = edge.targetId || edge.target;
        
        return {
          id: `${source}-${target}`,
          source,
          target,
          type: 'dataFlow',
          animated: edge.type === 'data-flow',
          label: edge.label || '',
          data: {
            strength: edge.strength || 1,
          },
        };
      });
      
      console.log('Created flow edges:', flowEdges);
      
      // グラフの種類に応じてレイアウト方法を選択
      // 階層情報の分析
      const hasHierarchy = flowNodes.some(node => node.data && typeof node.data.level === 'number');
      const hasMultipleLevels = new Set(flowNodes.map(node => node.data?.level || 0)).size > 1;
      const isComplex = flowNodes.length > 15 || flowEdges.length > 20;
      
      // レイアウト選択のロジック
      const useHierarchicalLayout = hasHierarchy && (hasMultipleLevels || isComplex);
      
      console.log(`Graph analysis: nodes=${flowNodes.length}, edges=${flowEdges.length}, hasHierarchy=${hasHierarchy}, hasMultipleLevels=${hasMultipleLevels}, isComplex=${isComplex}`);
      
      if (!useHierarchicalLayout) {
        // シンプルなグラフや階層が単一の場合は改良された基本レイアウトを使用
        console.log('Using improved standard layout for simple graph');
        const { nodes: layoutedNodes, edges: layoutedEdges } = getImprovedLayoutedElements(
          flowNodes,
          flowEdges,
          { 
            direction: 'TB',
            nodesep: 180, // より広いスペース
            ranksep: 200, // より広いスペース
            marginx: 50,
            marginy: 80
          }
        );
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setLoading(false);
        return;
      }
      
      // 複雑なグラフや明確な階層構造がある場合は最適化された階層レイアウトを使用
      console.log('Using enhanced hierarchical layout for complex/hierarchical graph');
      const { nodes: layoutedNodes, edges: layoutedEdges } = getImprovedHierarchicalLayout(
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
    console.log('Fetching graph data for roleModelId:', roleModelId);
    fetchGraphData();
  }, [fetchGraphData, roleModelId]);

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
    
    console.log(`[KnowledgeGraphViewer] WebSocketリスナーをセットアップ: roleModelId=${roleModelId}`);
    const socket = initSocket();
    
    // セットアップ関数 - 接続時とリトライ時に実行
    const setupSubscription = () => {
      if (!roleModelId || roleModelId === 'default') {
        console.warn('有効なロールモデルIDがありません。WebSocket購読をスキップします。');
        return;
      }
      
      // UUID形式かどうか検証
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(roleModelId)) {
        console.warn('無効なUUID形式です:', roleModelId);
        return;
      }
      
      console.log(`[KnowledgeGraphViewer] このロールモデルをWebSocketで購読: ${roleModelId}`);
      
      // 現在の日時を含めて、キャッシュバスティングを行う
      const timestamp = new Date().getTime();
      sendSocketMessage('subscribe', { 
        roleModelId,
        timestamp,
        clientId: `client-${Math.random().toString(36).substring(2, 9)}`
      });
      
      console.log(`[KnowledgeGraphViewer] 購読メッセージを送信しました: ${roleModelId}`);
    };
    
    // 即時実行とソケットオープン時の実行
    if (socket.readyState === WebSocket.OPEN) {
      setupSubscription();
    } else {
      console.log('[KnowledgeGraphViewer] WebSocketが開いていません、接続待機中...');
      
      // ソケットが開くのを待つ
      const handleOpen = () => {
        console.log('[KnowledgeGraphViewer] WebSocketが開きました、購読設定中...');
        setupSubscription();
      };
      
      socket.addEventListener('open', handleOpen);
      
      // クリーンアップ関数でイベントリスナーを削除
      return () => {
        socket.removeEventListener('open', handleOpen);
      };
    }
    
    // 進捗更新リスナー
    const handleProgress = (data: any) => {
      console.log('Progress update received:', data);
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
      console.log('Agent thoughts received:', data);
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
    
    // 接続イベントリスナー
    const handleConnected = (data: any) => {
      console.log('WebSocket connected:', data);
    }
    addSocketListener('connected', handleConnected);
    
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
          <div className="flex gap-2">
            <CrewAIButton 
              roleModelId={roleModelId}
              onStart={() => {
                setGenerating(true);
                setProgress(0);
                setProgressMessage('CrewAIでマルチエージェント処理を開始しています...');
                setAgentMessages([]);
              }}
              onComplete={() => fetchGraphData()}
            />
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
          </div>
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