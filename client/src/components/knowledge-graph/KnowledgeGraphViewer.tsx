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
import { Loader2, ZapIcon, RotateCcw, BoltIcon, FlaskConical, Save, Download } from 'lucide-react';
import { CrewAIButton } from './CrewAIButton';
import { useKnowledgeGraph } from '../../hooks/use-knowledge-graph-websocket';
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
  } = useKnowledgeGraph(roleModelId);
  
  // WebSocketコネクション用のカスタムフック
  const { isConnected, sendMessage } = useMultiAgentWebSocket();

  // ReactFlowの状態管理
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasKnowledgeGraph, setHasKnowledgeGraph] = useState<boolean>(false);

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

  // サーバーからグラフデータを取得
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/knowledge-graph/${roleModelId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // データが存在しない場合は正常に処理
          console.log('グラフデータはまだ存在しません');
          setHasKnowledgeGraph(false);
          if (onGraphDataChange) {
            onGraphDataChange(false);
          }
          setLoading(false);
          return;
        }
        throw new Error(`グラフデータの取得に失敗しました: ${response.statusText}`);
      }
      
      const graphData = await response.json();
      
      if (!graphData || !graphData.nodes || !graphData.edges) {
        setHasKnowledgeGraph(false);
        if (onGraphDataChange) {
          onGraphDataChange(false);
        }
        setLoading(false);
        return;
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
      
      // 階層ごとの設定（よりコンパクトなレイアウト）
      const levelHeight = 180; // 階層間の垂直距離を縮小
      const minHorizontalSpacing = 220; // ノード間の水平距離を縮小
      
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
            // ノード操作ハンドラを追加
            onEdit: handleEditNode,
            onDelete: handleDeleteNode,
            onAddChild: handleAddChildNode,
            onAddSibling: handleAddSiblingNode,
            onExpand: handleExpandNode,
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
            nodesep: 120, // コンパクトなスペース
            ranksep: 150, // コンパクトなスペース
            marginx: 30,
            marginy: 50
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
  }, [roleModelId]);

  // 初期ナレッジグラフの存在確認
  useEffect(() => {
    // ナレッジグラフが存在するか確認
    const checkKnowledgeGraphExists = async () => {
      try {
        const response = await fetch(`/api/knowledge-graph/${roleModelId}/exists`);
        if (response.ok) {
          const { exists } = await response.json();
          setHasKnowledgeGraph(exists);
          if (onGraphDataChange) {
            onGraphDataChange(exists);
          }
        }
      } catch (error) {
        console.error('ナレッジグラフ確認エラー:', error);
      }
    };
    
    checkKnowledgeGraphExists();
  }, [roleModelId, onGraphDataChange]);

  // ノード操作ユーティリティのセットアップ
  const nodeOperations = useNodeOperations(roleModelId, fetchGraphData, setUndoStack);
  
  // ノード操作ダイアログを開く
  const openNodeDialog = useCallback((type: 'edit' | 'add-child' | 'add-sibling', nodeId: string) => {
    const node = nodes.find((n: Node) => n.id === nodeId)?.data as KnowledgeNode | undefined;
    setNodeDialog({
      open: true,
      type,
      nodeId,
      node: node || null
    });
  }, [nodes]);
  
  // ノード編集
  const handleEditNode = useCallback((nodeId: string) => {
    openNodeDialog('edit', nodeId);
  }, [openNodeDialog]);
  
  // 子ノード追加
  const handleAddChildNode = useCallback((parentId: string) => {
    openNodeDialog('add-child', parentId);
  }, [openNodeDialog]);
  
  // 兄弟ノード追加
  const handleAddSiblingNode = useCallback((siblingId: string) => {
    openNodeDialog('add-sibling', siblingId);
  }, [openNodeDialog]);
  
  // ノード削除
  const handleDeleteNode = useCallback(async (nodeId: string) => {
    // 確認ダイアログ表示
    setAlertDialog({
      open: true,
      title: 'ノードの削除確認',
      message: 'このノードを削除してもよろしいですか？子ノードもすべて削除されます。',
      confirmAction: async () => {
        try {
          // GraphQLから全データ取得（Undo用に保存するため）
          const graphData = await fetch(`/api/knowledge-graph/${roleModelId}`).then(r => r.json());
          
          // 削除対象のノードとその子孫を特定
          const nodeToDelete = graphData.nodes.find((n: any) => n.id === nodeId);
          if (!nodeToDelete) {
            throw new Error('削除対象のノードが見つかりません');
          }
          
          // 削除リクエスト
          const response = await fetch(`/api/knowledge-nodes/${nodeId}`, {
            method: 'DELETE',
          });
          
          if (!response.ok) {
            throw new Error('ノードの削除に失敗しました');
          }
          
          // 削除情報をUndoスタックに追加
          const nodesToDelete = [nodeToDelete];
          const relatedEdges = graphData.edges.filter(
            (e: any) => e.sourceId === nodeId || e.targetId === nodeId
          );
          
          // 再帰的に子ノードを検索
          const findChildNodes = (parentId: string, allNodes: any[]) => {
            const children = allNodes.filter(n => n.parentId === parentId);
            let result = [...children];
            
            for (const child of children) {
              result = [...result, ...findChildNodes(child.id, allNodes)];
            }
            
            return result;
          };
          
          const childNodes = findChildNodes(nodeId, graphData.nodes);
          
          // UndoスタックにPush
          setUndoStack(prev => [...prev, {
            action: 'delete',
            data: {
              nodes: [nodeToDelete, ...childNodes],
              edges: relatedEdges,
            },
            timestamp: Date.now(),
          }]);
          
          // 成功したら再読み込み
          fetchGraphData();
        } catch (error) {
          console.error('ノード削除エラー:', error);
          alert('ノードの削除中にエラーが発生しました');
        }
      },
    });
  }, [roleModelId, fetchGraphData]);
  
  // ノード拡張（AI）
  const handleExpandNode = useCallback(async (nodeId: string) => {
    try {
      // 既存のノードデータを保存
      const existingData = await fetch(`/api/knowledge-graph/${roleModelId}`).then(r => r.json());
      
      // 拡張リクエスト
      const response = await fetch(`/api/knowledge-graph/nodes/${nodeId}/expand`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('ノードの拡張に失敗しました');
      }
      
      // Undo用に保存（拡張前の状態を記録）
      setUndoStack(prev => [...prev, {
        action: 'expand',
        data: {
          nodeId,
          prevState: existingData,
        },
        timestamp: Date.now(),
      }]);
      
      // 成功したら再読み込み
      fetchGraphData();
    } catch (error) {
      console.error('ノード拡張エラー:', error);
      alert('ノードの拡張中にエラーが発生しました');
    }
  }, [roleModelId, fetchGraphData]);
  
  // ノードダイアログで保存ボタンが押されたときの処理
  const handleNodeSave = useCallback(async (data: { name: string; description: string; nodeType: string }) => {
    const { type, nodeId } = nodeDialog;
    
    if (!nodeId) return;
    
    try {
      const nodeData = nodes.find(n => n.id === nodeId)?.data as KnowledgeNode;
      
      if (!nodeData) {
        throw new Error('対象ノードが見つかりません');
      }
      
      switch (type) {
        case 'edit':
          await nodeOperations.updateNode(nodeId, 
            { 
              name: data.name, 
              description: data.description, 
              color: nodeData.color ? nodeData.color : undefined,
              nodeType: data.nodeType
            }, 
            nodeData
          );
          // 編集の場合は再取得
          await fetchGraphData();
          break;
          
        case 'add-child':
          const childResult = await nodeOperations.addChildNode(nodeId, data, nodeData);
          
          // シームレスに追加（サーバー取得なし）
          if (childResult.success && childResult.node) {
            // ノードの位置を設定
            // nodeData.positionは存在しない可能性があるためデフォルト値を設定
            const nodePosition = {x: 0, y: 0};
            if (typeof nodeData.position === 'object' && nodeData.position !== null) {
              nodePosition.x = nodeData.position.x || 0;
              nodePosition.y = nodeData.position.y || 0;
            }
            
            // 新しいノードを作成（完全なカスタムノードに）
            // 親ノードの位置を基準にして、子ノードは親の真下に配置
            const parentNode = nodes.find(n => n.id === nodeId);
            let newPos = {
              x: nodePosition.x,
              y: nodePosition.y + 150
            };
            
            // 親ノードが見つかった場合はその位置を基準に配置する
            if (parentNode) {
              newPos = {
                x: parentNode.position.x,
                y: parentNode.position.y + 150
              };
            }
            
            const newNode = {
              id: childResult.node.id,
              type: data.nodeType === 'concept' ? 'concept' : 'agent',
              position: newPos,
              data: {
                ...childResult.node,
                // ReactFlowのノードデータに必要な追加情報
                position: newPos,
                color: getNodeColor(data.nodeType),
                name: childResult.node.name,
                description: childResult.node.description,
                type: childResult.node.type,
                onEditNode: handleEditNode,
                onAddChildNode: handleAddChildNode,
                onAddSiblingNode: handleAddSiblingNode,
                onDeleteNode: handleDeleteNode,
                onExpandNode: handleExpandNode,
                level: childResult.node.level,
                roleModelId: roleModelId
              }
            };

            // 新しいエッジを作成（edge が undefined の場合のフォールバック対応）
            const targetId = childResult.node?.id || '';
            const newEdge = {
              id: childResult.edge?.id || `e-${Math.random().toString(36).substring(2)}`,
              source: childResult.edge?.sourceId || nodeId,
              target: childResult.edge?.targetId || targetId,
              type: 'dataFlowEdge',
              data: childResult.edge || {
                type: 'parent_child',
                sourceId: nodeId,
                targetId: targetId
              } as any
            };
            
            // ReactFlowノードとエッジを更新
            setNodes(oldNodes => [...oldNodes, newNode]);
            setEdges(oldEdges => [...oldEdges, newEdge]);
          } else {
            await fetchGraphData(); // 失敗時は全体を再取得
          }
          break;
          
        case 'add-sibling':
          const siblingResult = await nodeOperations.addSiblingNode(nodeId, data, nodeData);
          
          // シームレスに追加（サーバー取得なし）
          if (siblingResult.success && siblingResult.node) {
            // ノードの位置を設定
            // nodeData.positionは存在しない可能性があるためデフォルト値を設定
            const nodePosition = {x: 0, y: 0};
            if (typeof nodeData.position === 'object' && nodeData.position !== null) {
              nodePosition.x = nodeData.position.x || 0;
              nodePosition.y = nodeData.position.y || 0;
            }
            
            // 新しいノードを作成（完全なカスタムノードに）
            // 兄弟ノードは元ノードの右側に配置
            const siblingNode = nodes.find(n => n.id === nodeId);
            let newPos = {
              x: nodePosition.x + 180,
              y: nodePosition.y
            };
            
            // 兄弟の元となるノードが見つかった場合はその位置を基準に配置する
            if (siblingNode) {
              newPos = {
                x: siblingNode.position.x + 180, // 元ノードより右に配置
                y: siblingNode.position.y
              };
            }
            
            const newNode = {
              id: siblingResult.node.id,
              type: data.nodeType === 'concept' ? 'concept' : 'agent',
              position: newPos,
              data: {
                ...siblingResult.node,
                // ReactFlowのノードデータに必要な追加情報
                position: newPos,
                color: getNodeColor(data.nodeType),
                name: siblingResult.node.name,
                description: siblingResult.node.description,
                type: siblingResult.node.type,
                onEditNode: handleEditNode,
                onAddChildNode: handleAddChildNode,
                onAddSiblingNode: handleAddSiblingNode,
                onDeleteNode: handleDeleteNode, 
                onExpandNode: handleExpandNode,
                level: siblingResult.node.level,
                roleModelId: roleModelId
              }
            };

            // 新しいエッジを作成（edge が undefined の場合のフォールバック対応）
            const targetId = siblingResult.node?.id || '';
            const sourceId = nodeData.parentId || nodeId;
            const newEdge = {
              id: siblingResult.edge?.id || `e-${Math.random().toString(36).substring(2)}`,
              source: siblingResult.edge?.sourceId || sourceId,
              target: siblingResult.edge?.targetId || targetId,
              type: 'dataFlowEdge',
              data: siblingResult.edge || {
                type: 'sibling',
                sourceId: sourceId,
                targetId: targetId
              } as any
            };
            
            // ReactFlowノードとエッジを更新
            setNodes(oldNodes => [...oldNodes, newNode]);
            setEdges(oldEdges => [...oldEdges, newEdge]);
          } else {
            await fetchGraphData(); // 失敗時は全体を再取得
          }
          break;
      }
      
    } catch (error) {
      console.error('ノード操作エラー:', error);
      alert('操作中にエラーが発生しました');
      await fetchGraphData(); // エラー時は全体を再取得
    }
  }, [nodeDialog, nodes, nodeOperations, fetchGraphData, setNodes, setEdges]);
  
  // ノードタイプに基づいて色を取得する関数
  const getNodeColor = useCallback((nodeType: string) => {
    switch (nodeType) {
      case 'concept': return '#47c1ff';
      case 'keyword': return '#77dd77';
      case 'task': return '#ff6961';
      case 'question': return '#fdfd96';
      case 'info': return '#b19cd9';
      default: return '#47c1ff';
    }
  }, []);
  
  // Undo（元に戻す）処理
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return;
    
    try {
      // スタックから最新の操作を取得
      const lastAction = undoStack[undoStack.length - 1];
      console.log('元に戻す操作:', lastAction);
      
      // 操作に応じた処理
      switch (lastAction.action) {
        case 'edit':
          // 編集を元に戻す
          await fetch(`/api/knowledge-nodes/${lastAction.data.nodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lastAction.data.prevData),
          });
          break;
          
        case 'add-child':
        case 'add-sibling':
          // 新規追加を元に戻す（最後に追加されたノードを削除）
          const graphData = await fetch(`/api/knowledge-graph/${roleModelId}`).then(r => r.json());
          
          // 親IDと名前から新しく追加されたノードを特定
          const addedNode = graphData.nodes.find((n: any) => 
            n.name === lastAction.data.nodeData.name && 
            n.parentId === lastAction.data.parentId
          );
          
          if (addedNode) {
            await fetch(`/api/knowledge-nodes/${addedNode.id}`, {
              method: 'DELETE',
            });
          }
          break;
          
        case 'delete':
          // 削除を元に戻す（ノードを復元）
          for (const node of lastAction.data.nodes) {
            await fetch(`/api/knowledge-nodes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...node,
                id: undefined, // 新しいIDを自動生成
              }),
            });
          }
          break;
          
        case 'expand':
          // 拡張を元に戻す（追加されたノードを削除）
          // 拡張前と後の差分を特定
          const currentData = await fetch(`/api/knowledge-graph/${roleModelId}`).then(r => r.json());
          const prevNodes = lastAction.data.prevState.nodes.map((n: any) => n.id);
          
          // 拡張後に追加されたノードを特定
          const newNodes = currentData.nodes.filter((n: any) => !prevNodes.includes(n.id));
          
          // 拡張で追加されたノードを削除
          for (const node of newNodes) {
            await fetch(`/api/knowledge-nodes/${node.id}`, {
              method: 'DELETE',
            });
          }
          break;
      }
      
      // 操作履歴からポップ
      setUndoStack(prev => prev.slice(0, -1));
      
      // グラフデータを再取得
      await fetchGraphData();
      
    } catch (error) {
      console.error('Undo処理エラー:', error);
      alert('操作を元に戻す際にエラーが発生しました');
    }
  }, [undoStack, roleModelId, fetchGraphData]);
  
  // キーボードショートカット処理（Ctrl+Z）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z で元に戻す
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        console.log('Ctrl+Z キーが押されました');
        handleUndo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo]);
  


  // グラフデータの初期ロード
  // WebSocketからのノードとエッジデータを処理するuseEffect
  useEffect(() => {
    // websocketNodesとwebsocketEdgesが更新されたときに処理
    if (websocketNodes.length > 0 || websocketEdges.length > 0) {
      console.log('WebSocketからグラフデータを受信:', { nodes: websocketNodes, edges: websocketEdges });
      try {
        // グラフエリアサイズの取得
        const graphAreaWidth = window.innerWidth - 100;
        const graphAreaHeight = window.innerHeight - 150;
        const centerX = graphAreaWidth / 2;
        const centerY = 150;
        
        // カラーマップの定義
        const colorMap = [
          '#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0', 
          '#4895ef', '#560bad', '#480ca8', '#b5179e', '#3f37c9'
        ];
        
        // ノードをReactFlowノードに変換
        const flowNodes: Node[] = websocketNodes.map((node: any, index: number) => {
          // ノードのレベルを取得（またはデフォルト値を使用）
          const level = node.level || 0;
          // 色の選択
          const color = colorMap[level % colorMap.length];
          
          // ノードの位置計算
          let x = centerX + (index % 3 - 1) * 250; // 簡易的な水平配置
          let y = centerY + (Math.floor(index / 3)) * 150; // 簡易的な垂直配置
          
          // ノードタイプの判定
          const nodeType = node.type === 'agent' ? 'agent' : 'concept';
          
          return {
            id: node.id,
            type: nodeType,
            position: { x, y },
            data: {
              ...node,
              label: node.name,
              color: node.color || color,
              // ノード操作ハンドラを追加
              onEdit: handleEditNode,
              onDelete: handleDeleteNode,
              onAddChild: handleAddChildNode,
              onAddSibling: handleAddSiblingNode,
              onExpand: handleExpandNode,
            },
            style: {
              background: node.color || color,
              borderColor: color,
            },
          };
        });
        
        // エッジの検証と変換
        const validEdges = websocketEdges.filter((edge: any) => {
          // sourceとtargetが存在するか確認
          const sourceExists = flowNodes.some(node => node.id === edge.source || node.id === edge.sourceId);
          const targetExists = flowNodes.some(node => node.id === edge.target || node.id === edge.targetId);
          
          return sourceExists && targetExists;
        });
        
        // ReactFlowエッジに変換
        const flowEdges: Edge[] = validEdges.map((edge: any) => {
          const source = edge.sourceId || edge.source;
          const target = edge.targetId || edge.target;
          
          return {
            id: edge.id || `${source}-${target}-${Math.random().toString(36).substr(2, 9)}`,
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
        
        // グラフの複雑さに基づいてレイアウト選択
        const hasHierarchy = flowNodes.some(node => node.data && typeof node.data.level === 'number');
        const hasMultipleLevels = new Set(flowNodes.map(node => node.data?.level || 0)).size > 1;
        const isComplex = flowNodes.length > 15 || flowEdges.length > 20;
        
        const useHierarchicalLayout = hasHierarchy && (hasMultipleLevels || isComplex);
        
        if (useHierarchicalLayout) {
          // 階層構造のあるグラフには階層レイアウトを使用
          console.log('階層レイアウトを適用します');
          const { nodes: layoutedNodes, edges: layoutedEdges } = getImprovedHierarchicalLayout(
            flowNodes,
            flowEdges
          );
          setNodes(layoutedNodes);
          setEdges(layoutedEdges);
        } else {
          // シンプルなグラフには標準レイアウトを使用
          console.log('標準レイアウトを適用します');
          const { nodes: layoutedNodes, edges: layoutedEdges } = getImprovedLayoutedElements(
            flowNodes,
            flowEdges,
            { 
              direction: 'TB',
              nodesep: 120,
              ranksep: 150,
              marginx: 30,
              marginy: 50
            }
          );
          setNodes(layoutedNodes);
          setEdges(layoutedEdges);
        }
        
        // データ状態の更新
        setLoading(false);
        const hasData = flowNodes.length > 0;
        setHasKnowledgeGraph(hasData);
        if (onGraphDataChange) {
          onGraphDataChange(hasData);
        }
      } catch (error) {
        console.error('グラフデータの処理エラー:', error);
        setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
        setLoading(false);
      }
    } else if (wsLoading) {
      // WebSocket接続中
      console.log('WebSocket接続中...');
      setLoading(true);
    } else if (wsError) {
      // WebSocketエラー
      console.error('WebSocketエラー:', wsError);
      setError(wsError);
      setLoading(false);
    }
  }, [websocketNodes, websocketEdges, wsLoading, wsError]);

  // ナレッジグラフの更新通知用
  useEffect(() => {
    if (wsUpdating) {
      toast({
        title: 'グラフ更新中',
        description: '知識グラフが更新されています...',
        duration: 2000,
      });
    }
        
    return () => {
      // このコンポーネントがアンマウントされるときの処理
      console.log('ナレッジグラフビューワーのクリーンアップ');
    };
  }, [wsUpdating, toast]);

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
  
  // テスト用のナレッジグラフを生成する関数
  const generateTestKnowledgeGraph = useCallback(async () => {
    try {
      // 分かりやすいスタイルでクリックイベントのログを出力
      console.log('%c === テスト用ナレッジグラフ生成ボタンがクリックされました ===', 
        'background: #4CAF50; color: white; font-weight: bold; padding: 5px; border-radius: 3px; font-size: 16px;');
      
      console.log(`%c roleModelId: ${roleModelId}`, 'color: blue; font-weight: bold;');
      
      if (!roleModelId) {
        console.error('%c エラー: roleModelIdが未定義です！', 'color: red; font-weight: bold;', { roleModelId });
        setError('ロールモデルIDが未定義のため、テスト用ナレッジグラフを生成できません。');
        return;
      }
      
      setLoading(true);
      setError(null);
      
      // グラフ生成APIのURLをログ出力
      const apiUrl = `/api/test-knowledge-graph/${roleModelId}`;
      console.log('%c APIリクエスト送信中... ', 'background: #2196F3; color: white; font-weight: bold; padding: 3px 5px; border-radius: 3px;', {
        url: apiUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // リクエスト送信時間を記録
      const startTime = new Date().getTime();
      
      // 実際にAPIを呼び出す
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      // リクエスト完了時間と所要時間を計算
      const endTime = new Date().getTime();
      const requestTime = endTime - startTime;
      
      console.log('APIレスポンス受信:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('APIエラーレスポンス:', errorData);
        throw new Error(errorData.error || 'テスト用ナレッジグラフの生成に失敗しました');
      }
      
      const result = await response.json();
      console.log('テスト用ナレッジグラフ生成リクエスト成功:', result);
      
      // 成功通知
      toast({
        title: 'グラフ生成開始',
        description: 'テスト用ナレッジグラフの生成を開始しました。WebSocketで進捗状況が通知されます。',
        duration: 3000,
      });
      
      // グラフデータを明示的にリクエスト
      console.log('明示的なグラフデータリクエストをスケジュール...');
      setTimeout(() => {
        console.log('明示的にグラフデータをリクエストします');
        requestGraphData(); // fetchGraphData()からrequestGraphData()に変更
      }, 1000);
      
    } catch (error) {
      console.error('テスト用ナレッジグラフ生成エラー:', error);
      setError(error instanceof Error ? error.message : '不明なエラーが発生しました');
      setLoading(false);
      
      // エラー通知
      toast({
        title: 'エラー',
        description: error instanceof Error ? error.message : 'テスト用ナレッジグラフの生成中にエラーが発生しました',
        variant: 'destructive',
        duration: 5000,
      });
    }
  }, [roleModelId, fetchGraphData]);

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
      
      // データ構造を正規化（WebSocketメッセージ形式対応）
      const payload = data.payload || data;
      
      // roleModelIdが一致する場合、またはpayload.roleModelIdがundefinedの場合
      const targetRoleModelId = payload.roleModelId || (data.payload?.roleModelId);
      const matchesRoleModel = !targetRoleModelId || targetRoleModelId === roleModelId;
      
      if (matchesRoleModel) {
        console.log(`Progress update for ${roleModelId}:`, data);
        const progressValue = payload.progress || payload.percent || payload.progressPercent || 0;
        setProgress(progressValue);
        setProgressMessage(payload.message || 'Processing...');
        
        // 完了時
        if (progressValue >= 100 || payload.status === 'completed' || payload.status === 'complete') {
          console.log('Progress complete, fetching updated graph data');
          setTimeout(() => {
            setGenerating(false);
            // 少し遅延させてデータベースの更新が確実に反映されるようにする
            setTimeout(() => {
              console.log('グラフデータを再取得します（進捗完了後）');
              fetchGraphData();
            }, 1500);
          }, 500);
        }
      }
    };
    
    // エージェント思考リスナー
    const handleAgentThoughts = (data: any) => {
      console.log('Agent thoughts received:', data);
      
      // データ構造を正規化（WebSocketメッセージ形式対応）
      const payload = data.payload || data;
      
      // roleModelIdが一致する場合、またはpayload.roleModelIdがundefinedの場合
      const targetRoleModelId = payload.roleModelId || (data.payload?.roleModelId);
      const matchesRoleModel = !targetRoleModelId || targetRoleModelId === roleModelId;
      
      if (matchesRoleModel) {
        console.log(`Agent thoughts for ${roleModelId}:`, data);
        setAgentMessages(prev => [
          ...prev, 
          {
            agent: payload.agentName || 'Agent', 
            message: payload.thought || payload.thoughts || payload.message || 'Working...',
            timestamp: payload.timestamp || new Date().toISOString()
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
    <div className="flex flex-col w-full h-full" style={{ height: '100%' }}>
      <div className="flex justify-between items-center mb-1 px-2 py-1 bg-muted/50 rounded-lg">
        <h3 className="text-sm font-semibold">ナレッジグラフビューワー</h3>
        <div className="flex space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={generateTestKnowledgeGraph}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
                  テストグラフ生成
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>テスト用のナレッジグラフを生成して表示</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
        <div className="flex-1 h-full" style={{ height: 'calc(100% - 36px)' }}>
          <ReactFlowProvider>
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
                  onSaveSuccess={fetchGraphData}
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
  );
};

export default KnowledgeGraphViewer;