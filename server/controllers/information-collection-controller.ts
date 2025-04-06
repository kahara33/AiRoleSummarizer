import { Request, Response } from 'express';
import { PlannerAgent } from '../agents/planner-agent';
import { db } from '../db';
import { informationCollectionPlans, knowledgeNodes } from '@shared/schema';
import { sendErrorMessage, sendCompletionMessage, sendProgressUpdate } from '../websocket';
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

    if (industryIds.length === 0) {
      return res.status(400).json({ error: '少なくとも1つの業界を選択してください' });
    }

    if (keywordIds.length === 0) {
      return res.status(400).json({ error: '少なくとも1つのキーワードを選択してください' });
    }

    // 既存の進行中プランがあるか確認
    const existingPlan = await db.query.informationCollectionPlans.findFirst({
      where: eq(informationCollectionPlans.roleModelId, roleModelId),
      orderBy: (informationCollectionPlans, { desc }) => [desc(informationCollectionPlans.createdAt)]
    });

    // 既存のプランが1時間以内に作成されていて、status='in_progress'の場合は処理をブロック
    if (existingPlan && existingPlan.status === 'in_progress') {
      const planCreatedAt = new Date(existingPlan.createdAt);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (planCreatedAt > oneHourAgo) {
        return res.status(409).json({ 
          error: '既に進行中のプラン作成があります。処理が完了するまでお待ちください',
          planId: existingPlan.id
        });
      }
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

    // 初期進捗メッセージを送信
    sendProgressUpdate(
      '情報収集プランの作成を開始します',
      5,
      roleModelId,
      {
        message: '情報収集プランの作成を開始します',
        progress: 5,
        stage: 'initialization',
        subStage: '前処理'
      }
    );

    // 非同期でプランを作成 - 明示的なユーザーID取得と例外処理の強化
    const userId = req.user?.id || 'development-user-id';
    
    // 開発環境では、ユーザーIDがない場合にはデフォルト値を使用
    if (process.env.NODE_ENV !== 'production' && !req.user?.id) {
      console.log('開発環境: デフォルトユーザーIDを使用します');
    }

    // プランの状態を「進行中」として保存
    const [initialPlan] = await db.insert(informationCollectionPlans).values({
      roleModelId,
      planData: JSON.stringify({ 
        status: 'initializing',
        industryIds,
        keywordIds,
        timestamp: new Date().toISOString()
      }),
      status: 'in_progress',
      updatedBy: userId
    }).returning();
    
    console.log('初期プラン状態を保存しました:', initialPlan.id);
    
    createPlanAsync(roleModelId, industryIds, keywordIds, knowledgeNodesList, userId, initialPlan.id)
      .then(result => {
        console.log('情報収集プラン作成成功:', result.id);
      })
      .catch(error => {
        console.error('情報収集プラン作成エラー:', error);
        
        // エラー情報をデータベースに保存
        db.update(informationCollectionPlans)
          .set({ 
            status: 'error',
            planData: JSON.stringify({ 
              status: 'error',
              error: error.message || 'エラーの詳細は不明です',
              timestamp: new Date().toISOString() 
            })
          })
          .where(eq(informationCollectionPlans.id, initialPlan.id))
          .execute()
          .catch(dbError => {
            console.error('エラー状態の保存に失敗しました:', dbError);
          });

        // エラーメッセージをクライアントに送信
        sendErrorMessage(
          `情報収集プランの作成中にエラーが発生しました: ${error.message || 'エラーの詳細は不明です'}`,
          roleModelId,
          { 
            error: error.message || 'エラーの詳細は不明です',
            planId: initialPlan.id,
            stackTrace: error.stack
          }
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
  userId: string,
  initialPlanId?: string
) {
  try {
    // 進捗メッセージ送信用のヘルパー関数
    const updateProgress = (message: string, progress: number, stage: string, subStage: string = '') => {
      sendProgressUpdate(message, progress, roleModelId, {
        message,
        progress,
        stage,
        subStage
      });
      
      // 初期プランIDが与えられていれば状態も更新
      if (initialPlanId) {
        try {
          db.update(informationCollectionPlans)
            .set({ 
              planData: JSON.stringify({ 
                status: 'in_progress',
                currentStage: stage,
                currentSubStage: subStage,
                progress,
                message,
                timestamp: new Date().toISOString() 
              })
            })
            .where(eq(informationCollectionPlans.id, initialPlanId))
            .execute()
            .catch(err => {
              console.warn('進捗状態の更新に失敗:', err);
            });
        } catch (dbErr) {
          console.warn('進捗状態の更新でエラー:', dbErr);
        }
      }
    };

    // PlannerAgentのインスタンス化
    updateProgress('プランナーエージェントを初期化しています', 10, 'initialization', 'agent_setup');
    const plannerAgent = new PlannerAgent(roleModelId, userId);
    
    // プランナーエージェントに進捗報告コールバックを設定
    let lastReportedProgress = 10;
    plannerAgent.onProgressUpdate = (progressData) => {
      // 進捗が前回から5%以上変化した場合にのみ報告
      if (progressData.progress - lastReportedProgress >= 5 || progressData.progress >= 100) {
        lastReportedProgress = progressData.progress;
        updateProgress(
          progressData.message || `進捗: ${progressData.progress}%`,
          progressData.progress,
          progressData.stage || 'processing',
          progressData.subStage || ''
        );
      }
    };
    
    updateProgress('情報収集プランの作成を開始します', 15, 'analysis', 'preparing_data');
    
    // 情報収集プランの作成
    const planData = await plannerAgent.createInformationCollectionPlan(
      industryIds,
      keywordIds,
      knowledgeNodesList
    );
    
    // 処理完了の進捗更新
    updateProgress('情報収集プランが完成しました。データを保存しています', 95, 'finalization', 'saving_data');
    
    // データベースに情報収集プランを保存または更新
    let savedPlan;
    
    if (initialPlanId) {
      // 既存のプランを更新
      [savedPlan] = await db.update(informationCollectionPlans)
        .set({
          planData: JSON.stringify(planData),
          status: 'completed',
          updatedBy: userId,
          updatedAt: new Date()
        })
        .where(eq(informationCollectionPlans.id, initialPlanId))
        .returning();
    } else {
      // 新しいプランを作成
      [savedPlan] = await db.insert(informationCollectionPlans)
        .values({
          roleModelId,
          planData: JSON.stringify(planData),
          status: 'completed',
          updatedBy: userId
        })
        .returning();
    }
    
    // 完了メッセージの送信
    sendCompletionMessage(
      '情報収集プランの作成が完了しました',
      roleModelId,
      { 
        planId: savedPlan.id,
        planSummary: planData.summary || '情報収集プランが正常に作成されました',
        industryCount: industryIds.length,
        keywordCount: keywordIds.length
      }
    );
    
    // 最終進捗更新
    updateProgress('情報収集プランの作成が完了しました', 100, 'completed', 'all_done');
    
    return savedPlan;
  } catch (error) {
    console.error('プラン作成エラー:', error);
    
    // エラー進捗更新
    sendProgressUpdate(
      `エラーが発生しました: ${error.message || 'エラーの詳細は不明です'}`,
      0,
      roleModelId,
      {
        message: `エラーが発生しました: ${error.message || 'エラーの詳細は不明です'}`,
        progress: 0,
        stage: 'error',
        subStage: 'process_failed'
      }
    );
    
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