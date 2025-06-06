import { Express, Request, Response, NextFunction } from 'express';
import { Server, createServer } from 'http';
import { 
  initWebSocketServer,
  sendProgressUpdate,
  sendAgentThoughts,
  sendToRoleModel,
  sendGraphUpdate
} from './websocket';
import { db } from './db';
import { setupAuth, isAuthenticated, requireRole, hashPassword, comparePasswords } from './auth';
import { initNeo4j, getKnowledgeGraph } from './neo4j';
import { eq, and, or, not, sql, inArray, desc } from 'drizzle-orm';
import { 
  createInformationCollectionPlan,
  getInformationCollectionPlan
} from './controllers/information-collection-controller';
import { 
  insertKnowledgeNodeSchema, 
  insertKnowledgeEdgeSchema,
  insertUserSchema,
  knowledgeNodes,
  knowledgeEdges,
  users,
  organizations,
  roleModels,
  insertRoleModelSchema,
  insertOrganizationSchema, // 組織スキーマに修正
  industries,
  industrySubcategories, // 業界サブカテゴリテーブルをインポート
  roleModelIndustries,
  roleModelKeywords,
  keywords,
  collectionPlans, // 情報収集プランテーブル追加
} from '@shared/schema';
import { generateKnowledgeGraphForNode } from './azure-openai';
import { generateKnowledgeGraphForRoleModel } from './knowledge-graph-generator';
import { generateKnowledgeGraphWithCrewAI } from './agents';
import { runKnowledgeLibraryProcess, createCollectionPlan, getCollectionPlans, getCollectionSummaries, getCollectionSources, generateKnowledgeLibraryWithCrewAI } from './services/crew-ai/knowledge-library-service';
import { searchWithExa, executeSearchForCollectionPlan, fetchContentWithExa } from './services/exa-search';
import { randomUUID } from 'crypto';

