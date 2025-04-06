import { Request, Response } from 'express';
import { PlannerAgent } from '../agents/planner-agent';
import { db } from '../db';
import { informationCollectionPlans, knowledgeNodes } from '@shared/schema';
import { sendErrorMessage, sendCompletionMessage } from '../websocket';
import { eq, and } from 'drizzle-orm';

/**
 * 情報収集プランを作成するコントローラー
 * @param req リクエスト
 * @param res レスポンス
 */
export async function createInformationCollectionPlan(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const { roleModelId, industryIds, keywordIds } = req.body;

    if (!roleModelId) {
      return res.status(400).json({ error: 'roleModelIdは必須です' });
    }

    if (!Array.isArray(industryIds) || !Array.isArray(keywordIds)) {
      return res.status(400).json({ error: 'industryIdsとkeywordIdsは配列である必要があります' });
    }

    // 知識グラフノードの取得
    const knowledgeNodesList = await db.query.knowledgeNodes.findMany({
      where: eq(knowledgeNodes.roleModelId, roleModelId)
    });

    if (knowledgeNodesList.length === 0) {
      return res.status(404).json({ error: '指定されたロールモデルIDに対応する知識グラフが見つかりません' });
    }

    // 初期レスポンスを送信
    res.status(202).json({
      message: '情報収集プランの作成を開始しました。WebSocketで進捗状況を確認できます',
      roleModelId
    });

    // 非同期でプランを作成 - 明示的なユーザーID取得と例外処理の強化
    const userId = req.user?.id || 'development-user-id';
    
    // 開発環境では、ユーザーIDがない場合にはデフォルト値を使用
    if (process.env.NODE_ENV !== 'production' && !req.user?.id) {
      console.log('開発環境: デフォルトユーザーIDを使用します');
    }
    
    createPlanAsync(roleModelId, industryIds, keywordIds, knowledgeNodesList, userId)
      .then(result => {
        console.log('情報収集プラン作成成功:', result.id);
      })
      .catch(error => {
        console.error('情報収集プラン作成エラー:', error);
        sendErrorMessage(
          `情報収集プランの作成中にエラーが発生しました: ${error.message || 'エラーの詳細は不明です'}`,
          roleModelId,
          { error: error.message || 'エラーの詳細は不明です' }
        );
      });
  } catch (error) {
    console.error('リクエスト処理エラー:', error);
    return res.status(500).json({ error: `サーバーエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}` });
  }
}

/**
 * 情報収集プランを作成する非同期処理
 */
async function createPlanAsync(
  roleModelId: string,
  industryIds: string[],
  keywordIds: string[],
  knowledgeNodesList: any[],
  userId: string
) {
  try {
    // PlannerAgentのインスタンス化
    const plannerAgent = new PlannerAgent(roleModelId, userId);
    
    // 情報収集プランの作成
    const planData = await plannerAgent.createInformationCollectionPlan(
      industryIds,
      keywordIds,
      knowledgeNodesList
    );
    
    // データベースに情報収集プランを保存
    const [savedPlan] = await db.insert(informationCollectionPlans).values({
      roleModelId,
      planData: JSON.stringify(planData),
      updatedBy: userId
    }).returning();
    
    // 完了メッセージの送信
    sendCompletionMessage(
      '情報収集プランの作成が完了しました',
      roleModelId,
      { planId: savedPlan.id }
    );
    
    return savedPlan;
  } catch (error) {
    console.error('プラン作成エラー:', error);
    throw error;
  }
}

/**
 * 情報収集プランを取得するコントローラー
 * @param req リクエスト
 * @param res レスポンス
 */
export async function getInformationCollectionPlan(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '認証が必要です' });
    }

    const { roleModelId } = req.params;

    if (!roleModelId) {
      return res.status(400).json({ error: 'roleModelIdは必須です' });
    }

    // 最新の情報収集プランを取得
    const plan = await db.query.informationCollectionPlans.findFirst({
      where: eq(informationCollectionPlans.roleModelId, roleModelId),
      orderBy: (informationCollectionPlans, { desc }) => [desc(informationCollectionPlans.createdAt)]
    });

    if (!plan) {
      return res.status(404).json({ error: '指定されたロールモデルIDに対応する情報収集プランが見つかりません' });
    }

    // プランデータをJSONに変換して返す
    const planData = JSON.parse(plan.planData);
    
    return res.status(200).json({
      id: plan.id,
      roleModelId: plan.roleModelId,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      plan: planData
    });
  } catch (error) {
    console.error('プラン取得エラー:', error);
    return res.status(500).json({ error: `サーバーエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}` });
  }
}