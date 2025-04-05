import { Express, Request, Response, NextFunction } from 'express';
import { Server, createServer } from 'http';
import { setupWebSocketServer, sendMessageToRoleModelViewers, sendAgentThoughts } from './websocket';
import { db } from './db';
import { setupAuth, isAuthenticated, requireRole, hashPassword } from './auth';
import { initNeo4j, getKnowledgeGraph } from './neo4j';
import { eq, and, or, not, sql } from 'drizzle-orm';
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
  insertCompanySchema,
} from '@shared/schema';
import { generateKnowledgeGraphForNode } from './azure-openai';
import { randomUUID } from 'crypto';

// ルートの登録
export async function registerRoutes(app: Express): Promise<Server> {
  // HTTPサーバーの作成
  const httpServer = createServer(app);
  
  // 認証のセットアップ
  setupAuth(app);
  
  // Neo4jの初期化
  try {
    await initNeo4j();
  } catch (error) {
    console.error('Neo4j初期化エラー:', error);
  }
  
  // WebSocketサーバーのセットアップ
  setupWebSocketServer(httpServer);
  
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
        companyId: req.user.companyId,
      } : null,
    });
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
      const validatedData = insertCompanySchema.parse(req.body);
      
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
      
      const validatedData = insertCompanySchema.parse(req.body);
      
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
            company: true,
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
      
      // 自分自身か、システム管理者か、同じ会社の組織管理者のみアクセス可能
      if (
        id !== currentUser.id &&
        currentUser.role !== 'admin' &&
        !(currentUser.role === 'company_admin' && currentUser.companyId === currentUser.companyId)
      ) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }
      
      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
        with: {
          company: true,
        },
      });
      
      if (!user) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
      }
      
      // パスワードを除外
      const { password, ...safeUser } = user;
      
      res.json({
        ...safeUser,
        company: user.company ? {
          id: user.company.id,
          name: user.company.name,
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
      
      // 自分自身か、システム管理者か、同じ会社の組織管理者のみアクセス可能
      if (
        id !== currentUser.id &&
        currentUser.role !== 'admin' &&
        !(currentUser.role === 'company_admin' && currentUser.companyId === currentUser.companyId)
      ) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }
      
      // 更新対象のユーザーを取得
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, id),
      });
      
      if (!targetUser) {
        return res.status(404).json({ error: 'ユーザーが見つかりません' });
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
      
      // 組織管理者は会社IDを変更できない & admin ロールに変更できない
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
      
      // 組織管理者は自分の会社のユーザーのみ削除可能
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
      
      // 自分のロールモデルと共有されているロールモデルを取得
      const roleModelsQuery = await db.query.roleModels.findMany({
        where: (roleModels, { or, and, eq }) => or(
          eq(roleModels.userId, user.id),
          and(
            eq(roleModels.isShared, 1),
            user.companyId ? eq(roleModels.companyId, user.companyId) : undefined
          )
        ),
        with: {
          user: true,
          company: true,
        },
        orderBy: (roleModels, { desc }) => [desc(roleModels.createdAt)],
      });
      
      // 安全な情報のみを返す
      const safeRoleModels = roleModelsQuery.map(model => ({
        ...model,
        user: {
          id: model.user.id,
          name: model.user.name,
        },
        company: model.company ? {
          id: model.company.id,
          name: model.company.name,
        } : null,
      }));
      
      res.json(safeRoleModels);
    } catch (error) {
      console.error('ロールモデル取得エラー:', error);
      res.status(500).json({ error: 'ロールモデルの取得に失敗しました' });
    }
  });
  
  // ロールモデル詳細取得
  app.get('/api/role-models/:id', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.user;
      
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
        roleModel.userId !== user.id && 
        !(roleModel.isShared === 1 && roleModel.companyId === user.companyId) &&
        user.role !== 'admin'
      ) {
        return res.status(403).json({ error: 'このロールモデルへのアクセス権限がありません' });
      }
      
      // 安全な情報のみを返す
      const safeRoleModel = {
        ...roleModel,
        user: {
          id: roleModel.user.id,
          name: roleModel.user.name,
        },
        company: roleModel.company ? {
          id: roleModel.company.id,
          name: roleModel.company.name,
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
  app.post('/api/role-models', isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      let validatedData = insertRoleModelSchema.parse(req.body);
      
      // ユーザーIDを現在のユーザーに設定
      validatedData.userId = user.id;
      
      // 会社IDを設定 (会社に所属しているユーザーの場合)
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
      
      // ロールモデルの存在確認
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, id),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック (作成者、システム管理者、同じ会社の組織管理者のみ更新可能)
      if (
        roleModel.userId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'company_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルを更新する権限がありません' });
      }
      
      const validatedData = insertRoleModelSchema.parse(req.body);
      
      // ユーザーIDは変更不可 (作成者は固定)
      validatedData.userId = roleModel.userId;
      
      // 会社IDも変更不可 (所属会社は固定)
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
      
      // ロールモデルの存在確認
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, id),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      // アクセス権のチェック (作成者、システム管理者、同じ会社の組織管理者のみ削除可能)
      if (
        roleModel.userId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'company_admin' && roleModel.companyId === user.companyId)
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
      
      // アクセス権のチェック (作成者、システム管理者、同じ会社の組織管理者のみ共有設定を変更可能)
      if (
        roleModel.userId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'company_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルの共有設定を変更する権限がありません' });
      }
      
      // 会社に所属していないユーザーは共有できない
      if (isShared === 1 && !roleModel.companyId) {
        return res.status(400).json({ error: '会社に所属していないため、ロールモデルを共有できません' });
      }
      
      const result = await db
        .update(roleModels)
        .set({ isShared: isShared })
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
      
      // アクセス権のチェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      if (
        roleModel.userId !== user.id && 
        !(roleModel.isShared === 1 && roleModel.companyId === user.companyId) &&
        user.role !== 'admin'
      ) {
        return res.status(403).json({ error: 'この知識グラフへのアクセス権限がありません' });
      }
      
      // Neo4jから知識グラフデータを取得
      const graphData = await getKnowledgeGraph(roleModelId);
      
      res.json(graphData);
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
      
      // アクセス権のチェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, validatedData.roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      if (
        roleModel.userId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'company_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルに知識ノードを追加する権限がありません' });
      }
      
      // PostgreSQLにノードを保存
      const result = await db.insert(knowledgeNodes).values(validatedData).returning();
      
      // Neo4jにも同じノードを保存
      await createNodeInNeo4j(result[0]);
      
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
      
      // アクセス権のチェック
      const roleModel = await db.query.roleModels.findFirst({
        where: eq(roleModels.id, validatedData.roleModelId),
      });
      
      if (!roleModel) {
        return res.status(404).json({ error: 'ロールモデルが見つかりません' });
      }
      
      if (
        roleModel.userId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'company_admin' && roleModel.companyId === user.companyId)
      ) {
        return res.status(403).json({ error: 'このロールモデルに知識エッジを追加する権限がありません' });
      }
      
      // PostgreSQLにエッジを保存
      const result = await db.insert(knowledgeEdges).values(validatedData).returning();
      
      // Neo4jにも同じエッジを保存
      await createEdgeInNeo4j(result[0]);
      
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
      if (
        node.roleModel.userId !== user.id && 
        user.role !== 'admin' && 
        !(user.role === 'company_admin' && node.roleModel.companyId === user.companyId)
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
        type: 'expand', 
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

  // エラーハンドリング
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('APIエラー:', err);
    res.status(err.status || 500).json({
      error: err.message || '予期せぬエラーが発生しました',
    });
  });

  return httpServer;
}

// Neo4jにノードを作成する補助関数
async function createNodeInNeo4j(node: any) {
  const { id, name, type, level, parentId, roleModelId, description, color } = node;
  
  try {
    import('./neo4j').then(async (neo4j) => {
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
    });
  } catch (error) {
    console.error('Neo4jノード作成エラー:', error);
    // エラーは無視して処理を続行
  }
}

// Neo4jにエッジを作成する補助関数
async function createEdgeInNeo4j(edge: any) {
  const { sourceId, targetId, label, strength, roleModelId } = edge;
  
  try {
    import('./neo4j').then(async (neo4j) => {
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
    });
  } catch (error) {
    console.error('Neo4j関係作成エラー:', error);
    // エラーは無視して処理を続行
  }
}