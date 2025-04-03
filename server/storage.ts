import { 
  User, InsertUser, 
  Company, InsertCompany,
  RoleModel, InsertRoleModel, 
  Tag, InsertTag, 
  KnowledgeNode, InsertKnowledgeNode,
  KnowledgeEdge, InsertKnowledgeEdge,
  Summary, InsertSummary, 
  RoleModelWithTags,
  SummaryWithTags,
  companies,
  users,
  roleModels,
  tags,
  knowledgeNodes,
  knowledgeEdges,
  summaries
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import crypto from "crypto";
import { eq, and, isNull, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";

// メモリストア（開発用）
const MemoryStore = createMemoryStore(session);

// PostgreSQLセッションストア
const PostgresSessionStore = connectPg(session);

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
  getSharedRoleModels(companyId: string): Promise<RoleModel[]>;
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
      // companyIdが一致するユーザーのみをフィルタリング
      // さらに、実際のUserオブジェクトであることを確認（nameとemailプロパティがあるか）
      return Array.from(this.users.values()).filter(
        (user) => user.companyId === companyId && typeof user.name === 'string' && typeof user.email === 'string'
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
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    const models = Array.from(this.roleModels.values()).filter(
      (roleModel) => roleModel.userId === userId
    );
    
    // 所属している会社の共有ロールモデルも取得
    if (user && user.companyId) {
      const companySharedModels = await this.getSharedRoleModels(user.companyId);
      return [...models, ...companySharedModels];
    }
    
    return models;
  }
  
  async getSharedRoleModels(companyId: string): Promise<RoleModel[]> {
    return Array.from(this.roleModels.values()).filter(
      (roleModel) => roleModel.companyId === companyId && roleModel.isShared === 1
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
      companyId: insertRoleModel.companyId || null,
      isShared: insertRoleModel.isShared || 0,
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

// PostgreSQL Storage Implementation
export class PostgresStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }

  // Company methods
  async getCompany(id: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id));
    return result[0];
  }

  async getCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(company).returning();
    return result[0];
  }

  async updateCompany(id: string, companyData: Partial<InsertCompany>): Promise<Company | undefined> {
    const result = await db.update(companies)
      .set(companyData)
      .where(eq(companies.id, id))
      .returning();
    return result[0];
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id)).returning();
    return result.length > 0;
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getUsers(companyId?: string): Promise<User[]> {
    if (companyId) {
      return await db.select().from(users).where(eq(users.companyId, companyId));
    }
    return await db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Role model methods
  async getRoleModels(userId: string): Promise<RoleModel[]> {
    // ユーザー固有のロールモデルを取得
    const userModels = await db.select()
      .from(roleModels)
      .where(eq(roleModels.userId, userId));
    
    // ユーザーの会社情報を取得
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, userId));
    
    const user = userResult[0];
    
    // 会社に所属していない場合は、ユーザー固有のモデルのみを返す
    if (!user || !user.companyId) {
      return userModels;
    }
    
    // 会社の共有ロールモデルを取得
    const sharedModels = await this.getSharedRoleModels(user.companyId);
    
    // 両方を結合して返す
    return [...userModels, ...sharedModels];
  }
  
  async getSharedRoleModels(companyId: string): Promise<RoleModel[]> {
    return await db.select()
      .from(roleModels)
      .where(
        and(
          eq(roleModels.companyId, companyId),
          eq(roleModels.isShared, 1)
        )
      );
  }

  async getRoleModelWithTags(id: string): Promise<RoleModelWithTags | undefined> {
    const roleModelResult = await db.select()
      .from(roleModels)
      .where(eq(roleModels.id, id));
      
    if (roleModelResult.length === 0) {
      return undefined;
    }
    
    const roleModel = roleModelResult[0];
    const tagsList = await db.select()
      .from(tags)
      .where(eq(tags.roleModelId, id));
      
    return {
      ...roleModel,
      tags: tagsList
    };
  }

  async createRoleModel(roleModel: InsertRoleModel): Promise<RoleModel> {
    const result = await db.insert(roleModels).values(roleModel).returning();
    return result[0];
  }

  async updateRoleModel(id: string, roleModelData: Partial<InsertRoleModel>): Promise<RoleModel | undefined> {
    const result = await db.update(roleModels)
      .set(roleModelData)
      .where(eq(roleModels.id, id))
      .returning();
    return result[0];
  }

  async deleteRoleModel(id: string): Promise<boolean> {
    const result = await db.delete(roleModels).where(eq(roleModels.id, id)).returning();
    return result.length > 0;
  }

  // Tag methods
  async getTags(roleModelId: string): Promise<Tag[]> {
    return await db.select()
      .from(tags)
      .where(eq(tags.roleModelId, roleModelId));
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const result = await db.insert(tags).values(tag).returning();
    return result[0];
  }

  async updateTag(id: string, tagData: Partial<InsertTag>): Promise<Tag | undefined> {
    const result = await db.update(tags)
      .set(tagData)
      .where(eq(tags.id, id))
      .returning();
    return result[0];
  }

  async deleteTag(id: string): Promise<boolean> {
    const result = await db.delete(tags).where(eq(tags.id, id)).returning();
    return result.length > 0;
  }

  // Knowledge Node methods
  async getKnowledgeNodes(roleModelId: string): Promise<KnowledgeNode[]> {
    return await db.select()
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.roleModelId, roleModelId))
      .orderBy(sql`"level" ASC`);
  }
  
  async getKnowledgeNode(id: string): Promise<KnowledgeNode | undefined> {
    const result = await db.select()
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.id, id));
    return result[0];
  }
  
  async createKnowledgeNode(node: InsertKnowledgeNode): Promise<KnowledgeNode> {
    const result = await db.insert(knowledgeNodes).values(node).returning();
    return result[0];
  }
  
  async updateKnowledgeNode(id: string, nodeData: Partial<InsertKnowledgeNode>): Promise<KnowledgeNode | undefined> {
    const result = await db.update(knowledgeNodes)
      .set(nodeData)
      .where(eq(knowledgeNodes.id, id))
      .returning();
    return result[0];
  }
  
  async deleteKnowledgeNode(id: string): Promise<boolean> {
    // 子ノードの検索と削除
    const childNodes = await db.select()
      .from(knowledgeNodes)
      .where(eq(knowledgeNodes.parentId, id));
      
    for (const child of childNodes) {
      await this.deleteKnowledgeNode(child.id);
    }
    
    // 関連するエッジの削除
    await db.delete(knowledgeEdges)
      .where(
        or(
          eq(knowledgeEdges.sourceId, id),
          eq(knowledgeEdges.targetId, id)
        )
      );
    
    // ノード自体の削除
    const result = await db.delete(knowledgeNodes)
      .where(eq(knowledgeNodes.id, id))
      .returning();
      
    return result.length > 0;
  }
  
  // Knowledge Edge methods
  async getKnowledgeEdges(roleModelId: string): Promise<KnowledgeEdge[]> {
    return await db.select()
      .from(knowledgeEdges)
      .where(eq(knowledgeEdges.roleModelId, roleModelId));
  }
  
  async getKnowledgeEdge(id: string): Promise<KnowledgeEdge | undefined> {
    const result = await db.select()
      .from(knowledgeEdges)
      .where(eq(knowledgeEdges.id, id));
    return result[0];
  }
  
  async createKnowledgeEdge(edge: InsertKnowledgeEdge): Promise<KnowledgeEdge> {
    const result = await db.insert(knowledgeEdges).values(edge).returning();
    return result[0];
  }
  
  async updateKnowledgeEdge(id: string, edgeData: Partial<InsertKnowledgeEdge>): Promise<KnowledgeEdge | undefined> {
    const result = await db.update(knowledgeEdges)
      .set(edgeData)
      .where(eq(knowledgeEdges.id, id))
      .returning();
    return result[0];
  }
  
  async deleteKnowledgeEdge(id: string): Promise<boolean> {
    const result = await db.delete(knowledgeEdges)
      .where(eq(knowledgeEdges.id, id))
      .returning();
    return result.length > 0;
  }

  // Summary methods
  async getSummaries(roleModelId: string): Promise<Summary[]> {
    return await db.select()
      .from(summaries)
      .where(eq(summaries.roleModelId, roleModelId))
      .orderBy(sql`"created_at" DESC`);
  }

  async getSummaryWithTags(id: string): Promise<SummaryWithTags | undefined> {
    const summaryResult = await db.select()
      .from(summaries)
      .where(eq(summaries.id, id));
      
    if (summaryResult.length === 0) {
      return undefined;
    }
    
    const summary = summaryResult[0];
    const tagsList = await db.select()
      .from(tags)
      .where(eq(tags.roleModelId, summary.roleModelId));
      
    return {
      ...summary,
      tags: tagsList
    };
  }

  async createSummary(summary: InsertSummary): Promise<Summary> {
    const result = await db.insert(summaries).values(summary).returning();
    return result[0];
  }

  async updateSummaryFeedback(id: string, feedback: number): Promise<Summary | undefined> {
    const result = await db.update(summaries)
      .set({ feedback })
      .where(eq(summaries.id, id))
      .returning();
    return result[0];
  }
}

// Export a singleton instance - PostgreSQLストレージに切り替え
// export const storage = new MemStorage();
export const storage = new PostgresStorage();