// UUIDの検証関数
function isValidUUID(str: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

// ルートの登録
export async function registerRoutes(app: Express, existingServer?: Server): Promise<Server> {
  // 既存のサーバーを使用するか、新しいサーバーを作成
  const httpServer = existingServer || createServer(app);
  
  // 認証のセットアップ
  setupAuth(app);
  
  // Neo4jの初期化 - サーバー起動を遅延させないように非同期で実行
  // リクエストがあった際にNeo4jに接続できるようにする
  initNeo4j().then(() => {
    console.log('Neo4j接続に成功しました');
  }).catch(error => {
    console.error('Neo4j初期化エラー:', error);
  });
  
  // WebSocketサーバーのセットアップはserver/index.tsで行われるため、ここでは不要
  // initWebSocketServer(httpServer);
  
  // API エンドポイントの設定
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
        organizationId: req.user.organizationId,
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
        companiesQuery = await db.query.organizations.findMany();
      } else {
        companiesQuery = await db.query.organizations.findMany({
          where: eq(organizations.id, user.organizationId),
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
      if (user.role !== 'admin' && user.organizationId !== id) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }
      
      const company = await db.query.organizations.findFirst({
        where: eq(organizations.id, id),
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
      
      const result = await db.insert(organizations).values(validatedData).returning();
      
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
      if (user.role === 'company_admin' && user.organizationId !== id) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }
      
      const validatedData = insertOrganizationSchema.parse(req.body);
      
      const result = await db
        .update(organizations)
        .set(validatedData)
        .where(eq(organizations.id, id))
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
          where: eq(users.organizationId, user.organizationId),
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
        !(currentUser?.role === 'company_admin' && user.organizationId === currentUser?.organizationId)
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
        !(currentUser.role === 'company_admin' && targetUser.organizationId === currentUser.organizationId)
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
        validatedData.organizationId = targetUser.organizationId;
        
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
        targetUser.organizationId !== currentUser.organizationId
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
      // リレーションを使用せずにシンプルなクエリに変更
      const roleModelsData = await db.select().from(roleModels).where(
        or(
          eq(roleModels.createdBy, user.id),
          // is_shared = 1 の場合も表示
          eq(roleModels.isShared, 1),
          user.organizationId ? eq(roleModels.organizationId, user.organizationId) : undefined
        )
      ).orderBy(desc(roleModels.createdAt));
      
      // ロールモデルのIDs
      const roleModelIds = roleModelsData.map(model => model.id);
      
      // 関連するユーザーとorganizationを取得
      const creatorIds = roleModelsData.map(model => model.createdBy).filter(Boolean);
      const orgIds = roleModelsData.map(model => model.organizationId).filter(Boolean);
      
      const [creators, orgs, keywordRelations, industryRelations] = await Promise.all([
        // ユーザーの取得
        creatorIds.length ? db.select().from(users).where(inArray(users.id, creatorIds)) : Promise.resolve([]),
        // 組織の取得
        orgIds.length ? db.select().from(organizations).where(inArray(organizations.id, orgIds)) : Promise.resolve([]),
        // キーワードの取得
        roleModelIds.length ? db.select().from(roleModelKeywords).where(inArray(roleModelKeywords.roleModelId, roleModelIds)) : Promise.resolve([]),
        // ロールモデルと業界のリレーション取得
        roleModelIds.length ? db.select().from(roleModelIndustries).where(inArray(roleModelIndustries.roleModelId, roleModelIds)) : Promise.resolve([])
      ]);
      
      // 業界IDsの抽出
      const industrySubcategoryIds = industryRelations.map(rel => rel.industryId);
      
      // 業界データの取得
      const industriesData = industrySubcategoryIds.length ? 
        await db.select().from(industrySubcategories).where(inArray(industrySubcategories.id, industrySubcategoryIds)) : 
        [];
      
      // ロールモデルデータの整形
      const safeRoleModels = roleModelsData.map(model => {
        // 作成者
        const creator = creators.find(u => u.id === model.createdBy);
        // 組織
        const organization = orgs.find(o => o.id === model.organizationId);
        
        // このロールモデルのキーワード
        const keywords = keywordRelations
          .filter(rel => rel.roleModelId === model.id)
          .map(rel => rel.keyword);
        
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
      if (!user.organizationId) {
        return res.json([]);
      }
      
      // リレーションを使用せずにシンプルなクエリに変更
      const sharedRoleModelsData = await db.select().from(roleModels).where(
        and(
          eq(roleModels.organizationId, user.organizationId),
          eq(roleModels.isShared, 1)
        )
      ).orderBy(desc(roleModels.createdAt));
      
      // ロールモデルのIDs
      const roleModelIds = sharedRoleModelsData.map(model => model.id);
      
      // 何もなければ空の配列を返す
      if (roleModelIds.length === 0) {
        return res.json([]);
      }
      
      // 関連するユーザーとorganizationを取得
      const creatorIds = sharedRoleModelsData.map(model => model.createdBy).filter(Boolean);
      const orgIds = sharedRoleModelsData.map(model => model.organizationId).filter(Boolean);
      
      const [creators, orgs, keywordRelations, industryRelations] = await Promise.all([
        // ユーザーの取得
        creatorIds.length ? db.select().from(users).where(inArray(users.id, creatorIds)) : Promise.resolve([]),
        // 組織の取得
        orgIds.length ? db.select().from(organizations).where(inArray(organizations.id, orgIds)) : Promise.resolve([]),
        // キーワードの取得
        roleModelIds.length ? db.select().from(roleModelKeywords).where(inArray(roleModelKeywords.roleModelId, roleModelIds)) : Promise.resolve([]),
        // ロールモデルと業界のリレーション取得
        roleModelIds.length ? db.select().from(roleModelIndustries).where(inArray(roleModelIndustries.roleModelId, roleModelIds)) : Promise.resolve([])
      ]);
      
      // 業界IDsの抽出
      const industrySubcategoryIds = industryRelations.map(rel => rel.industryId);
      
      // 業界データの取得
      const industriesData = industrySubcategoryIds.length ? 
        await db.select().from(industrySubcategories).where(inArray(industrySubcategories.id, industrySubcategoryIds)) : 
        [];
      
      // ロールモデルデータの整形
      const safeRoleModels = sharedRoleModelsData.map(model => {
        // 作成者
        const creator = creators.find(u => u.id === model.createdBy);
        // 組織
        const organization = orgs.find(o => o.id === model.organizationId);
        
        // このロールモデルのキーワード
        const keywords = keywordRelations
          .filter(rel => rel.roleModelId === model.id)
          .map(rel => rel.keyword);
        
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
      
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, id),
        with: {
          user: true,
          organization: true,
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
        !(roleModel.isShared === 1 && roleModel.organizationId === user.organizationId) &&
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
        organization: roleModel.organization ? {
          id: roleModel.organization.id,
          name: roleModel.organization.name,
        } : null,
        industries: roleModel.industries.map(rel => rel.industry),
        keywords: roleModel.keywords.map(rel => rel.keyword),
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
      if (roleModel.userId !== user!.id && user!.role !== 'admin') {
        return res.status(403).json({ error: 'このロールモデルを編集する権限がありません' });
      }

      // 産業と業界名を抽出
      const industries = roleModel.industries.map(rel => rel.industry.name);
      const keywords = roleModel.keywords.map(rel => rel.keyword.name);

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
      if (roleModel.userId !== user!.id && user!.role !== 'admin') {
        return res.status(403).json({ error: 'このロールモデルを編集する権限がありません' });
      }

      // 産業と業界名を抽出
      const industries = roleModel.industries.map(rel => rel.industry.name);
      const keywords = roleModel.keywords.map(rel => rel.keyword.name);

      // 非同期処理を開始し、すぐにレスポンスを返す
      res.json({ 
        success: true, 
        message: 'CrewAIを使用した知識グラフの生成を開始しました',
        roleModelId
      });

      // ロールモデル入力データを作成
      const input = {
        roleModelId,
        roleName: roleModel.name,
        description: roleModel.description || '',
        industries,
        keywords,
        userId: roleModel.userId || 'anonymous'
      };

      // バックグラウンドで処理を継続
      generateKnowledgeGraphWithCrewAI(input)
        .then(async (result) => {
          if (result.success) {
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
              
              sendProgressUpdate('知識グラフの生成と保存が完了しました', 100, roleModelId, {
                message: '知識グラフの生成と保存が完了しました',
                progress: 100,
                stage: 'completed',
                subStage: 'save_to_database'
              });
              
              // WebSocketで接続中のクライアントに通知
              sendToRoleModel(roleModelId, {
                type: 'knowledge_graph_update',
                message: '知識グラフが更新されました'
              });
              
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
            sendProgressUpdate(`エラーが発生しました: ${result.error}`, 100, roleModelId, {
              message: `エラーが発生しました: ${result.error}`,
              progress: 100,
              stage: 'error',
              error: true,
              errorMessage: result.error
            });
          }
        })
        .catch(err => {
          console.error('CrewAI知識グラフ生成エラー:', err);
          sendProgressUpdate(`エラーが発生しました: ${err.message}`, 100, roleModelId, {
            message: `エラーが発生しました: ${err.message}`,
            progress: 100,
            stage: 'error',
            error: true,
            errorMessage: err.message
          });
        });
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
      
      let validatedData = insertRoleModelSchema.parse(req.body);
      
      // 作成者IDを現在のユーザーに設定
      validatedData.createdBy = user.id;
      
      // 組織IDを設定 (組織に所属しているユーザーの場合)
      if (user.organizationId) {
        validatedData.organizationId = user.organizationId;
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
        !(user.role === 'organization_admin' && roleModel.organizationId === user.organizationId)
      ) {
        return res.status(403).json({ error: 'このロールモデルを更新する権限がありません' });
      }
      
      const validatedData = insertRoleModelSchema.parse(req.body);
      
      // 作成者は変更不可 (作成者は固定)
      validatedData.createdBy = roleModel.createdBy;
      
      // 組織IDも変更不可 (所属組織は固定)
      validatedData.organizationId = roleModel.organizationId;
      
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
        !(user.role === 'organization_admin' && roleModel.organizationId === user.organizationId)
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
        !(user.role === 'organization_admin' && roleModel.organizationId === user.organizationId)
      ) {
        return res.status(403).json({ error: 'このロールモデルの共有設定を変更する権限がありません' });
      }
      
      // 組織に所属していないユーザーは共有できない
      if (isShared === 1 && !roleModel.organizationId) {
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
  // ナレッジライブラリ関連
  // ==================
  
  // Exa検索API - 検索実行
  app.post('/api/exa/search', isAuthenticated, async (req, res) => {
    try {
      const { query, roleModelId, options } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: '検索クエリが必要です' });
      }
      
      const searchOptions = {
        query,
        ...options
      };
      
      const results = await searchWithExa(searchOptions, roleModelId);
      res.json(results);
    } catch (error) {
      console.error('Exa検索エラー:', error);
      res.status(500).json({ 
        error: 'Exa検索の実行に失敗しました', 
        details: error instanceof Error ? error.message : '不明なエラー' 
      });
    }
  });
  
  // Exa検索API - コンテンツ取得
  app.post('/api/exa/content', isAuthenticated, async (req, res) => {
    try {
      const { url, roleModelId } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URLまたはIDが必要です' });
      }
      
      const content = await fetchContentWithExa(url, roleModelId);
      res.json(content);
    } catch (error) {
      console.error('Exaコンテンツ取得エラー:', error);
      res.status(500).json({ 
        error: 'Exaコンテンツの取得に失敗しました', 
        details: error instanceof Error ? error.message : '不明なエラー' 
      });
    }
  });
  
  // 情報収集プランに基づいた検索実行
  app.post('/api/collection-plans/:planId/execute-search', isAuthenticated, async (req, res) => {
    try {
      const { planId } = req.params;
      const { roleModelId } = req.body;
      
      if (!roleModelId || !isValidUUID(roleModelId)) {
        return res.status(400).json({ error: '有効なロールモデルIDが必要です' });
      }
      
      // プランの取得
      const plan = await db.query.collectionPlans.findFirst({
        where: eq(collectionPlans.id, planId)
      });
      
      if (!plan) {
        return res.status(404).json({ error: '情報収集プランが見つかりません' });
      }
      
      // アクセス権チェック（シンプルバージョン）
      if (plan.createdBy !== req.user?.id && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'このプランにアクセスする権限がありません' });
      }
      
      // 検索を開始
      res.json({ status: 'processing', message: '検索を開始しました' });
      
      // バックグラウンドで処理
      executeSearchForCollectionPlan(plan, roleModelId)
        .then(results => {
          console.log(`検索成功: ${planId}, ${results.length}件の結果`);
          // WebSocketでクライアントに通知
          sendProgressUpdate(roleModelId, {
            type: 'collection_plan_search_complete',
            message: `${results.length}件の検索結果が見つかりました`,
            data: { count: results.length }
          });
        })
        .catch(error => {
          console.error(`検索エラー: ${planId}`, error);
          // WebSocketでクライアントに通知
          sendProgressUpdate(roleModelId, {
            type: 'collection_plan_search_error',
            message: `検索エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
          });
        });
    } catch (error) {
      console.error('情報収集プラン検索実行エラー:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: '検索の実行に失敗しました', 
          details: error instanceof Error ? error.message : '不明なエラー' 
        });
      }
    }
  });
  
  // 情報収集プランの実行（マルチエージェント処理）
  app.post('/api/collection-plans/:planId/execute', isAuthenticated, async (req, res) => {
    try {
      const { planId } = req.params;
      
      if (!planId || !isValidUUID(planId)) {
        return res.status(400).json({ error: '有効な情報収集プランIDが必要です' });
      }
      
      // プランの取得
      const plan = await db.query.collectionPlans.findFirst({
        where: eq(collectionPlans.id, planId)
      });
      
      if (!plan) {
        return res.status(404).json({ error: '情報収集プランが見つかりません' });
      }
      
      const roleModelId = plan.roleModelId;
      
      // アクセス権チェック
      if (plan.createdBy !== req.user?.id && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'このプランにアクセスする権限がありません' });
      }
      
      // 初期レスポンスを返す
      res.json({ status: 'processing', message: 'マルチエージェント処理を開始しました' });
      
      // バックグラウンドで処理（7つのエージェントによる処理）
      runKnowledgeLibraryProcess(roleModelId, planId, {
          title: plan.title,
          industries: [], // 必要に応じてロールモデルから業界情報を取得
          keywords: []   // 必要に応じてロールモデルからキーワード情報を取得
        })
        .then(result => {
          console.log(`マルチエージェント処理完了: ${planId}`);
          sendProgressUpdate(roleModelId, {
            type: 'agents_process_complete',
            message: '処理が完了しました',
            data: { success: result }
          });
        })
        .catch(error => {
          console.error(`マルチエージェント処理エラー: ${planId}`, error);
          sendProgressUpdate(roleModelId, {
            type: 'agents_process_error',
            message: `処理エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
          });
        });
    } catch (error) {
      console.error('マルチエージェント処理実行エラー:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'マルチエージェント処理の実行に失敗しました', 
          details: error instanceof Error ? error.message : '不明なエラー' 
        });
      }
    }
  });

  // 情報収集プランの実行エンドポイント（クライアント側でのボタン操作用）
  app.post('/api/knowledge-library/execute/:roleModelId/:planId', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId, planId } = req.params;
      
      if (!roleModelId || !isValidUUID(roleModelId)) {
        return res.status(400).json({ error: '有効なロールモデルIDが必要です' });
      }
      
      if (!planId || !isValidUUID(planId)) {
        return res.status(400).json({ error: '有効な情報収集プランIDが必要です' });
      }
      
      // ロールモデルとプランの取得（権限チェックのため）
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId)
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      const plan = await db.query.collectionPlans.findFirst({
        where: eq(collectionPlans.id, planId)
      });
      
      if (!plan) {
        return res.status(404).json({ error: '情報収集プランが見つかりません' });
      }
      
      // アクセス権チェック（シンプル版 - 必要に応じて厳密なチェックを追加）
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // 管理者であれば実行可能
      if (user.role !== 'admin') {
        // プランの作成者か、共有設定を確認
        const isCreator = plan.createdBy === user.id;
        if (!isCreator) {
          return res.status(403).json({ error: 'このプランを実行する権限がありません' });
        }
      }
      
      // 初期レスポンスを返す（処理は非同期で続行）
      res.json({ 
        status: 'processing', 
        message: 'マルチエージェント処理を開始しました',
        planId: planId,
        roleModelId: roleModelId
      });
      
      // バックグラウンドで処理実行 - 新しいexecuteCollectionPlan関数を使用
      const { executeCollectionPlan } = require('./services/crew-ai/knowledge-library-service');
      
      executeCollectionPlan(roleModelId, planId, {
        maxResults: 15,
        searchDepth: 2
      })
      .then(result => {
        console.log(`プラン実行完了: ${planId}`);
        sendProgressUpdate(roleModelId, {
          type: 'plan_execution_complete',
          message: '実行が完了しました',
          data: { success: true, result, planId }
        });
      })
      .catch(error => {
        console.error(`プラン実行エラー: ${planId}`, error);
        sendProgressUpdate(roleModelId, {
          type: 'plan_execution_error',
          message: `実行エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
          planId
        });
      });
    } catch (error) {
      console.error('プラン実行エラー:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'プランの実行に失敗しました', 
          details: error instanceof Error ? error.message : '不明なエラー' 
        });
      }
    }
  });

  // 情報収集プランの検索結果取得
  app.get('/api/collection-plans/:planId/search-results', isAuthenticated, async (req, res) => {
    try {
      const { planId } = req.params;
      const { executionId } = req.query;
      
      // アクセス権チェック（シンプルバージョン）
      const plan = await db.query.collectionPlans.findFirst({
        where: eq(collectionPlans.id, planId)
      });
      
      if (!plan) {
        return res.status(404).json({ error: '情報収集プランが見つかりません' });
      }
      
      if (plan.createdBy !== req.user?.id && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'このプランにアクセスする権限がありません' });
      }
      
      // 検索結果の取得
      let query = db.select().from(collectionSources)
        .where(eq(collectionSources.collectionPlanId, planId))
        .orderBy(desc(collectionSources.scoreRelevance));
      
      // 特定の実行IDに絞る場合
      if (executionId) {
        query = query.where(eq(collectionSources.executionId, executionId.toString()));
      }
      
      const results = await query;
      
      res.json(results);
    } catch (error) {
      console.error('情報収集プラン検索結果取得エラー:', error);
      res.status(500).json({ 
        error: '検索結果の取得に失敗しました', 
        details: error instanceof Error ? error.message : '不明なエラー' 
      });
    }
  });
  
  // CrewAIを使用してマルチエージェント処理を実行
  app.post('/api/knowledge-library/run-agents/:roleModelId', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.params;
      const { collectionPlanId } = req.body;
      
      if (!roleModelId || !isValidUUID(roleModelId)) {
        return res.status(400).json({ error: '有効なロールモデルIDが必要です' });
      }
      
      if (!collectionPlanId || !isValidUUID(collectionPlanId)) {
        return res.status(400).json({ error: '有効な情報収集プランIDが必要です' });
      }
      
      // 初期レスポンスを返す
      res.json({ status: 'processing', message: 'マルチエージェント処理を開始しました' });
      
      // バックグラウンドで処理
      runKnowledgeLibraryProcess(roleModelId, collectionPlanId, {
          title: "マルチエージェント情報処理",
          industries: [], // 必要に応じてデータを取得
          keywords: []    // 必要に応じてデータを取得
        })
        .then(result => {
          console.log(`マルチエージェント処理完了: ${collectionPlanId}`);
          sendProgressUpdate(roleModelId, {
            type: 'agents_process_complete',
            message: '処理が完了しました',
            data: result
          });
        })
        .catch(error => {
          console.error(`マルチエージェント処理エラー: ${collectionPlanId}`, error);
          sendProgressUpdate(roleModelId, {
            type: 'agents_process_error',
            message: `処理エラー: ${error instanceof Error ? error.message : '不明なエラー'}`
          });
        });
    } catch (error) {
      console.error('マルチエージェント処理実行エラー:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'マルチエージェント処理の実行に失敗しました', 
          details: error instanceof Error ? error.message : '不明なエラー' 
        });
      }
    }
  });
  
  // ナレッジライブラリの生成
  app.post('/api/knowledge-library/generate/:roleModelId', isAuthenticated, async (req, res) => {
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
      
      // アクセス権限の確認
      const hasAccess = roleModel.createdBy === user?.id || 
                       (roleModel.isShared === 1) || 
                       (user?.role === 'admin');
                       
      if (!hasAccess) {
        return res.status(403).json({ error: 'このロールモデルにアクセスする権限がありません' });
      }
      
      // 業種とキーワードの取得
      const industries = roleModel.industries.map(rel => ({
        id: rel.industry?.id || '',
        name: rel.industry?.name || '',
        description: rel.industry?.description || '',
      })).filter(i => i.id);
      
      const keywords = roleModel.keywords
        .map(rel => rel.keyword ? {
          id: rel.keyword.id,
          name: rel.keyword.name,
          description: rel.keyword.description,
        } : null)
        .filter(Boolean);
        
      // CrewAIに渡す入力の準備
      const input = {
        roleModelId,
        industries,
        keywords,
        roleModelName: roleModel.name,
        roleModelDescription: roleModel.description || '',
        userId: user?.id, // ユーザーIDを追加
      };
      
      // 処理を開始
      res.json({ status: 'processing', message: 'ナレッジライブラリの生成を開始しました' });
      
      // バックグラウンドで処理
      generateKnowledgeLibraryWithCrewAI(input)
        .then(result => {
          if (result.success) {
            console.log(`ナレッジライブラリ生成成功: ${roleModelId}`);
          } else {
            console.error(`ナレッジライブラリ生成失敗: ${roleModelId}`, result.error);
          }
        })
        .catch(error => {
          console.error(`ナレッジライブラリ生成エラー: ${roleModelId}`, error);
        });
        
    } catch (error) {
      console.error('ナレッジライブラリ生成エラー:', error);
      // すでにレスポンスを返している場合はエラーをキャッチするだけ
      if (!res.headersSent) {
        res.status(500).json({ error: 'ナレッジライブラリの生成に失敗しました' });
      }
    }
  });

  // ==================
  // 知識グラフ関連
  // ==================
  // 知識グラフの存在確認API
  app.get('/api/knowledge-graph/:roleModelId/exists', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.params;
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      console.log(`知識グラフ存在確認API: roleModelId=${roleModelId}`);
      
      // UUID形式でない場合はエラー
      if (roleModelId === 'default' || !isValidUUID(roleModelId)) {
        console.error(`無効なUUID形式: ${roleModelId}`);
        return res.status(400).json({ error: '無効なロールモデルIDです' });
      }
      
      // ロールモデルの存在確認
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // 本番環境ではアクセス権のチェック
      if (process.env.NODE_ENV === 'production') {
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
      
      // Neo4jでグラフの存在確認を試みる
      let exists = false;
      
      try {
        const graphData = await getKnowledgeGraph(roleModelId);
        exists = graphData.nodes.length > 0;
        
        if (exists) {
          console.log(`Neo4jでグラフの存在を確認: ${graphData.nodes.length}ノード`);
        }
      } catch (neo4jError) {
        console.error('Neo4jグラフ存在確認エラー:', neo4jError);
      }
      
      // Neo4jで確認できなかった場合、PostgreSQLで確認
      if (!exists) {
        const nodeCount = await db.select({ count: count() }).from(knowledgeNodes)
          .where(eq(knowledgeNodes.roleModelId, roleModelId));
        
        exists = nodeCount[0].count > 0;
        console.log(`PostgreSQLでグラフの存在を確認: ${nodeCount[0].count}ノード`);
      }
      
      res.json({ exists, roleModelId });
    } catch (error) {
      console.error('知識グラフ存在確認エラー:', error);
      res.status(500).json({ error: '知識グラフの存在確認に失敗しました' });
    }
  });

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
          !(isShared && roleModel.organizationId === user.organizationId) &&
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

  // 知識ノード操作
  app.post('/api/knowledge-nodes', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertKnowledgeNodeSchema.parse(req.body);
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
        !(user.role === 'organization_admin' && roleModel.organizationId === user.organizationId)
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
      const validatedData = insertKnowledgeEdgeSchema.parse(req.body);
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
        !(user.role === 'organization_admin' && roleModel.organizationId === user.organizationId)
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
      const hasUserIdField = tableColumns.includes('userId');
      const hasCreatedByField = tableColumns.includes('createdBy');
      const hasIsSharedField = tableColumns.includes('isShared');
      const hasSharedField = tableColumns.includes('shared');
      
      const creatorId = hasUserIdField ? node.roleModel.userId : 
                        hasCreatedByField ? node.roleModel.createdBy : null;
      
      const isShared = hasIsSharedField ? node.roleModel.isShared === 1 : 
                       hasSharedField ? node.roleModel.isShared === true : false;
      
      if (
        creatorId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && node.roleModel.organizationId === user.organizationId)
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
      sendToRoleModel(roleModelId, {
        type: 'graph-update', 
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
      const validatedData = insertKeywordSchema.parse(req.body);
      
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
      const hasUserIdField = tableColumns.includes('userId');
      const hasCreatedByField = tableColumns.includes('createdBy');
      const hasIsSharedField = tableColumns.includes('isShared');
      const hasSharedField = tableColumns.includes('shared');
      
      const creatorId = hasUserIdField ? roleModel.userId : 
                        hasCreatedByField ? roleModel.createdBy : null;
      
      const isShared = hasIsSharedField ? roleModel.isShared === 1 : 
                       hasSharedField ? roleModel.isShared === true : false;
      
      if (
        creatorId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.organizationId === user.organizationId)
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
          eq(roleModelIndustries.industrySubcategoryId, actualIndustryId)
        ),
      });
      
      if (existingRelation) {
        return res.json(existingRelation); // 既に存在する場合はそれを返す
      }
      
      // 関連付けを作成
      const [newRelation] = await db.insert(roleModelIndustries).values({
        roleModelId,
        industrySubcategoryId: actualIndustryId,
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
      const hasUserIdField = tableColumns.includes('userId');
      const hasCreatedByField = tableColumns.includes('createdBy');
      const hasIsSharedField = tableColumns.includes('isShared');
      const hasSharedField = tableColumns.includes('shared');
      
      const creatorId = hasUserIdField ? roleModel.userId : 
                        hasCreatedByField ? roleModel.createdBy : null;
      
      const isShared = hasIsSharedField ? roleModel.isShared === 1 : 
                       hasSharedField ? roleModel.isShared === true : false;
      
      if (
        creatorId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.organizationId === user.organizationId)
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
      const hasUserIdField = tableColumns.includes('userId');
      const hasCreatedByField = tableColumns.includes('createdBy');
      const hasIsSharedField = tableColumns.includes('isShared');
      const hasSharedField = tableColumns.includes('shared');
      
      const creatorId = hasUserIdField ? roleModel.userId : 
                        hasCreatedByField ? roleModel.createdBy : null;
      
      const isShared = hasIsSharedField ? roleModel.isShared === 1 : 
                       hasSharedField ? roleModel.isShared === true : false;
      
      if (
        creatorId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.organizationId === user.organizationId)
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
      const hasUserIdField = tableColumns.includes('userId');
      const hasCreatedByField = tableColumns.includes('createdBy');
      const hasIsSharedField = tableColumns.includes('isShared');
      const hasSharedField = tableColumns.includes('shared');
      
      const creatorId = hasUserIdField ? roleModel.userId : 
                        hasCreatedByField ? roleModel.createdBy : null;
      
      const isShared = hasIsSharedField ? roleModel.isShared === 1 : 
                       hasSharedField ? roleModel.isShared === true : false;
      
      if (
        creatorId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'organization_admin' && roleModel.organizationId === user.organizationId)
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
      // 現在はcollectionPlansテーブルを使用
      const plans = await db.query.collectionPlans.findMany({
        where: eq(collectionPlans.roleModelId, roleModelId)
      });
      
      return res.status(200).json(plans);
    } catch (error) {
      console.error('情報収集プラン一覧取得エラー:', error);
      return res.status(500).json({ error: `サーバーエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}` });
    }
  });
  
  // 特定の情報収集プラン取得API
  app.get('/api/information-collection-plans/:planId', isAuthenticated, getInformationCollectionPlan);
  
  // ロールモデルの最新の要約を取得するAPI
  app.get('/api/role-models/:roleModelId/collection-summaries', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.params;
      
      if (!roleModelId) {
        return res.status(400).json({ error: 'roleModelIdは必須です' });
      }
      
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // ロールモデルの存在確認とアクセス権チェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック
      const hasAccess = roleModel.createdBy === user.id || 
                         user.role === 'admin' || 
                         roleModel.isShared === 1;
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'このロールモデルにアクセスする権限がありません' });
      }
      
      // ロールモデルに関連する最新の要約を取得する
      const summaries = await db.query.collectionSummaries.findMany({
        where: eq(collectionSummaries.collectionPlanId, sql`(SELECT id FROM collection_plans WHERE role_model_id = ${roleModelId} LIMIT 1)`),
        orderBy: [desc(collectionSummaries.generatedAt)],
        limit: 10
      });
      
      return res.status(200).json(summaries);
    } catch (error) {
      console.error('コレクション要約取得エラー:', error);
      return res.status(500).json({ error: 'コレクション要約の取得に失敗しました' });
    }
  });
  
  // ノードに関連する要約を取得するAPI
  app.get('/api/knowledge-library/node-summaries/:roleModelId/:nodeId', isAuthenticated, async (req, res) => {
    try {
      const { roleModelId, nodeId } = req.params;
      
      if (!roleModelId || !nodeId) {
        return res.status(400).json({ error: 'roleModelIdとnodeIdは必須です' });
      }
      
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: '認証が必要です' });
      }
      
      // ロールモデルの存在確認とアクセス権チェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック（省略可能なロジック）
      const hasAccess = roleModel.createdBy === user.id || 
                         user.role === 'admin' || 
                         roleModel.isShared === 1;
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'このロールモデルにアクセスする権限がありません' });
      }
      
      // ノードの存在確認
      const node = await db.query.knowledgeNodes.findFirst({
        where: eq(knowledgeNodes.id, nodeId),
      });
      
      if (!node) {
        return res.status(404).json({ error: 'ノードが見つかりません' });
      }
      
      // ノードに関連する要約を取得する
      // ここではノード名をキーワードとして関連する要約を探す
      const summaries = await db.query.collectionSummaries.findMany({
        where: and(
          eq(collectionSummaries.collectionPlanId, sql`(SELECT id FROM collection_plans WHERE role_model_id = ${roleModelId} LIMIT 1)`),
          or(
            sql`LOWER(collection_summaries.title) LIKE LOWER('%' || ${node.name} || '%')`,
            sql`LOWER(collection_summaries.content) LIKE LOWER('%' || ${node.name} || '%')`
          )
        ),
        orderBy: [desc(collectionSummaries.generatedAt)],
        limit: 10
      });
      
      return res.status(200).json(summaries);
    } catch (error) {
      console.error('ノード関連の要約取得エラー:', error);
      return res.status(500).json({ error: 'ノード関連の要約の取得に失敗しました' });
    }
  });

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