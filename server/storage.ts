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
  IndustryCategory, InsertIndustryCategory,
  IndustrySubcategory, InsertIndustrySubcategory,
  Keyword, InsertKeyword,
  RoleModelIndustry, InsertRoleModelIndustry,
  RoleModelKeyword, InsertRoleModelKeyword,
  IndustrySubcategoryWithCategory,
  RoleModelWithIndustriesAndKeywords,
  IndustryCombination, InsertIndustryCombination,
  IndustryCombinationDetail, InsertIndustryCombinationDetail,
  companies,
  users,
  roleModels,
  tags,
  knowledgeNodes,
  knowledgeEdges,
  summaries,
  industryCategories,
  industrySubcategories,
  keywords,
  roleModelIndustries,
  roleModelKeywords,
  industryCombinations,
  industryCombinationDetails
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

  // Industry category operations
  getIndustryCategories(): Promise<IndustryCategory[]>;
  getIndustryCategory(id: string): Promise<IndustryCategory | undefined>;
  createIndustryCategory(category: InsertIndustryCategory): Promise<IndustryCategory>;
  updateIndustryCategory(id: string, category: Partial<InsertIndustryCategory>): Promise<IndustryCategory | undefined>;
  deleteIndustryCategory(id: string): Promise<boolean>;

  // Industry subcategory operations
  getIndustrySubcategories(categoryId?: string): Promise<IndustrySubcategory[]>;
  getIndustrySubcategoriesWithCategory(): Promise<IndustrySubcategoryWithCategory[]>;
  getIndustrySubcategory(id: string): Promise<IndustrySubcategory | undefined>;
  createIndustrySubcategory(subcategory: InsertIndustrySubcategory): Promise<IndustrySubcategory>;
  updateIndustrySubcategory(id: string, subcategory: Partial<InsertIndustrySubcategory>): Promise<IndustrySubcategory | undefined>;
  deleteIndustrySubcategory(id: string): Promise<boolean>;

  // Keyword operations
  getKeywords(search?: string): Promise<Keyword[]>;
  getKeyword(id: string): Promise<Keyword | undefined>;
  createKeyword(keyword: InsertKeyword): Promise<Keyword>;
  updateKeyword(id: string, keyword: Partial<InsertKeyword>): Promise<Keyword | undefined>;
  deleteKeyword(id: string): Promise<boolean>;

  // Role model industry mapping operations
  getRoleModelIndustries(roleModelId: string): Promise<RoleModelIndustry[]>;
  getRoleModelIndustriesWithData(roleModelId: string): Promise<IndustrySubcategoryWithCategory[]>;
  createRoleModelIndustry(mapping: InsertRoleModelIndustry): Promise<RoleModelIndustry>;
  deleteRoleModelIndustry(id: string): Promise<boolean>;
  
  // Role model keyword mapping operations
  getRoleModelKeywords(roleModelId: string): Promise<RoleModelKeyword[]>;
  getRoleModelKeywordsWithData(roleModelId: string): Promise<Keyword[]>;
  createRoleModelKeyword(mapping: InsertRoleModelKeyword): Promise<RoleModelKeyword>;
  deleteRoleModelKeyword(id: string): Promise<boolean>;
  
  // Extended role model operations
  getRoleModelWithIndustriesAndKeywords(id: string): Promise<RoleModelWithIndustriesAndKeywords | undefined>;
  
  // Industry combination operations
  getIndustryCombinations(userId: string, companyId: string | null): Promise<IndustryCombination[]>;
  getIndustryCombination(id: string): Promise<IndustryCombination | undefined>;
  getIndustryCombinationDetails(combinationId: string): Promise<IndustryCombinationDetail[]>;
  createIndustryCombination(combination: InsertIndustryCombination): Promise<IndustryCombination>;
  addIndustryCombinationDetail(combinationId: string, industrySubcategoryId: string): Promise<IndustryCombinationDetail>;
  deleteIndustryCombination(id: string): Promise<boolean>;

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
  private industryCategories: Map<string, IndustryCategory>;
  private industrySubcategories: Map<string, IndustrySubcategory>;
  private keywords: Map<string, Keyword>;
  private roleModelIndustries: Map<string, RoleModelIndustry>;
  private roleModelKeywords: Map<string, RoleModelKeyword>;
  private industryCombinations: Map<string, IndustryCombination>;
  private industryCombinationDetails: Map<string, IndustryCombinationDetail>;
  sessionStore: any; // session.SessionStore

  constructor() {
    this.companies = new Map();
    this.users = new Map();
    this.roleModels = new Map();
    this.tags = new Map();
    this.knowledgeNodes = new Map();
    this.knowledgeEdges = new Map();
    this.summaries = new Map();
    this.industryCategories = new Map();
    this.industrySubcategories = new Map();
    this.keywords = new Map();
    this.roleModelIndustries = new Map();
    this.roleModelKeywords = new Map();
    this.industryCombinations = new Map();
    this.industryCombinationDetails = new Map();
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

  // Industry category methods
  async getIndustryCategories(): Promise<IndustryCategory[]> {
    return Array.from(this.industryCategories.values());
  }

  async getIndustryCategory(id: string): Promise<IndustryCategory | undefined> {
    return this.industryCategories.get(id);
  }

  async createIndustryCategory(category: InsertIndustryCategory): Promise<IndustryCategory> {
    const id = crypto.randomUUID();
    const newCategory: IndustryCategory = {
      ...category,
      id,
      description: category.description || "",
      displayOrder: category.displayOrder || 0,
      createdAt: new Date()
    };
    this.industryCategories.set(id, newCategory);
    return newCategory;
  }

  async updateIndustryCategory(id: string, categoryData: Partial<InsertIndustryCategory>): Promise<IndustryCategory | undefined> {
    const existingCategory = this.industryCategories.get(id);
    if (!existingCategory) return undefined;

    const updatedCategory = { ...existingCategory, ...categoryData };
    this.industryCategories.set(id, updatedCategory);
    return updatedCategory;
  }

  async deleteIndustryCategory(id: string): Promise<boolean> {
    return this.industryCategories.delete(id);
  }

  // Industry subcategory methods
  async getIndustrySubcategories(categoryId?: string): Promise<IndustrySubcategory[]> {
    if (categoryId) {
      return Array.from(this.industrySubcategories.values()).filter(
        subcategory => subcategory.categoryId === categoryId
      );
    }
    return Array.from(this.industrySubcategories.values());
  }

  async getIndustrySubcategoriesWithCategory(): Promise<IndustrySubcategoryWithCategory[]> {
    return Array.from(this.industrySubcategories.values()).map(subcategory => {
      const category = this.industryCategories.get(subcategory.categoryId);
      if (!category) {
        throw new Error(`Category not found for subcategory: ${subcategory.id}`);
      }
      return {
        ...subcategory,
        category
      };
    });
  }

  async getIndustrySubcategory(id: string): Promise<IndustrySubcategory | undefined> {
    return this.industrySubcategories.get(id);
  }

  async createIndustrySubcategory(subcategory: InsertIndustrySubcategory): Promise<IndustrySubcategory> {
    const id = crypto.randomUUID();
    const newSubcategory: IndustrySubcategory = {
      ...subcategory,
      id,
      createdAt: new Date()
    };
    this.industrySubcategories.set(id, newSubcategory);
    return newSubcategory;
  }

  async updateIndustrySubcategory(id: string, subcategoryData: Partial<InsertIndustrySubcategory>): Promise<IndustrySubcategory | undefined> {
    const existingSubcategory = this.industrySubcategories.get(id);
    if (!existingSubcategory) return undefined;

    const updatedSubcategory = { ...existingSubcategory, ...subcategoryData };
    this.industrySubcategories.set(id, updatedSubcategory);
    return updatedSubcategory;
  }

  async deleteIndustrySubcategory(id: string): Promise<boolean> {
    return this.industrySubcategories.delete(id);
  }

  // Keyword methods
  async getKeywords(search?: string): Promise<Keyword[]> {
    if (search) {
      return Array.from(this.keywords.values()).filter(
        keyword => keyword.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return Array.from(this.keywords.values());
  }

  async getKeyword(id: string): Promise<Keyword | undefined> {
    return this.keywords.get(id);
  }

  async createKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const id = crypto.randomUUID();
    const newKeyword: Keyword = {
      ...keyword,
      id,
      createdAt: new Date()
    };
    this.keywords.set(id, newKeyword);
    return newKeyword;
  }

  async updateKeyword(id: string, keywordData: Partial<InsertKeyword>): Promise<Keyword | undefined> {
    const existingKeyword = this.keywords.get(id);
    if (!existingKeyword) return undefined;

    const updatedKeyword = { ...existingKeyword, ...keywordData };
    this.keywords.set(id, updatedKeyword);
    return updatedKeyword;
  }

  async deleteKeyword(id: string): Promise<boolean> {
    return this.keywords.delete(id);
  }

  // Role model industry mapping methods
  async getRoleModelIndustries(roleModelId: string): Promise<RoleModelIndustry[]> {
    return Array.from(this.roleModelIndustries.values()).filter(
      mapping => mapping.roleModelId === roleModelId
    );
  }

  async getRoleModelIndustriesWithData(roleModelId: string): Promise<IndustrySubcategoryWithCategory[]> {
    const mappings = await this.getRoleModelIndustries(roleModelId);
    
    return Promise.all(mappings.map(async mapping => {
      const subcategory = this.industrySubcategories.get(mapping.industrySubcategoryId);
      if (!subcategory) {
        throw new Error(`Subcategory not found for mapping: ${mapping.id}`);
      }
      
      const category = this.industryCategories.get(subcategory.categoryId);
      if (!category) {
        throw new Error(`Category not found for subcategory: ${subcategory.id}`);
      }
      
      return {
        ...subcategory,
        category
      };
    }));
  }

  async createRoleModelIndustry(mapping: InsertRoleModelIndustry): Promise<RoleModelIndustry> {
    const id = crypto.randomUUID();
    const newMapping: RoleModelIndustry = {
      ...mapping,
      id
    };
    this.roleModelIndustries.set(id, newMapping);
    return newMapping;
  }

  async deleteRoleModelIndustry(id: string): Promise<boolean> {
    return this.roleModelIndustries.delete(id);
  }
  
  // Role model keyword mapping methods
  async getRoleModelKeywords(roleModelId: string): Promise<RoleModelKeyword[]> {
    return Array.from(this.roleModelKeywords.values()).filter(
      mapping => mapping.roleModelId === roleModelId
    );
  }

  async getRoleModelKeywordsWithData(roleModelId: string): Promise<Keyword[]> {
    const mappings = await this.getRoleModelKeywords(roleModelId);
    
    return Promise.all(mappings.map(async mapping => {
      const keyword = this.keywords.get(mapping.keywordId);
      if (!keyword) {
        throw new Error(`Keyword not found for mapping: ${mapping.id}`);
      }
      
      return keyword;
    }));
  }

  async createRoleModelKeyword(mapping: InsertRoleModelKeyword): Promise<RoleModelKeyword> {
    const id = crypto.randomUUID();
    const newMapping: RoleModelKeyword = {
      ...mapping,
      id
    };
    this.roleModelKeywords.set(id, newMapping);
    return newMapping;
  }

  async deleteRoleModelKeyword(id: string): Promise<boolean> {
    return this.roleModelKeywords.delete(id);
  }
  
  // Extended role model operations
  async getRoleModelWithIndustriesAndKeywords(id: string): Promise<RoleModelWithIndustriesAndKeywords | undefined> {
    const roleModel = this.roleModels.get(id);
    if (!roleModel) return undefined;

    const industries = await this.getRoleModelIndustriesWithData(id);
    const keywords = await this.getRoleModelKeywordsWithData(id);

    return {
      ...roleModel,
      industries,
      keywords
    };
  }
  
  // Industry combination methods
  async getIndustryCombinations(userId: string, companyId: string | null): Promise<IndustryCombination[]> {
    // ユーザー自身の組み合わせ
    const userCombinations = Array.from(this.industryCombinations.values()).filter(
      combination => combination.userId === userId
    );
    
    // 会社の共有組み合わせ（もし会社IDがあれば）
    if (companyId) {
      const companyCombinations = Array.from(this.industryCombinations.values()).filter(
        combination => combination.companyId === companyId && combination.isShared
      );
      return [...userCombinations, ...companyCombinations];
    }
    
    return userCombinations;
  }
  
  async getIndustryCombination(id: string): Promise<IndustryCombination | undefined> {
    return this.industryCombinations.get(id);
  }
  
  async getIndustryCombinationDetails(combinationId: string): Promise<IndustryCombinationDetail[]> {
    return Array.from(this.industryCombinationDetails.values()).filter(
      detail => detail.combinationId === combinationId
    );
  }
  
  async createIndustryCombination(combination: InsertIndustryCombination): Promise<IndustryCombination> {
    const id = crypto.randomUUID();
    const now = new Date();
    const newCombination: IndustryCombination = {
      ...combination,
      id,
      createdAt: now,
      updatedAt: now,
      companyId: combination.companyId || null,
      isShared: combination.isShared || false
    };
    this.industryCombinations.set(id, newCombination);
    return newCombination;
  }
  
  async addIndustryCombinationDetail(combinationId: string, industrySubcategoryId: string): Promise<IndustryCombinationDetail> {
    const id = crypto.randomUUID();
    const detail: IndustryCombinationDetail = {
      id,
      combinationId,
      industrySubcategoryId,
      createdAt: new Date()
    };
    this.industryCombinationDetails.set(id, detail);
    return detail;
  }
  
  async deleteIndustryCombination(id: string): Promise<boolean> {
    // 関連する詳細情報も削除
    const details = Array.from(this.industryCombinationDetails.values()).filter(
      detail => detail.combinationId === id
    );
    
    for (const detail of details) {
      this.industryCombinationDetails.delete(detail.id);
    }
    
    return this.industryCombinations.delete(id);
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

  // Industry category methods
  async getIndustryCategories(): Promise<IndustryCategory[]> {
    return await db.select().from(industryCategories);
  }

  async getIndustryCategory(id: string): Promise<IndustryCategory | undefined> {
    const result = await db.select().from(industryCategories).where(eq(industryCategories.id, id));
    return result[0];
  }

  async createIndustryCategory(category: InsertIndustryCategory): Promise<IndustryCategory> {
    const result = await db.insert(industryCategories).values(category).returning();
    return result[0];
  }

  async updateIndustryCategory(id: string, categoryData: Partial<InsertIndustryCategory>): Promise<IndustryCategory | undefined> {
    const result = await db.update(industryCategories)
      .set(categoryData)
      .where(eq(industryCategories.id, id))
      .returning();
    return result[0];
  }

  async deleteIndustryCategory(id: string): Promise<boolean> {
    const result = await db.delete(industryCategories).where(eq(industryCategories.id, id)).returning();
    return result.length > 0;
  }

  // Industry subcategory methods
  async getIndustrySubcategories(categoryId?: string): Promise<IndustrySubcategory[]> {
    if (categoryId) {
      return await db.select().from(industrySubcategories).where(eq(industrySubcategories.categoryId, categoryId));
    }
    return await db.select().from(industrySubcategories);
  }

  async getIndustrySubcategoriesWithCategory(): Promise<IndustrySubcategoryWithCategory[]> {
    const result = await db
      .select({
        subcategory: industrySubcategories,
        category: industryCategories
      })
      .from(industrySubcategories)
      .leftJoin(industryCategories, eq(industrySubcategories.categoryId, industryCategories.id));

    return result.map(({ subcategory, category }) => ({
      ...subcategory,
      category
    }));
  }

  async getIndustrySubcategory(id: string): Promise<IndustrySubcategory | undefined> {
    const result = await db.select().from(industrySubcategories).where(eq(industrySubcategories.id, id));
    return result[0];
  }

  async createIndustrySubcategory(subcategory: InsertIndustrySubcategory): Promise<IndustrySubcategory> {
    const result = await db.insert(industrySubcategories).values(subcategory).returning();
    return result[0];
  }

  async updateIndustrySubcategory(id: string, subcategoryData: Partial<InsertIndustrySubcategory>): Promise<IndustrySubcategory | undefined> {
    const result = await db.update(industrySubcategories)
      .set(subcategoryData)
      .where(eq(industrySubcategories.id, id))
      .returning();
    return result[0];
  }

  async deleteIndustrySubcategory(id: string): Promise<boolean> {
    const result = await db.delete(industrySubcategories).where(eq(industrySubcategories.id, id)).returning();
    return result.length > 0;
  }

  // Keyword methods
  async getKeywords(search?: string): Promise<Keyword[]> {
    if (search) {
      return await db.select().from(keywords)
        .where(sql`${keywords.name} ILIKE ${`%${search}%`}`);
    }
    return await db.select().from(keywords);
  }

  async getKeyword(id: string): Promise<Keyword | undefined> {
    const result = await db.select().from(keywords).where(eq(keywords.id, id));
    return result[0];
  }

  async createKeyword(keyword: InsertKeyword): Promise<Keyword> {
    const result = await db.insert(keywords).values(keyword).returning();
    return result[0];
  }

  async updateKeyword(id: string, keywordData: Partial<InsertKeyword>): Promise<Keyword | undefined> {
    const result = await db.update(keywords)
      .set(keywordData)
      .where(eq(keywords.id, id))
      .returning();
    return result[0];
  }

  async deleteKeyword(id: string): Promise<boolean> {
    const result = await db.delete(keywords).where(eq(keywords.id, id)).returning();
    return result.length > 0;
  }

  // Role model industry mapping methods
  async getRoleModelIndustries(roleModelId: string): Promise<RoleModelIndustry[]> {
    return await db.select()
      .from(roleModelIndustries)
      .where(eq(roleModelIndustries.roleModelId, roleModelId));
  }

  async getRoleModelIndustriesWithData(roleModelId: string): Promise<IndustrySubcategoryWithCategory[]> {
    const result = await db
      .select({
        mapping: roleModelIndustries,
        subcategory: industrySubcategories,
        category: industryCategories
      })
      .from(roleModelIndustries)
      .leftJoin(industrySubcategories, eq(roleModelIndustries.industrySubcategoryId, industrySubcategories.id))
      .leftJoin(industryCategories, eq(industrySubcategories.categoryId, industryCategories.id))
      .where(eq(roleModelIndustries.roleModelId, roleModelId));

    return result.map(({ subcategory, category }) => ({
      ...subcategory,
      category
    }));
  }

  async createRoleModelIndustry(mapping: InsertRoleModelIndustry): Promise<RoleModelIndustry> {
    const result = await db.insert(roleModelIndustries).values(mapping).returning();
    return result[0];
  }

  async deleteRoleModelIndustry(id: string): Promise<boolean> {
    const result = await db.delete(roleModelIndustries).where(eq(roleModelIndustries.id, id)).returning();
    return result.length > 0;
  }
  
  async deleteRoleModelIndustriesByRoleModelId(roleModelId: string): Promise<boolean> {
    const result = await db.delete(roleModelIndustries)
      .where(eq(roleModelIndustries.roleModelId, roleModelId))
      .returning();
    return result.length > 0;
  }
  
  // Role model keyword mapping methods
  async getRoleModelKeywords(roleModelId: string): Promise<RoleModelKeyword[]> {
    return await db.select()
      .from(roleModelKeywords)
      .where(eq(roleModelKeywords.roleModelId, roleModelId));
  }

  async getRoleModelKeywordsWithData(roleModelId: string): Promise<Keyword[]> {
    const result = await db
      .select({
        mapping: roleModelKeywords,
        keyword: keywords
      })
      .from(roleModelKeywords)
      .leftJoin(keywords, eq(roleModelKeywords.keywordId, keywords.id))
      .where(eq(roleModelKeywords.roleModelId, roleModelId));

    return result.map(({ keyword }) => keyword);
  }

  async createRoleModelKeyword(mapping: InsertRoleModelKeyword): Promise<RoleModelKeyword> {
    const result = await db.insert(roleModelKeywords).values(mapping).returning();
    return result[0];
  }

  async deleteRoleModelKeyword(id: string): Promise<boolean> {
    const result = await db.delete(roleModelKeywords).where(eq(roleModelKeywords.id, id)).returning();
    return result.length > 0;
  }
  
  async deleteRoleModelKeywordsByRoleModelId(roleModelId: string): Promise<boolean> {
    const result = await db.delete(roleModelKeywords)
      .where(eq(roleModelKeywords.roleModelId, roleModelId))
      .returning();
    return result.length > 0;
  }
  
  // Extended role model operations
  async getRoleModelWithIndustriesAndKeywords(id: string): Promise<RoleModelWithIndustriesAndKeywords | undefined> {
    const roleModelResult = await db.select()
      .from(roleModels)
      .where(eq(roleModels.id, id));
      
    if (roleModelResult.length === 0) {
      return undefined;
    }
    
    const roleModel = roleModelResult[0];
    const industries = await this.getRoleModelIndustriesWithData(id);
    const keywords = await this.getRoleModelKeywordsWithData(id);
    
    return {
      ...roleModel,
      industries,
      keywords
    };
  }
}

// Export a singleton instance - PostgreSQLストレージに切り替え
// export const storage = new MemStorage();
export const storage = new PostgresStorage();
