import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  ConnectionLineType,
  OnConnect,
  ReactFlowProvider,
  Position,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { KnowledgeNode as BaseKnowledgeNode } from '@shared/schema';
import { ExtendedKnowledgeNode, ReactFlowKnowledgeEdge } from './types';
import { getHierarchicalLayout } from '@/lib/graph-layout';
import { getImprovedHierarchicalLayout, getImprovedLayoutedElements } from '@/lib/improved-graph-layout';
import { initSocket, addSocketListener, removeSocketListener, sendSocketMessage } from '@/lib/socket';
import ConceptNode from './ConceptNode';
import AgentNode from './AgentNode';
import DataFlowEdge from './DataFlowEdge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, ZapIcon, RotateCcw, BoltIcon, Save, Download } from 'lucide-react';
import { CrewAIButton } from './CrewAIButton';
import { useKnowledgeGraphWebSocket } from '../../hooks/use-knowledge-graph-websocket';
import { useMultiAgentWebSocket } from '../../hooks/use-multi-agent-websocket-fixed';
import { NodeEditDialog } from './NodeEditDialog';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNodeOperations } from './NodeOperations';
import { toast, useToast } from '@/hooks/use-toast';
import KnowledgeGraphSavePanel from './KnowledgeGraphSavePanel';


type KnowledgeNode = ExtendedKnowledgeNode;

interface KnowledgeGraphViewerProps {
  roleModelId: string;
  onNodeSelect?: (node: KnowledgeNode) => void;
  width?: string | number;
  height?: string | number;
  onGraphDataChange?: (hasData: boolean) => void;
  onDataStatus?: (hasData: boolean) => void; // 既存のonGraphDataChangeと同様の機能
  autoLoad?: boolean;  // 自動データロードを制御するプロパティ（デフォルトはtrue）
}

// カスタムノードタイプの定義
const nodeTypes = {
  concept: ConceptNode,
  agent: AgentNode,
};

// カスタムエッジタイプの定義
const edgeTypes = {
  dataFlow: DataFlowEdge,
};

