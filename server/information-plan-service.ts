/**
 * 情報収集プラン関連のサービス関数
 */
import { db } from './db';
import { collectionPlans, collectionSources, collectionSummaries, roleModels } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { WebSocket } from 'ws';

/**
 * 特定のロールモデルIDに関連する情報収集プランを取得する
 * @param roleModelId ロールモデルID
 * @returns 情報収集プランの配列とPromise
 */
export async function getInformationCollectionPlansForRoleModel(roleModelId: string) {
  try {
    console.log(`ロールモデル ${roleModelId} の情報収集プランを取得中`);
    
    const plans = await db.query.collectionPlans.findMany({
      where: eq(collectionPlans.roleModelId, roleModelId),
      orderBy: [desc(collectionPlans.updatedAt)],
      with: {
        sources: {
          orderBy: [desc(collectionSources.collectedAt)],
          limit: 10
        },
        summaries: {
          orderBy: [desc(collectionSummaries.generatedAt)],
          limit: 1
        }
      }
    });
    
    console.log(`${plans.length} 件の情報収集プランが見つかりました`);
    return plans;
  } catch (error) {
    console.error('情報収集プラン取得エラー:', error);
    throw error;
  }
}

/**
 * 情報収集プランを作成または更新する
 * @param planData 情報収集プランのデータ
 * @returns 作成または更新された情報収集プラン
 */
export async function saveInformationCollectionPlan(planData: any) {
  try {
    // IDがある場合は更新、ない場合は新規作成
    if (planData.id) {
      console.log(`情報収集プラン ${planData.id} を更新中`);
      
      const [updatedPlan] = await db
        .update(collectionPlans)
        .set({
          title: planData.title,
          isActive: planData.isActive || false,
          frequency: planData.frequency || 'daily',
          updatedAt: new Date(),
          toolsConfig: planData.toolsConfig || { enabledTools: [] },
          deliveryConfig: planData.deliveryConfig || { emailEnabled: false, webhookEnabled: false }
        })
        .where(eq(collectionPlans.id, planData.id))
        .returning();
      
      console.log('情報収集プランが更新されました');
      return updatedPlan;
    } else {
      console.log('新しい情報収集プランを作成中');
      
      // roleModelIdが必須
      if (!planData.roleModelId) {
        throw new Error('情報収集プランの作成にはroleModelIdが必要です');
      }
      
      const [newPlan] = await db
        .insert(collectionPlans)
        .values({
          title: planData.title,
          roleModelId: planData.roleModelId,
          isActive: planData.isActive || false,
          createdBy: planData.createdBy,
          frequency: planData.frequency || 'daily',
          toolsConfig: planData.toolsConfig || { enabledTools: [] },
          deliveryConfig: planData.deliveryConfig || { emailEnabled: false, webhookEnabled: false }
        })
        .returning();
      
      console.log('新しい情報収集プランが作成されました');
      return newPlan;
    }
  } catch (error) {
    console.error('情報収集プラン保存エラー:', error);
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
    console.log(`情報収集プラン ${planId} を削除中`);
    
    const result = await db
      .delete(collectionPlans)
      .where(eq(collectionPlans.id, planId))
      .returning({ id: collectionPlans.id });
    
    if (result.length === 0) {
      throw new Error('情報収集プランが見つかりません');
    }
    
    console.log('情報収集プランが削除されました');
    return { success: true, id: planId };
  } catch (error) {
    console.error('情報収集プラン削除エラー:', error);
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
    console.log(`情報収集プランデータをクライアントに送信中: roleModelId=${roleModelId}`);
    
    // データベースから情報収集プランを取得
    const plans = await getInformationCollectionPlansForRoleModel(roleModelId);
    
    // ロールモデル情報も取得
    const roleModel = await db.query.roleModels.findFirst({
      where: eq(roleModels.id, roleModelId)
    });
    
    if (!roleModel) {
      console.log(`ロールモデル ${roleModelId} が見つかりません`);
      return false;
    }
    
    // データを送信
    ws.send(JSON.stringify({
      type: 'information_collection_plans',
      roleModelId,
      message: '情報収集プランを取得しました',
      status: 'success',
      data: { 
        plans,
        roleModel: { id: roleModel.id, name: roleModel.name }
      },
      timestamp: new Date().toISOString()
    }));
    
    console.log(`情報収集プランの送信が完了しました: roleModelId=${roleModelId}, ${plans.length}件のプラン`);
    return true;
  } catch (error) {
    console.error(`情報収集プランデータの送信エラー: ${error}`);
    
    // エラー通知を送信
    ws.send(JSON.stringify({
      type: 'information_collection_error',
      roleModelId,
      message: '情報収集プランの取得中にエラーが発生しました',
      status: 'error',
      timestamp: new Date().toISOString()
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
  sendSocketMessage?: (type: string, data: any) => void
) {
  try {
    const data = {
      type: 'information_plan_update',
      updateType,
      roleModelId,
      plan: planData,
      timestamp: new Date().toISOString()
    };
    
    // WebSocket経由で通知（sendSocketMessage関数が提供されている場合）
    if (sendSocketMessage) {
      sendSocketMessage('information_plan_update', data);
    }
    
    console.log(`情報収集プラン更新通知を送信: ${roleModelId}, type=${updateType}`);
  } catch (error) {
    console.error(`情報収集プラン更新通知エラー: ${error}`);
  }
}