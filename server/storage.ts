import { 
  User, InsertUser, 
  Company, InsertCompany,
  RoleModel, InsertRoleModel, 
  Tag, InsertTag, 
  KnowledgeNode, InsertKnowledgeNode,
  KnowledgeEdge, InsertKnowledgeEdge,
  Summary, InsertSummary, 
  RoleModelWithTags,
  SummaryWithTags
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import crypto from "crypto";

const MemoryStore = createMemoryStore(session);

// Storage interface
export interface IStorage {
  // Company operations
  getCompany(id: string): Promise<Company | undefined>;
  getCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;

  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(companyId?: string): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  // Role model operations
  getRoleModels(userId: string): Promise<RoleModel[]>;
  getRoleModelWithTags(id: string): Promise<RoleModelWithTags | undefined>;
  createRoleModel(roleModel: InsertRoleModel): Promise<RoleModel>;
  updateRoleModel(id: string, roleModel: Partial<InsertRoleModel>): Promise<RoleModel | undefined>;
  deleteRoleModel(id: string): Promise<boolean>;
  
  // Tag operations
  getTags(roleModelId: string): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, tag: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<boolean>;
  
  // Knowledge Node operations
  getKnowledgeNodes(roleModelId: string): Promise<KnowledgeNode[]>;
  getKnowledgeNode(id: string): Promise<KnowledgeNode | undefined>;
  createKnowledgeNode(node: InsertKnowledgeNode): Promise<KnowledgeNode>;
  updateKnowledgeNode(id: string, node: Partial<InsertKnowledgeNode>): Promise<KnowledgeNode | undefined>;
  deleteKnowledgeNode(id: string): Promise<boolean>;
  
  // Knowledge Edge operations
  getKnowledgeEdges(roleModelId: string): Promise<KnowledgeEdge[]>;
  getKnowledgeEdge(id: string): Promise<KnowledgeEdge | undefined>;
  createKnowledgeEdge(edge: InsertKnowledgeEdge): Promise<KnowledgeEdge>;
  updateKnowledgeEdge(id: string, edge: Partial<InsertKnowledgeEdge>): Promise<KnowledgeEdge | undefined>;
  deleteKnowledgeEdge(id: string): Promise<boolean>;

  // Summary operations
  getSummaries(roleModelId: string): Promise<Summary[]>;
  getSummaryWithTags(id: string): Promise<SummaryWithTags | undefined>;
  createSummary(summary: InsertSummary): Promise<Summary>;
  updateSummaryFeedback(id: string, feedback: number): Promise<Summary | undefined>;

  // Session store
  sessionStore: any; // session.SessionStore
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private companies: Map<string, Company>;
  private users: Map<string, User>;
  private roleModels: Map<string, RoleModel>;
  private tags: Map<string, Tag>;
  private knowledgeNodes: Map<string, KnowledgeNode>;
  private knowledgeEdges: Map<string, KnowledgeEdge>;
  private summaries: Map<string, Summary>;
  sessionStore: any; // session.SessionStore

  constructor() {
    this.companies = new Map();
    this.users = new Map();
    this.roleModels = new Map();
    this.tags = new Map();
    this.knowledgeNodes = new Map();
    this.knowledgeEdges = new Map();
    this.summaries = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }

  // Company methods
  async getCompany(id: string): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = crypto.randomUUID();
    const company: Company = { 
      ...insertCompany, 
      id,
      description: insertCompany.description || null
    };
    this.companies.set(id, company);
    return company;
  }

  async updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const existingCompany = this.companies.get(id);
    if (!existingCompany) return undefined;

    const updatedCompany = { ...existingCompany, ...company };
    this.companies.set(id, updatedCompany);
    return updatedCompany;
  }

  async deleteCompany(id: string): Promise<boolean> {
    return this.companies.delete(id);
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email
    );
  }

  async getUsers(companyId?: string): Promise<User[]> {
    if (companyId) {
      return Array.from(this.users.values()).filter(
        (user) => user.companyId === companyId
      );
    }
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = crypto.randomUUID();
    // デフォルト値を設定
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || 'individual_user',
      companyId: insertUser.companyId || null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;

    const updatedUser = { ...existingUser, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  // Role model methods
  async getRoleModels(userId: string): Promise<RoleModel[]> {
    return Array.from(this.roleModels.values()).filter(
      (roleModel) => roleModel.userId === userId
    );
  }

  async getRoleModelWithTags(id: string): Promise<RoleModelWithTags | undefined> {
    const roleModel = this.roleModels.get(id);
    if (!roleModel) return undefined;

    const modelTags = Array.from(this.tags.values()).filter(
      (tag) => tag.roleModelId === id
    );

    return {
      ...roleModel,
      tags: modelTags
    };
  }

  async createRoleModel(insertRoleModel: InsertRoleModel): Promise<RoleModel> {
    const id = crypto.randomUUID();
    const roleModel: RoleModel = { 
      ...insertRoleModel, 
      id,
      createdAt: new Date() 
    };
    this.roleModels.set(id, roleModel);
    return roleModel;
  }

  async updateRoleModel(id: string, roleModel: Partial<InsertRoleModel>): Promise<RoleModel | undefined> {
    const existingRoleModel = this.roleModels.get(id);
    if (!existingRoleModel) return undefined;

    const updatedRoleModel = { ...existingRoleModel, ...roleModel };
    this.roleModels.set(id, updatedRoleModel);
    return updatedRoleModel;
  }

  async deleteRoleModel(id: string): Promise<boolean> {
    return this.roleModels.delete(id);
  }

  // Tag methods
  async getTags(roleModelId: string): Promise<Tag[]> {
    return Array.from(this.tags.values()).filter(
      (tag) => tag.roleModelId === roleModelId
    );
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    const id = crypto.randomUUID();
    const tag: Tag = { ...insertTag, id };
    this.tags.set(id, tag);
    return tag;
  }

  async updateTag(id: string, tag: Partial<InsertTag>): Promise<Tag | undefined> {
    const existingTag = this.tags.get(id);
    if (!existingTag) return undefined;

    const updatedTag = { ...existingTag, ...tag };
    this.tags.set(id, updatedTag);
    return updatedTag;
  }

  async deleteTag(id: string): Promise<boolean> {
    return this.tags.delete(id);
  }
  
  // Knowledge Node methods
  async getKnowledgeNodes(roleModelId: string): Promise<KnowledgeNode[]> {
    return Array.from(this.knowledgeNodes.values())
      .filter((node) => node.roleModelId === roleModelId)
      .sort((a, b) => a.level - b.level); // Sort by level ascending
  }
  
  async getKnowledgeNode(id: string): Promise<KnowledgeNode | undefined> {
    return this.knowledgeNodes.get(id);
  }
  
  async createKnowledgeNode(insertNode: InsertKnowledgeNode): Promise<KnowledgeNode> {
    const id = crypto.randomUUID();
    const node: KnowledgeNode = {
      ...insertNode,
      id,
      createdAt: new Date(),
      description: insertNode.description || null,
      color: insertNode.color || null,
      parentId: insertNode.parentId || null,
      type: insertNode.type || "keyword",
      level: insertNode.level || 0
    };
    this.knowledgeNodes.set(id, node);
    return node;
  }
  
  async updateKnowledgeNode(id: string, nodeData: Partial<InsertKnowledgeNode>): Promise<KnowledgeNode | undefined> {
    const existingNode = this.knowledgeNodes.get(id);
    if (!existingNode) return undefined;
    
    const updatedNode = { ...existingNode, ...nodeData };
    this.knowledgeNodes.set(id, updatedNode);
    return updatedNode;
  }
  
  async deleteKnowledgeNode(id: string): Promise<boolean> {
    // 削除するノードに依存する子ノードも削除
    const childNodes = Array.from(this.knowledgeNodes.values())
      .filter(node => node.parentId === id);
      
    childNodes.forEach(node => this.knowledgeNodes.delete(node.id));
    
    // 関連するエッジも削除
    const relatedEdges = Array.from(this.knowledgeEdges.values())
      .filter(edge => edge.sourceId === id || edge.targetId === id);
      
    relatedEdges.forEach(edge => this.knowledgeEdges.delete(edge.id));
    
    return this.knowledgeNodes.delete(id);
  }
  
  // Knowledge Edge methods
  async getKnowledgeEdges(roleModelId: string): Promise<KnowledgeEdge[]> {
    return Array.from(this.knowledgeEdges.values())
      .filter((edge) => edge.roleModelId === roleModelId);
  }
  
  async getKnowledgeEdge(id: string): Promise<KnowledgeEdge | undefined> {
    return this.knowledgeEdges.get(id);
  }
  
  async createKnowledgeEdge(insertEdge: InsertKnowledgeEdge): Promise<KnowledgeEdge> {
    const id = crypto.randomUUID();
    const edge: KnowledgeEdge = {
      ...insertEdge,
      id,
      label: insertEdge.label || null,
      strength: insertEdge.strength || 1
    };
    this.knowledgeEdges.set(id, edge);
    return edge;
  }
  
  async updateKnowledgeEdge(id: string, edgeData: Partial<InsertKnowledgeEdge>): Promise<KnowledgeEdge | undefined> {
    const existingEdge = this.knowledgeEdges.get(id);
    if (!existingEdge) return undefined;
    
    const updatedEdge = { ...existingEdge, ...edgeData };
    this.knowledgeEdges.set(id, updatedEdge);
    return updatedEdge;
  }
  
  async deleteKnowledgeEdge(id: string): Promise<boolean> {
    return this.knowledgeEdges.delete(id);
  }

  // Summary methods
  async getSummaries(roleModelId: string): Promise<Summary[]> {
    return Array.from(this.summaries.values())
      .filter((summary) => summary.roleModelId === roleModelId)
      .sort((a, b) => {
        // Sort by createdAt in descending order
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date();
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date();
        return dateB.getTime() - dateA.getTime();
      });
  }

  async getSummaryWithTags(id: string): Promise<SummaryWithTags | undefined> {
    const summary = this.summaries.get(id);
    if (!summary) return undefined;

    // Find all tags for this summary's role model
    const summaryTags = Array.from(this.tags.values()).filter(
      (tag) => tag.roleModelId === summary.roleModelId
    );

    return {
      ...summary,
      tags: summaryTags
    };
  }

  async createSummary(insertSummary: InsertSummary): Promise<Summary> {
    const id = crypto.randomUUID();
    const createdAt = new Date();
    const summary: Summary = { 
      ...insertSummary, 
      id, 
      createdAt,
      sources: insertSummary.sources || null,
      feedback: insertSummary.feedback || null
    };
    this.summaries.set(id, summary);
    return summary;
  }

  async updateSummaryFeedback(id: string, feedback: number): Promise<Summary | undefined> {
    const existingSummary = this.summaries.get(id);
    if (!existingSummary) return undefined;

    const updatedSummary = { ...existingSummary, feedback };
    this.summaries.set(id, updatedSummary);
    return updatedSummary;
  }
}

// Export a singleton instance
export const storage = new MemStorage();
