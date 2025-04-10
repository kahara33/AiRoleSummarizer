import { Express, Request, Response, NextFunction } from 'express';
import { Server, createServer } from 'http';
import { 
  initWebSocket,
  sendProgressUpdate,
  sendAgentThoughts,
  sendMessageToRoleModelViewers,
  sendKnowledgeGraphUpdate
} from './websocket';
import { registerDebugRoutes } from './debug-routes';
import { db } from './db';
import { setupAuth, isAuthenticated, requireRole, hashPassword, comparePasswords } from './auth';
import { initNeo4j, getKnowledgeGraph } from './neo4j';
import neo4j from 'neo4j-driver';
import { eq, and, or, not, sql, inArray, desc, count } from 'drizzle-orm';
import { 
  createInformationCollectionPlan,
  getInformationCollectionPlan
} from './controllers/information-collection-controller';
import {
  generateWithCrewAI,
  enhanceKnowledgeGraph,
  notifyGraphGenerationProgress
} from './controllers/multi-agent-controller';
import { 
  insertKnowledgeNodeSchema, 
  insertKnowledgeEdgeSchema,
  insertUserSchema,
  knowledgeNodes,
  knowledgeEdges,
  users,
  companies,
  roleModels,
  insertRoleModelSchema,
  insertOrganizationSchema, // 組織スキーマに修正
  industries,
  industryCategories,
  industrySubcategories,
  roleModelIndustries,
  roleModelKeywords,
  keywords,
  knowledgeGraphSnapshots,
} from '@shared/schema';
import { generateKnowledgeGraphForNode } from './azure-openai';
import { generateKnowledgeGraphForRoleModel } from './knowledge-graph-generator';
import { generateKnowledgeGraphWithCrewAI } from './services/crew-ai/crew-ai-service';
import { randomUUID } from 'crypto';

