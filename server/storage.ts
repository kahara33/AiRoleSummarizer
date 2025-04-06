import { 
  User, InsertUser, 
  RoleModel, InsertRoleModel, 
  KnowledgeNode, InsertKnowledgeNode,
  KnowledgeEdge, InsertKnowledgeEdge,
  Keyword, InsertKeyword,
  Industry, IndustrySubcategory,
  roleModels,
  users,
  knowledgeNodes,
  knowledgeEdges, 
  keywords,
  industries,
  industrySubcategories,
  RoleModelWithIndustriesAndKeywords,
  SubscriptionPlan, InsertSubscriptionPlan,
  subscriptionPlans,
  InformationCollectionPlan, InsertInformationCollectionPlan,
  informationCollectionPlans
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import crypto from "crypto";
import { sql, eq, and, inArray } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";

// メモリストア（開発用）
const MemoryStore = createMemoryStore(session);

// PostgreSQLセッションストア
const PostgresSessionStore = connectPg(session);

// Storage interface
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserSubscription(userId: string, planName: string, expiresAt?: Date): Promise<User>;
  
  // Knowledge Node operations
  getKnowledgeNodes(roleModelId: string): Promise<KnowledgeNode[]>;
  getKnowledgeNode(id: string): Promise<KnowledgeNode | undefined>;
  createKnowledgeNode(node: InsertKnowledgeNode): Promise<KnowledgeNode>;
  deleteKnowledgeNodesByRoleModelId(roleModelId: string): Promise<void>;
  
  // Knowledge Edge operations
  getKnowledgeEdges(roleModelId: string): Promise<KnowledgeEdge[]>;
  getKnowledgeEdge(id: string): Promise<KnowledgeEdge | undefined>;
  createKnowledgeEdge(edge: InsertKnowledgeEdge): Promise<KnowledgeEdge>;
  deleteKnowledgeEdgesByRoleModelId(roleModelId: string): Promise<void>;

  // Role Model operations
  getRoleModels(userId: string): Promise<RoleModel[]>;
  getSharedRoleModels(companyId: string): Promise<RoleModel[]>;
  getRoleModelWithIndustriesAndKeywords(id: string): Promise<RoleModelWithIndustriesAndKeywords | undefined>;

  // Subscription operations
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;

  // Information Collection Plan operations
  getInformationCollectionPlan(roleModelId: string): Promise<InformationCollectionPlan | undefined>;
  createInformationCollectionPlan(plan: InsertInformationCollectionPlan): Promise<InformationCollectionPlan>;
  updateInformationCollectionPlan(id: string, planData: string, updatedBy: string): Promise<InformationCollectionPlan>;

  // Session store
  sessionStore: any; // session.SessionStore
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private roleModels: Map<string, RoleModel>;
  private knowledgeNodes: Map<string, KnowledgeNode>;
  private knowledgeEdges: Map<string, KnowledgeEdge>;
  private keywords: Map<string, Keyword>;
  private industries: Map<string, Industry>;
  private subscriptionPlans: Map<string, SubscriptionPlan>;
  private informationCollectionPlans: Map<string, InformationCollectionPlan>;
  sessionStore: any; // session.SessionStore

  constructor() {
    this.users = new Map();
    this.roleModels = new Map();
    this.knowledgeNodes = new Map();
    this.knowledgeEdges = new Map();
    this.keywords = new Map();
    this.industries = new Map();
    this.subscriptionPlans = new Map();
    this.informationCollectionPlans = new Map();
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = crypto.randomUUID();
    // デフォルト値を設定
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || 'individual_user',
      companyId: insertUser.companyId || null,
      subscriptionPlan: 'Lite',
      subscriptionExpiresAt: null
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUserSubscription(userId: string, planName: string, expiresAt?: Date): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const updatedUser = {
      ...user,
      subscriptionPlan: planName,
      subscriptionExpiresAt: expiresAt || null
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
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

  // Extended role model operations
  async getRoleModelWithIndustriesAndKeywords(id: string): Promise<RoleModelWithIndustriesAndKeywords | undefined> {
    const roleModel = this.roleModels.get(id);
    if (!roleModel) return undefined;

    // メモリストレージにはこのメソッドの完全実装がないので、空の配列を返す
    return {
      ...roleModel,
      industries: [],
      keywords: []
    };
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
    const id = insertNode.id || crypto.randomUUID();
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
  
  async deleteKnowledgeNodesByRoleModelId(roleModelId: string): Promise<void> {
    // ノードをフィルタリングして削除
    const nodeIdsToDelete: string[] = [];
    
    this.knowledgeNodes.forEach((node, id) => {
      if (node.roleModelId === roleModelId) {
        nodeIdsToDelete.push(id);
      }
    });
    
    // 特定したノードをMapから削除
    nodeIdsToDelete.forEach(id => {
      this.knowledgeNodes.delete(id);
    });
    
    console.log(`Deleted ${nodeIdsToDelete.length} knowledge nodes for role model ID: ${roleModelId}`);
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
  
  async deleteKnowledgeEdgesByRoleModelId(roleModelId: string): Promise<void> {
    // エッジをフィルタリングして削除
    const edgeIdsToDelete: string[] = [];
    
    this.knowledgeEdges.forEach((edge, id) => {
      if (edge.roleModelId === roleModelId) {
        edgeIdsToDelete.push(id);
      }
    });
    
    // 特定したエッジをMapから削除
    edgeIdsToDelete.forEach(id => {
      this.knowledgeEdges.delete(id);
    });
    
    console.log(`Deleted ${edgeIdsToDelete.length} knowledge edges for role model ID: ${roleModelId}`);
  }
  
  // 購読プラン関連メソッド
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return Array.from(this.subscriptionPlans.values());
  }
  
  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    return this.subscriptionPlans.get(id);
  }
  
  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const newPlan: SubscriptionPlan = {
      ...plan,
      id,
      createdAt: now,
      updatedAt: now,
      description: plan.description || null,
      features: plan.features || null
    };
    
    this.subscriptionPlans.set(id, newPlan);
    return newPlan;
  }
  
  // 情報収集プラン関連メソッド
  async getInformationCollectionPlan(roleModelId: string): Promise<InformationCollectionPlan | undefined> {
    return Array.from(this.informationCollectionPlans.values()).find(
      plan => plan.roleModelId === roleModelId
    );
  }
  
  async createInformationCollectionPlan(plan: InsertInformationCollectionPlan): Promise<InformationCollectionPlan> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const newPlan: InformationCollectionPlan = {
      ...plan,
      id,
      createdAt: now,
      updatedAt: now,
      updatedBy: plan.updatedBy || null
    };
    
    this.informationCollectionPlans.set(id, newPlan);
    return newPlan;
  }
  
  async updateInformationCollectionPlan(id: string, planData: string, updatedBy: string): Promise<InformationCollectionPlan> {
    const existingPlan = this.informationCollectionPlans.get(id);
    if (!existingPlan) {
      throw new Error(`Information collection plan with ID ${id} not found`);
    }
    
    const updatedPlan: InformationCollectionPlan = {
      ...existingPlan,
      planData,
      updatedBy,
      updatedAt: new Date()
    };
    
    this.informationCollectionPlans.set(id, updatedPlan);
    return updatedPlan;
  }
}

