/**
 * 情報収集プランの更新を処理するためのカスタムフック
 * WebSocketからの情報収集プラン更新を受け取り、リアルタイム表示をサポート
 */

import { useState, useEffect, useCallback } from 'react';
import { useMultiAgentWebSocket } from './use-multi-agent-websocket-fixed';

export interface InformationPlan {
  id: string;
  roleModelId: string;
  title: string;
  description?: string;
  content: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  order?: number;
  tags?: string[];
  status?: string;
  priority?: string;
  metaData?: Record<string, any>;
}

interface PlanUpdateEvent {
  plans?: InformationPlan[];
  plan?: InformationPlan;
  updateType?: 'create' | 'update' | 'delete';
  roleModelId?: string;
  timestamp?: string;
  planId?: string;
  [key: string]: any;
}

interface UseInformationPlanReturn {
  plans: InformationPlan[];
  selectedPlan: InformationPlan | null;
  loading: boolean;
  error: string | null;
  isUpdating: boolean;
  lastUpdateTime: string | null;
  selectPlan: (planId: string) => void;
  savePlan: (plan: Partial<InformationPlan>) => Promise<boolean>;
  deletePlan: (planId: string) => Promise<boolean>;
  createPlan: (plan: Partial<InformationPlan>) => Promise<boolean>;
  refreshPlans: () => void;
}

