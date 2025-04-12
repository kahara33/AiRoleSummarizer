/**
 * 情報収集プラン関連のサービス関数
 */
import { db } from './db';
import { eq, and, desc, asc } from 'drizzle-orm';
import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { 
  collectionPlans, 
  InformationCollectionPlan, 
  InformationCollectionPlanData,
  CollectionPlan
} from '@shared/schema';

/**
 * 特定のロールモデルIDに関連する情報収集プランを取得する
 * @param roleModelId ロールモデルID
 * @returns 情報収集プランの配列とPromise
 */
export async function getInformationCollectionPlansForRoleModel(roleModelId: string): Promise<InformationCollectionPlan[]> {
  try {
    console.log(`ロールモデルID ${roleModelId} の情報収集プランを取得します`);
    
    // データベースからロールモデルIDに一致するプランを取得
    const dbPlans = await db.query.collectionPlans.findMany({
      where: eq(collectionPlans.roleModelId, roleModelId),
      orderBy: [
        // orderフィールドがある場合はそれでソート、なければ作成日時で降順ソート
        asc(collectionPlans.order),
        desc(collectionPlans.createdAt)
      ]
    });
    
    console.log(`${dbPlans.length}件の情報収集プランを取得しました`);
    
    // データベースのプランをInformationCollectionPlan型に変換
    return dbPlans.map(plan => ({
      id: plan.id,
      roleModelId: plan.roleModelId,
      title: plan.title,
      description: plan.description || undefined,
      content: plan.content || "",
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      order: plan.order || undefined,
      tags: plan.tags as string[] || [],
      status: plan.status || "active",
      priority: plan.priority || "medium",
      metaData: plan.metaData as Record<string, any> || {}
    }));
  } catch (error) {
    console.error(`情報収集プラン取得エラー: ${error}`);
    // 空の配列を返す（エラーの場合でも処理を続行できるように）
    return [];
  }
}

/**
 * 情報収集プランを作成または更新する
 * @param planData 情報収集プランのデータ
 * @returns 作成または更新された情報収集プラン
 */
export async function saveInformationCollectionPlan(planData: InformationCollectionPlanData): Promise<InformationCollectionPlan> {
  try {
    const now = new Date();
    let savedPlan: InformationCollectionPlan;
    
    // 更新の場合
    if (planData.id) {
      console.log(`既存の情報収集プラン ${planData.id} を更新します`);
      
      // 既存のプランをデータベースから検索
      const existingPlan = await db.query.collectionPlans.findFirst({
        where: eq(collectionPlans.id, planData.id)
      });
      
      if (existingPlan) {
        // 既存のプランを更新
        const result = await db.update(collectionPlans)
          .set({
            title: planData.title,
            description: planData.description,
            content: planData.content || '',
            updatedAt: now,
            order: planData.order,
            tags: planData.tags as any,
            status: planData.status || 'active',
            priority: planData.priority || 'medium',
            metaData: planData.metaData as any
          })
          .where(eq(collectionPlans.id, planData.id))
          .returning();
        
        const updatedPlan = result[0];
        savedPlan = {
          id: updatedPlan.id,
          roleModelId: updatedPlan.roleModelId,
          title: updatedPlan.title,
          description: updatedPlan.description || '',
          content: updatedPlan.content || '',
          createdAt: updatedPlan.createdAt,
          updatedAt: updatedPlan.updatedAt,
          order: updatedPlan.order,
          tags: updatedPlan.tags as string[] || [],
          status: updatedPlan.status || 'active',
          priority: updatedPlan.priority || 'medium',
          metaData: updatedPlan.metaData as Record<string, any> || {}
        };
        
        console.log(`情報収集プラン ${updatedPlan.id} を更新しました`);
      } else {
        // IDが指定されているが存在しない場合は新規作成
        console.log(`指定されたID ${planData.id} の情報収集プランが見つかりません。新規作成します。`);
        return await createNewPlan(planData, now);
      }
    } else {
      // 新規作成
      savedPlan = await createNewPlan(planData, now);
    }
    
    return savedPlan;
  } catch (error) {
    console.error(`情報収集プラン保存エラー: ${error}`);
    throw error;
  }
}

/**
 * 新しい情報収集プランを作成する（内部ヘルパー関数）
 * @param planData プランデータ
 * @param creationDate 作成日時
 * @returns 作成された情報収集プラン
 */
async function createNewPlan(planData: InformationCollectionPlanData, creationDate: Date): Promise<InformationCollectionPlan> {
  const planId = planData.id || randomUUID();
  
  console.log(`新しい情報収集プラン ${planId} を作成します`);
  
  // 新規プランをデータベースに挿入
  const result = await db.insert(collectionPlans)
    .values({
      id: planId,
      roleModelId: planData.roleModelId,
      title: planData.title || '新しい情報収集プラン',
      description: planData.description,
      content: planData.content || '',
      createdAt: creationDate,
      updatedAt: creationDate,
      order: planData.order,
      tags: planData.tags as any,
      status: planData.status || 'active',
      priority: planData.priority || 'medium',
      metaData: planData.metaData as any
    })
    .returning();
  
  const newPlan = result[0];
  
  // 返却用のオブジェクトを作成
  const createdPlan: InformationCollectionPlan = {
    id: newPlan.id,
    roleModelId: newPlan.roleModelId,
    title: newPlan.title,
    description: newPlan.description || '',
    content: newPlan.content || '',
    createdAt: newPlan.createdAt,
    updatedAt: newPlan.updatedAt,
    order: newPlan.order,
    tags: newPlan.tags as string[] || [],
    status: newPlan.status || 'active',
    priority: newPlan.priority || 'medium',
    metaData: newPlan.metaData as Record<string, any> || {}
  };
  
  console.log(`情報収集プラン ${newPlan.id} を作成しました`);
  
  return createdPlan;
}

/**
 * 情報収集プランを削除する
 * @param planId 情報収集プランのID
 * @returns 削除結果
 */
export async function deleteInformationCollectionPlan(planId: string) {
  try {
    console.log(`情報収集プラン ${planId} の削除を試みます`);
    
    // 削除前にプランを取得
    const existingPlan = await db.query.collectionPlans.findFirst({
      where: eq(collectionPlans.id, planId)
    });
    
    if (existingPlan) {
      console.log(`情報収集プラン ${planId} が見つかりました。削除します。`);
      
      // プランをデータベースから削除
      await db.delete(collectionPlans)
        .where(eq(collectionPlans.id, planId));
      
      // 削除されたプランを返す
      const deletedPlan: InformationCollectionPlan = {
        id: existingPlan.id,
        roleModelId: existingPlan.roleModelId || '',
        title: existingPlan.title,
        description: existingPlan.description || '',
        content: '', // データベーススキーマに content フィールドがないため空文字を設定
        createdAt: existingPlan.createdAt || new Date(),
        updatedAt: existingPlan.updatedAt || new Date(),
        status: 'deleted', // 削除されたことを示すステータス
        metaData: existingPlan.toolsConfig || {} // metaDataフィールドがないため、ツール設定を流用
      };
      
      console.log(`情報収集プラン ${planId} を削除しました`);
      
      return {
        success: true,
        planId,
        message: '情報収集プランを削除しました',
        plan: deletedPlan
      };
    }
    
    console.log(`情報収集プラン ${planId} が見つかりませんでした`);
    
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
  sendSocketMessage: (targetRoleModelId: string | string[] | undefined, type: string, data: any) => void
): void {
  try {
    sendSocketMessage(roleModelId, 'information_plan_update', {
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