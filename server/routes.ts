import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireRole } from "./auth";
import { z } from "zod";
import { 
  insertRoleModelSchema, 
  insertTagSchema,
  insertUserSchema,
  insertCompanySchema,
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

  app.get("/api/role-models/:id", isAuthenticated, async (req, res) => {
    try {
      const roleModel = await storage.getRoleModelWithTags(req.params.id);
      
      if (!roleModel) {
        return res.status(404).json({ message: "Role model not found" });
      }
      
      // Check if role model belongs to user
      if (roleModel.userId !== req.user!.id) {
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
        description: req.body.description
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

  // Company management (system admin only)
  app.get("/api/companies", requireRole(USER_ROLES.SYSTEM_ADMIN), async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Error fetching companies" });
    }
  });

  app.post("/api/companies", requireRole(USER_ROLES.SYSTEM_ADMIN), async (req, res) => {
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

  app.put("/api/companies/:id", requireRole(USER_ROLES.SYSTEM_ADMIN), async (req, res) => {
    try {
      const companyId = req.params.id;
      const existingCompany = await storage.getCompany(companyId);
      
      if (!existingCompany) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Update company
      const updatedCompany = await storage.updateCompany(companyId, {
        name: req.body.name,
        description: req.body.description
      });
      
      res.json(updatedCompany);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Error updating company" });
    }
  });

  app.delete("/api/companies/:id", requireRole(USER_ROLES.SYSTEM_ADMIN), async (req, res) => {
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

  // User management routes
  // System admins can manage company admins
  app.post("/api/company-admins", requireRole(USER_ROLES.SYSTEM_ADMIN), async (req, res) => {
    try {
      const { name, email, password, companyId } = req.body;
      
      if (!name || !email || !password || !companyId) {
        return res.status(400).json({ message: "Name, email, password, and companyId are required" });
      }
      
      // Validate if company exists
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Create a company admin user
      const admin = await storage.createUser({
        name,
        email,
        password,
        role: USER_ROLES.COMPANY_ADMIN,
        companyId
      });
      
      res.status(201).json(admin);
    } catch (error) {
      console.error("Error creating company admin:", error);
      res.status(500).json({ message: "Error creating company admin" });
    }
  });

  // Company admins can manage company users
  app.get("/api/companies/:id/users", requireRole([USER_ROLES.SYSTEM_ADMIN, USER_ROLES.COMPANY_ADMIN]), async (req, res) => {
    try {
      const companyId = req.params.id;
      
      // If company admin, verify they are from this company
      if (req.user && req.user.role === USER_ROLES.COMPANY_ADMIN && req.user.companyId !== companyId) {
        return res.status(403).json({ message: "You can only access users from your own company" });
      }
      
      const users = await storage.getUsers(companyId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching company users:", error);
      res.status(500).json({ message: "Error fetching company users" });
    }
  });

  app.post("/api/company-users", requireRole(USER_ROLES.COMPANY_ADMIN), async (req, res) => {
    try {
      const { name, email, password } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }
      
      // Company admin can only create users for their own company
      const companyId = req.user?.companyId;
      
      // Create a company user
      const user = await storage.createUser({
        name,
        email,
        password,
        role: USER_ROLES.COMPANY_USER,
        companyId
      });
      
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating company user:", error);
      res.status(500).json({ message: "Error creating company user" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
