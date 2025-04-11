/**
 * 情報収集プラン関連のサービス関数
 */
import { db } from './db';
import { eq } from 'drizzle-orm';
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';

// 情報収集プランテーブル
// ※本来はshared/schema.tsで定義しますが、今回は既存のマイグレーションに影響を与えないように
// インメモリで処理します
interface InformationCollectionPlan {
  id: string;
  roleModelId: string;
  title: string;
  description?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  order?: number;
  tags?: string[];
  status?: string;
  priority?: string;
  metaData?: Record<string, any>;
}

// インメモリストレージ（データベースマイグレーションが完了するまでの暫定対応）
const informationPlans: InformationCollectionPlan[] = [];

/**
 * 特定のロールモデルIDに関連する情報収集プランを取得する
 * @param roleModelId ロールモデルID
 * @returns 情報収集プランの配列とPromise
 */
export async function getInformationCollectionPlansForRoleModel(roleModelId: string) {
  try {
    // ロールモデルIDに一致する情報収集プランをインメモリから取得
    const plans = informationPlans.filter(plan => plan.roleModelId === roleModelId);
    
    // 並び順でソート（もし設定されていれば）
    return plans.sort((a, b) => {
      // orderが設定されていなければ作成日時で並べる
      if (a.order === undefined && b.order === undefined) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      // orderがaだけ設定されていない場合
      if (a.order === undefined) return 1;
      // orderがbだけ設定されていない場合
      if (b.order === undefined) return -1;
      // 両方設定されている場合
      return a.order - b.order;
    });
  } catch (error) {
    console.error(`情報収集プラン取得エラー: ${error}`);
    throw error;
  }
}

/**
 * 情報収集プランを作成または更新する
 * @param planData 情報収集プランのデータ
 * @returns 作成または更新された情報収集プラン
 */
export async function saveInformationCollectionPlan(planData: any): Promise<InformationCollectionPlan> {
  try {
    const now = new Date();
    
    // 更新の場合
    if (planData.id) {
      const existingPlanIndex = informationPlans.findIndex(plan => plan.id === planData.id);
      
      if (existingPlanIndex !== -1) {
        // 既存のプランを更新
        const updatedPlan = {
          ...informationPlans[existingPlanIndex],
          ...planData,
          updatedAt: now
        };
        
        informationPlans[existingPlanIndex] = updatedPlan;
        return updatedPlan;
      }
    }
    
    // 新規作成の場合
    const newPlan: InformationCollectionPlan = {
      id: planData.id || randomUUID(),
      roleModelId: planData.roleModelId,
      title: planData.title || '新しい情報収集プラン',
      description: planData.description || '',
      content: planData.content || '',
      createdAt: now,
      updatedAt: now,
      order: planData.order,
      tags: planData.tags,
      status: planData.status || 'active',
      priority: planData.priority || 'medium',
      metaData: planData.metaData || {}
    };
    
    informationPlans.push(newPlan);
    return newPlan;
  } catch (error) {
    console.error(`情報収集プラン保存エラー: ${error}`);
    throw error;
  }
}

/**
 * 情報収集プランを削除する
 * @param planId 情報収集プランのID
 * @returns 削除結果
 */
export async function deleteInformationCollectionPlan(planId: string) {
  try {
    const initialLength = informationPlans.length;
    const planIndex = informationPlans.findIndex(plan => plan.id === planId);
    
    if (planIndex !== -1) {
      // プランを保存（削除前の状態を戻り値として返すため）
      const deletedPlan = informationPlans[planIndex];
      
      // プランを削除
      informationPlans.splice(planIndex, 1);
      
      return {
        success: true,
        planId,
        message: '情報収集プランを削除しました',
        plan: deletedPlan
      };
    }
    
    return {
      success: false,
      planId,
      message: '指定されたIDの情報収集プランが見つかりません'
    };
  } catch (error) {
    console.error(`情報収集プラン削除エラー: ${error}`);
    throw error;
  }
}

/**
 * WebSocketクライアントに情報収集プランを送信する
 * @param ws WebSocketクライアント
 * @param roleModelId ロールモデルID
 * @returns 処理結果のPromise
 */
export async function sendInformationCollectionPlansToClient(ws: WebSocket, roleModelId: string): Promise<boolean> {
  try {
    // 指定されたロールモデルIDに関連する情報収集プランを取得
    const plans = await getInformationCollectionPlansForRoleModel(roleModelId);
    
    // プランをクライアントに送信
    ws.send(JSON.stringify({
      type: 'information_plans',
      message: '情報収集プランを取得しました',
      roleModelId,
      plans,
      count: plans.length,
      timestamp: new Date().toISOString(),
      status: 'success'
    }));
    
    return true;
  } catch (error) {
    console.error(`情報収集プラン送信エラー: ${error}`);
    
    // エラーメッセージを送信
    ws.send(JSON.stringify({
      type: 'information_plan_error',
      message: '情報収集プランの取得中にエラーが発生しました',
      roleModelId,
      error: String(error),
      timestamp: new Date().toISOString(),
      status: 'error'
    }));
    
    return false;
  }
}

/**
 * 情報収集プランの更新通知を送信する関数
 * @param roleModelId ロールモデルID
 * @param planData プランデータ（保存されたプラン）
 * @param updateType 更新タイプ（'create', 'update', 'delete'）
 * @param sendSocketMessage WebSocketメッセージ送信関数
 */
export function notifyInformationPlanUpdate(
  roleModelId: string,
  planData: any,
  updateType: string = 'update',
  sendSocketMessage: (type: string, data: any) => void
): void {
  try {
    sendSocketMessage('information_plan_update', {
      message: `情報収集プランが${updateType === 'create' ? '作成' : updateType === 'update' ? '更新' : '削除'}されました`,
      roleModelId,
      plan: planData,
      updateType,
      timestamp: new Date().toISOString(),
      status: 'success'
    });
  } catch (error) {
    console.error(`情報収集プラン更新通知エラー: ${error}`);
  }
}