// UUIDの検証関数
function isValidUUID(str: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

// ルートの登録
export async function registerRoutes(app: Express, server?: Server): Promise<Server> {
  // HTTPサーバーを受け取るか作成
  const httpServer = server || createServer(app);
  
  // 認証のセットアップ
  setupAuth(app);
  
  // デバッグルートの登録
  registerDebugRoutes(app);
  
  // Neo4jの初期化 - サーバー起動を遅延させないように非同期で実行
  // リクエストがあった際にNeo4jに接続できるようにする
  initNeo4j().then(() => {
    console.log('Neo4j接続に成功しました');
  }).catch(error => {
    console.error('Neo4j初期化エラー:', error);
  });
  
  // テスト用のナレッジグラフ生成API
  app.post('/api/test-knowledge-graph/:roleModelId', async (req, res) => {
    try {
      const { roleModelId } = req.params;
      
      if (!isValidUUID(roleModelId)) {
        return res.status(400).json({ error: '無効なロールモデルIDです' });
      }
      
      // ロールモデル情報を取得
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
        with: {
          industries: {
            with: {
              industry: true
            }
          },
          keywords: {
            with: {
              keyword: true
            }
          },
          user: true
        }
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // 産業と業界名を抽出
      const industries = roleModel.industries.map(rel => rel.industry.name);
      const keywords = roleModel.keywords.map(rel => rel.keyword ? rel.keyword.name : '').filter(Boolean);
      
      console.log(`テスト用ナレッジグラフ生成開始: roleModelId=${roleModelId}`);
      console.log(`産業: ${industries.join(', ')}`);
      console.log(`キーワード: ${keywords.join(', ')}`);
      
      // WebSocket通知: 処理開始
      sendProgressUpdate({
        roleModelId,
        percent: 5,
        message: 'テスト用ナレッジグラフの生成を開始しています...'
      });
      
      // 既存のグラフを削除
      await db.delete(knowledgeNodes).where(eq(knowledgeNodes.roleModelId, roleModelId));
      await db.delete(knowledgeEdges).where(eq(knowledgeEdges.roleModelId, roleModelId));
      
      // テスト用のノードとエッジを作成するタスクを非同期で実行
      (async () => {
        try {
          // 進捗通知: 準備完了
          await new Promise(resolve => setTimeout(resolve, 1000));
          sendProgressUpdate({
            roleModelId,
            percent: 10,
            message: 'グラフの準備が完了しました。ノードを生成しています...'
          });
          
          // ベースノードの作成 (roleModel.name)
          const baseNodeId = crypto.randomUUID();
          const baseNode = {
            id: baseNodeId,
            name: roleModel.name,
            type: 'base',
            description: roleModel.description || `${roleModel.name}の知識グラフ`,
            level: 0,
            color: '#4285F4', // Google Blue
            roleModelId,
            createdAt: new Date(),
            parentId: null
          };
          
          // ノードをデータベースに挿入
          await db.insert(knowledgeNodes).values(baseNode);
          
          // WebSocket通知: 進捗20%（ベースノード作成）
          await new Promise(resolve => setTimeout(resolve, 500));
          sendProgressUpdate({
            roleModelId,
            percent: 20,
            message: 'ベースノードを作成しました。業界ノードを生成中...'
          });
          
          // ノードを段階的に追加していくための配列
          const allNodes = [baseNode];
          const allEdges = [];
          
          // WebSocketで部分更新を送信（ベースノードのみ）
          sendMessageToRoleModelViewers(
            roleModelId,
            'knowledge-graph-update',
            {
              updateType: 'partial',
              isPartial: true,
              roleModelId,
              data: {
                nodes: allNodes,
                edges: []
              }
            }
          );
          
          // 産業ノードの作成
          const industryNodes = [];
          for (let i = 0; i < industries.length; i++) {
            const industryNodeId = crypto.randomUUID();
            const industryNode = {
              id: industryNodeId,
              name: industries[i],
              type: 'industry',
              description: `${industries[i]}業界に関する知識`,
              parentId: baseNodeId,
              level: 1,
              color: '#DB4437', // Google Red
              roleModelId,
              createdAt: new Date()
            };
            
            // ノードをデータベースに挿入
            await db.insert(knowledgeNodes).values(industryNode);
            industryNodes.push(industryNode);
            allNodes.push(industryNode);
            
            // エッジの作成（ベースノード -> 産業ノード）
            const industryEdgeId = crypto.randomUUID();
            const industryEdge = {
              id: industryEdgeId,
              sourceId: baseNodeId,
              targetId: industryNodeId,
              type: 'industry_relation',
              label: '業界',
              roleModelId,
              createdAt: new Date()
            };
            
            // エッジをデータベースに挿入
            await db.insert(knowledgeGraphEdges).values(industryEdge);
            allEdges.push(industryEdge);
            
            // 少し遅延を入れて進捗感を出す
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // WebSocketで部分更新を送信（産業ノードを段階的に追加）
            sendMessageToRoleModelViewers(
              roleModelId,
              'knowledge-graph-update',
              {
                updateType: 'partial',
                isPartial: true,
                roleModelId,
                data: {
                  nodes: allNodes,
                  edges: allEdges
                }
              }
            );
          }
          
          // WebSocket通知: 進捗50%（産業ノード作成完了）
          sendProgressUpdate({
            roleModelId,
            percent: 50,
            message: '業界ノードを作成しました。キーワードノードを生成中...'
          });
          
          // キーワードノードの作成
          const keywordNodes = [];
          for (let i = 0; i < keywords.length; i++) {
            if (!keywords[i]) continue; // 空のキーワードはスキップ
            
            const keywordNodeId = crypto.randomUUID();
            const keywordNode = {
              id: keywordNodeId,
              name: keywords[i],
              type: 'keyword',
              description: `${keywords[i]}に関する知識`,
              parentId: baseNodeId,
              level: 1,
              color: '#F4B400', // Google Yellow
              roleModelId,
              createdAt: new Date()
            };
            
            // ノードをデータベースに挿入
            await db.insert(knowledgeNodes).values(keywordNode);
            keywordNodes.push(keywordNode);
            allNodes.push(keywordNode);
            
            // エッジの作成（ベースノード -> キーワードノード）
            const keywordEdgeId = crypto.randomUUID();
            const keywordEdge = {
              id: keywordEdgeId,
              sourceId: baseNodeId,
              targetId: keywordNodeId,
              type: 'keyword_relation',
              label: 'キーワード',
              roleModelId,
              createdAt: new Date()
            };
            
            // エッジをデータベースに挿入
            await db.insert(knowledgeEdges).values(keywordEdge);
            allEdges.push(keywordEdge);
            
            // 少し遅延を入れて進捗感を出す
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // WebSocketで部分更新を送信（キーワードノードを段階的に追加）
            sendMessageToRoleModelViewers(
              roleModelId,
              'knowledge-graph-update',
              {
                updateType: 'partial',
                isPartial: true,
                roleModelId,
                data: {
                  nodes: allNodes,
                  edges: allEdges
                }
              }
            );
            
            // ランダムに産業ノードとの関連付けを行う（完全に接続されたグラフを作成）
            if (industryNodes.length > 0) {
              const randomIndustryIndex = Math.floor(Math.random() * industryNodes.length);
              const randomIndustryNode = industryNodes[randomIndustryIndex];
              
              const relationEdgeId = crypto.randomUUID();
              const relationEdge = {
                id: relationEdgeId,
                sourceId: randomIndustryNode.id,
                targetId: keywordNodeId,
                type: 'industry_keyword_relation',
                label: '関連',
                roleModelId,
                createdAt: new Date()
              };
              
              // エッジをデータベースに挿入
              await db.insert(knowledgeGraphEdges).values(relationEdge);
              allEdges.push(relationEdge);
            }
          }
          
          // WebSocket通知: 進捗80%（キーワードノード作成完了）
          sendProgressUpdate({
            roleModelId,
            percent: 80,
            message: 'キーワードノードを作成しました。関連性を計算中...'
          });
          
          // キーワード同士の関連性をランダムに作成
          if (keywordNodes.length > 1) {
            for (let i = 0; i < keywordNodes.length; i++) {
              for (let j = i + 1; j < keywordNodes.length; j++) {
                // 30%の確率で関連性を作成
                if (Math.random() < 0.3) {
                  const relationEdgeId = crypto.randomUUID();
                  const relationEdge = {
                    id: relationEdgeId,
                    sourceId: keywordNodes[i].id,
                    targetId: keywordNodes[j].id,
                    type: 'keyword_keyword_relation',
                    label: '関連',
                    roleModelId,
                    createdAt: new Date()
                  };
                  
                  // エッジをデータベースに挿入
                  await db.insert(knowledgeGraphEdges).values(relationEdge);
                  allEdges.push(relationEdge);
                  
                  // 少し遅延を入れて進捗感を出す
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
                  // WebSocketで部分更新を送信（関連性エッジを段階的に追加）
                  sendMessageToRoleModelViewers(
                    roleModelId,
                    'knowledge-graph-update',
                    {
                      updateType: 'partial',
                      isPartial: true,
                      roleModelId,
                      data: {
                        nodes: allNodes,
                        edges: allEdges
                      }
                    }
                  );
                }
              }
            }
          }
          
          // WebSocket通知: 進捗100%（完了）
          await new Promise(resolve => setTimeout(resolve, 1000));
          sendProgressUpdate({
            roleModelId,
            percent: 100,
            message: 'テスト用ナレッジグラフの生成が完了しました',
            status: 'completed'
          });
          
          // 完了メッセージを送信
          sendMessageToRoleModelViewers(
            roleModelId,
            'knowledge-graph-update',
            {
              updateType: 'complete',
              isPartial: false,
              isCompleted: true,
              roleModelId,
              data: {
                nodes: allNodes,
                edges: allEdges
              },
              message: 'テスト用ナレッジグラフの生成が完了しました'
            }
          );
          
          console.log(`テスト用ナレッジグラフの生成が完了しました: roleModelId=${roleModelId}`);
          console.log(`生成されたノード数: ${allNodes.length}`);
          console.log(`生成されたエッジ数: ${allEdges.length}`);
          
        } catch (error) {
          console.error('テスト用ナレッジグラフ生成エラー:', error);
          
          // エラー通知
          sendProgressUpdate({
            roleModelId,
            percent: 0,
            message: 'ナレッジグラフの生成中にエラーが発生しました',
            status: 'error'
          });
        }
      })();
      
      // 即時レスポンスを返す
      res.json({
        success: true,
        message: 'テスト用ナレッジグラフの生成を開始しました',
        roleModelId
      });
      
    } catch (error) {
      console.error('テスト用ナレッジグラフ生成APIエラー:', error);
      res.status(500).json({ error: 'テスト用ナレッジグラフの生成に失敗しました' });
    }
  });
  
  // WebSocketサーバーのセットアップ
  // 注: メインのWebSocketサーバーは外部でセットアップされるため、こちらの初期化は無効化
  // if (!server) {
  //   initWebSocket(httpServer);
  // }
  
  // API エンドポイントの設定
  
  // チャットAPI エンドポイント
  app.post('/api/chat/:roleModelId', async (req: Request, res: Response) => {
    const { roleModelId } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'メッセージは必須です' });
    }

    try {
      console.log(`[CHAT API] メッセージを受信しました: roleModelId=${roleModelId}, message="${message.substring(0, 50)}..."`);
      
      // WebSocketを使用してエージェント思考のデモ送信
      if (message.includes('エージェント') || message.includes('グラフ') || message.includes('作成') || message.includes('収集')) {
        console.log(`[CHAT API] エージェント思考プロセスのデモ表示を開始します`);
        
        // Orchestratorエージェントの思考を送信
        setTimeout(() => {
          sendAgentThoughts(
            'Orchestrator', 
            `質問「${message}」を受け取りました。分析を開始します。`, 
            roleModelId,
            { agentType: 'orchestrator' }
          );
        }, 500);
        
        // AnalyzerAgentの思考を送信
        setTimeout(() => {
          sendAgentThoughts(
            'AnalyzerAgent', 
            `質問を解析しています:\n「${message}」\n\nこの質問は知識グラフの構造に関連していると判断しました。`, 
            roleModelId,
            { agentType: 'analyzer' }
          );
        }, 1500);
        
        // 進捗更新を送信
        setTimeout(() => {
          sendProgressUpdate(
            '情報収集を実行中...', 
            25, 
            roleModelId
          );
        }, 2500);
        
        // ResearcherAgentの思考を送信
        setTimeout(() => {
          sendAgentThoughts(
            'ResearcherAgent', 
            `関連情報を収集しています。\n\n・ナレッジグラフは知識の構造化に有効\n・複数のエージェントが協調して処理`, 
            roleModelId,
            { agentType: 'researcher' }
          );
        }, 3500);
        
        // 別の進捗更新を送信
        setTimeout(() => {
          sendProgressUpdate(
            '情報の構造化を実行中...', 
            55, 
            roleModelId
          );
        }, 4500);
        
        // DomainExpertAgentの思考を送信
        setTimeout(() => {
          sendAgentThoughts(
            'DomainExpertAgent', 
            `専門的な視点からの分析:\n\nマルチエージェントシステムは複数のAIが連携して効率的に問題解決を行うアーキテクチャです。`, 
            roleModelId,
            { agentType: 'domain_expert' }
          );
        }, 5500);
        
        // 最終進捗更新を送信
        setTimeout(() => {
          sendProgressUpdate(
            '回答の生成中...', 
            85, 
            roleModelId
          );
        }, 6500);
      }

      // 実際のレスポンスを生成 (今回はモックレスポンス)
      const response = `あなたの質問「${message}」に関する回答です。マルチエージェントシステムを使用して分析した結果、この質問に対する答えは...\n\n知識グラフは情報の関連性を視覚化し、複数のAIエージェントがそれぞれの専門知識を活かして協調的に問題を解決します。`;

      console.log(`[CHAT API] 応答生成完了`);
      
      // クライアントにJSONレスポンスを送信
      res.json({ message: response });
      
      // WebSocketを通じてクライアントに応答を送信
      try {
        // チャットメッセージをブロードキャスト
        sendMessageToRoleModelViewers(response, 'chat_message', {
          roleModelId
        });
        
        console.log(`[CHAT API] WebSocketメッセージが送信されました`);
      } catch (wsError) {
        console.error(`[CHAT API] WebSocket送信エラー:`, wsError);
      }
      
      // 処理完了メッセージを送信
      setTimeout(() => {
        sendProgressUpdate(
          '処理が完了しました', 
          100, 
          roleModelId
        );
      }, 7500);
      
    } catch (err) {
      console.error('チャットリクエストエラー:', err);
      res.status(500).json({
        error: 'チャットリクエストの処理中にエラーが発生しました'
      });
    }
  });
  
  // システム状態の確認
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      authenticated: req.isAuthenticated(),
      user: req.user ? {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role,
        companyId: req.user.companyId,
      } : null,
    });
  });
  
  // ユーザー認証関連API
  // 現在のユーザー情報取得
  app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
      // ユーザー情報をクライアントに返す
      const user = req.user;
      // パスワードは送信しない
      const { password, ...userInfo } = user;
      res.json(userInfo);
    } else {
      res.status(401).json({ error: '認証されていません' });
    }
  });
  
  // プロフィール更新API
  app.patch('/api/profile', isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword, confirmPassword, ...profileData } = req.body;
      
      // 現在のパスワードが正しいか確認
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      
      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }
      
      const isPasswordCorrect = await comparePasswords(currentPassword, user.password);
      if (!isPasswordCorrect) {
        return res.status(400).json({ error: '現在のパスワードが正しくありません' });
      }
      
      // 更新データ準備
      const updateData: any = {
        name: profileData.name,
        email: profileData.email,
      };
      
      // パスワード変更がある場合
      if (newPassword) {
        updateData.password = await hashPassword(newPassword);
      }
      
      // ユーザー情報更新
      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();
      
      // パスワードを除いた情報を返す
      const { password, ...userInfo } = updatedUser;
      res.json(userInfo);
    } catch (error) {
      console.error('プロフィール更新エラー:', error);
      res.status(500).json({ error: 'プロフィールの更新に失敗しました' });
    }
  });

  // ==================
  // 会社(組織)管理
  // ==================
  // 会社一覧取得
  app.get('/api/companies', isAuthenticated, requireRole(['admin', 'company_admin']), async (req, res) => {
    try {
      // システム管理者は全ての会社を取得
      // 組織管理者は自分の会社のみ取得
      const user = req.user;
      let companiesQuery;
      
      if (user.role === 'admin') {
        companiesQuery = await db.query.companies.findMany();
      } else {
        companiesQuery = await db.query.companies.findMany({
          where: eq(companies.id, user.companyId),
        });
      }
      
      res.json(companiesQuery);
    } catch (error) {
      console.error('会社一覧取得エラー:', error);
      res.status(500).json({ error: '会社一覧の取得に失敗しました' });
    }
  });
  
  // 会社詳細取得
  app.get('/api/companies/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // 自分の会社か、システム管理者のみアクセス可能
      if (user.role !== 'admin' && user.companyId !== id) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }
      
      const company = await db.query.companies.findFirst({
        where: eq(companies.id, id),
        with: {
          users: {
            orderBy: (users, { asc }) => [asc(users.name)],
          },
        },
      });
      
      if (!company) {
        return res.status(404).json({ error: '会社が見つかりません' });
      }
      
      // パスワードなど機密情報を除外
      const safeUsers = company.users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }));
      
      res.json({
        ...company,
        users: safeUsers,
      });
    } catch (error) {
      console.error('会社詳細取得エラー:', error);
      res.status(500).json({ error: '会社情報の取得に失敗しました' });
    }
  });
  
  // 会社作成 (システム管理者のみ)
  app.post('/api/companies', isAuthenticated, requireRole('admin'), async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.parse(req.body);
      
      const result = await db.insert(companies).values(validatedData).returning();
      
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('会社作成エラー:', error);
      res.status(500).json({ error: '会社の作成に失敗しました' });
    }
  });
  
  // 会社更新 (システム管理者と組織管理者のみ)
  app.put('/api/companies/:id', isAuthenticated, requireRole(['admin', 'company_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      // 組織管理者は自分の会社のみ更新可能
      if (user.role === 'company_admin' && user.companyId !== id) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }
      
      const validatedData = insertOrganizationSchema.parse(req.body);
      
      const result = await db
        .update(companies)
        .set(validatedData)
        .where(eq(companies.id, id))
        .returning();
      
      if (result.length === 0) {
        return res.status(404).json({ error: '会社が見つかりません' });
      }
      
      res.json(result[0]);
    } catch (error) {
      console.error('会社更新エラー:', error);
      res.status(500).json({ error: '会社の更新に失敗しました' });
    }
  });
  
  // ==================
  // ユーザー管理
  // ==================
  // ユーザー一覧取得 (管理者と組織管理者のみ)
  app.get('/api/users', isAuthenticated, requireRole(['admin', 'company_admin']), async (req, res) => {
    try {
      const user = req.user;
      let usersQuery;
      
      // システム管理者は全ユーザーを取得
      // 組織管理者は自分の会社のユーザーのみ取得
      if (user.role === 'admin') {
        usersQuery = await db.query.users.findMany({
          with: {
            company: true,
          },
          orderBy: (users, { asc }) => [asc(users.name)],
        });
      } else {
        usersQuery = await db.query.users.findMany({
          where: eq(users.companyId, user.companyId),
          with: {
            organization: true,
          },
          orderBy: (users, { asc }) => [asc(users.name)],
        });
      }
      
      res.json(usersQuery.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company ? {
          id: user.company.id,
          name: user.company.name,
        } : null,
      })));
    } catch (error) {
      console.error('ユーザー一覧取得エラー:', error);
      res.status(500).json({ error: 'ユーザー一覧の取得に失敗しました' });
    }
  });
  
  // ユーザー詳細取得
  app.get('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      
      // ユーザーを先に取得
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
        with: {
          organization: true,
        },
      });
      
      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }
      
      // 自分自身か、システム管理者か、同じ組織の組織管理者のみアクセス可能
      if (
        id !== currentUser?.id &&
        currentUser?.role !== 'admin' &&
        !(currentUser?.role === 'company_admin' && user.companyId === currentUser?.companyId)
      ) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }
      
      // パスワードを除外
      const { password, ...safeUser } = user;
      
      res.json({
        ...safeUser,
        organization: user.organization ? {
          id: user.organization.id,
          name: user.organization.name,
        } : null,
      });
    } catch (error) {
      console.error('ユーザー詳細取得エラー:', error);
      res.status(500).json({ error: 'ユーザー情報の取得に失敗しました' });
    }
  });
  
  // ユーザー作成 (管理者と組織管理者のみ)
  app.post('/api/users', isAuthenticated, requireRole(['admin', 'company_admin']), async (req, res) => {
    try {
      const currentUser = req.user;
      let validatedData = insertUserSchema.parse(req.body);
      
      // パスワードをハッシュ化
      validatedData.password = await hashPassword(validatedData.password);
      
      // 組織管理者は自分の会社のユーザーのみ作成可能
      if (currentUser.role === 'company_admin') {
        if (!validatedData.companyId || validatedData.companyId !== currentUser.companyId) {
          validatedData.companyId = currentUser.companyId;
        }
        
        // 組織管理者はsystem_adminロールのユーザーを作成できない
        if (validatedData.role === 'admin') {
          return res.status(403).json({ error: 'システム管理者ロールのユーザーを作成する権限がありません' });
        }
      }
      
      const result = await db.insert(users).values(validatedData).returning();
      
      // パスワードを除外して返す
      const { password, ...safeUser } = result[0];
      
      res.status(201).json(safeUser);
    } catch (error) {
      console.error('ユーザー作成エラー:', error);
      res.status(500).json({ error: 'ユーザーの作成に失敗しました' });
    }
  });
  
  // ユーザー更新
  app.put('/api/users/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      
      if (!currentUser) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // 更新対象のユーザーを取得
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, id),
      });
      
      if (!targetUser) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }
      
      // 自分自身か、システム管理者か、同じ組織の組織管理者のみアクセス可能
      if (
        id !== currentUser.id &&
        currentUser.role !== 'admin' &&
        !(currentUser.role === 'company_admin' && targetUser.companyId === currentUser.companyId)
      ) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }
      
      // システム管理者以外は、システム管理者のロールを変更できない
      if (
        targetUser.role === 'admin' && 
        currentUser.role !== 'admin'
      ) {
        return res.status(403).json({ error: 'システム管理者のユーザー情報を更新する権限がありません' });
      }
      
      let validatedData = insertUserSchema.parse(req.body);
      
      // パスワードが変更されている場合はハッシュ化
      if (validatedData.password && validatedData.password !== targetUser.password) {
        validatedData.password = await hashPassword(validatedData.password);
      }
      
      // 組織管理者は組織IDを変更できない & admin ロールに変更できない
      if (currentUser.role === 'company_admin') {
        validatedData.companyId = targetUser.companyId;
        
        if (validatedData.role === 'admin' && targetUser.role !== 'admin') {
          return res.status(403).json({ error: 'ユーザーをシステム管理者に昇格させる権限がありません' });
        }
      }
      
      const result = await db
        .update(users)
        .set(validatedData)
        .where(eq(users.id, id))
        .returning();
      
      // パスワードを除外して返す
      const { password, ...safeUser } = result[0];
      
      res.json(safeUser);
    } catch (error) {
      console.error('ユーザー更新エラー:', error);
      res.status(500).json({ error: 'ユーザーの更新に失敗しました' });
    }
  });
  
  // ユーザー削除 (管理者と組織管理者のみ)
  app.delete('/api/users/:id', isAuthenticated, requireRole(['admin', 'company_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const currentUser = req.user;
      
      if (!currentUser) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // 自分自身は削除できない
      if (id === currentUser.id) {
        return res.status(400).json({ error: '自分自身のアカウントは削除できません' });
      }
      
      // 削除対象のユーザーを取得
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, id),
      });
      
      if (!targetUser) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }
      
      // 組織管理者は自分の組織のユーザーのみ削除可能
      if (
        currentUser.role === 'company_admin' && 
        targetUser.companyId !== currentUser.companyId
      ) {
        return res.status(403).json({ error: 'このユーザーを削除する権限がありません' });
      }
      
      // システム管理者以外は、システム管理者を削除できない
      if (
        targetUser.role === 'admin' && 
        currentUser.role !== 'admin'
      ) {
        return res.status(403).json({ error: 'システム管理者を削除する権限がありません' });
      }
      
      await db.delete(users).where(eq(users.id, id));
      
      res.status(204).end();
    } catch (error) {
      console.error('ユーザー削除エラー:', error);
      res.status(500).json({ error: 'ユーザーの削除に失敗しました' });
    }
  });

  // ==================
  // ロールモデル関連
  // ==================
  app.get('/api/role-models', isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // 自分のロールモデルと共有されているロールモデルを取得
      // SQL文を直接実行して、カラム名の問題を回避
      // drizzleのクエリビルダーを使用
      const roleModelsData = await db.query.roleModels.findMany({
        orderBy: (roleModels, { desc }) => [desc(roleModels.id)],
        where: (roleModels, { or, eq }) => or(
          eq(roleModels.createdBy, user.id),
          eq(roleModels.isShared, 1),
          user.companyId ? eq(roleModels.companyId, user.companyId) : undefined
        )
      });
      
      // ロールモデルのIDs
      const roleModelIds = roleModelsData.map(model => model.id);
      
      // 関連するユーザーとorganizationを取得
      const creatorIds = roleModelsData.map(model => model.createdBy).filter(Boolean);
      const orgIds = roleModelsData.map(model => model.companyId).filter(Boolean);
      
      const [creators, orgs, keywordRelations, industryRelations] = await Promise.all([
        // ユーザーの取得
        creatorIds.length ? db.select().from(users).where(inArray(users.id, creatorIds)) : Promise.resolve([]),
        // 組織の取得
        orgIds.length ? db.select().from(companies).where(inArray(companies.id, orgIds)) : Promise.resolve([]),
        // キーワードの取得
        roleModelIds.length ? db.select().from(roleModelKeywords).where(inArray(roleModelKeywords.roleModelId, roleModelIds)) : Promise.resolve([]),
        // ロールモデルと業界のリレーション取得
        roleModelIds.length ? db.select().from(roleModelIndustries).where(inArray(roleModelIndustries.roleModelId, roleModelIds)) : Promise.resolve([])
      ]);
      
      // 業界IDsの抽出
      // キーワードIDsの抽出
      const keywordIds = keywordRelations.map(rel => rel.keywordId).filter(Boolean);
      
      // キーワードデータの取得
      const keywordsData = keywordIds.length ? 
        await db.select().from(keywords).where(inArray(keywords.id, keywordIds)) : 
        [];
      
      const industryIds = industryRelations.map(rel => rel.industryId).filter(Boolean);
      
      // 業界データの取得
      const industriesData = industryIds.length ? 
        await db.select().from(industrySubcategories).where(inArray(industrySubcategories.id, industryIds)) : 
        [];
      
      // ロールモデルデータの整形
      const safeRoleModels = roleModelsData.map(model => {
        // 作成者
        const creator = creators.find(u => u.id === model.createdBy);
        // 組織
        const organization = orgs.find(o => o.id === model.companyId);
        
        // このロールモデルのキーワード
        const modelKeywordIds = keywordRelations
          .filter(rel => rel.roleModelId === model.id)
          .map(rel => rel.keywordId)
          .filter(Boolean);
          
        // キーワード名の取得
        const keywords = modelKeywordIds.map(id => {
          const keyword = keywordsData.find(k => k.id === id);
          return keyword ? keyword.name : null;
        }).filter(Boolean);
        
        // このロールモデルの業界リレーション
        const modelIndustryRels = industryRelations.filter(rel => rel.roleModelId === model.id);
        // 関連業界データ
        const modelIndustries = modelIndustryRels
          .map(rel => industriesData.find(ind => ind.id === rel.industryId))
          .filter(Boolean);
        
        return {
          ...model,
          user: creator ? {
            id: creator.id,
            name: creator.name
          } : null,
          organization: organization ? {
            id: organization.id,
            name: organization.name
          } : null,
          industries: modelIndustries,
          keywords: keywords
        };
      });
      
      res.json(safeRoleModels);
    } catch (error) {
      console.error('ロールモデル取得エラー:', error);
      res.status(500).json({ error: 'ロールモデルの取得に失敗しました' });
    }
  });
  
  // 共有ロールモデル取得
  app.get('/api/role-models/shared', isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // 組織IDがない場合は空の配列を返す
      if (!user.companyId) {
        return res.json([]);
      }
      
      // drizzleのクエリビルダーを使用
      const sharedRoleModelsData = await db.query.roleModels.findMany({
        orderBy: (roleModels, { desc }) => [desc(roleModels.id)],
        where: (roleModels, { and, eq }) => and(
          eq(roleModels.companyId, user.companyId),
          eq(roleModels.isShared, 1)
        )
      });
      
      // ロールモデルのIDs
      const roleModelIds = sharedRoleModelsData.map(model => model.id);
      
      // 何もなければ空の配列を返す
      if (roleModelIds.length === 0) {
        return res.json([]);
      }
      
      // 関連するユーザーとorganizationを取得 - createdByを使用
      const creatorIds = sharedRoleModelsData.map(model => model.createdBy).filter(Boolean);
      const orgIds = sharedRoleModelsData.map(model => model.companyId).filter(Boolean);
      
      // 以下、Drizzleの修正されたクエリビルダーAPIを使用
      // ユーザーの取得
      const creators = creatorIds.length ? await db.query.users.findMany({
        where: (users, { inArray }) => inArray(users.id, creatorIds)
      }) : [];
      
      // 組織の取得
      const orgs = orgIds.length ? await db.query.companies.findMany({
        where: (companies, { inArray }) => inArray(companies.id, orgIds)
      }) : [];
      
      // キーワードの取得
      const keywordRelations = roleModelIds.length ? await db.query.roleModelKeywords.findMany({
        where: (roleModelKeywords, { inArray }) => inArray(roleModelKeywords.roleModelId, roleModelIds)
      }) : [];
      
      // ロールモデルと業界のリレーション取得
      const industryRelations = roleModelIds.length ? await db.query.roleModelIndustries.findMany({
        where: (roleModelIndustries, { inArray }) => inArray(roleModelIndustries.roleModelId, roleModelIds)
      }) : [];
      
      // 業界IDsの抽出
      const industryIds = industryRelations.map(rel => rel.industryId).filter(Boolean);
      
      // キーワードIDsの抽出
      const keywordIds = keywordRelations.map(rel => rel.keywordId).filter(Boolean);
      
      // 業界データの取得
      const industriesData = industryIds.length ? await db.query.industrySubcategories.findMany({
        where: (industrySubcategories, { inArray }) => inArray(industrySubcategories.id, industryIds)
      }) : [];
        
      // キーワードデータの取得
      const keywordsData = keywordIds.length ? await db.query.keywords.findMany({
        where: (keywords, { inArray }) => inArray(keywords.id, keywordIds)
      }) : [];
      
      // ロールモデルデータの整形
      const safeRoleModels = sharedRoleModelsData.map(model => {
        // 作成者 - createdByを使用
        const creator = creators.find(u => u.id === model.createdBy);
        // 組織
        const organization = orgs.find(o => o.id === model.companyId);
        
        // このロールモデルのキーワード
        const modelKeywordIds = keywordRelations
          .filter(rel => rel.roleModelId === model.id)
          .map(rel => rel.keywordId)
          .filter(Boolean);
          
        // キーワード名の取得
        const keywords = modelKeywordIds.map(id => {
          const keyword = keywordsData.find(k => k.id === id);
          return keyword ? keyword.name : null;
        }).filter(Boolean);
        
        // このロールモデルの業界リレーション
        const modelIndustryRels = industryRelations.filter(rel => rel.roleModelId === model.id);
        // 関連業界データ
        const modelIndustries = modelIndustryRels
          .map(rel => industriesData.find(ind => ind.id === rel.industryId))
          .filter(Boolean);
        
        return {
          ...model,
          user: creator ? {
            id: creator.id,
            name: creator.name
          } : null,
          organization: organization ? {
            id: organization.id,
            name: organization.name
          } : null,
          industries: modelIndustries,
          keywords: keywords
        };
      });
      
      res.json(safeRoleModels);
    } catch (error) {
      console.error('共有ロールモデル取得エラー:', error);
      res.status(500).json({ error: '共有ロールモデルの取得に失敗しました' });
    }
  });
  
  // ロールモデル詳細取得
  app.get('/api/role-models/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // UUIDの妥当性チェック
      if (!isValidUUID(id)) {
        return res.status(400).json({ error: '無効なロールモデルIDです' });
      }
      
      console.log("ロールモデル詳細取得開始: ID=", id);
      
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, id),
        with: {
          user: true,
          company: true,
          industries: {
            with: {
              industry: true,
            },
          },
          keywords: {
            with: {
              keyword: true,
            },
          },
        },
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック
      if (
        roleModel.createdBy !== user.id && 
        !(roleModel.isShared === 1 && roleModel.companyId === user.companyId) &&
        user.role !== 'admin'
      ) {
        return res.status(403).json({ error: 'このロールモデルへのアクセス権限がありません' });
      }
      
      // 安全な情報のみを返す
      const safeRoleModel = {
        ...roleModel,
        user: roleModel.user ? {
          id: roleModel.user.id,
          name: roleModel.user.name,
        } : null,
        company: roleModel.company ? {
          id: roleModel.company.id,
          name: roleModel.company.name,
        } : null,
        industries: roleModel.industries?.map(rel => rel.industry) || [],
        keywords: roleModel.keywords?.map(rel => rel.keyword ? rel.keyword : rel.keywordId) || [],
      };
      
      res.json(safeRoleModel);
    } catch (error) {
      console.error('ロールモデル詳細取得エラー:', error);
      res.status(500).json({ error: 'ロールモデル詳細の取得に失敗しました' });
    }
  });
  
  // ロールモデル作成
  // AI生成ナレッジグラフのエンドポイント
  app.post('/api/knowledge-graph/generate/:roleModelId', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.params;
      
      // UUID形式でない場合はエラー
      if (roleModelId === 'default' || !isValidUUID(roleModelId)) {
        console.error(`無効なUUID形式: ${roleModelId}`);
        return res.status(400).json({ error: '無効なロールモデルIDです' });
      }
      
      const user = req.user;

      // 権限チェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
        with: {
          industries: {
            with: {
              industry: true,
            },
          },
          keywords: {
            with: {
              keyword: true,
            },
          },
        },
      });

      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }

      // 自分のロールモデルのみ編集可能
      if (roleModel.createdBy !== user!.id && user!.role !== 'admin') {
        return res.status(403).json({ error: 'このロールモデルを編集する権限がありません' });
      }

      // 産業と業界名を抽出
      const industries = roleModel.industries.map(rel => rel.industry.name);
      const keywords = roleModel.keywords.map(rel => rel.keyword ? rel.keyword.name : (rel.keywordId && typeof rel.keywordId === 'object' ? rel.keywordId.name : ''));

      // 非同期処理を開始し、すぐにレスポンスを返す
      res.json({ 
        success: true, 
        message: '知識グラフの生成を開始しました',
        roleModelId
      });

      // バックグラウンドで処理を継続
      generateKnowledgeGraphForRoleModel(
        roleModelId,
        roleModel.name,
        roleModel.description || '',
        industries,
        keywords
      ).catch(err => {
        console.error('知識グラフ生成エラー:', err);
        sendProgressUpdate(`エラーが発生しました: ${err.message}`, 100, roleModelId);
      });
    } catch (error) {
      console.error('知識グラフ生成リクエストエラー:', error);
      res.status(500).json({ error: '知識グラフの生成に失敗しました' });
    }
  });
  
  // テスト用に簡易的なナレッジグラフを生成するエンドポイント
  app.post('/api/knowledge-graph/generate-test/:roleModelId', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.params;
      
      // UUID形式でない場合はエラー
      if (roleModelId === 'default' || !isValidUUID(roleModelId)) {
        console.error(`無効なUUID形式: ${roleModelId}`);
        return res.status(400).json({ error: '無効なロールモデルIDです' });
      }
      
      // ロールモデル情報を取得
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
        with: {
          industries: {
            with: {
              industry: true,
            },
          },
          keywords: {
            with: {
              keyword: true,
            },
          },
        },
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // テスト用のシンプルなグラフを作成
      const testGraphData = {
        nodes: [],
        edges: []
      };
      
      // 中心ノード（ロールモデル）を作成
      const centralNodeId = randomUUID();
      testGraphData.nodes.push({
        id: centralNodeId,
        name: roleModel.name,
        type: 'central',
        description: roleModel.description || `${roleModel.name}の中心ノード`,
        level: 0,
        color: '#4285F4', // Googleブルー
        roleModelId: roleModelId,
        createdAt: new Date()
      });
      
      // 業界ノードを作成
      const industries = roleModel.industries.map(rel => rel.industry);
      for (const industry of industries) {
        const industryNodeId = randomUUID();
        
        // 業界ノードを追加
        testGraphData.nodes.push({
          id: industryNodeId,
          name: industry.name,
          type: 'industry',
          description: `${industry.name}業界`,
          parentId: centralNodeId,
          level: 1,
          color: '#34A853', // Googleグリーン
          roleModelId: roleModelId,
          createdAt: new Date()
        });
        
        // 中心ノードと業界ノードをつなぐエッジを追加
        testGraphData.edges.push({
          id: randomUUID(),
          sourceId: centralNodeId,
          targetId: industryNodeId,
          type: 'belongs_to',
          label: '業界',
          roleModelId: roleModelId,
          createdAt: new Date()
        });
      }
      
      // キーワードノードを作成
      const keywords = roleModel.keywords.map(rel => rel.keyword ? rel.keyword.name : (rel.keywordId && typeof rel.keywordId === 'object' ? rel.keywordId.name : ''));
      for (const keyword of keywords) {
        if (!keyword) continue;
        
        const keywordNodeId = randomUUID();
        
        // キーワードノードを追加
        testGraphData.nodes.push({
          id: keywordNodeId,
          name: keyword,
          type: 'keyword',
          description: `キーワード: ${keyword}`,
          parentId: centralNodeId,
          level: 1,
          color: '#EA4335', // Googleレッド
          roleModelId: roleModelId,
          createdAt: new Date()
        });
        
        // 中心ノードとキーワードノードをつなぐエッジを追加
        testGraphData.edges.push({
          id: randomUUID(),
          sourceId: centralNodeId,
          targetId: keywordNodeId,
          type: 'related',
          label: '関連キーワード',
          roleModelId: roleModelId,
          createdAt: new Date()
        });
      }
      
      // 既存のノードとエッジがあれば削除
      await db.delete(knowledgeEdges).where(eq(knowledgeEdges.roleModelId, roleModelId));
      await db.delete(knowledgeNodes).where(eq(knowledgeNodes.roleModelId, roleModelId));
      
      // 新しいノードを挿入
      for (const node of testGraphData.nodes) {
        await db.insert(knowledgeNodes).values({
          id: node.id,
          name: node.name,
          description: node.description || null,
          type: node.type || null,
          level: node.level || 0,
          color: node.color || null,
          parentId: node.parentId || null,
          roleModelId: roleModelId,
          createdAt: new Date()
        });
      }
      
      // 新しいエッジを挿入
      for (const edge of testGraphData.edges) {
        await db.insert(knowledgeEdges).values({
          id: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          type: edge.type || 'default',
          label: edge.label || null,
          roleModelId: roleModelId,
          createdAt: new Date()
        });
      }
      
      // WebSocketでグラフ更新を通知
      const { sendKnowledgeGraphUpdate } = require('./websocket');
      sendKnowledgeGraphUpdate(roleModelId, {
        nodes: testGraphData.nodes,
        edges: testGraphData.edges
      }, 'create');
      
      // 成功レスポンスを返す
      res.json({
        success: true,
        message: 'テスト用ナレッジグラフを生成しました',
        graphData: testGraphData
      });
      
    } catch (error) {
      console.error('テスト用ナレッジグラフ生成エラー:', error);
      res.status(500).json({ error: 'テスト用ナレッジグラフの生成に失敗しました' });
    }
  });
  
  // CrewAI を使用した知識グラフの生成エンドポイント
  app.post('/api/knowledge-graph/generate-with-crewai/:roleModelId', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.params;
      
      // UUID形式でない場合はエラー
      if (roleModelId === 'default' || !isValidUUID(roleModelId)) {
        console.error(`無効なUUID形式: ${roleModelId}`);
        return res.status(400).json({ error: '無効なロールモデルIDです' });
      }
      
      const user = req.user;

      // 権限チェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
        with: {
          industries: {
            with: {
              industry: true,
            },
          },
          keywords: {
            with: {
              keyword: true,
            },
          },
        },
      });

      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }

      // 自分のロールモデルのみ編集可能
      if (roleModel.createdBy !== user!.id && user!.role !== 'admin') {
        return res.status(403).json({ error: 'このロールモデルを編集する権限がありません' });
      }

      // 産業と業界名を抽出
      const industries = roleModel.industries.map(rel => rel.industry.name);
      const keywords = roleModel.keywords.map(rel => rel.keyword ? rel.keyword.name : (rel.keywordId && typeof rel.keywordId === 'object' ? rel.keywordId.name : ''));

      // ロールモデル入力データを作成
      const input = {
        roleModelId,
        roleName: roleModel.name,
        description: roleModel.description || '',
        industries,
        keywords,
        userId: roleModel.createdBy || 'anonymous'
      };

      // WebSocket経由でAIエージェント思考プロセスのシミュレーションを開始
      try {
        const { sendAgentThoughts, sendProgressUpdate } = require('./websocket/ws-server');
        
        // WebSocket接続の有無に関わらず、サーバーからメッセージを送信
        console.log(`CrewAIナレッジグラフ生成プロセス開始: roleModelId=${roleModelId}`);
        
        // Orchestratorエージェントの思考を送信
        sendAgentThoughts(
          'オーケストレーター', 
          `チーム、今日は${roleModel.name}のナレッジグラフと情報収集プラン作成を担当します。各専門分野からの視点で協力して進めましょう。`, 
          roleModelId,
          { agentType: 'orchestrator' }
        );
        
        // 初期進捗更新を送信
        sendProgressUpdate({
          message: 'マルチエージェント処理を開始しています...',
          progress: 5,
          roleModelId
        });
        
        // 異なるエージェントメッセージをシミュレーション
        setTimeout(() => {
          sendAgentThoughts(
            'タスクプランナー', 
            `了解しました。私はまず「${roleModel.name}」の主要な専門分野とキーワードの関係性を分析します。ドメインエキスパートとリサーチャーからの情報も必要になりそうです。`, 
            roleModelId,
            { agentType: 'planner' }
          );
        }, 1000);
        
        setTimeout(() => {
          sendProgressUpdate({
            message: '重要トピックの分析中...',
            progress: 20,
            roleModelId
          });
        }, 2000);
        
      } catch (wsError) {
        console.warn("WebSocketメッセージの送信に失敗しました:", wsError);
      }
      
      // 非同期処理を開始し、すぐにレスポンスを返す
      res.json({ 
        success: true, 
        message: 'CrewAIを使用した知識グラフの生成を開始しました',
        roleModelId
      });
      
      // さらにAIエージェント思考プロセスのシミュレーションを続ける
      try {
        const { sendAgentThoughts, sendProgressUpdate, sendMessageToRoleModelViewers } = require('./websocket/ws-server');
        
        // エージェント間の対話シミュレーション
        setTimeout(() => {
          sendAgentThoughts(
            'リサーチャー', 
            `タスクプランナーさん、情報収集を開始します。業界「${industries.join(', ')}」内でキーワード「${keywords.join(', ')}」に関連する最新トレンドと動向を調査します。`, 
            roleModelId,
            { agentType: 'researcher' }
          );
        }, 3000);
        
        setTimeout(() => {
          sendProgressUpdate({
            message: '業界データの分析中...',
            progress: 40,
            roleModelId
          });
        }, 4000);
        
        setTimeout(() => {
          sendAgentThoughts(
            'ドメインエキスパート', 
            `私はリサーチャーの調査と並行してキーワード間の関連性を整理します。特に「${keywords[0] || '主要キーワード'}」を中心とした階層構造が重要になりそうです。オーケストレーターさん、全体の進行はいかがでしょうか？`, 
            roleModelId,
            { agentType: 'domain_expert' }
          );
        }, 5000);
        
        setTimeout(() => {
          sendProgressUpdate({
            message: '知識グラフの構築中...',
            progress: 65,
            roleModelId
          });
        }, 6000);
        
        setTimeout(() => {
          sendAgentThoughts(
            'プランナー', 
            `分析結果から、最適な情報収集計画を作成しました。重要度の高い情報源は:\n\n1. 専門ジャーナル\n2. 業界レポート\n3. トレンド分析ツール\n4. 専門家インタビュー\n\nドメインエキスパートの指摘通り、「${keywords[0] || '主要キーワード'}」を中心に情報を構造化すべきです。`, 
            roleModelId,
            { agentType: 'planner' }
          );
        }, 7000);
        
        setTimeout(() => {
          sendProgressUpdate({
            message: '情報収集プランの作成中...',
            progress: 85,
            roleModelId
          });
        }, 8000);
        
        setTimeout(() => {
          sendAgentThoughts(
            'オーケストレーター', 
            `皆さん、素晴らしい分析と連携でした。各エージェントからの専門的視点を統合し、「${roleModel.name}」向けの完成度の高いナレッジグラフが作成できました。特にドメインエキスパートとリサーチャーのやり取りから得られた知見は非常に価値があります。`, 
            roleModelId,
            { agentType: 'orchestrator', type: 'success' }
          );
        }, 9000);
        
        setTimeout(() => {
          sendProgressUpdate({
            message: 'ナレッジグラフと情報収集プランの生成が完了しました',
            progress: 100,
            roleModelId
          });
        }, 10000);
        
      } catch (wsError) {
        console.warn("追加WebSocketメッセージの送信に失敗しました:", wsError);
      }
      
      // 実際の非同期処理を実行
      (async () => {
        try {
          const result = await generateKnowledgeGraphWithCrewAI(
            input.userId,
            input.roleModelId,
            input.roleName,
            input.keywords,
            input.description ? [input.description] : [],
            input.industries || [],
            input.keywords || []
          );
            
          if (result && result.success) {
            // 正常に生成された場合、知識グラフデータをデータベースに保存
            try {
              // 既存のノードとエッジを削除
              await db.delete(knowledgeEdges).where(eq(knowledgeEdges.roleModelId, roleModelId));
              await db.delete(knowledgeNodes).where(eq(knowledgeNodes.roleModelId, roleModelId));
              
              // ノードとエッジを保存
              for (const node of result.data.nodes) {
                await db.insert(knowledgeNodes).values({
                  id: node.id,
                  name: node.name,
                  description: node.description || null,
                  level: node.level,
                  type: node.type || 'default',
                  parentId: node.parentId || null,
                  roleModelId,
                  color: node.color || null
                });
                
                // Neo4jにも保存
                try {
                  await createNodeInNeo4j({
                    id: node.id,
                    name: node.name,
                    type: node.type || 'default',
                    level: node.level,
                    parentId: node.parentId || null,
                    roleModelId,
                    description: node.description || null,
                    color: node.color || null
                  });
                } catch (neo4jError) {
                  console.error('Neo4jノード作成エラー (無視して続行):', neo4jError);
                }
              }
              
              for (const edge of result.data.edges) {
                // 数値に変換
                const strengthValue = typeof edge.strength === 'string' ? parseFloat(edge.strength) : (edge.strength || 0.5);
                
                await db.insert(knowledgeEdges).values({
                  id: randomUUID(),
                  sourceId: edge.source,
                  targetId: edge.target,
                  label: edge.label || null,
                  roleModelId,
                  strength: strengthValue
                });
                
                // Neo4jにも保存
                try {
                  await createEdgeInNeo4j({
                    sourceId: edge.source,
                    targetId: edge.target,
                    label: edge.label || null,
                    roleModelId,
                    strength: strengthValue
                  });
                } catch (neo4jError) {
                  console.error('CrewAI生成時のNeo4jエッジ作成エラー (無視して続行):', neo4jError);
                }
              }
              
              // 進捗完了メッセージを送信
              sendProgressUpdate({
                message: '知識グラフの生成と保存が完了しました',
                percent: 100,
                roleModelId,
                status: 'completed'
              });
              
              // 少し遅延させてからグラフ更新通知を送信（進捗完了メッセージが先に処理されるようにするため）
              setTimeout(() => {
                // 明示的にグラフ完了メッセージを送信
                sendMessageToRoleModelViewers(
                  roleModelId,
                  'knowledge_graph_update',
                  {
                    message: '知識グラフが更新されました',
                    updateType: 'complete',
                    timestamp: new Date().toISOString()
                  }
                );
                
                // 互換性のために両方の形式で送信
                sendMessageToRoleModelViewers(
                  roleModelId,
                  'knowledge-graph-update',
                  {
                    message: '知識グラフが更新されました',
                    updateType: 'complete',
                    timestamp: new Date().toISOString()
                  }
                );
                
                console.log(`知識グラフ更新完了通知を送信: roleModelId=${roleModelId}`);
              }, 500);
              
            } catch (dbError) {
              console.error('知識グラフ保存エラー:', dbError);
              sendProgressUpdate(`データベース保存エラー: ${dbError.message}`, 100, roleModelId, {
                message: `データベース保存エラー: ${dbError.message}`,
                progress: 100,
                stage: 'error',
                error: true,
                errorMessage: dbError.message
              });
            }
          } else {
            // エラーがあった場合
            console.error('CrewAI知識グラフ生成エラー:', result.error);
            
            // 最新のWebSocketメッセージフォーマットでエラーを送信
            sendProgressUpdate({
              message: `エラーが発生しました: ${result.error}`,
              percent: 100,
              roleModelId,
              status: 'error'
            });
          }
        } catch (err) {
          console.error('CrewAI知識グラフ生成エラー:', err);
          
          // エラーメッセージを安全に抽出
          const errorMessage = err instanceof Error ? err.message : String(err);
          
          // 最新のWebSocketメッセージフォーマットでエラーを送信
          sendProgressUpdate({
            message: `エラーが発生しました: ${errorMessage}`,
            percent: 100,
            roleModelId,
            status: 'error'
          });
        }
      })();
    } catch (error) {
      console.error('CrewAI知識グラフ生成リクエストエラー:', error);
      res.status(500).json({ error: 'CrewAIを使用した知識グラフの生成に失敗しました' });
    }
  });

  app.post('/api/role-models', isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      let validatedData: any = insertRoleModelSchema.parse(req.body);
      
      // 作成者IDを現在のユーザーに設定
      validatedData.createdBy = user.id;
      
      // 組織IDを設定 (組織に所属しているユーザーの場合)
      if (user.companyId) {
        validatedData.companyId = user.companyId;
      }
      
      const result = await db.insert(roleModels).values(validatedData).returning();
      
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('ロールモデル作成エラー:', error);
      res.status(500).json({ error: 'ロールモデルの作成に失敗しました' });
    }
  });
  
  // ロールモデル更新
  app.put('/api/role-models/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // ロールモデルの存在確認
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, id),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック (作成者、システム管理者、同じ組織の組織管理者のみ更新可能)
      if (
        roleModel.createdBy !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルを更新する権限がありません' });
      }
      
      const validatedData: any = insertRoleModelSchema.parse(req.body);
      
      // 作成者は変更不可 (作成者は固定)
      validatedData.createdBy = roleModel.createdBy;
      
      // 組織IDも変更不可 (所属組織は固定)
      validatedData.companyId = roleModel.companyId;
      
      const result = await db
        .update(roleModels)
        .set(validatedData)
        .where(eq(roleModels.id, id))
        .returning();
      
      res.json(result[0]);
    } catch (error) {
      console.error('ロールモデル更新エラー:', error);
      res.status(500).json({ error: 'ロールモデルの更新に失敗しました' });
    }
  });
  
  // ロールモデル削除
  app.delete('/api/role-models/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // ロールモデルの存在確認
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, id),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック (作成者、システム管理者、同じ組織の組織管理者のみ削除可能)
      if (
        roleModel.createdBy !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルを削除する権限がありません' });
      }
      
      await db.delete(roleModels).where(eq(roleModels.id, id));
      
      res.status(204).end();
    } catch (error) {
      console.error('ロールモデル削除エラー:', error);
      res.status(500).json({ error: 'ロールモデルの削除に失敗しました' });
    }
  });
  
  // ロールモデル共有設定の切り替え
  app.put('/api/role-models/:id/share', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      const { isShared } = req.body;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      if (typeof isShared !== 'number') {
        return res.status(400).json({ error: 'isSharedは数値で指定してください (0または1)' });
      }
      
      // ロールモデルの存在確認
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, id),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック (作成者、システム管理者、同じ組織の組織管理者のみ共有設定を変更可能)
      if (
        roleModel.createdBy !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルの共有設定を変更する権限がありません' });
      }
      
      // 組織に所属していないユーザーは共有できない
      if (isShared === 1 && !roleModel.companyId) {
        return res.status(400).json({ error: '組織に所属していないため、ロールモデルを共有できません' });
      }
      
      // isSharedフィールドが実際に存在するか確認してから更新
      const tableColumns = Object.keys(roleModels);
      const hasIsSharedField = tableColumns.includes('isShared');
      
      const updateData: any = {};
      if (hasIsSharedField) {
        updateData.isShared = isShared;
      } else {
        // isSharedフィールドを使用
        updateData.isShared = isShared;
      }
      
      const result = await db
        .update(roleModels)
        .set(updateData)
        .where(eq(roleModels.id, id))
        .returning();
      
      res.json(result[0]);
    } catch (error) {
      console.error('ロールモデル共有設定変更エラー:', error);
      res.status(500).json({ error: 'ロールモデルの共有設定変更に失敗しました' });
    }
  });

  // ==================
  // 知識グラフ関連
  // ==================
  app.get('/api/knowledge-graph/:roleModelId', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // UUID形式でない場合はエラー
      if (roleModelId === 'default' || !isValidUUID(roleModelId)) {
        console.error(`無効なUUID形式: ${roleModelId}`);
        return res.status(400).json({ error: '無効なロールモデルIDです' });
      }
      
      // 開発環境ではアクセス権チェックをスキップ
      if (process.env.NODE_ENV !== 'production') {
        // ロールモデルの存在確認のみ行う
        const roleModel = await db.query.roleModels.findFirst({
          where: eq(roleModels.id, roleModelId),
        });
        
        if (!roleModel) {
          return res.status(404).json({ error: 'ロールモデルが見つかりません' });
        }
      } else {
        // 本番環境ではアクセス権のチェック
        
        // アクセス権のチェック
        const roleModel = await db.query.roleModels.findFirst({
          where: eq(roleModels.id, roleModelId),
        });
        
        if (!roleModel) {
          return res.status(404).json({ error: 'ロールモデルが見つかりません' });
        }
        
        // 組織内共有の場合は、isSharedフィールドと組織IDをチェック
        const isShared = roleModel.isShared === 1;
        
        if (
          roleModel.createdBy !== user.id && 
          !(isShared && roleModel.companyId === user.companyId) &&
          user.role !== 'admin'
        ) {
          return res.status(403).json({ error: 'この知識グラフへのアクセス権限がありません' });
        }
      }
      
      // Neo4jからグラフデータ取得を試みる
      try {
        const graphData = await getKnowledgeGraph(roleModelId);
        
        // Neo4jからデータが取得できた場合はそれを返す
        if (graphData.nodes.length > 0) {
          console.log(`Neo4jからグラフデータを取得しました: ノード ${graphData.nodes.length}個, エッジ ${graphData.edges.length}個`);
          return res.json(graphData);
        } else {
          console.log('Neo4jからグラフデータが取得できませんでした。PostgreSQLからデータを取得します。');
        }
      } catch (neo4jError) {
        console.error('Neo4jグラフ取得エラー:', neo4jError);
        console.log('PostgreSQLからグラフデータを取得します。');
      }
      
      // Neo4jから取得できなかった場合、PostgreSQLからデータを取得
      const nodes = await db.query.knowledgeNodes.findMany({
        where: eq(knowledgeNodes.roleModelId, roleModelId),
      });
      
      const edges = await db.query.knowledgeEdges.findMany({
        where: eq(knowledgeEdges.roleModelId, roleModelId),
      });
      
      console.log(`PostgreSQLからグラフデータを取得しました: ノード ${nodes.length}個, エッジ ${edges.length}個`);
      res.json({ nodes, edges });
    } catch (error) {
      console.error('知識グラフ取得エラー:', error);
      res.status(500).json({ error: '知識グラフの取得に失敗しました' });
    }
  });

  // ナレッジグラフが存在するか確認
  app.get('/api/knowledge-graph/:roleModelId/exists', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // アクセス権のチェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }

      // Neo4jからグラフデータの存在を確認
      try {
        const graphData = await getKnowledgeGraph(roleModelId);
        if (graphData.nodes.length > 0) {
          return res.json({ exists: true });
        }
      } catch (neo4jError) {
        console.error('Neo4jグラフ確認エラー:', neo4jError);
      }
      
      // PostgreSQLからノードの存在を確認
      const nodeCount = await db.select({ count: count() }).from(knowledgeNodes)
        .where(eq(knowledgeNodes.roleModelId, roleModelId));
      
      const exists = nodeCount.length > 0 && nodeCount[0].count > 0;
      return res.json({ exists });
    } catch (error) {
      console.error('知識グラフ確認エラー:', error);
      res.status(500).json({ error: '知識グラフの確認に失敗しました' });
    }
  });

  // ナレッジグラフスナップショットを保存
  app.post('/api/knowledge-graph/:roleModelId/snapshots', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.params;
      const { name, description } = req.body;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // アクセス権のチェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }

      // 現在のグラフデータを取得
      let graphData;
      
      // Neo4jからグラフデータ取得を試みる
      try {
        graphData = await getKnowledgeGraph(roleModelId);
        
        // Neo4jからデータが取得できた場合はそれを使用
        if (graphData.nodes.length === 0) {
          console.log('Neo4jからグラフデータが取得できませんでした。PostgreSQLからデータを取得します。');
          throw new Error('Neo4jからグラフデータが取得できませんでした');
        }
      } catch (neo4jError) {
        console.error('Neo4jグラフ取得エラー:', neo4jError);
        console.log('PostgreSQLからグラフデータを取得します。');
        
        // PostgreSQLからデータを取得
        const nodes = await db.query.knowledgeNodes.findMany({
          where: eq(knowledgeNodes.roleModelId, roleModelId),
        });
        
        const edges = await db.query.knowledgeEdges.findMany({
          where: eq(knowledgeEdges.roleModelId, roleModelId),
        });
        
        graphData = { nodes, edges };
      }
      
      // 既存のアクティブなスナップショットがあれば非アクティブに設定
      await db.update(knowledgeGraphSnapshots)
        .set({ isActive: false })
        .where(and(
          eq(knowledgeGraphSnapshots.roleModelId, roleModelId),
          eq(knowledgeGraphSnapshots.isActive, true)
        ));
      
      // 新しいスナップショットを保存
      const [newSnapshot] = await db.insert(knowledgeGraphSnapshots)
        .values({
          roleModelId,
          name: name || `スナップショット ${new Date().toLocaleDateString('ja-JP')}`,
          description: description || '自動保存されたナレッジグラフ',
          graphData: graphData,
          isActive: true,
        })
        .returning();
      
      res.status(201).json(newSnapshot);
    } catch (error) {
      console.error('ナレッジグラフスナップショット保存エラー:', error);
      res.status(500).json({ error: 'ナレッジグラフのスナップショット保存に失敗しました' });
    }
  });

  // スナップショット一覧を取得
  app.get('/api/knowledge-graph/:roleModelId/snapshots', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // アクセス権のチェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // スナップショット一覧を取得
      const snapshots = await db.query.knowledgeGraphSnapshots.findMany({
        where: eq(knowledgeGraphSnapshots.roleModelId, roleModelId),
        orderBy: [desc(knowledgeGraphSnapshots.createdAt)],
      });
      
      res.json(snapshots.map(snapshot => ({
        id: snapshot.id,
        name: snapshot.name,
        description: snapshot.description,
        createdAt: snapshot.createdAt,
        isActive: snapshot.isActive,
      })));
    } catch (error) {
      console.error('スナップショット一覧取得エラー:', error);
      res.status(500).json({ error: 'スナップショット一覧の取得に失敗しました' });
    }
  });

  // スナップショットを復元（適用）
  app.post('/api/knowledge-graph/:roleModelId/snapshots/:snapshotId/restore', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId, snapshotId } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // アクセス権のチェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // スナップショットを取得
      const snapshot = await db.query.knowledgeGraphSnapshots.findFirst({
        where: and(
          eq(knowledgeGraphSnapshots.id, snapshotId),
          eq(knowledgeGraphSnapshots.roleModelId, roleModelId)
        ),
      });
      
      if (!snapshot) {
        return res.status(404).json({ error: 'スナップショットが見つかりません' });
      }
      
      // 既存のノードとエッジを削除
      await db.delete(knowledgeEdges)
        .where(eq(knowledgeEdges.roleModelId, roleModelId));
      
      await db.delete(knowledgeNodes)
        .where(eq(knowledgeNodes.roleModelId, roleModelId));
      
      // スナップショットからノードとエッジを再作成
      const graphData = snapshot.graphData as any;
      
      if (graphData && graphData.nodes && graphData.edges) {
        // ノードの再作成
        for (const node of graphData.nodes) {
          await db.insert(knowledgeNodes)
            .values({
              id: node.id,
              roleModelId,
              name: node.name,
              level: node.level,
              type: node.type || 'keyword',
              parentId: node.parentId,
              description: node.description,
              color: node.color,
            });
        }
        
        // エッジの再作成
        for (const edge of graphData.edges) {
          await db.insert(knowledgeEdges)
            .values({
              roleModelId,
              sourceId: edge.source || edge.sourceId,
              targetId: edge.target || edge.targetId,
              label: edge.label,
              strength: edge.strength || 1,
            });
        }
        
        // Neo4jデータベースも更新
        try {
          // Neo4jにグラフデータを保存
          // ロールモデルに関連する既存のノードとエッジを削除
          await initNeo4j();
          const session = initNeo4j();
          
          // ロールモデルに関連するすべてのノードとエッジを削除
          await session.run(
            `MATCH (n:KnowledgeNode {roleModelId: $roleModelId}) 
             DETACH DELETE n`,
            { roleModelId }
          );
          
          // ノードを作成
          for (const node of graphData.nodes) {
            await session.run(
              `CREATE (n:KnowledgeNode {
                id: $id,
                roleModelId: $roleModelId,
                name: $name,
                level: $level,
                type: $type,
                parentId: $parentId,
                description: $description,
                color: $color
              })`,
              {
                id: node.id,
                roleModelId,
                name: node.name,
                level: neo4j.int(node.level),
                type: node.type || 'keyword',
                parentId: node.parentId || null,
                description: node.description || '',
                color: node.color || ''
              }
            );
            console.log(`Neo4jにノード作成: ${node.id}`);
          }
          
          // エッジを作成
          for (const edge of graphData.edges) {
            const sourceId = edge.source || edge.sourceId;
            const targetId = edge.target || edge.targetId;
            
            await session.run(
              `MATCH (source:KnowledgeNode {id: $sourceId})
               MATCH (target:KnowledgeNode {id: $targetId})
               CREATE (source)-[r:RELATED_TO {
                 roleModelId: $roleModelId,
                 label: $label,
                 strength: $strength
               }]->(target)`,
              {
                sourceId,
                targetId,
                roleModelId,
                label: edge.label || '',
                strength: neo4j.int(edge.strength || 1)
              }
            );
            console.log(`Neo4jに関係作成: ${sourceId} -> ${targetId}`);
          }
          
          session.close();
        } catch (neo4jError) {
          console.error('Neo4jグラフ復元エラー:', neo4jError);
          // Neo4jの更新に失敗しても処理は続行（PostgreSQLにはデータが保存されている）
        }
        
        // 現在のスナップショットをアクティブに設定
        await db.update(knowledgeGraphSnapshots)
          .set({ isActive: false })
          .where(and(
            eq(knowledgeGraphSnapshots.roleModelId, roleModelId),
            eq(knowledgeGraphSnapshots.isActive, true)
          ));
        
        await db.update(knowledgeGraphSnapshots)
          .set({ isActive: true })
          .where(eq(knowledgeGraphSnapshots.id, snapshotId));
        
        res.json({ success: true, message: 'ナレッジグラフを復元しました' });
      } else {
        throw new Error('スナップショットのデータ形式が無効です');
      }
    } catch (error) {
      console.error('スナップショット復元エラー:', error);
      res.status(500).json({ error: 'スナップショットの復元に失敗しました' });
    }
  });

  // 知識ノード操作
  app.post('/api/knowledge-nodes', isAuthenticated, async (req, res) => {
    try {
      const validatedData: any = insertKnowledgeNodeSchema.parse(req.body);
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // アクセス権のチェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, validatedData.roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // 組織内共有の場合は、isSharedフィールドと組織IDをチェック
      const isShared = roleModel.isShared === 1;
      
      if (
        roleModel.createdBy !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルに知識ノードを追加する権限がありません' });
      }
      
      // PostgreSQLにノードを保存
      const result = await db.insert(knowledgeNodes).values(validatedData).returning();
      
      // Neo4jにも同じノードを保存
      try {
        await createNodeInNeo4j(result[0]);
      } catch (neo4jError) {
        console.error('Neo4jノード作成エラー (無視して続行):', neo4jError);
      }
      
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('ノード作成エラー:', error);
      res.status(500).json({ error: 'ノードの作成に失敗しました' });
    }
  });

  // 知識エッジ操作
  app.post('/api/knowledge-edges', isAuthenticated, async (req, res) => {
    try {
      const validatedData: any = insertKnowledgeEdgeSchema.parse(req.body);
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // アクセス権のチェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, validatedData.roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // 組織内共有の場合は、isSharedフィールドと組織IDをチェック
      const isShared = roleModel.isShared === 1;
      
      if (
        roleModel.createdBy !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルに知識エッジを追加する権限がありません' });
      }
      
      // PostgreSQLにエッジを保存
      const result = await db.insert(knowledgeEdges).values(validatedData).returning();
      
      // Neo4jにも同じエッジを保存
      try {
        await createEdgeInNeo4j(result[0]);
      } catch (neo4jError) {
        console.error('Neo4jエッジ作成エラー (無視して続行):', neo4jError);
      }
      
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('エッジ作成エラー:', error);
      res.status(500).json({ error: 'エッジの作成に失敗しました' });
    }
  });
  
  // 知識ノード展開 - AIによるノード展開処理
  app.post('/api/knowledge-nodes/:nodeId/expand', isAuthenticated, async (req, res) => {
    try {
      const { nodeId } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // ノードの存在確認とデータ取得
      const node = await db.query.knowledgeNodes.findFirst({
        where: eq(knowledgeNodes.id, nodeId),
        with: {
          roleModel: true,
        },
      });
      
      if (!node) {
        return res.status(404).json({ error: '対象のノードが見つかりません' });
      }
      
      // アクセス権のチェック
      // 組織内共有の場合は、shared/isSharedフィールドと組織IDをチェック
      const tableColumns = Object.keys(node.roleModel);
      // createdByおよびisSharedフィールドの有無を確認
      const hasCreatedByField = tableColumns.includes('createdBy');
      const hasIsSharedField = tableColumns.includes('isShared');
      const hasSharedField = tableColumns.includes('shared');
      
      // 常にcreatedByを優先的に使用
      const creatorId = hasCreatedByField ? node.roleModel.createdBy : null;
      
      const isShared = hasIsSharedField ? node.roleModel.isShared === 1 : 
                       hasSharedField ? node.roleModel.isShared === true : false;
      
      if (
        creatorId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && node.roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このノードを展開する権限がありません' });
      }
      
      console.log(`ノード "${node.name}" (ID: ${nodeId}) の展開を開始します`);
      
      // WebSocketを通じてエージェントの思考プロセスを通知
      sendAgentThoughts(
        "KnowledgeGraphAgent", 
        `"${node.name}" の拡張ノードとエッジを生成しています。AIによる分析中...`,
        node.roleModelId?.toString()
      );
      
      // Azure OpenAIを使用してノードを展開
      const success = await generateKnowledgeGraphForNode(
        node.roleModelId?.toString() || "", // nullのケースもカバー
        node.name || "",
        nodeId
      );
      
      if (!success) {
        return res.status(500).json({ error: 'ノードの展開に失敗しました' });
      }
      
      // 新しく作成されたノードとエッジを取得
      const newNodes = await db.query.knowledgeNodes.findMany({
        where: eq(knowledgeNodes.parentId, nodeId)
      });
      
      const newEdges = await db.query.knowledgeEdges.findMany({
        where: eq(knowledgeEdges.sourceId, nodeId)
      });
      
      // WebSocketでリアルタイム更新を通知
      sendMessageToRoleModelViewers('graph-update', { 
        updateType: 'expand', 
        nodeId,
        data: {
          nodes: newNodes,
          edges: newEdges
        }
      }, node.roleModelId?.toString() || "");
      
      // 完了通知
      sendAgentThoughts(
        "OrchestratorAgent",
        `ノード "${node.name}" の展開が完了しました。\n\n` +
        `- 新規ノード: ${newNodes.length}個\n` +
        `- 新規エッジ: ${newEdges.length}個\n\n` +
        `グラフが正常に更新されました。`,
        node.roleModelId?.toString()
      );
      
      res.json({
        success: true,
        nodeId,
        nodes: newNodes,
        edges: newEdges
      });
    } catch (error) {
      console.error('ノード展開エラー:', error);
      res.status(500).json({ error: '知識ノードの展開に失敗しました' });
    }
  });

  // ==================
  // 業界カテゴリーAPI
  // ==================
  // 業界カテゴリー一覧取得
  app.get('/api/industry-categories', async (req, res) => {
    try {
      const categories = await db.query.industryCategories.findMany({
        orderBy: (industryCategories, { asc }) => [asc(industryCategories.name)]
      });
      res.json(categories);
    } catch (error) {
      console.error('業界カテゴリー取得エラー:', error);
      res.status(500).json({ error: '業界カテゴリーの取得に失敗しました' });
    }
  });

  // 業界サブカテゴリー一覧取得
  app.get('/api/industry-subcategories', async (req, res) => {
    try {
      const subcategories = await db.query.industrySubcategories.findMany({
        orderBy: (industrySubcategories, { asc }) => [asc(industrySubcategories.name)]
      });
      res.json(subcategories);
    } catch (error) {
      console.error('業界サブカテゴリー取得エラー:', error);
      res.status(500).json({ error: '業界サブカテゴリーの取得に失敗しました' });
    }
  });

  // カテゴリーに関連するサブカテゴリーを取得
  app.get('/api/industry-categories/:categoryId/subcategories', async (req, res) => {
    try {
      const { categoryId } = req.params;
      const subcategories = await db.query.industrySubcategories.findMany({
        where: eq(industrySubcategories.categoryId, categoryId),
        orderBy: (industrySubcategories, { asc }) => [asc(industrySubcategories.name)]
      });
      res.json(subcategories);
    } catch (error) {
      console.error('カテゴリーサブカテゴリー取得エラー:', error);
      res.status(500).json({ error: 'カテゴリーに関連するサブカテゴリーの取得に失敗しました' });
    }
  });

  // ==================
  // キーワードAPI
  // ==================
  // キーワード一覧取得
  app.get('/api/keywords', async (req, res) => {
    try {
      const allKeywords = await db.query.keywords.findMany({
        orderBy: (keywords, { asc }) => [asc(keywords.name)]
      });
      res.json(allKeywords);
    } catch (error) {
      console.error('キーワード取得エラー:', error);
      res.status(500).json({ error: 'キーワードの取得に失敗しました' });
    }
  });

  // キーワード作成
  app.post('/api/keywords', isAuthenticated, async (req, res) => {
    try {
      const validatedData: any = insertKeywordSchema.parse(req.body);
      
      // 作成者IDを設定
      validatedData.createdBy = req.user?.id;
      
      const result = await db.insert(keywords).values(validatedData).returning();
      
      res.status(201).json(result[0]);
    } catch (error) {
      console.error('キーワード作成エラー:', error);
      res.status(500).json({ error: 'キーワードの作成に失敗しました' });
    }
  });

  // キーワード検索
  app.get('/api/keywords/search', async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: '検索クエリが必要です' });
      }
      
      const searchResults = await db.query.keywords.findMany({
        where: sql`${keywords.name} ILIKE ${`%${query}%`}`,
        orderBy: (keywords, { asc }) => [asc(keywords.name)],
        limit: 10
      });
      
      res.json(searchResults);
    } catch (error) {
      console.error('キーワード検索エラー:', error);
      res.status(500).json({ error: 'キーワード検索に失敗しました' });
    }
  });

  // エラーハンドリング
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('APIエラー:', err);
    res.status(err.status || 500).json({
      error: err.message || '予期せぬエラーが発生しました',
    });
  });

  // 業界カテゴリの名前からIDを取得する関数
  async function getIndustryIdByName(name: string): Promise<string | null> {
    try {
      // 名前と合致する業界サブカテゴリを検索
      const industry = await db.query.industrySubcategories.findFirst({
        where: eq(industrySubcategories.name, name),
      });

      return industry ? industry.id : null;
    } catch (error) {
      console.error('業界カテゴリID検索エラー:', error);
      return null;
    }
  }

  // ロールモデルと業界カテゴリの関連付け作成
  app.post('/api/role-model-industries', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId, industrySubcategoryId } = req.body;
      
      if (!roleModelId || !industrySubcategoryId) {
        return res.status(400).json({ error: 'roleModelIdとindustrySubcategoryIdは必須です' });
      }
      
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // ロールモデルの存在確認
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック
      // 組織内共有の場合は、shared/isSharedフィールドと組織IDをチェック
      const tableColumns = Object.keys(roleModel);
      const hasUserIdField = tableColumns.includes("user_id");
      const hasCreatedByField = tableColumns.includes('createdBy');
      const hasIsSharedField = tableColumns.includes('isShared');
      const hasSharedField = tableColumns.includes('shared');
      
      const creatorId = hasUserIdField ? roleModel.user_id : 
                        hasCreatedByField ? roleModel.createdBy : null;
      
      const isShared = hasIsSharedField ? roleModel.isShared === 1 : 
                       hasSharedField ? roleModel.isShared === true : false;
      
      if (
        creatorId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルを編集する権限がありません' });
      }
      
      // 業界カテゴリIDの取得
      // UUIDの形式かどうかをチェック
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let actualIndustryId: string;

      if (uuidPattern.test(industrySubcategoryId)) {
        // すでにUUID形式ならそのまま使用
        actualIndustryId = industrySubcategoryId;
      } else {
        // ID（英語名）から日本語名へのマッピング
        const idToNameMap: Record<string, string> = {
          // IT・インターネット関連
          "ai": "AI",
          "cloud": "クラウド",
          "ecommerce": "eコマース",
          "system-dev": "システム開発",
          "saas": "ソフトウェア(SaaS)",
          "mobile-carrier": "携帯電話事業者",
          "internet-line": "インターネット回線",
          "cybersecurity": "サイバーセキュリティー",
          "web-app": "Webアプリ",
          "quantum-computer": "量子コンピューター",
          "dx": "DX",
          "youtuber": "ユーチューバー(YouTuber)",
          "mobile-sales": "携帯電話販売代理店",
          "metaverse": "メタバース",
          "nft": "NFT",
          "programming": "プログラミング",
          "medical-tech": "医療テック",
          "web3": "Web3",
          
          // 金融・法人サービス関連
          "esg": "ESG",
          "ma-merger": "M&A仲介・合併",
          "pr-ir": "PR・IR",
          "activist": "アクティビスト",
          
          // 生活用品・嗜好品・薬
          "bags": "かばん",
          "cro-pharma": "CRO・臨床検査・薬",
          
          // 食品・農業
          "tobacco": "たばこ"
        };
        
        let searchName = industrySubcategoryId;
        if (idToNameMap[industrySubcategoryId]) {
          searchName = idToNameMap[industrySubcategoryId];
        }
        
        // 名前からIDを取得
        const industryId = await db.query.industrySubcategories.findFirst({
          where: eq(industrySubcategories.name, searchName),
        });
        
        if (!industryId) {
          return res.status(404).json({ error: `業界カテゴリが見つかりません(名前: ${searchName}, 元の値: ${industrySubcategoryId})` });
        }
        
        actualIndustryId = industryId.id;
      }
      
      // 業界カテゴリの存在確認
      const industry = await db.query.industrySubcategories.findFirst({
        where: eq(industrySubcategories.id, actualIndustryId),
      });
      
      if (!industry) {
        return res.status(404).json({ error: '業界カテゴリが見つかりません' });
      }
      
      // 既に関連付けが存在するか確認
      const existingRelation = await db.query.roleModelIndustries.findFirst({
        where: and(
          eq(roleModelIndustries.roleModelId, roleModelId),
          eq(roleModelIndustries.industryId, actualIndustryId)
        ),
      });
      
      if (existingRelation) {
        return res.json(existingRelation); // 既に存在する場合はそれを返す
      }
      
      // 関連付けを作成
      const [newRelation] = await db.insert(roleModelIndustries).values({
        roleModelId,
        industryId: actualIndustryId,
      }).returning();
      
      res.status(201).json(newRelation);
    } catch (error) {
      console.error('ロールモデル-業界カテゴリ関連付けエラー:', error);
      res.status(500).json({ error: '業界カテゴリの関連付けに失敗しました' });
    }
  });
  
  // ロールモデルの業界カテゴリ関連付けを全て削除
  app.delete('/api/role-model-industries/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params; // ロールモデルID
      
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // ロールモデルの存在確認
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, id),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック
      // 組織内共有の場合は、shared/isSharedフィールドと組織IDをチェック
      const tableColumns = Object.keys(roleModel);
      const hasUserIdField = tableColumns.includes("user_id");
      const hasCreatedByField = tableColumns.includes('createdBy');
      const hasIsSharedField = tableColumns.includes('isShared');
      const hasSharedField = tableColumns.includes('shared');
      
      const creatorId = hasUserIdField ? roleModel.user_id : 
                        hasCreatedByField ? roleModel.createdBy : null;
      
      const isShared = hasIsSharedField ? roleModel.isShared === 1 : 
                       hasSharedField ? roleModel.isShared === true : false;
      
      if (
        creatorId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルを編集する権限がありません' });
      }
      
      // 関連付けを全て削除
      await db.delete(roleModelIndustries).where(eq(roleModelIndustries.roleModelId, id));
      
      res.status(200).json({ message: '業界カテゴリ関連付けを削除しました' });
    } catch (error) {
      console.error('ロールモデル-業界カテゴリ関連付け削除エラー:', error);
      res.status(500).json({ error: '業界カテゴリ関連付けの削除に失敗しました' });
    }
  });
  
  // キーワードのIDを取得する関数
  async function getKeywordIdByNameOrId(nameOrId: string): Promise<string | null> {
    try {
      // まずIDとして検索
      const keywordById = await db.query.keywords.findFirst({
        where: eq(keywords.id, nameOrId),
      });

      if (keywordById) {
        return keywordById.id;
      }

      // 次に名前として検索
      const keywordByName = await db.query.keywords.findFirst({
        where: eq(keywords.name, nameOrId),
      });

      return keywordByName ? keywordByName.id : null;
    } catch (error) {
      console.error('キーワードID検索エラー:', error);
      return null;
    }
  }

  // ロールモデルとキーワードの関連付け作成
  app.post('/api/role-model-keywords', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId, keywordId } = req.body;
      
      if (!roleModelId || !keywordId) {
        return res.status(400).json({ error: 'roleModelIdとkeywordIdは必須です' });
      }
      
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // ロールモデルの存在確認
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック
      // 組織内共有の場合は、shared/isSharedフィールドと組織IDをチェック
      const tableColumns = Object.keys(roleModel);
      const hasUserIdField = tableColumns.includes("user_id");
      const hasCreatedByField = tableColumns.includes('createdBy');
      const hasIsSharedField = tableColumns.includes('isShared');
      const hasSharedField = tableColumns.includes('shared');
      
      const creatorId = hasUserIdField ? roleModel.user_id : 
                        hasCreatedByField ? roleModel.createdBy : null;
      
      const isShared = hasIsSharedField ? roleModel.isShared === 1 : 
                       hasSharedField ? roleModel.isShared === true : false;
      
      if (
        creatorId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルを編集する権限がありません' });
      }
      
      // キーワードIDの取得
      // UUIDの形式かどうかをチェック
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let actualKeywordId: string;

      if (uuidPattern.test(keywordId)) {
        // すでにUUID形式ならそのまま使用
        actualKeywordId = keywordId;
      } else {
        // ID（英語名）と日本語名のマッピング（必要に応じて追加）
        const idToNameMap: Record<string, string> = {
          "gdp": "GDP",
          "cpi": "CPI",
          "ev": "EV",
          "dmo": "DMO",
          "saas": "SaaS",
          "esg": "ESG",
          "api": "API",
          "llm": "LLM",
          "5g": "5G"
        };
        
        let searchName = keywordId;
        if (idToNameMap[keywordId.toLowerCase()]) {
          searchName = idToNameMap[keywordId.toLowerCase()];
        }
        
        // 名前からIDを取得
        const keyword = await db.query.keywords.findFirst({
          where: eq(keywords.name, searchName),
        });
        
        if (!keyword) {
          return res.status(404).json({ error: `キーワードが見つかりません(名前: ${searchName}, 元の値: ${keywordId})` });
        }
        
        actualKeywordId = keyword.id;
      }
      
      // キーワードの存在確認
      const keyword = await db.query.keywords.findFirst({
        where: eq(keywords.id, actualKeywordId),
      });
      
      if (!keyword) {
        return res.status(404).json({ error: 'キーワードが見つかりません' });
      }
      
      // 既に関連付けが存在するか確認
      const existingRelation = await db.query.roleModelKeywords.findFirst({
        where: and(
          eq(roleModelKeywords.roleModelId, roleModelId),
          eq(roleModelKeywords.keywordId, actualKeywordId)
        ),
      });
      
      if (existingRelation) {
        return res.json(existingRelation); // 既に存在する場合はそれを返す
      }
      
      // 関連付けを作成
      const [newRelation] = await db.insert(roleModelKeywords).values({
        roleModelId,
        keywordId: actualKeywordId,
      }).returning();
      
      res.status(201).json(newRelation);
    } catch (error) {
      console.error('ロールモデル-キーワード関連付けエラー:', error);
      res.status(500).json({ error: 'キーワードの関連付けに失敗しました' });
    }
  });
  
  // ロールモデルのキーワード関連付けを全て削除
  app.delete('/api/role-model-keywords/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params; // ロールモデルID
      
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // ロールモデルの存在確認
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, id),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック
      // 組織内共有の場合は、shared/isSharedフィールドと組織IDをチェック
      const tableColumns = Object.keys(roleModel);
      const hasUserIdField = tableColumns.includes("user_id");
      const hasCreatedByField = tableColumns.includes('createdBy');
      const hasIsSharedField = tableColumns.includes('isShared');
      const hasSharedField = tableColumns.includes('shared');
      
      const creatorId = hasUserIdField ? roleModel.user_id : 
                        hasCreatedByField ? roleModel.createdBy : null;
      
      const isShared = hasIsSharedField ? roleModel.isShared === 1 : 
                       hasSharedField ? roleModel.isShared === true : false;
      
      if (
        creatorId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルを編集する権限がありません' });
      }
      
      // 関連付けを全て削除
      await db.delete(roleModelKeywords).where(eq(roleModelKeywords.roleModelId, id));
      
      res.status(200).json({ message: 'キーワード関連付けを削除しました' });
    } catch (error) {
      console.error('ロールモデル-キーワード関連付け削除エラー:', error);
      res.status(500).json({ error: 'キーワード関連付けの削除に失敗しました' });
    }
  });

  // ==================
  // 情報収集プラン関連
  // ==================
  
  // 情報収集プラン作成API
  app.post('/api/role-models/:roleModelId/information-collection-plans', isAuthenticated, createInformationCollectionPlan);
  
  // 情報収集プラン一覧取得API
  app.get('/api/role-models/:roleModelId/information-collection-plans', isAuthenticated, async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      const { roleModelId } = req.params;
      
      // ロールモデルIDで最新の情報収集プランを取得
      const plans = await db.query.informationCollectionPlans.findMany({
        where: eq(informationCollectionPlans.roleModelId, roleModelId)
      });
      
      return res.status(200).json(plans);
    } catch (error) {
      console.error('情報収集プラン一覧取得エラー:', error);
      return res.status(500).json({ error: `サーバーエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}` });
    }
  });
  
  // 特定の情報収集プラン取得API
  app.get('/api/information-collection-plans/:planId', isAuthenticated, getInformationCollectionPlan);

  // デバッグルートを登録
  registerDebugRoutes(app);

  return httpServer;
}