// PostgresStorage implementation
export class PostgresStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool, 
      createTableIfMissing: true
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error in getUser:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error("Error in getUserByEmail:", error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const [newUser] = await db.insert(users).values({
        ...user,
        subscriptionPlan: 'Lite'
      }).returning();
      return newUser;
    } catch (error) {
      console.error("Error in createUser:", error);
      throw error;
    }
  }
  
  async updateUserSubscription(userId: string, planName: string, expiresAt?: Date): Promise<User> {
    try {
      const [updatedUser] = await db.update(users)
        .set({ 
          subscriptionPlan: planName,
          subscriptionExpiresAt: expiresAt || null
        })
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        throw new Error(`User with ID ${userId} not found`);
      }
      
      return updatedUser;
    } catch (error) {
      console.error("Error in updateUserSubscription:", error);
      throw error;
    }
  }

  // Role model methods
  async getRoleModels(userId: string): Promise<RoleModel[]> {
    try {
      // ユーザーが所属する会社を取得
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      // ユーザーに直接紐づくロールモデル
      const userModels = await db.select()
        .from(roleModels)
        .where(eq(roleModels.userId, userId));
      
      // 会社に紐づく共有ロールモデル
      if (user && user.companyId) {
        const companyModels = await this.getSharedRoleModels(user.companyId);
        return [...userModels, ...companyModels];
      }
      
      return userModels;
    } catch (error) {
      console.error("Error in getRoleModels:", error);
      return [];
    }
  }
  
  async getSharedRoleModels(companyId: string): Promise<RoleModel[]> {
    try {
      return await db.select()
        .from(roleModels)
        .where(
          and(
            eq(roleModels.companyId, companyId),
            eq(roleModels.isShared, 1)
          )
        );
    } catch (error) {
      console.error("Error in getSharedRoleModels:", error);
      return [];
    }
  }

  // Knowledge Node methods
  async getKnowledgeNodes(roleModelId: string): Promise<KnowledgeNode[]> {
    try {
      return await db.select()
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.roleModelId, roleModelId))
        .orderBy(knowledgeNodes.level);
    } catch (error) {
      console.error("Error in getKnowledgeNodes:", error);
      return [];
    }
  }
  
  async getKnowledgeNode(id: string): Promise<KnowledgeNode | undefined> {
    try {
      const [node] = await db.select()
        .from(knowledgeNodes)
        .where(eq(knowledgeNodes.id, id));
      return node;
    } catch (error) {
      console.error("Error in getKnowledgeNode:", error);
      return undefined;
    }
  }
  
  async createKnowledgeNode(node: InsertKnowledgeNode): Promise<KnowledgeNode> {
    try {
      const [newNode] = await db.insert(knowledgeNodes).values(node).returning();
      return newNode;
    } catch (error) {
      console.error("Error in createKnowledgeNode:", error);
      throw error;
    }
  }
  
  async deleteKnowledgeNodesByRoleModelId(roleModelId: string): Promise<void> {
    try {
      await db.delete(knowledgeNodes)
        .where(eq(knowledgeNodes.roleModelId, roleModelId));
      console.log(`Deleted knowledge nodes for role model ID: ${roleModelId}`);
    } catch (error) {
      console.error("Error in deleteKnowledgeNodesByRoleModelId:", error);
      throw error;
    }
  }
  
  // Knowledge Edge methods
  async getKnowledgeEdges(roleModelId: string): Promise<KnowledgeEdge[]> {
    try {
      return await db.select()
        .from(knowledgeEdges)
        .where(eq(knowledgeEdges.roleModelId, roleModelId));
    } catch (error) {
      console.error("Error in getKnowledgeEdges:", error);
      return [];
    }
  }
  
  async getKnowledgeEdge(id: string): Promise<KnowledgeEdge | undefined> {
    try {
      const [edge] = await db.select()
        .from(knowledgeEdges)
        .where(eq(knowledgeEdges.id, id));
      return edge;
    } catch (error) {
      console.error("Error in getKnowledgeEdge:", error);
      return undefined;
    }
  }
  
  async createKnowledgeEdge(edge: InsertKnowledgeEdge): Promise<KnowledgeEdge> {
    try {
      const [newEdge] = await db.insert(knowledgeEdges).values(edge).returning();
      return newEdge;
    } catch (error) {
      console.error("Error in createKnowledgeEdge:", error);
      throw error;
    }
  }
  
  async deleteKnowledgeEdgesByRoleModelId(roleModelId: string): Promise<void> {
    try {
      await db.delete(knowledgeEdges)
        .where(eq(knowledgeEdges.roleModelId, roleModelId));
      console.log(`Deleted knowledge edges for role model ID: ${roleModelId}`);
    } catch (error) {
      console.error("Error in deleteKnowledgeEdgesByRoleModelId:", error);
      throw error;
    }
  }

  // Extended role model operations
  async getRoleModelWithIndustriesAndKeywords(id: string): Promise<RoleModelWithIndustriesAndKeywords | undefined> {
    try {
      const [roleModel] = await db.select().from(roleModels).where(eq(roleModels.id, id));
      if (!roleModel) return undefined;

      // DBから業界とキーワードデータを取得
      const industriesData = await this.getRoleModelIndustriesData(id);
      const keywordsData = await this.getRoleModelKeywordsData(id);

      return {
        ...roleModel,
        industries: industriesData,
        keywords: keywordsData
      };
    } catch (error) {
      console.error("Error in getRoleModelWithIndustriesAndKeywords:", error);
      return undefined;
    }
  }

  // ロールモデルに関連する業界データを取得
  private async getRoleModelIndustriesData(roleModelId: string): Promise<IndustrySubcategory[]> {
    try {
      // ロールモデルに関連する業界サブカテゴリーIDを取得
      const industryMappings = await db
        .select()
        .from(sql`role_model_industries`)
        .where(sql`role_model_id = ${roleModelId}`);
      
      if (!industryMappings || industryMappings.length === 0) {
        return [];
      }
      
      // 業界サブカテゴリーIDリスト
      const subcategoryIds = industryMappings.map((mapping: any) => mapping.industry_id);
      
      // 業界サブカテゴリーデータ取得
      const subcategoryData = await db
        .select()
        .from(industrySubcategories)
        .where(inArray(industrySubcategories.id, subcategoryIds));
      
      return subcategoryData;
    } catch (error) {
      console.error("Error in getRoleModelIndustriesData:", error);
      return [];
    }
  }

  // ロールモデルに関連するキーワードデータを取得
  private async getRoleModelKeywordsData(roleModelId: string): Promise<Keyword[]> {
    try {
      // ロールモデルに関連するキーワードIDを取得（SQLで直接クエリ）
      const keywordMappings = await db
        .select()
        .from(sql`role_model_keywords`)
        .where(sql`role_model_id = ${roleModelId}`);
      
      if (!keywordMappings || keywordMappings.length === 0) {
        return [];
      }
      
      // キーワードIDリスト
      const keywordIds = keywordMappings.map((mapping: any) => mapping.keyword_id);
      
      // キーワードデータ取得
      const keywordData = await db
        .select()
        .from(keywords)
        .where(inArray(keywords.id, keywordIds));
      
      // 必要なプロパティを持つKeyword型の配列に変換
      return keywordData.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        status: item.status || null,
        parentId: item.parentId || null,
        isCommon: item.isCommon || null,
        createdBy: item.createdBy || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));
    } catch (error) {
      console.error("Error in getRoleModelKeywordsData:", error);
      return [];
    }
  }
  
  // 購読プラン操作
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      return await db.select().from(subscriptionPlans);
    } catch (error) {
      console.error("Error in getSubscriptionPlans:", error);
      return [];
    }
  }
  
  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    try {
      const [plan] = await db.select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, id));
      return plan;
    } catch (error) {
      console.error("Error in getSubscriptionPlan:", error);
      return undefined;
    }
  }
  
  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    try {
      const [newPlan] = await db.insert(subscriptionPlans)
        .values({
          ...plan,
          features: plan.features || null
        })
        .returning();
      return newPlan;
    } catch (error) {
      console.error("Error in createSubscriptionPlan:", error);
      throw error;
    }
  }
  
  // 情報収集プラン操作
  async getInformationCollectionPlan(roleModelId: string): Promise<InformationCollectionPlan | undefined> {
    try {
      const [plan] = await db.select()
        .from(informationCollectionPlans)
        .where(eq(informationCollectionPlans.roleModelId, roleModelId));
      return plan;
    } catch (error) {
      console.error("Error in getInformationCollectionPlan:", error);
      return undefined;
    }
  }
  
  async createInformationCollectionPlan(plan: InsertInformationCollectionPlan): Promise<InformationCollectionPlan> {
    try {
      const [newPlan] = await db.insert(informationCollectionPlans)
        .values({
          ...plan,
          updatedBy: plan.updatedBy || null
        })
        .returning();
      return newPlan;
    } catch (error) {
      console.error("Error in createInformationCollectionPlan:", error);
      throw error;
    }
  }
  
  async updateInformationCollectionPlan(id: string, planData: string, updatedBy: string): Promise<InformationCollectionPlan> {
    try {
      const [updatedPlan] = await db.update(informationCollectionPlans)
        .set({
          planData,
          updatedBy,
          updatedAt: new Date()
        })
        .where(eq(informationCollectionPlans.id, id))
        .returning();
      
      if (!updatedPlan) {
        throw new Error(`Information collection plan with ID ${id} not found`);
      }
      
      return updatedPlan;
    } catch (error) {
      console.error("Error in updateInformationCollectionPlan:", error);
      throw error;
    }
  }
}

// ストレージインスタンスを作成
export const storage = new PostgresStorage();