export function useInformationPlan(roleModelId: string): UseInformationPlanReturn {
  const [plans, setPlans] = useState<InformationPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<InformationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  
  // WebSocket接続を使用
  const { connect, sendMessage, isConnected } = useMultiAgentWebSocket();
  
  // ロールモデルIDが変更された場合、WebSocket接続を更新
  useEffect(() => {
    if (roleModelId) {
      connect(roleModelId);
    }
  }, [roleModelId, connect]);
  
  // WebSocketからの情報収集プラン更新イベントを処理
  useEffect(() => {
    const handlePlanUpdate = (event: CustomEvent<PlanUpdateEvent>) => {
      console.log('情報収集プラン更新イベントを受信:', event.detail);
      
      const updateData = event.detail;
      const updateRoleModelId = updateData.roleModelId;
      
      // このインスタンスのロールモデルIDに一致するイベントだけを処理
      if (updateRoleModelId && updateRoleModelId !== roleModelId) {
        console.log(`ロールモデルIDが異なるため更新をスキップ: 受信=${updateRoleModelId}, 現在=${roleModelId}`);
        return;
      }
      
      setIsUpdating(true);
      setLastUpdateTime(updateData.timestamp || new Date().toISOString());
      
      try {
        // プラン配列全体が送信された場合
        if (updateData.plans && Array.isArray(updateData.plans)) {
          setPlans(updateData.plans);
        }
        // 単一のプランが更新された場合
        else if (updateData.plan) {
          const plan = updateData.plan;
          const updateType = updateData.updateType || 'update';
          
          if (updateType === 'delete') {
            // プランの削除
            setPlans(prev => prev.filter(p => p.id !== plan.id));
            
            // 削除されたプランが選択中だった場合は選択を解除
            if (selectedPlan && selectedPlan.id === plan.id) {
              setSelectedPlan(null);
            }
          } else if (updateType === 'create' || updateType === 'update') {
            // プランの作成または更新
            setPlans(prev => {
              const exists = prev.some(p => p.id === plan.id);
              if (exists) {
                // 既存プランの更新
                return prev.map(p => p.id === plan.id ? plan : p);
              } else {
                // 新規プランの追加
                return [...prev, plan];
              }
            });
            
            // 更新されたプランが選択中だった場合は選択状態も更新
            if (selectedPlan && selectedPlan.id === plan.id) {
              setSelectedPlan(plan);
            }
          }
        }
        // プランIDのみが送信された場合（削除イベントなど）
        else if (updateData.planId && updateData.updateType === 'delete') {
          const planId = updateData.planId;
          setPlans(prev => prev.filter(p => p.id !== planId));
          
          // 削除されたプランが選択中だった場合は選択を解除
          if (selectedPlan && selectedPlan.id === planId) {
            setSelectedPlan(null);
          }
        }
        
        setError(null);
      } catch (err) {
        console.error('プラン更新処理中のエラー:', err);
        setError('情報収集プランの更新中にエラーが発生しました');
      } finally {
        setIsUpdating(false);
        setLoading(false);
      }
    };
    
    // カスタムイベントリスナーを登録
    window.addEventListener('information_plan_update', handlePlanUpdate as EventListener);
    
    // 初回読み込み時にプランデータをリクエスト
    if (isConnected && roleModelId) {
      console.log('初期情報収集プランデータをリクエスト:', roleModelId);
      sendMessage('information_collection_plan', { roleModelId });
      fetchPlans();
    }
    
    // クリーンアップ
    return () => {
      window.removeEventListener('information_plan_update', handlePlanUpdate as EventListener);
    };
  }, [roleModelId, isConnected, sendMessage, selectedPlan]);
  
  // APIを使って情報収集プランを取得
  const fetchPlans = useCallback(async () => {
    if (!roleModelId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/role-models/${roleModelId}/information-collection-plans`);
      if (response.ok) {
        const data = await response.json();
        console.log('情報収集プラン取得成功:', data);
        setPlans(data);
      } else {
        console.error('情報収集プラン取得エラー:', response.statusText);
        setError('情報収集プランの取得に失敗しました');
      }
    } catch (error) {
      console.error('情報収集プラン取得例外:', error);
      setError('情報収集プランの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [roleModelId]);
  
  // プランの選択
  const selectPlan = useCallback((planId: string) => {
    const plan = plans.find(p => p.id === planId);
    setSelectedPlan(plan || null);
  }, [plans]);
  
  // プランの保存
  const savePlan = useCallback(async (plan: Partial<InformationPlan>): Promise<boolean> => {
    if (!roleModelId || !plan.id) {
      setError('プランIDまたはロールモデルIDが指定されていないため保存できません');
      return false;
    }
    
    setIsUpdating(true);
    
    try {
      // WebSocketを使用して保存
      sendMessage('save_information_plan', {
        roleModelId,
        plan: {
          ...plan,
          roleModelId,
          updatedAt: new Date().toISOString()
        }
      });
      
      // API経由でも保存
      const response = await fetch(`/api/role-models/${roleModelId}/information-collection-plans/${plan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...plan,
          roleModelId,
          updatedAt: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('APIを通じたプランの保存に失敗しました');
      }
      
      return true;
    } catch (err) {
      console.error('プラン保存エラー:', err);
      setError('プランの保存中にエラーが発生しました');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [roleModelId, sendMessage]);
  
  // プランの削除
  const deletePlan = useCallback(async (planId: string): Promise<boolean> => {
    if (!roleModelId || !planId) {
      setError('プランIDまたはロールモデルIDが指定されていないため削除できません');
      return false;
    }
    
    setIsUpdating(true);
    
    try {
      // WebSocketを使用して削除
      sendMessage('delete_information_plan', {
        roleModelId,
        planId
      });
      
      // API経由でも削除
      const response = await fetch(`/api/role-models/${roleModelId}/information-collection-plans/${planId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('APIを通じたプランの削除に失敗しました');
      }
      
      // 選択中のプランが削除された場合は選択を解除
      if (selectedPlan && selectedPlan.id === planId) {
        setSelectedPlan(null);
      }
      
      return true;
    } catch (err) {
      console.error('プラン削除エラー:', err);
      setError('プランの削除中にエラーが発生しました');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [roleModelId, sendMessage, selectedPlan]);
  
  // 新規プランの作成
  const createPlan = useCallback(async (plan: Partial<InformationPlan>): Promise<boolean> => {
    if (!roleModelId) {
      setError('ロールモデルIDが指定されていないため作成できません');
      return false;
    }
    
    setIsUpdating(true);
    
    try {
      // 新しいプランオブジェクトを作成
      const newPlan = {
        ...plan,
        roleModelId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // API経由で作成
      const response = await fetch(`/api/role-models/${roleModelId}/information-collection-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPlan)
      });
      
      if (!response.ok) {
        throw new Error('APIを通じたプランの作成に失敗しました');
      }
      
      const createdPlan = await response.json();
      
      // WebSocketを使用して通知
      sendMessage('save_information_plan', {
        roleModelId,
        plan: createdPlan,
        updateType: 'create'
      });
      
      return true;
    } catch (err) {
      console.error('プラン作成エラー:', err);
      setError('プランの作成中にエラーが発生しました');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [roleModelId, sendMessage]);
  
  // 情報収集プランの再取得
  const refreshPlans = useCallback(() => {
    if (isConnected && roleModelId) {
      console.log('情報収集プランデータを再取得:', roleModelId);
      sendMessage('information_collection_plan', { roleModelId });
      fetchPlans();
    }
  }, [roleModelId, isConnected, sendMessage, fetchPlans]);
  
  return {
    plans,
    selectedPlan,
    loading,
    error,
    isUpdating,
    lastUpdateTime,
    selectPlan,
    savePlan,
    deletePlan,
    createPlan,
    refreshPlans
  };
}