import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireRole } from "./auth";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { 
  insertRoleModelSchema, 
  insertTagSchema,
  insertUserSchema,
  insertCompanySchema,
  insertKnowledgeNodeSchema,
  insertKnowledgeEdgeSchema,
  insertIndustryCategorySchema,
  insertIndustrySubcategorySchema,
  insertKeywordSchema,
  insertRoleModelIndustrySchema,
  insertRoleModelKeywordSchema,
  USER_ROLES
} from "@shared/schema";
import { 
  suggestTags, 
  collectInformation,
  generateSummary,
  generateKnowledgeGraph,
  generateKnowledgeGraphForNode,
  updateKnowledgeGraphByChat
} from "./azure-openai";

// マルチAIエージェントアーキテクチャのインポート
import {
  generateKnowledgeGraphForRoleModel
} from "./agents/index";

// WebSocketサーバーのインポート
import { setupWebSocketServer } from "./websocket";

// Middleware to ensure user is authenticated
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
};

// 特定の役割を持つユーザーのみアクセスを許可するミドルウェア
// auth.tsで定義されている関数を使用

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // HTTPサーバーの作成
  const httpServer = createServer(app);
  
  // WebSocketサーバーの初期化
  setupWebSocketServer(httpServer);

  // Role Model routes
  app.get("/api/role-models", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const roleModels = await storage.getRoleModels(userId);
      
      // 各ロールモデルの業界とキーワード情報を取得
      const detailedRoleModels = await Promise.all(
        roleModels.map(async (model) => {
          const industries = await storage.getRoleModelIndustriesWithData(model.id);
          const keywords = await storage.getRoleModelKeywordsWithData(model.id);
          
          return {
            ...model,
            industries,
            keywords
          };
        })
      );
      
      res.json(detailedRoleModels);
    } catch (error) {
      console.error("Error fetching role models:", error);
      res.status(500).json({ message: "Error fetching role models" });
    }
  });
  
  // 組織の共有ロールモデルを取得するルート
  app.get("/api/role-models/shared", isAuthenticated, async (req, res) => {
    try {
      // ユーザーの会社IDが必要
      const companyId = req.user?.companyId;
      
      if (!companyId) {
        return res.status(200).json([]); // 個人ユーザーの場合は空の配列を返す
      }
      
      const sharedRoleModels = await storage.getSharedRoleModels(companyId);
      
      // 各ロールモデルの業界とキーワード情報を取得
      const detailedSharedRoleModels = await Promise.all(
        sharedRoleModels.map(async (model) => {
          const industries = await storage.getRoleModelIndustriesWithData(model.id);
          const keywords = await storage.getRoleModelKeywordsWithData(model.id);
          
          return {
            ...model,
            industries,
            keywords
          };
        })
      );
      
      res.json(detailedSharedRoleModels);
    } catch (error) {
      console.error("Error fetching shared role models:", error);
      res.status(500).json({ message: "Error fetching shared role models" });
    }
  });

  app.get("/api/role-models/:id", isAuthenticated, async (req, res) => {
    try {
      const roleModel = await storage.getRoleModelWithTags(req.params.id);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // ユーザーのロールモデルか、ユーザーが所属する組織の共有ロールモデルかチェック
      const isUserModel = roleModel.userId === req.user!.id;
      const isSharedCompanyModel = roleModel.isShared === 1 && 
                                roleModel.companyId === req.user!.companyId;
      
      if (!isUserModel && !isSharedCompanyModel) {
        return res.status(403).json({ message: "Not authorized to access this role model" });
      }
      
      res.json(roleModel);
    } catch (error) {
      console.error("Error fetching role model:", error);
      res.status(500).json({ message: "Error fetching role model" });
    }
  });
  
  // Get role model with tags, industries and keywords
  app.get("/api/role-models/:id/with-tags", isAuthenticated, async (req, res) => {
    try {
      const roleModel = await storage.getRoleModelWithTags(req.params.id);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // ユーザーのロールモデルか、ユーザーが所属する組織の共有ロールモデルかチェック
      const isUserModel = roleModel.userId === req.user!.id;
      const isSharedCompanyModel = roleModel.isShared === 1 && 
                                roleModel.companyId === req.user!.companyId;
      
      if (!isUserModel && !isSharedCompanyModel) {
        return res.status(403).json({ message: "Not authorized to access this role model" });
      }
      
      // タグを取得
      const tags = await storage.getTags(roleModel.id);
      // 業界とキーワードを取得
      const industries = await storage.getRoleModelIndustriesWithData(roleModel.id);
      const keywords = await storage.getRoleModelKeywordsWithData(roleModel.id);
      
      // デバッグログを追加
      console.log("Role model industries:", industries);
      console.log("Role model keywords:", keywords);
      
      const roleModelWithData = {
        ...roleModel,
        tags,
        industries,
        keywords
      };
      
      // レスポンスデータを詳細にログ出力
      console.log("Complete role model response:", JSON.stringify(roleModelWithData, null, 2));
      
      // キャッシュを無効化するヘッダーを設定
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json(roleModelWithData);
    } catch (error) {
      console.error("Error fetching role model with data:", error);
      res.status(500).json({ message: "Error fetching role model with data" });
    }
  });

  app.post("/api/role-models", isAuthenticated, async (req, res) => {
    try {
      // Validate role model data
      const validatedData = insertRoleModelSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      
      const roleModel = await storage.createRoleModel(validatedData);
      res.status(201).json(roleModel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid role model data", errors: error.errors });
      }
      console.error("Error creating role model:", error);
      res.status(500).json({ message: "Error creating role model" });
    }
  });
  
  // ロールモデル削除エンドポイント
  app.delete("/api/role-models/:id", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // ユーザーのロールモデルかチェック
      const isUserModel = roleModel.userId === req.user!.id;
      // システム管理者か組織管理者は自組織の共有ロールモデルも削除可能
      const isAdminOrOrgAdmin = [USER_ROLES.SYSTEM_ADMIN, USER_ROLES.COMPANY_ADMIN].includes(req.user!.role as any);
      const isSameCompany = roleModel.companyId === req.user!.companyId;
      const canDeleteShared = isAdminOrOrgAdmin && isSameCompany && roleModel.isShared === 1;
      
      if (!isUserModel && !canDeleteShared) {
        return res.status(403).json({ message: "Not authorized to delete this role model" });
      }
      
      // 関連するデータを削除
      // 1. 知識エッジを削除
      const edges = await storage.getKnowledgeEdges(roleModelId);
      for (const edge of edges) {
        await storage.deleteKnowledgeEdge(edge.id);
      }
      
      // 2. 知識ノードを削除
      const nodes = await storage.getKnowledgeNodes(roleModelId);
      for (const node of nodes) {
        await storage.deleteKnowledgeNode(node.id);
      }
      
      // 3. タグを削除
      const tags = await storage.getTags(roleModelId);
      for (const tag of tags) {
        await storage.deleteTag(tag.id);
      }
      
      // 4. サマリーを削除
      const summaries = await storage.getSummaries(roleModelId);
      for (const summary of summaries) {
        await storage.updateSummaryFeedback(summary.id, 0); // 削除用のダミー操作
      }
      
      // 5. ロールモデル自体を削除
      const success = await storage.deleteRoleModel(roleModelId);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to delete role model" });
      }
      
      res.status(200).json({ message: "Role model and related data deleted successfully" });
    } catch (error) {
      console.error("Error deleting role model:", error);
      res.status(500).json({ message: "Error deleting role model" });
    }
  });

  app.put("/api/role-models/:id", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const existingRoleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!existingRoleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (existingRoleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to modify this role model" });
      }
      
      // Update role model
      const updatedRoleModel = await storage.updateRoleModel(roleModelId, {
        name: req.body.name,
        description: req.body.description,
        isShared: req.body.isShared
      });
      
      res.json(updatedRoleModel);
    } catch (error) {
      console.error("Error updating role model:", error);
      res.status(500).json({ message: "Error updating role model" });
    }
  });



  // Tag routes
  app.get("/api/role-models/:id/tags", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this role model's tags" });
      }
      
      const tags = await storage.getTags(roleModelId);
      res.json(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ message: "Error fetching tags" });
    }
  });

  app.post("/api/role-models/:id/tags", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to add tags to this role model" });
      }
      
      // Validate tag data
      const validatedData = insertTagSchema.parse({
        ...req.body,
        roleModelId
      });
      
      const tag = await storage.createTag(validatedData);
      res.status(201).json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid tag data", errors: error.errors });
      }
      console.error("Error creating tag:", error);
      res.status(500).json({ message: "Error creating tag" });
    }
  });

  app.delete("/api/tags/:id", isAuthenticated, async (req, res) => {
    try {
      const tagId = req.params.id;
      // In a real application, we would check if the tag belongs to the user
      // For MVP, we'll just delete the tag
      await storage.deleteTag(tagId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ message: "Error deleting tag" });
    }
  });

  // Knowledge Node routes
  app.get("/api/role-models/:id/knowledge-nodes", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this role model's knowledge nodes" });
      }
      
      const nodes = await storage.getKnowledgeNodes(roleModelId);
      res.json(nodes);
    } catch (error) {
      console.error("Error fetching knowledge nodes:", error);
      res.status(500).json({ message: "Error fetching knowledge nodes" });
    }
  });

  app.get("/api/knowledge-nodes/:id", isAuthenticated, async (req, res) => {
    try {
      const nodeId = req.params.id;
      const node = await storage.getKnowledgeNode(nodeId);
      
      if (!node) {
        return res.status(404).json({ message: "Knowledge node not found" });
      }
      
      // Verify ownership by checking the role model
      const roleModel = await storage.getRoleModelWithTags(node.roleModelId);
      if (!roleModel || roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this knowledge node" });
      }
      
      res.json(node);
    } catch (error) {
      console.error("Error fetching knowledge node:", error);
      res.status(500).json({ message: "Error fetching knowledge node" });
    }
  });

  app.post("/api/role-models/:id/knowledge-nodes", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to add knowledge nodes to this role model" });
      }
      
      // Validate node data
      const validatedData = insertKnowledgeNodeSchema.parse({
        ...req.body,
        roleModelId
      });
      
      const node = await storage.createKnowledgeNode(validatedData);
      res.status(201).json(node);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid knowledge node data", errors: error.errors });
      }
      console.error("Error creating knowledge node:", error);
      res.status(500).json({ message: "Error creating knowledge node" });
    }
  });

  app.put("/api/knowledge-nodes/:id", isAuthenticated, async (req, res) => {
    try {
      const nodeId = req.params.id;
      const node = await storage.getKnowledgeNode(nodeId);
      
      if (!node) {
        return res.status(404).json({ message: "Knowledge node not found" });
      }
      
      // Verify ownership by checking the role model
      const roleModel = await storage.getRoleModelWithTags(node.roleModelId);
      if (!roleModel || roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to modify this knowledge node" });
      }
      
      // Update node
      const updatedNode = await storage.updateKnowledgeNode(nodeId, req.body);
      res.json(updatedNode);
    } catch (error) {
      console.error("Error updating knowledge node:", error);
      res.status(500).json({ message: "Error updating knowledge node" });
    }
  });

  app.delete("/api/knowledge-nodes/:id", isAuthenticated, async (req, res) => {
    try {
      const nodeId = req.params.id;
      const node = await storage.getKnowledgeNode(nodeId);
      
      if (!node) {
        return res.status(404).json({ message: "Knowledge node not found" });
      }
      
      // Verify ownership by checking the role model
      const roleModel = await storage.getRoleModelWithTags(node.roleModelId);
      if (!roleModel || roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this knowledge node" });
      }
      
      // Delete node
      await storage.deleteKnowledgeNode(nodeId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting knowledge node:", error);
      res.status(500).json({ message: "Error deleting knowledge node" });
    }
  });

  // Knowledge Edge routes
  app.get("/api/role-models/:id/knowledge-edges", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this role model's knowledge edges" });
      }
      
      const edges = await storage.getKnowledgeEdges(roleModelId);
      res.json(edges);
    } catch (error) {
      console.error("Error fetching knowledge edges:", error);
      res.status(500).json({ message: "Error fetching knowledge edges" });
    }
  });

  app.post("/api/role-models/:id/knowledge-edges", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to add knowledge edges to this role model" });
      }
      
      // Validate that source and target nodes exist and belong to the role model
      const { sourceId, targetId } = req.body;
      const sourceNode = await storage.getKnowledgeNode(sourceId);
      const targetNode = await storage.getKnowledgeNode(targetId);
      
      if (!sourceNode || sourceNode.roleModelId !== roleModelId) {
        return res.status(400).json({ message: "Source node not found or does not belong to this role model" });
      }
      
      if (!targetNode || targetNode.roleModelId !== roleModelId) {
        return res.status(400).json({ message: "Target node not found or does not belong to this role model" });
      }
      
      // Validate edge data
      const validatedData = insertKnowledgeEdgeSchema.parse({
        ...req.body,
        roleModelId
      });
      
      const edge = await storage.createKnowledgeEdge(validatedData);
      res.status(201).json(edge);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid knowledge edge data", errors: error.errors });
      }
      console.error("Error creating knowledge edge:", error);
      res.status(500).json({ message: "Error creating knowledge edge" });
    }
  });

  app.delete("/api/knowledge-edges/:id", isAuthenticated, async (req, res) => {
    try {
      const edgeId = req.params.id;
      const edge = await storage.getKnowledgeEdge(edgeId);
      
      if (!edge) {
        return res.status(404).json({ message: "Knowledge edge not found" });
      }
      
      // Verify ownership by checking the role model
      const roleModel = await storage.getRoleModelWithTags(edge.roleModelId);
      if (!roleModel || roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this knowledge edge" });
      }
      
      // Delete edge
      await storage.deleteKnowledgeEdge(edgeId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting knowledge edge:", error);
      res.status(500).json({ message: "Error deleting knowledge edge" });
    }
  });

  // Summary routes
  app.get("/api/role-models/:id/summaries", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to access this role model's summaries" });
      }
      
      const summaries = await storage.getSummaries(roleModelId);
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching summaries:", error);
      res.status(500).json({ message: "Error fetching summaries" });
    }
  });

  app.post("/api/summaries/:id/feedback", isAuthenticated, async (req, res) => {
    try {
      const summaryId = req.params.id;
      const feedback = parseInt(req.body.feedback);
      
      if (isNaN(feedback) || feedback < -1 || feedback > 1) {
        return res.status(400).json({ message: "Invalid feedback value" });
      }
      
      const updatedSummary = await storage.updateSummaryFeedback(summaryId, feedback);
      
      if (!updatedSummary) {
        return res.status(404).json({ message: "Summary not found" });
      }
      
      res.json(updatedSummary);
    } catch (error) {
      console.error("Error updating summary feedback:", error);
      res.status(500).json({ message: "Error updating summary feedback" });
    }
  });

  // 組織管理ルート
  // 組織一覧を取得（システム管理者のみ）
  app.get("/api/companies", requireRole("system_admin"), async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Error fetching companies" });
    }
  });

  // 組織を作成（システム管理者のみ）
  app.post("/api/companies", requireRole("system_admin"), async (req, res) => {
    try {
      // Validate company data
      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid company data", errors: error.errors });
      }
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Error creating company" });
    }
  });

  // 組織を更新（システム管理者のみ）
  app.put("/api/companies/:id", requireRole("system_admin"), async (req, res) => {
    try {
      const companyId = req.params.id;
      const existingCompany = await storage.getCompany(companyId);
      
      if (!existingCompany) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Update company
      const updatedCompany = await storage.updateCompany(companyId, req.body);
      res.json(updatedCompany);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Error updating company" });
    }
  });

  // 組織を削除（システム管理者のみ）
  app.delete("/api/companies/:id", requireRole("system_admin"), async (req, res) => {
    try {
      const companyId = req.params.id;
      const existingCompany = await storage.getCompany(companyId);
      
      if (!existingCompany) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Delete company
      await storage.deleteCompany(companyId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company:", error);
      res.status(500).json({ message: "Error deleting company" });
    }
  });

  // 組織のユーザー一覧を取得（システム管理者または組織管理者）
  app.get("/api/companies/:id/users", requireRole(["system_admin", "company_admin"]), async (req, res) => {
    try {
      const companyId = req.params.id;
      
      // 組織管理者は自分の組織のユーザーのみ取得可能
      if (req.user && req.user.role === "company_admin" && req.user.companyId !== companyId) {
        return res.status(403).json({ message: "Not authorized to access this company's users" });
      }
      
      const users = await storage.getUsers(companyId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching company users:", error);
      res.status(500).json({ message: "Error fetching company users" });
    }
  });

  // 組織にユーザーを追加（システム管理者または組織管理者）
  app.post("/api/companies/:id/users", requireRole(["system_admin", "company_admin"]), async (req, res) => {
    try {
      const companyId = req.params.id;
      
      // 組織管理者は自分の組織のユーザーのみ追加可能
      if (req.user && req.user.role === "company_admin" && req.user.companyId !== companyId) {
        return res.status(403).json({ message: "Not authorized to add users to this company" });
      }
      
      // メールアドレスが既に存在するかチェック
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "このメールアドレスは既に使用されています" });
      }

      // システム管理者は常にcompanyIdなし（組織に所属させない）で作成できるようにする
      let userData;
      if (req.body.role === USER_ROLES.SYSTEM_ADMIN) {
        // システム管理者の場合は組織に所属させない
        userData = {
          ...req.body,
          companyId: null
        };
      } else {
        // それ以外のユーザーは指定された組織に所属させる
        userData = {
          ...req.body,
          companyId
        };
      }
      
      // Validate user data
      const validatedData = insertUserSchema.parse(userData);
      
      const user = await storage.createUser(validatedData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Error creating user" });
    }
  });

  // AI assistance routes
  app.post("/api/suggest-tags", isAuthenticated, async (req, res) => {
    try {
      const { name, description } = req.body;
      
      if (!name || !description) {
        return res.status(400).json({ message: "Name and description are required" });
      }
      
      const suggestedTags = await suggestTags(name, description);
      res.json(suggestedTags);
    } catch (error) {
      console.error("Error suggesting tags:", error);
      res.status(500).json({ message: "Error suggesting tags" });
    }
  });

  app.post("/api/collect-information", isAuthenticated, async (req, res) => {
    try {
      const { roleModelId } = req.body;
      
      if (!roleModelId) {
        return res.status(400).json({ message: "Role model ID is required" });
      }
      
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to collect information for this role model" });
      }
      
      const success = await collectInformation(roleModelId);
      
      if (success) {
        res.json({ message: "Information collection initiated successfully" });
      } else {
        res.status(500).json({ message: "Failed to collect information" });
      }
    } catch (error) {
      console.error("Error collecting information:", error);
      res.status(500).json({ message: "Error collecting information" });
    }
  });



  // Create HTTP server
  // AI Knowledge Graph Generation routes
  // チャット指示による知識グラフ更新
  app.post("/api/role-models/:id/update-by-chat", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "Chat prompt is required" });
      }
      
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to update this role model" });
      }
      
      const success = await updateKnowledgeGraphByChat(roleModelId, prompt);
      
      if (success) {
        res.json({ message: "Knowledge graph updated successfully" });
      } else {
        res.status(500).json({ message: "Failed to update knowledge graph" });
      }
    } catch (error) {
      console.error("Error updating knowledge graph by chat:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/role-models/:id/generate-knowledge-graph", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to generate knowledge graph for this role model" });
      }
      
      // Check if knowledge nodes already exist for this role model
      const existingNodes = await storage.getKnowledgeNodes(roleModelId);
      if (existingNodes.length > 0) {
        return res.status(400).json({ 
          message: "This role model already has a knowledge graph. Please delete existing nodes first or create a new role model."
        });
      }
      
      console.log(`Generating knowledge graph using multi-agent architecture for role model: ${roleModel.name}`);
      
      // 業界とキーワード情報を取得
      const industries = await storage.getRoleModelIndustriesWithData(roleModelId);
      const keywords = await storage.getRoleModelKeywordsWithData(roleModelId);
      
      // マルチAIエージェントアーキテクチャを使用してナレッジグラフを生成
      try {
        // RoleModelInputを構築
        const agentInput = {
          id: roleModelId, // RoleModelInputインターフェースに必要なidフィールド
          userId: req.user?.id || "", // RoleModelInputインターフェースに必要なuserIdフィールド（必須フィールド）
          roleModelId,
          roleName: roleModel.name,
          description: roleModel.description || "",
          industries: industries.map(i => i.name),
          keywords: keywords.map(k => k.name)
        };
        
        console.log("Agent input prepared:", JSON.stringify(agentInput, null, 2));
        
        // 高度なマルチAIエージェントオーケストレーターを呼び出し
        console.log("Initiating advanced multi-agent architecture with CrewAI, LangChain, and LlamaIndex integration");
        
        // オーケストレーターを呼び出し
        const result = await generateKnowledgeGraphForRoleModel(agentInput);
        
        if (!result.success) {
          throw new Error(`Failed to generate knowledge graph data: ${result.error || 'Unknown error'}`);
        }
        
        console.log("Knowledge graph generated successfully");
        
        // 生成されたグラフデータは既にデータベースに保存されている
        
        // Return the newly created nodes and edges
        const nodes = await storage.getKnowledgeNodes(roleModelId);
        const edges = await storage.getKnowledgeEdges(roleModelId);
        
        res.status(201).json({
          message: "Knowledge graph generated successfully using multi-agent architecture",
          nodes,
          edges
        });
        return;
      } catch (aiError) {
        console.error("Error in Multi-AI agent process:", aiError);
        
        // AIエージェント処理に失敗した場合は、従来の方法を試す
        console.log("Falling back to traditional knowledge graph generation method");
      }
      
      // フォールバック: 従来の方法でナレッジグラフを生成
      const success = await generateKnowledgeGraph(
        roleModelId,
        roleModel.name,
        roleModel.description || ""
      );
      
      if (success) {
        // Return the newly created nodes and edges
        const nodes = await storage.getKnowledgeNodes(roleModelId);
        const edges = await storage.getKnowledgeEdges(roleModelId);
        
        res.status(201).json({
          message: "Knowledge graph generated successfully",
          nodes,
          edges
        });
      } else {
        res.status(500).json({ message: "Failed to generate knowledge graph" });
      }
    } catch (error) {
      console.error("Error generating knowledge graph:", error);
      res.status(500).json({ message: "Error generating knowledge graph" });
    }
  });
  
  app.post("/api/knowledge-nodes/:id/expand", isAuthenticated, async (req, res) => {
    try {
      const nodeId = req.params.id;
      const node = await storage.getKnowledgeNode(nodeId);
      
      if (!node) {
        return res.status(404).json({ message: "Knowledge node not found" });
      }
      
      // Verify ownership by checking the role model
      const roleModel = await storage.getRoleModelWithTags(node.roleModelId);
      if (!roleModel || roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to expand this knowledge node" });
      }
      
      // Generate additional knowledge nodes for this node
      const success = await generateKnowledgeGraphForNode(
        node.roleModelId,
        node.name,
        nodeId
      );
      
      if (success) {
        // Return the newly created nodes and edges connected to this node
        const allNodes = await storage.getKnowledgeNodes(node.roleModelId);
        const allEdges = await storage.getKnowledgeEdges(node.roleModelId);
        
        // Filter edges to only include those connected to the expanded node
        const relevantEdges = allEdges.filter(edge => edge.sourceId === nodeId || edge.targetId === nodeId);
        
        // Get the IDs of nodes connected to the expanded node
        const connectedNodeIds = new Set<string>();
        relevantEdges.forEach(edge => {
          connectedNodeIds.add(edge.sourceId);
          connectedNodeIds.add(edge.targetId);
        });
        
        // Filter nodes to only include the connected ones
        const relevantNodes = allNodes.filter(n => connectedNodeIds.has(n.id));
        
        res.status(201).json({
          message: "Knowledge node expanded successfully",
          nodes: relevantNodes,
          edges: relevantEdges
        });
      } else {
        res.status(500).json({ message: "Failed to expand knowledge node" });
      }
    } catch (error) {
      console.error("Error expanding knowledge node:", error);
      res.status(500).json({ message: "Error expanding knowledge node" });
    }
  });

  // Industry Category routes
  app.get("/api/industry-categories", isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getIndustryCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching industry categories:", error);
      res.status(500).json({ message: "Error fetching industry categories" });
    }
  });

  app.get("/api/industry-categories/:id/subcategories", isAuthenticated, async (req, res) => {
    try {
      const categoryId = req.params.id;
      const subcategories = await storage.getIndustrySubcategories(categoryId);
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching industry subcategories:", error);
      res.status(500).json({ message: "Error fetching industry subcategories" });
    }
  });

  app.get("/api/industry-subcategories", isAuthenticated, async (req, res) => {
    try {
      const subcategories = await storage.getIndustrySubcategories();
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching all industry subcategories:", error);
      res.status(500).json({ message: "Error fetching all industry subcategories" });
    }
  });

  // Keywords routes
  app.get("/api/keywords", isAuthenticated, async (req, res) => {
    try {
      const keywords = await storage.getKeywords();
      res.json(keywords);
    } catch (error) {
      console.error("Error fetching keywords:", error);
      res.status(500).json({ message: "Error fetching keywords" });
    }
  });

  app.post("/api/keywords", isAuthenticated, requireRole([USER_ROLES.SYSTEM_ADMIN, USER_ROLES.COMPANY_ADMIN]), async (req, res) => {
    try {
      // Validate keyword data
      const validatedData = insertKeywordSchema.parse(req.body);
      const keyword = await storage.createKeyword(validatedData);
      res.status(201).json(keyword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid keyword data", errors: error.errors });
      }
      console.error("Error creating keyword:", error);
      res.status(500).json({ message: "Error creating keyword" });
    }
  });

  // Role Model Industry and Keyword routes
  app.get("/api/role-models/:id/industries", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Check authorization
      const isUserModel = roleModel.userId === req.user!.id;
      const isSharedCompanyModel = roleModel.isShared === 1 && 
                                roleModel.companyId === req.user!.companyId;
      
      if (!isUserModel && !isSharedCompanyModel) {
        return res.status(403).json({ message: "Not authorized to access this role model's industries" });
      }
      
      const industries = await storage.getRoleModelIndustries(roleModelId);
      res.json(industries);
    } catch (error) {
      console.error("Error fetching role model industries:", error);
      res.status(500).json({ message: "Error fetching role model industries" });
    }
  });

  app.post("/api/role-models/:id/industries", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to add industries to this role model" });
      }
      
      // Validate data
      const validatedData = insertRoleModelIndustrySchema.parse({
        ...req.body,
        roleModelId
      });
      
      const industry = await storage.createRoleModelIndustry(validatedData);
      res.status(201).json(industry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid industry data", errors: error.errors });
      }
      console.error("Error adding industry to role model:", error);
      res.status(500).json({ message: "Error adding industry to role model" });
    }
  });

  app.delete("/api/role-models/:roleModelId/industries/:industryId", isAuthenticated, async (req, res) => {
    try {
      const { roleModelId, industryId } = req.params;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to remove industries from this role model" });
      }
      
      await storage.deleteRoleModelIndustry(industryId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing industry from role model:", error);
      res.status(500).json({ message: "Error removing industry from role model" });
    }
  });

  app.get("/api/role-models/:id/keywords", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Check authorization
      const isUserModel = roleModel.userId === req.user!.id;
      const isSharedCompanyModel = roleModel.isShared === 1 && 
                                roleModel.companyId === req.user!.companyId;
      
      if (!isUserModel && !isSharedCompanyModel) {
        return res.status(403).json({ message: "Not authorized to access this role model's keywords" });
      }
      
      const keywords = await storage.getRoleModelKeywords(roleModelId);
      res.json(keywords);
    } catch (error) {
      console.error("Error fetching role model keywords:", error);
      res.status(500).json({ message: "Error fetching role model keywords" });
    }
  });

  app.post("/api/role-models/:id/keywords", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to add keywords to this role model" });
      }
      
      // Validate data
      const validatedData = insertRoleModelKeywordSchema.parse({
        ...req.body,
        roleModelId
      });
      
      const keyword = await storage.createRoleModelKeyword(validatedData);
      res.status(201).json(keyword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid keyword data", errors: error.errors });
      }
      console.error("Error adding keyword to role model:", error);
      res.status(500).json({ message: "Error adding keyword to role model" });
    }
  });

  app.delete("/api/role-models/:roleModelId/keywords/:keywordId", isAuthenticated, async (req, res) => {
    try {
      const { roleModelId, keywordId } = req.params;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to remove keywords from this role model" });
      }
      
      await storage.deleteRoleModelKeyword(keywordId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing keyword from role model:", error);
      res.status(500).json({ message: "Error removing keyword from role model" });
    }
  });

  // Role Model with Industries and Keywords
  app.get("/api/role-models/:id/with-industries-keywords", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Check authorization
      const isUserModel = roleModel.userId === req.user!.id;
      const isSharedCompanyModel = roleModel.isShared === 1 && 
                                roleModel.companyId === req.user!.companyId;
      
      if (!isUserModel && !isSharedCompanyModel) {
        return res.status(403).json({ message: "Not authorized to access this role model" });
      }
      
      const roleModelWithDetails = await storage.getRoleModelWithIndustriesAndKeywords(roleModelId);
      res.json(roleModelWithDetails);
    } catch (error) {
      console.error("Error fetching role model with industries and keywords:", error);
      res.status(500).json({ message: "Error fetching role model details" });
    }
  });

  // 業界組み合わせの管理 API
  app.get("/api/industry-combinations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      
      const combinations = await storage.getIndustryCombinations(userId, companyId);
      res.json(combinations);
    } catch (error) {
      console.error("Error fetching industry combinations:", error);
      res.status(500).json({ message: "Error fetching industry combinations" });
    }
  });

  app.get("/api/industry-combinations/:id", isAuthenticated, async (req, res) => {
    try {
      const combinationId = req.params.id;
      const combination = await storage.getIndustryCombination(combinationId);
      
      if (!combination) {
        return res.status(404).json({ message: "Industry combination not found" });
      }
      
      // 自分のものか、共有されたものかチェック
      const isOwner = combination.userId === req.user!.id;
      const isSharedCompany = combination.isShared && combination.companyId === req.user!.companyId;
      
      if (!isOwner && !isSharedCompany) {
        return res.status(403).json({ message: "Not authorized to access this industry combination" });
      }
      
      // 詳細情報を取得
      const details = await storage.getIndustryCombinationDetails(combinationId);
      
      res.json({
        ...combination,
        details
      });
    } catch (error) {
      console.error("Error fetching industry combination:", error);
      res.status(500).json({ message: "Error fetching industry combination" });
    }
  });

  app.post("/api/industry-combinations", isAuthenticated, async (req, res) => {
    try {
      const { name, industrySubcategoryIds, isShared = false } = req.body;
      
      if (!name || !Array.isArray(industrySubcategoryIds) || industrySubcategoryIds.length === 0) {
        return res.status(400).json({ message: "Name and industry subcategory IDs are required" });
      }
      
      // 作成
      const newCombination = await storage.createIndustryCombination({
        name,
        userId: req.user!.id,
        isShared,
        companyId: isShared ? req.user!.companyId : null
      });
      
      // 詳細を追加
      for (const subcategoryId of industrySubcategoryIds) {
        await storage.addIndustryCombinationDetail(newCombination.id, subcategoryId);
      }
      
      res.status(201).json(newCombination);
    } catch (error) {
      console.error("Error creating industry combination:", error);
      res.status(500).json({ message: "Error creating industry combination" });
    }
  });

  app.delete("/api/industry-combinations/:id", isAuthenticated, async (req, res) => {
    try {
      const combinationId = req.params.id;
      const combination = await storage.getIndustryCombination(combinationId);
      
      if (!combination) {
        return res.status(404).json({ message: "Industry combination not found" });
      }
      
      // 所有者かチェック
      if (combination.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this industry combination" });
      }
      
      // 削除
      await storage.deleteIndustryCombination(combinationId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting industry combination:", error);
      res.status(500).json({ message: "Error deleting industry combination" });
    }
  });

  // 情報収集プラン生成 API
  app.post("/api/information-collection/plan", isAuthenticated, async (req, res) => {
    try {
      const { industryIds, keywordIds } = req.body;
      
      if (!industryIds || !Array.isArray(industryIds) || industryIds.length === 0) {
        return res.status(400).json({ message: "Industry IDs are required" });
      }
      
      // 業界情報を取得
      const industries = await Promise.all(
        industryIds.map(async (id) => {
          const subcategory = await storage.getIndustrySubcategory(id);
          if (subcategory) {
            const category = await storage.getIndustryCategory(subcategory.categoryId);
            return {
              id: subcategory.id,
              name: subcategory.name,
              categoryName: category?.name || 'Unknown',
              description: subcategory.description
            };
          }
          return null;
        })
      );
      
      const validIndustries = industries.filter(i => i !== null);
      
      // キーワード情報を取得（もし指定されていれば）
      let keywords = [];
      if (keywordIds && Array.isArray(keywordIds) && keywordIds.length > 0) {
        keywords = await Promise.all(
          keywordIds.map(async (id) => {
            const keyword = await storage.getKeyword(id);
            return keyword ? {
              id: keyword.id,
              name: keyword.name,
              description: keyword.description
            } : null;
          })
        );
        keywords = keywords.filter(k => k !== null);
      }
      
      // プラン生成（今回はモックデータ）
      const plan = {
        id: crypto.randomUUID(),
        name: `情報収集プラン - ${new Date().toLocaleDateString('ja-JP')}`,
        createdAt: new Date(),
        userId: req.user!.id,
        industries: validIndustries,
        keywords: keywords,
        status: "active"
      };
      
      res.status(201).json(plan);
    } catch (error) {
      console.error("Error generating information collection plan:", error);
      res.status(500).json({ message: "Error generating information collection plan" });
    }
  });

  // ロールモデルの業界カテゴリ関連付けを削除するエンドポイント
  app.delete("/api/role-model-industries/:roleModelId", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.roleModelId;
      
      // Check role model ownership
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to modify this role model" });
      }
      
      // 詳細なデバッグログを追加
      console.log(`削除開始 - ロールモデルID: ${roleModelId}の業界カテゴリを全て削除します`);
      const result = await storage.deleteRoleModelIndustriesByRoleModelId(roleModelId);
      console.log(`削除結果 - 業界カテゴリ削除: ${result}`);
      
      res.status(200).json({ message: "All industry mappings deleted successfully" });
    } catch (error) {
      console.error("Error deleting role model industries:", error);
      res.status(500).json({ message: "Error deleting role model industries" });
    }
  });
  
  // ロールモデルの業界カテゴリ関連付けを追加するエンドポイント
  app.post("/api/role-model-industries", isAuthenticated, async (req, res) => {
    try {
      const { roleModelId, industrySubcategoryId } = req.body;
      
      if (!roleModelId || !industrySubcategoryId) {
        return res.status(400).json({ message: "Role model ID and industry subcategory ID are required" });
      }
      
      // Check role model ownership
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to modify this role model" });
      }
      
      // Insert new mapping with validation
      const validatedData = {
        id: uuidv4(),
        roleModelId,
        industrySubcategoryId
      };
      
      console.log(`業界カテゴリを関連付け: ${JSON.stringify(validatedData)}`);
      const mapping = await storage.createRoleModelIndustry(validatedData);
      res.status(200).json(mapping);
    } catch (error) {
      console.error("Error creating role model industry mapping:", error);
      res.status(500).json({ message: "Error creating role model industry mapping" });
    }
  });

  // ロールモデルのキーワード関連付けを削除するエンドポイント
  app.delete("/api/role-model-keywords/:roleModelId", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.roleModelId;
      
      // Check role model ownership
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to modify this role model" });
      }
      
      // 詳細なデバッグログを追加
      console.log(`削除開始 - ロールモデルID: ${roleModelId}のキーワードを全て削除します`);
      const result = await storage.deleteRoleModelKeywordsByRoleModelId(roleModelId);
      console.log(`削除結果 - キーワード削除: ${result}`);
      
      res.status(200).json({ message: "All keyword mappings deleted successfully" });
    } catch (error) {
      console.error("Error deleting role model keywords:", error);
      res.status(500).json({ message: "Error deleting role model keywords" });
    }
  });
  
  // ロールモデルのキーワード関連付けを追加するエンドポイント
  app.post("/api/role-model-keywords", isAuthenticated, async (req, res) => {
    try {
      const { roleModelId, keywordId } = req.body;
      
      if (!roleModelId || !keywordId) {
        return res.status(400).json({ message: "Role model ID and keyword ID are required" });
      }
      
      // Check role model ownership
      const roleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      if (roleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to modify this role model" });
      }
      
      // Insert new mapping with validation
      const validatedData = {
        id: uuidv4(),
        roleModelId,
        keywordId
      };
      
      console.log(`キーワードを関連付け: ${JSON.stringify(validatedData)}`);
      const mapping = await storage.createRoleModelKeyword(validatedData);
      res.status(200).json(mapping);
    } catch (error) {
      console.error("Error creating role model keyword mapping:", error);
      res.status(500).json({ message: "Error creating role model keyword mapping" });
    }
  });

  return httpServer;
}
