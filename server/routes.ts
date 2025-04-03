import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertRoleModelSchema, 
  insertTagSchema,
  insertUserSchema,
  insertCompanySchema,
  insertKnowledgeNodeSchema,
  insertKnowledgeEdgeSchema,
  USER_ROLES
} from "@shared/schema";
import { 
  suggestTags, 
  collectInformation,
  generateSummary
} from "./azure-openai";

// Middleware to ensure user is authenticated
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
};

// 特定の役割を持つユーザーのみアクセスを許可するミドルウェア
const requireRole = (role: string | string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const roles = Array.isArray(role) ? role : [role];
    if (roles.includes(req.user.role)) {
      return next();
    }
    
    res.status(403).json({ message: "Access denied" });
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Role Model routes
  app.get("/api/role-models", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const roleModels = await storage.getRoleModels(userId);
      res.json(roleModels);
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
      res.json(sharedRoleModels);
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

  app.delete("/api/role-models/:id", isAuthenticated, async (req, res) => {
    try {
      const roleModelId = req.params.id;
      const existingRoleModel = await storage.getRoleModelWithTags(roleModelId);
      
      if (!existingRoleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Ensure role model belongs to user
      if (existingRoleModel.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to delete this role model" });
      }
      
      // Delete role model
      await storage.deleteRoleModel(roleModelId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting role model:", error);
      res.status(500).json({ message: "Error deleting role model" });
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
  const httpServer = createServer(app);
  return httpServer;
}
