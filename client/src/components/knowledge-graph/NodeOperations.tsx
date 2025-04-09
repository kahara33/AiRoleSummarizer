import React, { useCallback } from 'react';
import { KnowledgeNode } from '@shared/schema';

// ノード操作のヘルパー関数を提供するカスタムフック
export const useNodeOperations = (
  roleModelId: string,
  fetchGraphData: () => Promise<void>,
  undoStackSetter: React.Dispatch<React.SetStateAction<any[]>>
) => {
  // ノード編集
  const updateNode = useCallback(async (
    nodeId: string,
    data: { name: string; description: string; color?: string },
    prevNode: KnowledgeNode
  ) => {
    try {
      const response = await fetch(`/api/knowledge-nodes/${nodeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('ノードの更新に失敗しました');
      }
      
      // Undo用に情報を保存
      undoStackSetter(prev => [...prev, {
        action: 'edit',
        data: {
          nodeId,
          prevData: {
            name: prevNode.name,
            description: prevNode.description || '',
            color: prevNode.color,
          },
          newData: data,
        },
        timestamp: Date.now(),
      }]);
      
      // 成功したらデータを再読み込み
      await fetchGraphData();
      return true;
    } catch (error) {
      console.error('ノード更新エラー:', error);
      return false;
    }
  }, [fetchGraphData, undoStackSetter]);
  
  // 子ノード追加
  const addChildNode = useCallback(async (
    parentId: string,
    data: { name: string; description: string; color?: string },
    parentNode: KnowledgeNode
  ) => {
    try {
      const level = (parentNode.level || 0) + 1;
      
      const response = await fetch(`/api/knowledge-nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          color: data.color,
          level,
          type: 'concept',
          roleModelId,
          parentId,
        }),
      });
      
      if (!response.ok) {
        throw new Error('子ノードの追加に失敗しました');
      }
      
      // Undo用に情報を保存
      undoStackSetter(prev => [...prev, {
        action: 'add-child',
        data: {
          parentId,
          nodeData: {
            name: data.name,
            description: data.description,
            color: data.color,
            level,
          },
        },
        timestamp: Date.now(),
      }]);
      
      // 成功したらデータを再読み込み
      await fetchGraphData();
      return true;
    } catch (error) {
      console.error('子ノード追加エラー:', error);
      return false;
    }
  }, [roleModelId, fetchGraphData, undoStackSetter]);
  
  // 兄弟ノード追加
  const addSiblingNode = useCallback(async (
    siblingId: string,
    data: { name: string; description: string; color?: string },
    siblingNode: KnowledgeNode
  ) => {
    try {
      const level = siblingNode.level || 0;
      const parentId = siblingNode.parentId;
      
      const response = await fetch(`/api/knowledge-nodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          color: data.color,
          level,
          type: 'concept',
          roleModelId,
          parentId,
        }),
      });
      
      if (!response.ok) {
        throw new Error('兄弟ノードの追加に失敗しました');
      }
      
      // Undo用に情報を保存
      undoStackSetter(prev => [...prev, {
        action: 'add-sibling',
        data: {
          parentId,
          nodeData: {
            name: data.name,
            description: data.description,
            color: data.color,
            level,
          },
        },
        timestamp: Date.now(),
      }]);
      
      // 成功したらデータを再読み込み
      await fetchGraphData();
      return true;
    } catch (error) {
      console.error('兄弟ノード追加エラー:', error);
      return false;
    }
  }, [roleModelId, fetchGraphData, undoStackSetter]);
  
  // ノード削除
  const deleteNode = useCallback(async (
    nodeId: string,
    allNodes: KnowledgeNode[],
    allEdges: any[]
  ) => {
    try {
      // 削除前のノードとその子孫を記録
      const nodeToDelete = allNodes.find(n => n.id === nodeId);
      if (!nodeToDelete) {
        throw new Error('削除対象のノードが見つかりません');
      }
      
      // 再帰的に子孫ノードを収集する関数
      const collectDescendants = (currentId: string, nodes: KnowledgeNode[]): KnowledgeNode[] => {
        const childNodes = nodes.filter(n => n.parentId === currentId);
        let descendants = [nodes.find(n => n.id === currentId)!];
        
        for (const child of childNodes) {
          descendants = [...descendants, ...collectDescendants(child.id, nodes)];
        }
        
        return descendants;
      };
      
      // 削除対象のノードとその子孫を収集
      const nodesToDelete = collectDescendants(nodeId, allNodes);
      const nodeIdsToDelete = nodesToDelete.map(n => n.id);
      
      // 関連するエッジを特定
      const relatedEdges = allEdges.filter(
        e => nodeIdsToDelete.includes(e.sourceId) || nodeIdsToDelete.includes(e.targetId)
      );
      
      // 削除リクエスト
      const response = await fetch(`/api/knowledge-nodes/${nodeId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('ノードの削除に失敗しました');
      }
      
      // Undo用に情報を保存
      undoStackSetter(prev => [...prev, {
        action: 'delete',
        data: {
          nodes: nodesToDelete,
          edges: relatedEdges,
        },
        timestamp: Date.now(),
      }]);
      
      // 成功したらデータを再読み込み
      await fetchGraphData();
      return true;
    } catch (error) {
      console.error('ノード削除エラー:', error);
      return false;
    }
  }, [fetchGraphData, undoStackSetter]);
  
  // ノードAI拡張
  const expandNode = useCallback(async (nodeId: string) => {
    try {
      const response = await fetch(`/api/knowledge-graph/nodes/${nodeId}/expand`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('ノードの拡張に失敗しました');
      }
      
      // 成功したらデータを再読み込み
      await fetchGraphData();
      return true;
    } catch (error) {
      console.error('ノード拡張エラー:', error);
      return false;
    }
  }, [fetchGraphData]);
  
  return {
    updateNode,
    addChildNode,
    addSiblingNode,
    deleteNode,
    expandNode,
  };
};