const KnowledgeGraphViewer: React.FC<KnowledgeGraphViewerProps> = ({
  roleModelId,
  onNodeSelect,
  width = '100%',
  height = '600px',
  onGraphDataChange,
  onDataStatus,
  autoLoad = true, // デフォルトはtrue（従来の動作を維持）
}) => {
  // useKnowledgeGraphフックを使用してWebSocket通信を行う
  const {
    nodes: websocketNodes,
    edges: websocketEdges,
    loading: wsLoading,
    error: wsError,
    saveGraph: wsSaveGraph,
    loadGraph: wsLoadGraph,
    isUpdating: wsUpdating,
    lastUpdateTime,
    lastUpdateSource,
    requestGraphData // 明示的なグラフデータリクエスト関数を追加
  } = useKnowledgeGraphWebSocket(roleModelId);
  
  // WebSocketコネクション用のカスタムフック
  const { isConnected, sendMessage } = useMultiAgentWebSocket();

  // ReactFlowの状態管理
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasKnowledgeGraph, setHasKnowledgeGraph] = useState<boolean>(false);
  
  // ローディング関連の状態
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [loadingMessages, setLoadingMessages] = useState<{ agent: string, message: string }[]>([]);

  // ノード操作関連の状態
  const [nodeDialog, setNodeDialog] = useState<{
    open: boolean;
    type: 'edit' | 'add-child' | 'add-sibling';
    nodeId: string | null;
    node: KnowledgeNode | null;
  }>({
    open: false,
    type: 'edit',
    nodeId: null,
    node: null
  });
  
  // Undo操作のための履歴スタック
  const [undoStack, setUndoStack] = useState<{
    action: string;
    data: any;
    timestamp: number;
  }[]>([]);
  
  // ダイアログ関連のステート
  const [alertDialog, setAlertDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmAction: () => {},
  });

  // グラフ生成関連のステート
  const [generating, setGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [agentMessages, setAgentMessages] = useState<{agent: string, message: string, timestamp: string}[]>([]);

  // デバッグ情報
  const [debugInfo, setDebugInfo] = useState<any>({});

  // サーバーからグラフデータを取得する関数（デバッグログ追加、エラー処理改善）
  const fetchGraphData = useCallback(async () => {
    try {
      console.log(`[KnowledgeGraphViewer] fetchGraphData実行: roleModelId=${roleModelId}, autoLoad=${autoLoad}`);
      setLoading(true);
      setError(null);
      setLoadingProgress(10); // 進捗表示開始
      
      // ローディングメッセージを初期化
      setLoadingMessages([
        { agent: 'システム', message: 'ナレッジグラフデータをロード中...' },
        { agent: 'データベース', message: 'Neo4jグラフデータベースに接続中...' }
      ]);
      
      console.log('[DEBUG] APIリクエスト実行:', `/api/knowledge-graph/${roleModelId}`);
      const response = await fetch(`/api/knowledge-graph/${roleModelId}`);
      setLoadingProgress(30);
      
      if (!response.ok) {
        if (response.status === 404) {
          // データが存在しない場合は正常に処理
          console.log('グラフデータはまだ存在しません');
          setHasKnowledgeGraph(false);
          if (onGraphDataChange) {
            onGraphDataChange(false);
          }
          if (onDataStatus) {
            onDataStatus(false);
          }
          setLoading(false);
          setLoadingProgress(100);
          return;
        }
        const errorText = await response.text();
        console.error(`API応答エラー (${response.status}):`, errorText);
        throw new Error(`グラフデータの取得に失敗しました: ${response.status} ${response.statusText}`);
      }
      
      // 進捗表示を更新
      setLoadingProgress(50);
      setLoadingMessages(prev => [...prev, { agent: 'システム', message: 'グラフデータの解析中...' }]);
      
      // APIレスポンスをJSONとして解析
      const graphData = await response.json();
      console.log('[DEBUG] 取得したグラフデータ:', graphData);
      
      if (!graphData || !graphData.nodes || !graphData.edges) {
        console.warn('有効なグラフデータが取得できませんでした:', graphData);
        setHasKnowledgeGraph(false);
        if (onGraphDataChange) {
          onGraphDataChange(false);
        }
        if (onDataStatus) {
          onDataStatus(false);
        }
        setLoading(false);
        setLoadingProgress(100);
        return;
      }
      
      // 進捗表示を更新
      setLoadingProgress(70);
      setLoadingMessages(prev => [...prev, 
        { agent: 'データベース', message: `${graphData.nodes.length}個のノードと${graphData.edges.length}個のエッジを取得しました` },
        { agent: 'システム', message: 'ReactFlowコンポーネント用にデータを変換中...' }
      ]);
      
      // デモデータを作成（ノードが0個の場合）
      if (graphData.nodes.length === 0) {
        console.log('[DEBUG] グラフデータが空のため、デモノードを作成');
        
        // この部分は通常実行されないはずですが、APIからデータが取得できない場合のフォールバックとして残しています
        const demoNode = {
          id: 'root',
          name: 'サンプルルートノード',
          description: 'これはサンプルノードです。実際のデータがロードされるとこのノードは置き換えられます。',
          type: 'concept',
          level: 0,
          nodeType: 'root',
          parentId: null,
          roleModelId
        };
        
        graphData.nodes = [demoNode];
        graphData.edges = [];
      }
      
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
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      const graphAreaWidth = viewportWidth - 100; // 余白を考慮
      const graphAreaHeight = viewportHeight - 150; // 余白を考慮
      const centerX = graphAreaWidth / 2;
      const centerY = graphAreaHeight / 3; // 上から1/3の位置に配置
      
      // 階層ごとの設定（よりコンパクトなレイアウト）
      const levelHeight = 180; // 階層間の垂直距離
      const minHorizontalSpacing = 250; // ノード間の水平距離
      
      // カラーマップ（レベルごとに異なる色を割り当て）
      const colorMap = [
        '#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0', 
        '#4895ef', '#560bad', '#480ca8', '#b5179e', '#3f37c9'
      ];
      
      // ノードの初期位置を計算
      const flowNodes: Node[] = graphData.nodes.map((node: any, idx: number) => {
        // レベルとインデックスを取得
        const level = node.level || 0;
        const nodesInThisLevel = nodesByLevel[level] ? nodesByLevel[level].length : 0;
        
        // このレベルでのインデックスを取得
        const index = nodesByLevel[level] ? nodesByLevel[level].indexOf(node) : 0;
        
        // 水平方向の配置計算
        let x = centerX + (idx % 3) * 150; // 簡易的な配置（後でレイアウトアルゴリズムで最適化）
        let y = centerY + Math.floor(idx / 3) * 150; // 簡易的な配置
        
        if (level === 0) {
          // ルートノードは中央上部に配置
          x = centerX;
          y = 100;
        } else if (nodesInThisLevel === 1) {
          // 1つしかない場合は親の下に直接配置
          const parentId = node.parentId;
          const parentNode = parentId ? graphData.nodes.find((n: any) => n.id === parentId) : null;
          if (parentNode) {
            x = centerX;
            y = 100 + level * levelHeight;
          }
        } else if (nodesInThisLevel > 1) {
          // 複数ある場合は均等に配置
          const sectionWidth = Math.max(minHorizontalSpacing * (nodesInThisLevel - 1), 400);
          x = centerX - sectionWidth / 2 + index * (sectionWidth / (nodesInThisLevel - 1));
          y = centerY + level * levelHeight;
        }
        
        // ノードのタイプと階層に基づいて色を設定
        const color = colorMap[level % colorMap.length];
        
        // ReactFlowノードの作成
        return {
          id: node.id,
          type: node.type === 'agent' ? 'agent' : 'concept',
          position: { x, y },
          data: {
            ...node,
            label: node.name || 'No Name',
            color: node.color || color,
            // ノード操作ハンドラを後でプロパティとして追加
            onEdit: (nodeId: string) => {
              console.log(`ノード編集: ${nodeId}`);
              if (typeof handleEditNode === 'function') {
                handleEditNode(nodeId);
              }
            },
            onDelete: (nodeId: string) => {
              console.log(`ノード削除: ${nodeId}`);
              if (typeof handleDeleteNode === 'function') {
                handleDeleteNode(nodeId);
              }
            },
            onAddChild: (nodeId: string) => {
              console.log(`子ノード追加: ${nodeId}`);
              if (typeof handleAddChildNode === 'function') {
                handleAddChildNode(nodeId);
              }
            },
            onAddSibling: (nodeId: string) => {
              console.log(`兄弟ノード追加: ${nodeId}`);
              if (typeof handleAddSiblingNode === 'function') {
                handleAddSiblingNode(nodeId);
              }
            },
            onExpand: (nodeId: string) => {
              console.log(`ノード展開: ${nodeId}`);
              if (typeof handleExpandNode === 'function') {
                handleExpandNode(nodeId);
              }
            },
          },
          style: {
            background: node.color || color,
            borderColor: color,
          },
        };
      });
      
      console.log('[DEBUG] 作成したReactFlowノード:', flowNodes);
      
      // 進捗表示を更新
      setLoadingProgress(80);
      
      // エッジデータのチェックと修正
      const validEdges = graphData.edges.filter((edge: any) => {
        // sourceとtargetが存在するノードを参照しているか確認
        const sourceExists = flowNodes.some(node => node.id === edge.source || node.id === edge.sourceId);
        const targetExists = flowNodes.some(node => node.id === edge.target || node.id === edge.targetId);
        
        if (!sourceExists || !targetExists) {
          console.warn('無効なエッジをスキップします:', edge);
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
        const edgeId = edge.id || edgeKey + '-' + Date.now().toString(36).substr(-6);
        
        // 重複がない場合だけ追加（後から来たエッジで上書き）
        edgeMap.set(edgeKey, {
          id: edgeId,
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
      
      console.log('[DEBUG] 作成したReactFlowエッジ:', flowEdges);
      
      // 進捗表示を更新
      setLoadingProgress(90);
      setLoadingMessages(prev => [...prev, { agent: 'システム', message: 'レイアウト最適化を適用中...' }]);
      
      // グラフの種類に応じてレイアウト方法を選択
      // 階層情報の分析
      const hasHierarchy = flowNodes.some(node => node.data && typeof node.data.level === 'number');
      const hasMultipleLevels = new Set(flowNodes.map(node => node.data?.level || 0)).size > 1;
      const isComplex = flowNodes.length > 5 || flowEdges.length > 10;
      
      // 最適なレイアウトを選択
      const useHierarchicalLayout = hasHierarchy && (hasMultipleLevels || isComplex);
      
      console.log(`[DEBUG] グラフ分析: ノード数=${flowNodes.length}, エッジ数=${flowEdges.length}, 階層あり=${hasHierarchy}, 複数レベル=${hasMultipleLevels}, 複雑=${isComplex}`);
      
      // 実際にレイアウトアルゴリズムを適用し、ノードとエッジを配置
      let layoutedNodes, layoutedEdges;
      
      if (!useHierarchicalLayout || flowNodes.length <= 2) {
        // シンプルなグラフや階層が単一の場合は基本レイアウトを使用
        console.log('[DEBUG] シンプルなグラフに標準レイアウトを使用');
        
        const result = getImprovedLayoutedElements(
          flowNodes,
          flowEdges,
          { 
            direction: 'TB', // Top to Bottom
            nodesep: 150,    // ノード間の水平距離
            ranksep: 150,    // 階層間の垂直距離
            marginx: 30,
            marginy: 50
          }
        );
        
        layoutedNodes = result.nodes;
        layoutedEdges = result.edges;
      } else {
        // 複雑なグラフには階層的レイアウトを使用
        console.log('[DEBUG] 複雑なグラフに階層的レイアウトを使用');
        
        const result = getImprovedHierarchicalLayout(flowNodes, flowEdges);
        layoutedNodes = result.nodes;
        layoutedEdges = result.edges;
      }
      
      console.log('[DEBUG] レイアウト適用後のノード:', layoutedNodes);
      console.log('[DEBUG] レイアウト適用後のエッジ:', layoutedEdges);
      
      // フォールバック: レイアウトエンジンが失敗した場合、元のノード・エッジをそのまま使用
      if (!layoutedNodes || layoutedNodes.length === 0) {
        console.warn('レイアウトエンジンが失敗しました。元のノード配置を使用します。');
        layoutedNodes = flowNodes;
        layoutedEdges = flowEdges;
      }
      
      // ReactFlowのステートを更新
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      
      // ローディング完了
      setLoading(false);
      setLoadingProgress(100);
      
      // ナレッジグラフが存在することを通知
      const hasData = layoutedNodes.length > 0;
      setHasKnowledgeGraph(hasData);
      if (onGraphDataChange) {
        onGraphDataChange(hasData);
      }
      if (onDataStatus) {
        onDataStatus(hasData);
      }
      
      console.log('[DEBUG] ナレッジグラフの読み込み完了:', hasData ? '成功' : '空グラフ');
    } catch (err) {
      console.error('グラフデータの取得エラー:', err);
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
      setLoading(false);
      setLoadingProgress(100);
      // エラー発生時も状態更新
      setHasKnowledgeGraph(false);
      if (onGraphDataChange) {
        onGraphDataChange(false);
      }
      if (onDataStatus) {
        onDataStatus(false);
      }
    }
  }, [roleModelId, autoLoad, onGraphDataChange, onDataStatus]);

  // 初期ナレッジグラフの存在確認
  useEffect(() => {
    // autoLoadが無効の場合は処理をスキップ
    if (autoLoad === false) {
      console.log('自動データロードが無効になっています - ナレッジグラフの確認をスキップします');
      return;
    }
    
    // ナレッジグラフが存在するか確認
    const checkKnowledgeGraphExists = async () => {
      try {
        const response = await fetch(`/api/knowledge-graph/${roleModelId}/exists`);
        if (response.ok) {
          const data = await response.json();
          console.log('ナレッジグラフ存在確認結果:', data);
          
          // データが存在する場合、完全データを取得
          if (data.exists) {
            await fetchGraphData();
          } else {
            // データが存在しない場合は適切に状態を更新
            setHasKnowledgeGraph(false);
            setLoading(false);
            
            if (onGraphDataChange) {
              onGraphDataChange(false);
            }
            if (onDataStatus) {
              onDataStatus(false);
            }
          }
        } else {
          console.error('ナレッジグラフ存在確認エラー:', response.statusText);
          setLoading(false);
          // エラー発生時も状態更新
          setHasKnowledgeGraph(false);
          
          if (onGraphDataChange) {
            onGraphDataChange(false);
          }
          if (onDataStatus) {
            onDataStatus(false);
          }
        }
      } catch (err) {
        console.error('ナレッジグラフ存在確認中にエラーが発生しました:', err);
        setLoading(false);
        setHasKnowledgeGraph(false);
        
        if (onGraphDataChange) {
          onGraphDataChange(false);
        }
        if (onDataStatus) {
          onDataStatus(false);
        }
      }
    };
    
    checkKnowledgeGraphExists();
  }, [roleModelId, fetchGraphData, onGraphDataChange, onDataStatus, autoLoad]);

  // ノード編集ダイアログを開く
  const handleEditNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setNodeDialog({
        open: true,
        type: 'edit',
        nodeId: nodeId,
        node: node.data as KnowledgeNode
      });
    }
  }, [nodes]);

  // 子ノード追加ダイアログを開く
  const handleAddChildNode = useCallback((parentId: string) => {
    setNodeDialog({
      open: true,
      type: 'add-child',
      nodeId: parentId,
      node: null
    });
  }, []);

  // 兄弟ノード追加ダイアログを開く
  const handleAddSiblingNode = useCallback((siblingId: string) => {
    setNodeDialog({
      open: true,
      type: 'add-sibling',
      nodeId: siblingId,
      node: null
    });
  }, []);

  // ノード削除処理
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    // ノード削除の確認ダイアログを表示
    setAlertDialog({
      open: true,
      title: 'ノードの削除',
      message: 'このノードとその子ノードをすべて削除します。この操作は元に戻せません。続行しますか？',
      confirmAction: async () => {
        if (!nodeId) return;
        
        try {
          // 削除前の状態をUndoスタックに保存
          setUndoStack(prev => [
            ...prev,
            {
              action: 'deleteNode',
              data: {
                nodeId,
                nodes: [...nodes],
                edges: [...edges]
              },
              timestamp: Date.now()
            }
          ]);
          
          // ノードとその子孫を特定
          const nodeToDelete = nodes.find(n => n.id === nodeId);
          if (!nodeToDelete) {
            console.error('削除するノードが見つかりません:', nodeId);
            return;
          }
          
          // 子孫ノードのIDをすべて収集する関数
          const findDescendants = (parentId: string, allNodes: Node[]): string[] => {
            const directChildren = allNodes.filter(n => n.data?.parentId === parentId).map(n => n.id);
            let descendants = [...directChildren];
            
            for (const childId of directChildren) {
              descendants = [...descendants, ...findDescendants(childId, allNodes)];
            }
            
            return descendants;
          };
          
          // 削除対象のノードIDを特定
          const descendants = findDescendants(nodeId, nodes);
          const nodesToDelete = [nodeId, ...descendants];
          
          console.log('削除対象ノード:', nodesToDelete);
          
          // 削除対象のノードに接続されているエッジをすべて取得
          const edgesToDelete = edges.filter(edge => 
            nodesToDelete.includes(edge.source) || nodesToDelete.includes(edge.target)
          );
          
          // APIでノードを削除
          const response = await fetch(`/api/knowledge-graph/${roleModelId}/nodes/${nodeId}`, {
            method: 'DELETE'
          });
          
          if (response.ok) {
            // UI上でノードを削除（残りのノードを取得）
            const remainingNodes = nodes.filter(node => !nodesToDelete.includes(node.id));
            const remainingEdges = edges.filter(edge => 
              !nodesToDelete.includes(edge.source) && !nodesToDelete.includes(edge.target)
            );
            
            // ステートを更新
            setNodes(remainingNodes);
            setEdges(remainingEdges);
            
            // 成功メッセージを表示
            toast({
              title: 'ノードを削除しました',
              description: `${nodesToDelete.length}個のノードと${edgesToDelete.length}個の接続が削除されました`,
              variant: 'default',
            });
          } else {
            console.error('ノード削除APIエラー:', await response.text());
            toast({
              title: 'ノード削除エラー',
              description: '削除処理中にエラーが発生しました。再試行してください。',
              variant: 'destructive',
            });
          }
        } catch (error) {
          console.error('ノード削除処理エラー:', error);
          toast({
            title: 'エラー',
            description: 'ノードの削除中にエラーが発生しました',
            variant: 'destructive',
          });
        }
      }
    });
  }, [nodes, edges, roleModelId]);

  // ノード展開処理
  const handleExpandNode = useCallback(async (nodeId: string) => {
    try {
      // ノードを特定
      const node = nodes.find(n => n.id === nodeId);
      if (!node) {
        console.error('展開するノードが見つかりません:', nodeId);
        return;
      }
      
      // ノードの色に基づいて、展開されるノードの色を決定
      const getNodeTypeColor = (type: string) => {
        switch (type) {
          case 'concept': return '#47c1ff';
          case 'keyword': return '#77dd77';
          case 'task': return '#ff6961';
          case 'question': return '#fdfd96';
          case 'info': return '#b19cd9';
          default: return '#47c1ff';
        }
      };
      
      // 元に戻すためのデータをスタックに保存
      const handleUndo = useCallback(async () => {
        if (undoStack.length === 0) return;
        
        const lastAction = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1)); // 最後の要素を削除
        
        try {
          if (lastAction.action === 'deleteNode') {
            // 削除されたノードを復元
            setNodes(lastAction.data.nodes);
            setEdges(lastAction.data.edges);
            
            toast({
              title: '操作を元に戻しました',
              description: 'ノード削除操作が取り消されました',
              variant: 'default',
            });
          } else if (lastAction.action === 'addNodes') {
            // 追加されたノードを削除
            const nodesToKeep = nodes.filter(n => !lastAction.data.addedNodeIds.includes(n.id));
            const edgesToKeep = edges.filter(e => 
              !lastAction.data.addedNodeIds.includes(e.source) && 
              !lastAction.data.addedNodeIds.includes(e.target)
            );
            
            setNodes(nodesToKeep);
            setEdges(edgesToKeep);
            
            toast({
              title: '操作を元に戻しました',
              description: 'ノード追加操作が取り消されました',
              variant: 'default',
            });
          }
        } catch (error) {
          console.error('Undo処理エラー:', error);
          toast({
            title: 'エラー',
            description: '操作を元に戻せませんでした',
            variant: 'destructive',
          });
        }
      }, [undoStack, nodes, edges]);
      
      // キーボードショートカットを設定
      useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
          // Ctrl+Z (Windows) or Command+Z (Mac)
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            handleUndo();
          }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => {
          window.removeEventListener('keydown', handleKeyDown);
        };
      }, [handleUndo]);
      
      setUndoStack(prev => [
        ...prev,
        {
          action: 'addNodes',
          data: {
            parentNodeId: nodeId,
            addedNodeIds: [] // 後で追加されるノードのIDで更新
          },
          timestamp: Date.now()
        }
      ]);
      
      // APIで関連ノードを取得
      const response = await fetch(`/api/knowledge-graph/${roleModelId}/nodes/${nodeId}/expand`);
      
      if (response.ok) {
        const { relatedNodes, relatedEdges } = await response.json();
        
        if (!relatedNodes || relatedNodes.length === 0) {
          toast({
            title: '関連ノードがありません',
            description: 'このノードに関連するノードは見つかりませんでした',
            variant: 'default',
          });
          return;
        }
        
        console.log('取得した関連ノード:', relatedNodes);
        console.log('取得した関連エッジ:', relatedEdges);
        
        // 新しいノードとエッジを既存のものとマージ
        const existingNodeIds = nodes.map(n => n.id);
        
        // 新しいノードのみをフィルタリング
        const newNodes = relatedNodes.filter((rNode: any) => !existingNodeIds.includes(rNode.id));
        
        // 追加されたノードのIDを記録
        const addedNodeIds = newNodes.map((n: any) => n.id);
        
        // UndoスタックのデータをこれらのIDで更新
        setUndoStack(prev => {
          const newStack = [...prev];
          const lastAction = newStack[newStack.length - 1];
          if (lastAction && lastAction.action === 'addNodes') {
            lastAction.data.addedNodeIds = addedNodeIds;
          }
          return newStack;
        });
        
        // レベルを計算（親ノードのレベル + 1）
        const parentLevel = node.data?.level || 0;
        const childLevel = parentLevel + 1;
        
        // 新しいノードをReactFlowノードに変換
        const flowNodes = newNodes.map((rNode: any, idx: number) => {
          // 親ノードの位置を基準に配置
          const parentPos = node.position;
          const angleStep = (2 * Math.PI) / newNodes.length;
          const radius = 200; // 円の半径
          const angle = angleStep * idx;
          
          const x = parentPos.x + radius * Math.cos(angle);
          const y = parentPos.y + radius * Math.sin(angle);
          
          // ノードタイプに基づいて色を設定
          const color = getNodeTypeColor(rNode.nodeType || 'concept');
          
          return {
            id: rNode.id,
            type: rNode.type === 'agent' ? 'agent' : 'concept',
            position: { x, y },
            data: {
              ...rNode,
              label: rNode.name,
              color: rNode.color || color,
              level: childLevel,
              parentId: nodeId,
              onEdit: (id: string) => handleEditNode(id),
              onDelete: (id: string) => handleDeleteNode(id),
              onAddChild: (id: string) => handleAddChildNode(id),
              onAddSibling: (id: string) => handleAddSiblingNode(id),
              onExpand: (id: string) => handleExpandNode(id),
            },
            style: {
              background: rNode.color || color,
              borderColor: color,
            }
          };
        });
        
        // エッジの処理
        const existingEdgeKeys = new Set(edges.map(e => `${e.source}-${e.target}`));
        const newEdges = relatedEdges
          .filter((edge: any) => {
            const sourceExists = [...existingNodeIds, ...addedNodeIds].includes(edge.source || edge.sourceId);
            const targetExists = [...existingNodeIds, ...addedNodeIds].includes(edge.target || edge.targetId);
            return sourceExists && targetExists;
          })
          .map((edge: any) => {
            const source = edge.sourceId || edge.source;
            const target = edge.targetId || edge.target;
            const edgeKey = `${source}-${target}`;
            
            // 既存のエッジと重複しないようにする
            if (existingEdgeKeys.has(edgeKey)) {
              return null;
            }
            
            return {
              id: edge.id || `${edgeKey}-${Date.now().toString(36).substr(-6)}`,
              source,
              target,
              type: 'dataFlow',
              animated: edge.type === 'data-flow',
              label: edge.label || '',
              data: {
                strength: edge.strength || 1,
              },
            };
          })
          .filter(Boolean); // nullをフィルタリング
        
        // ノードとエッジを更新
        setNodes(prevNodes => [...prevNodes, ...flowNodes]);
        setEdges(prevEdges => [...prevEdges, ...newEdges]);
        
        // 成功メッセージを表示
        toast({
          title: 'ノードを展開しました',
          description: `${flowNodes.length}個の関連ノードを追加しました`,
          variant: 'default',
        });
      } else {
        console.error('ノード展開APIエラー:', await response.text());
        toast({
          title: 'ノード展開エラー',
          description: '関連ノードの取得中にエラーが発生しました',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('ノード展開処理エラー:', error);
      toast({
        title: 'エラー',
        description: 'ノードの展開中にエラーが発生しました',
        variant: 'destructive',
      });
    }
  }, [nodes, edges, roleModelId, undoStack, handleEditNode, handleDeleteNode, handleAddChildNode, handleAddSiblingNode]);

  // ノードクリック処理
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      console.log('ノードクリック:', node);
      
      // ノード選択コールバックがある場合は実行
      if (onNodeSelect) {
        const nodeData = node.data as KnowledgeNode;
        onNodeSelect(nodeData);
      }
    },
    [onNodeSelect]
  );

  // ノード変更ハンドラ
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  // エッジ変更ハンドラ
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  // 接続ハンドラ
  const handleConnect: OnConnect = useCallback(
    (connection) => {
      console.log('新しい接続:', connection);
      // 接続をステートに追加
      setEdges((eds) => {
        const newEdge = {
          id: `${connection.source}-${connection.target}-${Date.now().toString(36).substr(-6)}`,
          source: connection.source,
          target: connection.target,
          type: 'dataFlow',
          animated: true,
          data: { strength: 1 },
        };
        return [...eds, newEdge];
      });
    },
    [setEdges]
  );

  // ノード保存ハンドラ
  const handleNodeSave = useCallback(async (data: { name: string; description: string; nodeType: string }) => {
    console.log('ノード保存:', data, nodeDialog);
    
    try {
      if (nodeDialog.type === 'edit' && nodeDialog.nodeId) {
        // 既存ノードの編集
        const nodeId = nodeDialog.nodeId;
        const updatedNode = {
          ...nodeDialog.node,
          name: data.name,
          description: data.description,
          nodeType: data.nodeType
        };
        
        // APIでノードを更新
        const response = await fetch(`/api/knowledge-graph/${roleModelId}/nodes/${nodeId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedNode),
        });
        
        if (response.ok) {
          // UI上のノードを更新
          setNodes(nodes.map(node => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  name: data.name,
                  description: data.description,
                  nodeType: data.nodeType,
                  label: data.name, // ラベルも更新
                }
              };
            }
            return node;
          }));
          
          toast({
            title: 'ノードを更新しました',
            description: `"${data.name}" ノードが更新されました`,
            variant: 'default',
          });
        } else {
          const errorText = await response.text();
          console.error('ノード更新APIエラー:', errorText);
          toast({
            title: 'ノード更新エラー',
            description: '保存中にエラーが発生しました',
            variant: 'destructive',
          });
        }
      } else if (nodeDialog.type === 'add-child' && nodeDialog.nodeId) {
        // 子ノードの追加
        const parentId = nodeDialog.nodeId;
        const parentNode = nodes.find(n => n.id === parentId);
        
        if (!parentNode) {
          console.error('親ノードが見つかりません:', parentId);
          return;
        }
        
        const parentLevel = parentNode.data?.level || 0;
        const parentPos = parentNode.position;
        
        // 新しいノードのデータ
        const newNodeData = {
          name: data.name,
          description: data.description,
          nodeType: data.nodeType,
          parentId: parentId,
          roleModelId: roleModelId,
          level: parentLevel + 1,
        };
        
        // APIで新しいノードを作成
        const response = await fetch(`/api/knowledge-graph/${roleModelId}/nodes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newNodeData),
        });
        
        if (response.ok) {
          const newNode = await response.json();
          console.log('作成されたノード:', newNode);
          
          // ノードの色を決定
          const color = '#47c1ff'; // 基本色
          
          // UI上に新しいノードを追加
          const flowNode = {
            id: newNode.id,
            type: 'concept',
            position: {
              x: parentPos.x + (Math.random() - 0.5) * 200,
              y: parentPos.y + 150
            },
            data: {
              ...newNode,
              label: data.name,
              color,
              onEdit: (id: string) => handleEditNode(id),
              onDelete: (id: string) => handleDeleteNode(id),
              onAddChild: (id: string) => handleAddChildNode(id),
              onAddSibling: (id: string) => handleAddSiblingNode(id),
              onExpand: (id: string) => handleExpandNode(id),
            },
            style: {
              background: color,
              borderColor: color,
            }
          };
          
          // 新しいエッジを作成
          const newEdge = {
            id: `${parentId}-${newNode.id}-${Date.now().toString(36).substr(-6)}`,
            source: parentId,
            target: newNode.id,
            type: 'dataFlow',
            animated: true,
            data: { strength: 1 },
          };
          
          // ステートを更新
          setNodes(prevNodes => [...prevNodes, flowNode]);
          setEdges(prevEdges => [...prevEdges, newEdge]);
          
          toast({
            title: '子ノードを追加しました',
            description: `"${data.name}" が親ノードの下に追加されました`,
            variant: 'default',
          });
        } else {
          const errorText = await response.text();
          console.error('ノード作成APIエラー:', errorText);
          toast({
            title: 'ノード作成エラー',
            description: '子ノードの追加中にエラーが発生しました',
            variant: 'destructive',
          });
        }
      } else if (nodeDialog.type === 'add-sibling' && nodeDialog.nodeId) {
        // 兄弟ノードの追加
        const siblingId = nodeDialog.nodeId;
        const siblingNode = nodes.find(n => n.id === siblingId);
        
        if (!siblingNode) {
          console.error('兄弟ノードが見つかりません:', siblingId);
          return;
        }
        
        const parentId = siblingNode.data?.parentId;
        const siblingLevel = siblingNode.data?.level || 0;
        const siblingPos = siblingNode.position;
        
        // 新しいノードのデータ
        const newNodeData = {
          name: data.name,
          description: data.description,
          nodeType: data.nodeType,
          parentId: parentId, // 同じ親を持つ
          roleModelId: roleModelId,
          level: siblingLevel, // 同じレベル
        };
        
        // APIで新しいノードを作成
        const response = await fetch(`/api/knowledge-graph/${roleModelId}/nodes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newNodeData),
        });
        
        if (response.ok) {
          const newNode = await response.json();
          console.log('作成された兄弟ノード:', newNode);
          
          // ノードの色を決定
          const color = '#47c1ff'; // 基本色
          
          // UI上に新しいノードを追加
          const flowNode = {
            id: newNode.id,
            type: 'concept',
            position: {
              x: siblingPos.x + 200, // 兄弟の右側に配置
              y: siblingPos.y
            },
            data: {
              ...newNode,
              label: data.name,
              color,
              onEdit: (id: string) => handleEditNode(id),
              onDelete: (id: string) => handleDeleteNode(id),
              onAddChild: (id: string) => handleAddChildNode(id),
              onAddSibling: (id: string) => handleAddSiblingNode(id),
              onExpand: (id: string) => handleExpandNode(id),
            },
            style: {
              background: color,
              borderColor: color,
            }
          };
          
          // 親が存在する場合は親からのエッジも追加
          let newEdges = [];
          if (parentId) {
            const newEdge = {
              id: `${parentId}-${newNode.id}-${Date.now().toString(36).substr(-6)}`,
              source: parentId,
              target: newNode.id,
              type: 'dataFlow',
              animated: true,
              data: { strength: 1 },
            };
            newEdges.push(newEdge);
          }
          
          // ステートを更新
          setNodes(prevNodes => [...prevNodes, flowNode]);
          setEdges(prevEdges => [...prevEdges, ...newEdges]);
          
          toast({
            title: '兄弟ノードを追加しました',
            description: `"${data.name}" が同じレベルに追加されました`,
            variant: 'default',
          });
        } else {
          const errorText = await response.text();
          console.error('ノード作成APIエラー:', errorText);
          toast({
            title: 'ノード作成エラー',
            description: '兄弟ノードの追加中にエラーが発生しました',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('ノード保存処理エラー:', error);
      toast({
        title: 'エラー',
        description: 'ノードの保存中にエラーが発生しました',
        variant: 'destructive',
      });
    } finally {
      // ダイアログを閉じる
      setNodeDialog(prev => ({ ...prev, open: false }));
    }
  }, [nodeDialog, nodes, roleModelId, handleEditNode, handleDeleteNode, handleAddChildNode, handleAddSiblingNode, handleExpandNode]);

  // CrewAIを使ったグラフ生成
  const startGraphGeneration = useCallback(async () => {
    if (!roleModelId || !generating) return;
    
    try {
      setGenerating(true);
      setProgress(0);
      setProgressMessage('開始中...');
      setAgentMessages([]);
      
      // 進捗更新ハンドラ
      const handleProgress = (data: any) => {
        console.log('グラフ生成進捗:', data);
        
        if (data && typeof data.progress === 'number') {
          setProgress(data.progress);
        }
        
        if (data && data.message) {
          setProgressMessage(data.message);
        }
      };
      
      // エージェント思考プロセス処理ハンドラ
      const handleAgentThoughts = (data: any) => {
        if (data && data.agent && data.message) {
          console.log(`エージェント思考 (${data.agent}):`, data.message);
          
          // 新しいメッセージを追加
          setAgentMessages(prev => [
            ...prev,
            {
              agent: data.agent,
              message: data.message,
              timestamp: data.timestamp || new Date().toISOString()
            }
          ]);
        }
      };
      
      // WebSocketイベントリスナーを設定
      addSocketListener('knowledgeGraphProgress', handleProgress);
      addSocketListener('agentThoughts', handleAgentThoughts);
      
      // APIリクエストを送信
      const response = await fetch(`/api/knowledge-graph/${roleModelId}/generate`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('グラフ生成APIエラー: ' + response.statusText);
      }
      
      const result = await response.json();
      console.log('グラフ生成開始結果:', result);
      
      // ユーザーに通知
      toast({
        title: 'グラフ生成開始',
        description: '生成処理を開始しました。完了までしばらくお待ちください。',
        variant: 'default',
      });
      
      // 生成完了を検出するためのポーリング
      const checkInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/knowledge-graph/${roleModelId}/generation-status`);
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            if (statusData.status === 'completed') {
              clearInterval(checkInterval);
              
              // 生成が完了したらグラフを読み込む
              await fetchGraphData();
              
              // 生成状態をリセット
              setGenerating(false);
              setProgress(100);
              setProgressMessage('完了しました');
              
              // 完了通知
              toast({
                title: 'グラフ生成完了',
                description: 'ナレッジグラフが正常に生成されました',
                variant: 'default',
              });
            } else if (statusData.status === 'failed') {
              clearInterval(checkInterval);
              setGenerating(false);
              
              // エラー通知
              toast({
                title: 'グラフ生成失敗',
                description: statusData.error || '生成中にエラーが発生しました',
                variant: 'destructive',
              });
            }
          }
        } catch (err) {
          console.error('生成状態チェックエラー:', err);
        }
      }, 5000); // 5秒ごとにチェック
      
      // クリーンアップ関数
      return () => {
        clearInterval(checkInterval);
        removeSocketListener('knowledgeGraphProgress', handleProgress);
        removeSocketListener('agentThoughts', handleAgentThoughts);
      };
    } catch (error) {
      console.error('グラフ生成エラー:', error);
      setGenerating(false);
      
      toast({
        title: 'グラフ生成エラー',
        description: error instanceof Error ? error.message : '不明なエラーが発生しました',
        variant: 'destructive',
      });
    }
  }, [roleModelId, generating, fetchGraphData]);

  return (
    <div className="flex flex-col w-full h-full" style={{ height: '100%' }}>
      <div className="flex justify-between items-center mb-1 px-2 py-1 bg-muted/50 rounded-lg">
        <h3 className="text-sm font-semibold">ナレッジグラフビューワー</h3>
        
        <div className="flex space-x-2">
          {hasKnowledgeGraph && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={async () => {
                      try {
                        const snapshotName = `手動保存 - ${new Date().toLocaleString('ja-JP')}`;
                        const response = await fetch(`/api/knowledge-graph/${roleModelId}/snapshots`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({
                            name: snapshotName,
                            description: '手動で保存されたグラフ'
                          }),
                        });
                        
                        if (response.ok) {
                          // 成功メッセージ
                          alert('グラフが保存されました');
                        } else {
                          const errorData = await response.json();
                          console.error('保存エラー:', errorData);
                          alert('保存に失敗しました');
                        }
                      } catch (error) {
                        console.error('保存中にエラーが発生しました:', error);
                        alert('保存処理中にエラーが発生しました');
                      }
                    }}
                  >
                    保存
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>現在のグラフをスナップショットとして保存します</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* CrewAIボタンはKnowledgeGraphPageに移動しました */}
        </div>
      </div>
      
      {/* デバッグ情報表示エリア */}
      <div className="w-full mb-2 p-2 bg-yellow-50 rounded-md border border-yellow-200 text-xs overflow-auto" style={{ maxHeight: '350px' }}>
        <h4 className="font-bold">デバッグ情報:</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p><strong>RoleModelID:</strong> {roleModelId}</p>
            <p><strong>WebSocket接続状態:</strong> {isConnected ? '接続済み' : '未接続'}</p>
            <p><strong>WebSocketステータス:</strong> {wsLoading ? "読込中" : wsError ? "エラー" : "接続済み"}</p>
          </div>
          <div>
            <p><strong>ノード数:</strong> {nodes.length} (WebSocket: {websocketNodes.length})</p>
            <p><strong>エッジ数:</strong> {edges.length} (WebSocket: {websocketEdges.length})</p>
            <p><strong>ロード状態:</strong> {loading ? `読込中 (${loadingProgress}%)` : '完了'}</p>
            <p><strong>グラフ存在:</strong> {hasKnowledgeGraph ? 'あり' : 'なし'}</p>
          </div>
        </div>
        <div className="mt-1">
          <p><strong>エラー:</strong> {error || 'なし'}</p>
          <p><strong>最終更新:</strong> {lastUpdateTime ? new Date(lastUpdateTime).toLocaleString() : 'なし'}</p>
          <p><strong>更新元:</strong> {lastUpdateSource || 'なし'}</p>
        </div>
        <pre className="mt-1 text-xs bg-gray-100 p-1 rounded overflow-auto">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>

        {/* WebSocketから受け取ったノードのサンプル */}
        {websocketNodes.length > 0 && (
          <div className="mt-1">
            <p><strong>WebSocketノードサンプル:</strong></p>
            <pre className="bg-gray-100 p-1 rounded overflow-auto" style={{ maxHeight: '100px' }}>
              {JSON.stringify(websocketNodes[0], null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      <div className="flex-1">
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
                onClick={requestGraphData}
              >
                再試行
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 h-full" style={{ height: 'calc(100% - 36px)', width: '100%', minHeight: '500px', position: 'relative' }}>
            <ReactFlowProvider>
              <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                <ReactFlow
                  style={{ height: '100%', width: '100%' }}
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
                  onNodeContextMenu={(e, node) => {
                    // コンテキストメニューは各ノードコンポーネント内で処理
                    e.preventDefault();
                  }}
                  defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                >
                  <Background color="#aaa" gap={16} />
                  <Controls 
                    position="bottom-left"
                    style={{ bottom: 42, left: 12 }}
                  />
                  <MiniMap
                    position="bottom-right"
                    style={{ bottom: 28, right: 12 }}
                    nodeStrokeWidth={3}
                    nodeColor={(node) => {
                      return node.data?.color || '#1a192b';
                    }}
                  />
                  
                  {/* グラフ保存パネル */}
                  <Panel position="top-right" style={{ right: 10, top: 10 }}>
                    <KnowledgeGraphSavePanel 
                      roleModelId={roleModelId} 
                      onSaveSuccess={requestGraphData}
                    />
                  </Panel>
                  
                  {/* 元に戻すボタン - Undoスタックに操作がある場合のみ表示 */}
                  {undoStack.length > 0 && (
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: 10, 
                        left: 10, 
                        zIndex: 10 
                      }}
                      className="bg-white dark:bg-gray-800 shadow-md rounded-md p-1"
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={handleUndo}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>元に戻す (Ctrl+Z)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </ReactFlow>
              </div>
            </ReactFlowProvider>
            
            {/* ノード編集ダイアログ */}
            <NodeEditDialog
              open={nodeDialog.open}
              onOpenChange={(open) => setNodeDialog(prev => ({ ...prev, open }))}
              type={nodeDialog.type}
              node={nodeDialog.node}
              onSave={handleNodeSave}
            />
            
            {/* アラートダイアログ */}
            <AlertDialog 
              open={alertDialog.open} 
              onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogDescription>
                  {alertDialog.message}
                </AlertDialogDescription>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={alertDialog.confirmAction}>
                    確認
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraphViewer;