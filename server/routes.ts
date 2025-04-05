import { Express, Request, Response, NextFunction } from 'express';
import { Server, createServer } from 'http';
import { setupWebSocketServer, sendMessageToRoleModelViewers, sendAgentThoughts } from './websocket';
import { db } from './db';
import { setupAuth, isAuthenticated, requireRole } from './auth';
import { initNeo4j, getKnowledgeGraph } from './neo4j';
import { eq } from 'drizzle-orm';
import { 
  insertKnowledgeNodeSchema, 
  insertKnowledgeEdgeSchema,
  knowledgeNodes,
  knowledgeEdges 
} from '@shared/schema';
import { generateKnowledgeGraphForNode } from './azure-openai';

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
      } : null,
    });
  });

  // ロールモデル関連
  app.get('/api/role-models', isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      const roleModels = await db.query.roleModels.findMany({
        where: (roleModels, { or, eq }) => or(
          eq(roleModels.isShared, 1),
          user && user.companyId ? eq(roleModels.companyId, user.companyId) : undefined
        ),
      });
      
      res.json(roleModels);
    } catch (error) {
      console.error('ロールモデル取得エラー:', error);
      res.status(500).json({ error: 'ロールモデルの取得に失敗しました' });
    }
  });

  // 知識グラフ関連
  app.get('/api/knowledge-graph/:roleModelId', async (req, res) => {
    try {
      const { roleModelId } = req.params;
      
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
      
      // ノードの存在確認とデータ取得
      const node = await db.query.knowledgeNodes.findFirst({
        where: eq(knowledgeNodes.id, nodeId)
      });
      
      if (!node) {
        return res.status(404).json({ error: '対象のノードが見つかりません' });
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

  // 管理者専用ルート
  app.get('/api/admin/users', requireRole('admin'), async (req, res) => {
    try {
      const users = await db.query.users.findMany({
        with: {
          company: true,
        },
      });
      
      res.json(users.map(user => ({
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
  const { source, target, type, label, strength, roleModelId } = edge;
  
  try {
    import('./neo4j').then(async (neo4j) => {
      // Neo4jに関係作成
      await neo4j.createRelationship(
        source,
        target,
        type || 'RELATED_TO',
        {
          label,
          strength: strength || 1,
        },
        roleModelId.toString()
      );
      
      console.log(`Neo4jに関係作成: ${source} -> ${target}`);
    });
  } catch (error) {
    console.error('Neo4j関係作成エラー:', error);
    // エラーは無視して処理を続行
  }
}