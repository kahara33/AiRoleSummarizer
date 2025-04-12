/**
 * ナレッジグラフの更新を処理するためのカスタムフック
 * WebSocketからのナレッジグラフ更新を受け取り、リアルタイム描画をサポート
 */

import { useState, useEffect, useCallback } from 'react';
import { useMultiAgentWebSocket } from './use-multi-agent-websocket-fixed';

interface GraphNode {
  id: string;
  type: string;
  name: string;
  [key: string]: any;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  [key: string]: any;
}

interface GraphUpdateEvent {
  nodes: GraphNode[];
  edges: GraphEdge[];
  updateType: 'create' | 'update' | 'delete' | 'partial' | 'complete';
  isPartial?: boolean;
  roleModelId?: string;
  agentName?: string;
  timestamp?: string;
  [key: string]: any;
}

interface UseKnowledgeGraphReturn {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;
  error: string | null;
  isUpdating: boolean;
  lastUpdateTime: string | null;
  lastUpdateSource: string | null;
  saveGraph: (name: string, description?: string) => Promise<boolean>;
  loadGraph: (snapshotId: string) => Promise<boolean>;
  resetGraph: () => void;
  // グラフデータを明示的にリクエストするメソッドを追加
  requestGraphData: () => void;
}

export function useKnowledgeGraph(roleModelId: string): UseKnowledgeGraphReturn {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [lastUpdateSource, setLastUpdateSource] = useState<string | null>(null);
  
  // WebSocket接続を使用
  const { connect, sendMessage, isConnected } = useMultiAgentWebSocket();
  
  // ロールモデルIDが変更された場合、WebSocket接続を更新
  useEffect(() => {
    if (roleModelId) {
      connect(roleModelId);
    }
  }, [roleModelId, connect]);
  
  // WebSocketからのグラフ更新イベントを処理
  useEffect(() => {
    const handleGraphUpdate = (event: CustomEvent<GraphUpdateEvent>) => {
      console.log('ナレッジグラフ更新イベントを受信:', event.detail);
      
      const updateData = event.detail;
      const updateRoleModelId = updateData.roleModelId;
      
      // このインスタンスのロールモデルIDに一致するイベントだけを処理
      if (updateRoleModelId && updateRoleModelId !== roleModelId) {
        console.log(`ロールモデルIDが異なるため更新をスキップ: 受信=${updateRoleModelId}, 現在=${roleModelId}`);
        return;
      }
      
      setIsUpdating(true);
      setLastUpdateTime(updateData.timestamp || new Date().toISOString());
      setLastUpdateSource(updateData.agentName || 'システム');
      
      try {
        const newNodes = updateData.nodes || [];
        const newEdges = updateData.edges || [];
        
        // 更新のタイプに基づいて状態を更新
        switch (updateData.updateType) {
          case 'create':
            // 完全に新しいグラフを作成
            setNodes(newNodes);
            setEdges(newEdges);
            break;
            
          case 'update':
            // 既存のグラフを更新（置換）
            setNodes(newNodes);
            setEdges(newEdges);
            break;
            
          case 'partial':
            // 既存のグラフに新しいノードとエッジを追加
            setNodes(prevNodes => {
              // 既存のノードIDを取得
              const existingNodeIds = new Set(prevNodes.map(node => node.id));
              
              // 重複するノードを除外し、新しいノードを追加
              const filteredNewNodes = newNodes.filter(node => !existingNodeIds.has(node.id));
              return [...prevNodes, ...filteredNewNodes];
            });
            
            setEdges(prevEdges => {
              // 既存のエッジIDを取得
              const existingEdgeIds = new Set(prevEdges.map(edge => edge.id));
              
              // 重複するエッジを除外し、新しいエッジを追加
              const filteredNewEdges = newEdges.filter(edge => !existingEdgeIds.has(edge.id));
              return [...prevEdges, ...filteredNewEdges];
            });
            break;
            
          case 'delete':
            // ノードまたはエッジを削除
            if (newNodes.length > 0) {
              const nodeIdsToDelete = new Set(newNodes.map(node => node.id));
              setNodes(prevNodes => prevNodes.filter(node => !nodeIdsToDelete.has(node.id)));
            }
            
            if (newEdges.length > 0) {
              const edgeIdsToDelete = new Set(newEdges.map(edge => edge.id));
              setEdges(prevEdges => prevEdges.filter(edge => !edgeIdsToDelete.has(edge.id)));
            }
            break;
            
          default:
            console.warn('未知の更新タイプ:', updateData.updateType);
        }
        
        setError(null);
      } catch (err) {
        console.error('グラフ更新処理中のエラー:', err);
        setError('グラフの更新中にエラーが発生しました');
      } finally {
        setIsUpdating(false);
        setLoading(false);
      }
    };
    
    // カスタムイベントリスナーを登録
    window.addEventListener('knowledge_graph_update', handleGraphUpdate as EventListener);
    
    // 初回読み込み時の自動グラフデータリクエストを削除
    // 自動的にリクエストするのではなく、明示的なユーザーアクションによってのみリクエストするように変更
    console.log('WebSocket接続完了:', roleModelId, '- ユーザーがボタンをクリックするまで待機します');
    
    // クリーンアップ
    return () => {
      window.removeEventListener('knowledge_graph_update', handleGraphUpdate as EventListener);
    };
  }, [roleModelId, isConnected, sendMessage]);
  
  // グラフの保存
  const saveGraph = useCallback(async (name: string, description?: string): Promise<boolean> => {
    if (!roleModelId) {
      setError('ロールモデルIDが指定されていないため保存できません');
      return false;
    }
    
    try {
      // WebSocketを使用してグラフを保存
      sendMessage('save_knowledge_graph', {
        roleModelId,
        name,
        description,
        timestamp: new Date().toISOString()
      });
      
      // API経由でも保存を試みる
      const response = await fetch(`/api/knowledge-graph/${roleModelId}/snapshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          description
        })
      });
      
      if (!response.ok) {
        throw new Error('APIを通じたグラフの保存に失敗しました');
      }
      
      return true;
    } catch (err) {
      console.error('グラフ保存エラー:', err);
      setError('グラフの保存中にエラーが発生しました');
      return false;
    }
  }, [roleModelId, sendMessage]);
  
  // 保存済みグラフの読み込み
  const loadGraph = useCallback(async (snapshotId: string): Promise<boolean> => {
    if (!roleModelId) {
      setError('ロールモデルIDが指定されていないため読み込めません');
      return false;
    }
    
    setLoading(true);
    
    try {
      // WebSocketを使用してグラフを読み込み
      sendMessage('load_knowledge_graph', {
        roleModelId,
        snapshotId,
        timestamp: new Date().toISOString()
      });
      
      // API経由でも読み込みを試みる
      const response = await fetch(`/api/knowledge-graph/${roleModelId}/snapshots/${snapshotId}/restore`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('APIを通じたグラフの読み込みに失敗しました');
      }
      
      return true;
    } catch (err) {
      console.error('グラフ読み込みエラー:', err);
      setError('グラフの読み込み中にエラーが発生しました');
      return false;
    } finally {
      setLoading(false);
    }
  }, [roleModelId, sendMessage]);
  
  // グラフのリセット
  const resetGraph = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setError(null);
    setLastUpdateTime(null);
    setLastUpdateSource(null);
  }, []);
  
  // グラフデータを明示的にリクエスト（Promiseを返すように修正）
  const requestGraphData = useCallback(async () => {
    if (isConnected && roleModelId) {
      console.log('ナレッジグラフデータをリクエスト:', roleModelId);
      setLoading(true);
      sendMessage('get_knowledge_graph', { roleModelId });
      return Promise.resolve(); // 正常終了
    } else {
      console.error('WebSocket接続がないため、グラフデータをリクエストできません');
      setError('サーバーに接続できません。後でもう一度お試しください。');
      return Promise.reject(new Error('WebSocket接続がありません')); // エラー終了
    }
  }, [roleModelId, isConnected, sendMessage]);
  
  return {
    nodes,
    edges,
    loading,
    error,
    isUpdating,
    lastUpdateTime,
    lastUpdateSource,
    saveGraph,
    loadGraph,
    resetGraph,
    requestGraphData
  };
}