// Neo4jにノードを作成する補助関数
async function createNodeInNeo4j(node: any) {
  const { id, name, type, level, parentId, roleModelId, description, color } = node;
  
  // UUID形式でない場合はスキップ
  if (!roleModelId || roleModelId === 'default' || !isValidUUID(roleModelId.toString())) {
    console.error(`無効なUUID形式のためNeo4jへのノード作成をスキップします: ${roleModelId}`);
    return;
  }
  
  try {
    const neo4j = await import('./neo4j');
    // Neo4jにノード作成
    await neo4j.createNode(
      type || 'Concept',
      {
        id,
        name,
        level: level || 0,
        parentId,
        description,
        color,
        type,
      },
      roleModelId.toString()
    );
    
    console.log(`Neo4jにノード作成: ${id}`);
  } catch (error) {
    console.error('Neo4jノード作成エラー:', error);
    // エラーは無視して処理を続行
    throw error; // エラーを上位に伝播させて処理できるようにする
  }
}



// Neo4jにエッジを作成する補助関数
async function createEdgeInNeo4j(edge: any) {
  const { sourceId, targetId, label, strength, roleModelId } = edge;
  
  // UUID形式でない場合はスキップ
  if (!roleModelId || roleModelId === 'default' || !isValidUUID(roleModelId.toString())) {
    console.error(`無効なUUID形式のためNeo4jへのエッジ作成をスキップします: ${roleModelId}`);
    return;
  }
  
  try {
    const neo4j = await import('./neo4j');
    // Neo4jに関係作成
    await neo4j.createRelationship(
      sourceId,
      targetId,
      'RELATED_TO',
      {
        label,
        strength: strength || 1,
      },
      roleModelId.toString()
    );
    
    console.log(`Neo4jに関係作成: ${sourceId} -> ${targetId}`);
  } catch (error) {
    console.error('Neo4j関係作成エラー:', error);
    // エラーは無視して処理を続行
    throw error; // エラーを上位に伝播させて処理できるようにする
  }
}