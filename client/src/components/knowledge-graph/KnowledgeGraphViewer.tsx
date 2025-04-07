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
  onGraphDataChange?: (hasData: boolean) => void;
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
  onGraphDataChange,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasKnowledgeGraph, setHasKnowledgeGraph] = useState<boolean>(false);

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
      // edgeのIDを一意に保つため、マップを使用して重複を排除
      const edgeMap = new Map();
      
      validEdges.forEach((edge: any) => {
        // sourceIdとtargetIdの優先的な使用 (PostgreSQLから取得した場合)
        const source = edge.sourceId || edge.source;
        const target = edge.targetId || edge.target;
        
        // 重複チェック用のキー
        const edgeKey = `${source}-${target}`;
        
        // 重複がない場合だけ追加（後から来たエッジで上書き）
        edgeMap.set(edgeKey, {
          id: edge.id || edgeKey + '-' + Math.random().toString(36).substr(2, 9), // 一意のIDを生成
          source,
          target,
          type: 'dataFlow',
          animated: edge.type === 'data-flow',
          label: edge.label || '',
          data: {
            strength: edge.strength || 1,
          },
        });
      });
      
      // マップから配列に変換
      const flowEdges: Edge[] = Array.from(edgeMap.values());
      
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
        
        // ナレッジグラフが存在することを通知
        const hasData = flowNodes.length > 0;
        setHasKnowledgeGraph(hasData);
        if (onGraphDataChange) {
          onGraphDataChange(hasData);
        }
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
      
      // ナレッジグラフが存在することを通知
      const hasData = flowNodes.length > 0;
      setHasKnowledgeGraph(hasData);
      if (onGraphDataChange) {
        onGraphDataChange(hasData);
      }
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
    if (!roleModelId || roleModelId === 'default') {
      console.log('有効なロールモデルIDがないため、WebSocketリスナーをセットアップしません');
      return;
    }
    
    console.log(`WebSocketリスナーをセットアップ: roleModelId=${roleModelId}`);
    const socket = initSocket();
    
    // グラフ更新のイベントハンドラ
    const handleGraphUpdate = (data: any) => {
      console.log('ナレッジグラフ更新を受信:', data);
      // roleModelIdが一致するか、data.roleModelIdがundefinedの場合（後方互換性のため）
      if (!data.roleModelId || data.roleModelId === roleModelId) {
        console.log('グラフデータの再取得をトリガー');
        console.log(`更新内容：${data.nodes?.length || 0}ノード、${data.edges?.length || 0}エッジ`);
        fetchGraphData();
      }
    };
    
    // WebSocketの接続状態を確認する関数
    const subscribeToRoleModel = () => {
      if (socket.readyState === WebSocket.OPEN) {
        console.log(`ロールモデル ${roleModelId} を購読`);
        
        // 現在の日時を含めて、キャッシュバスティングを行う
        const timestamp = new Date().getTime();
        sendSocketMessage('subscribe', { 
          roleModelId,
          timestamp,
          clientId: `client-${Math.random().toString(36).substring(2, 9)}`
        });
      } else {
        console.log('WebSocketが開いていません。接続待機中...');
      }
    };
    
    // ソケットの状態に応じて購読を試みる
    if (socket.readyState === WebSocket.OPEN) {
      subscribeToRoleModel();
    }
    
    // 接続イベントのハンドラ
    const handleSocketOpen = () => {
      console.log('WebSocket接続が確立されました。ロールモデルを購読します。');
      subscribeToRoleModel();
    };
    
    // イベントリスナーの登録
    socket.addEventListener('open', handleSocketOpen);
    addSocketListener('knowledge-graph-update', handleGraphUpdate);
    addSocketListener('knowledge_graph_update', handleGraphUpdate); // アンダースコア版も登録
    addSocketListener('graph-update', handleGraphUpdate); // ハイフン版も登録
    
    // 定期的な再接続と購読の確認（5秒ごと）
    const intervalId = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        console.log('WebSocket接続が閉じられています。再接続を試みます。');
        initSocket(); // 再接続
      } else {
        // 接続中に購読状態を確認
        subscribeToRoleModel();
      }
    }, 5000);
    
    return () => {
      // イベントリスナーの解除
      socket.removeEventListener('open', handleSocketOpen);
      removeSocketListener('knowledge-graph-update', handleGraphUpdate);
      removeSocketListener('knowledge_graph_update', handleGraphUpdate);
      removeSocketListener('graph-update', handleGraphUpdate);
      clearInterval(intervalId);
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
      setProgressMessage('ナレッジグラフの生成を開始しています...');
      setAgentMessages([]);
      
      // 生成リクエストを送信
      const response = await fetch(`/api/knowledge-graph/generate/${roleModelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`ナレッジグラフの生成リクエストに失敗しました: ${response.statusText}`);
      }
      
      // WebSocketで進捗が通知されるので、レスポンスは特に処理しない
      
    } catch (err) {
      console.error('ナレッジグラフ生成エラー:', err);
      setProgressMessage(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setGenerating(false);
    }
  }, [roleModelId]);

  // WebSocketから進捗と結果を受信（AI生成中の進捗表示用）
  useEffect(() => {
    if (!roleModelId || !generating) return;
    
    console.log(`[KnowledgeGraphViewer] 進捗リスナーをセットアップ: roleModelId=${roleModelId}`);
    
    // 進捗更新リスナー
    const handleProgress = (data: any) => {
      console.log('Progress update received:', data);
      
      // roleModelIdが一致する場合、またはdata.roleModelIdがundefinedの場合
      const matchesRoleModel = !data.roleModelId || data.roleModelId === roleModelId;
      
      if (matchesRoleModel) {
        console.log(`Progress update for ${roleModelId}:`, data);
        setProgress(data.progress || 0);
        setProgressMessage(data.message || 'Processing...');
        
        // 完了時
        if (data.progress >= 100) {
          console.log('Progress complete, fetching updated graph data');
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
      
      // roleModelIdが一致する場合、またはdata.roleModelIdがundefinedの場合
      const matchesRoleModel = !data.roleModelId || data.roleModelId === roleModelId;
      
      if (matchesRoleModel) {
        console.log(`Agent thoughts for ${roleModelId}:`, data);
        setAgentMessages(prev => [
          ...prev, 
          {
            agent: data.agentName || 'Agent', 
            message: data.thoughts || data.message || 'Working...',
            timestamp: data.timestamp || new Date().toISOString()
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
      console.log('Removed progress and agent_thoughts listeners');
    };
  }, [roleModelId, fetchGraphData, generating]);

  return (
    <div className="flex flex-col w-full" style={{ height }}>
      <div className="flex justify-between items-center mb-1 px-2 py-1 bg-muted/50 rounded-lg">
        <h3 className="text-sm font-semibold">ナレッジグラフビューワー</h3>
        {/* CrewAIボタンはKnowledgeGraphPageに移動しました */}
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
              <Controls 
                position="bottom-left"
                style={{ bottom: 18, left: 12 }}
              />
              <MiniMap
                position="bottom-right"
                style={{ bottom: 12, right: 12 }}
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