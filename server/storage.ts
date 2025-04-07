import { db } from './db';
import { initNeo4j } from './neo4j';
import { eq, and, desc } from 'drizzle-orm';
import {
  users,
  organizations,
  roleModels,
  knowledgeNodes,
  knowledgeEdges,
  roleModelKeywords,
  roleModelIndustries,
  industries,
  summaries,
  collectionPlans,
  collectionSources,
  collectionSummaries,
  User,
  Organization,
  RoleModel,
  KnowledgeNode,
  KnowledgeEdge,
  RoleModelKeyword,
  RoleModelIndustry,
  Industry,
  Summary,
  InsertUser,
  InsertOrganization,
  InsertRoleModel,
  InsertKnowledgeNode,
  InsertKnowledgeEdge,
  InsertRoleModelKeyword,
  InsertRoleModelIndustry,
  InsertIndustry,
  InsertSummary,
  CollectionPlan,
  CollectionSource,
  CollectionSummary,
  InsertCollectionPlan,
  InsertCollectionSource,
  InsertCollectionSummary,
  RoleModelWithIndustriesAndKeywords
} from '@shared/schema';
import connectPg from 'connect-pg-simple';
import session from 'express-session';
import { pool } from './db';

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // ユーザー関連
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // 組織関連
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationByName(name: string): Promise<Organization | undefined>;
  createOrganization(organization: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, organization: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<boolean>;

  // ロールモデル関連
  getRoleModel(id: string): Promise<RoleModel | undefined>;
  getRoleModelsByOrganizationId(organizationId: string): Promise<RoleModel[]>;
  getRoleModelsByUserId(userId: string): Promise<RoleModel[]>;
  getRoleModelWithIndustriesAndKeywords(id: string): Promise<RoleModelWithIndustriesAndKeywords | undefined>;
  createRoleModel(roleModel: InsertRoleModel): Promise<RoleModel>;
  updateRoleModel(id: string, roleModel: Partial<InsertRoleModel>): Promise<RoleModel | undefined>;
  deleteRoleModel(id: string): Promise<boolean>;

  // ナレッジグラフ関連
  getKnowledgeNodesByRoleModelId(roleModelId: string): Promise<KnowledgeNode[]>;
  getKnowledgeEdgesByRoleModelId(roleModelId: string): Promise<KnowledgeEdge[]>;
  getKnowledgeNodeById(id: string): Promise<KnowledgeNode | undefined>;
  getKnowledgeEdgeById(id: string): Promise<KnowledgeEdge | undefined>;
  createKnowledgeNode(node: InsertKnowledgeNode): Promise<KnowledgeNode>;
  createKnowledgeEdge(edge: InsertKnowledgeEdge): Promise<KnowledgeEdge>;
  updateKnowledgeNode(id: string, node: Partial<InsertKnowledgeNode>): Promise<KnowledgeNode | undefined>;
  updateKnowledgeEdge(id: string, edge: Partial<InsertKnowledgeEdge>): Promise<KnowledgeEdge | undefined>;
  deleteKnowledgeNode(id: string): Promise<boolean>;
  deleteKnowledgeEdge(id: string): Promise<boolean>;
  deleteKnowledgeNodesByRoleModelId(roleModelId: string): Promise<boolean>;
  deleteKnowledgeEdgesByRoleModelId(roleModelId: string): Promise<boolean>;

  // キーワード関連
  getRoleModelKeywordsByRoleModelId(roleModelId: string): Promise<RoleModelKeyword[]>;
  createRoleModelKeyword(keyword: InsertRoleModelKeyword): Promise<RoleModelKeyword>;
  deleteRoleModelKeyword(id: string): Promise<boolean>;
  deleteRoleModelKeywordsByRoleModelId(roleModelId: string): Promise<boolean>;

  // 業界関連
  getIndustry(id: string): Promise<Industry | undefined>;
  getIndustries(): Promise<Industry[]>;
  getIndustryByName(name: string): Promise<Industry | undefined>;
  createIndustry(industry: InsertIndustry): Promise<Industry>;
  getRoleModelIndustriesByRoleModelId(roleModelId: string): Promise<RoleModelIndustry[]>;
  createRoleModelIndustry(roleModelIndustry: InsertRoleModelIndustry): Promise<RoleModelIndustry>;
  deleteRoleModelIndustry(id: string): Promise<boolean>;
  deleteRoleModelIndustriesByRoleModelId(roleModelId: string): Promise<boolean>;

  // サマリー関連
  getSummariesByRoleModelId(roleModelId: string): Promise<Summary[]>;
  getSummary(id: string): Promise<Summary | undefined>;
  createSummary(summary: InsertSummary): Promise<Summary>;
  updateSummary(id: string, summary: Partial<InsertSummary>): Promise<Summary | undefined>;
  deleteSummary(id: string): Promise<boolean>;

  // 情報収集プラン関連
  getCollectionPlanById(id: string): Promise<CollectionPlan | undefined>;
  getCollectionPlansByRoleModelId(roleModelId: string): Promise<CollectionPlan[]>;
  getCollectionPlansByUserId(userId: string): Promise<CollectionPlan[]>;
  getActiveCollectionPlansByUserId(userId: string): Promise<CollectionPlan[]>;
  createCollectionPlan(plan: InsertCollectionPlan): Promise<CollectionPlan>;
  updateCollectionPlan(id: string, plan: Partial<InsertCollectionPlan>): Promise<CollectionPlan | undefined>;
  deleteCollectionPlan(id: string): Promise<boolean>;
  activateCollectionPlan(id: string): Promise<CollectionPlan | undefined>;
  deactivateCollectionPlan(id: string): Promise<CollectionPlan | undefined>;

  // 情報ソース関連
  getCollectionSourceById(id: string): Promise<CollectionSource | undefined>;
  getCollectionSourcesByPlanId(planId: string): Promise<CollectionSource[]>;
  getCollectionSourcesByExecutionId(executionId: string): Promise<CollectionSource[]>;
  createCollectionSource(source: InsertCollectionSource): Promise<CollectionSource>;
  deleteCollectionSource(id: string): Promise<boolean>;

  // 要約結果関連
  getCollectionSummaryById(id: string): Promise<CollectionSummary | undefined>;
  getCollectionSummariesByPlanId(planId: string): Promise<CollectionSummary[]>;
  getCollectionSummaryByExecutionId(executionId: string): Promise<CollectionSummary | undefined>;
  createCollectionSummary(summary: InsertCollectionSummary): Promise<CollectionSummary>;
  updateCollectionSummary(id: string, summary: Partial<InsertCollectionSummary>): Promise<CollectionSummary | undefined>;
  deleteCollectionSummary(id: string): Promise<boolean>;

  // セッションストア
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: pool,
      createTableIfMissing: true,
      tableName: 'session',
      schemaName: 'public',
      // スケジュールされたクリーンアップが動作しない問題を解決するためのカスタム設定
      pruneSessionInterval: 60 * 60 * 24 // 24時間ごとに期限切れセッションを削除
    });
  }

  // ユーザー関連
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // username フィールドがないためemailで代用
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [createdUser] = await db.insert(users).values(user).returning();
    return createdUser;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<boolean> {
    const [deletedUser] = await db.delete(users).where(eq(users.id, id)).returning();
    return !!deletedUser;
  }

  // 組織関連
  async getOrganization(id: string): Promise<Organization | undefined> {
    const [organization] = await db.select().from(organizations).where(eq(organizations.id, id));
    return organization;
  }

  async getOrganizationByName(name: string): Promise<Organization | undefined> {
    const [organization] = await db.select().from(organizations).where(eq(organizations.name, name));
    return organization;
  }

  async createOrganization(organization: InsertOrganization): Promise<Organization> {
    const [createdOrganization] = await db.insert(organizations).values(organization).returning();
    return createdOrganization;
  }

  async updateOrganization(id: string, organization: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updatedOrganization] = await db.update(organizations).set(organization).where(eq(organizations.id, id)).returning();
    return updatedOrganization;
  }

  async deleteOrganization(id: string): Promise<boolean> {
    const [deletedOrganization] = await db.delete(organizations).where(eq(organizations.id, id)).returning();
    return !!deletedOrganization;
  }

  // ロールモデル関連
  async getRoleModel(id: string): Promise<RoleModel | undefined> {
    const [roleModel] = await db.select().from(roleModels).where(eq(roleModels.id, id));
    return roleModel;
  }

  async getRoleModelsByOrganizationId(organizationId: string): Promise<RoleModel[]> {
    const models = await db.select().from(roleModels).where(eq(roleModels.organizationId, organizationId));
    return models;
  }

  async getRoleModelsByUserId(userId: string): Promise<RoleModel[]> {
    const models = await db.select().from(roleModels).where(eq(roleModels.createdBy, userId));
    return models;
  }

  async getRoleModelWithIndustriesAndKeywords(id: string): Promise<RoleModelWithIndustriesAndKeywords | undefined> {
    const [roleModel] = await db.select().from(roleModels).where(eq(roleModels.id, id));
    if (!roleModel) return undefined;

    const roleModelIndustryRelations = await db.select().from(roleModelIndustries).where(eq(roleModelIndustries.roleModelId, id));
    const industryIds = roleModelIndustryRelations.map(relation => relation.industryId);

    const industryList = await db.select().from(industries).where(industryIds.length ? (industryIds as any) : eq(industries.id, ''));

    const keywordRelations = await db.select().from(roleModelKeywords).where(eq(roleModelKeywords.roleModelId, id));
    const keywords = keywordRelations.map(relation => relation.keyword);

    return {
      ...roleModel,
      industries: industryList,
      keywords
    };
  }

  async createRoleModel(roleModel: InsertRoleModel): Promise<RoleModel> {
    const [createdRoleModel] = await db.insert(roleModels).values(roleModel).returning();
    return createdRoleModel;
  }

  async updateRoleModel(id: string, roleModel: Partial<InsertRoleModel>): Promise<RoleModel | undefined> {
    const [updatedRoleModel] = await db.update(roleModels).set(roleModel).where(eq(roleModels.id, id)).returning();
    return updatedRoleModel;
  }

  async deleteRoleModel(id: string): Promise<boolean> {
    const [deletedRoleModel] = await db.delete(roleModels).where(eq(roleModels.id, id)).returning();
    return !!deletedRoleModel;
  }

  // ナレッジグラフ関連
  async getKnowledgeNodesByRoleModelId(roleModelId: string): Promise<KnowledgeNode[]> {
    const nodes = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.roleModelId, roleModelId));
    return nodes;
  }

  async getKnowledgeEdgesByRoleModelId(roleModelId: string): Promise<KnowledgeEdge[]> {
    const edges = await db.select().from(knowledgeEdges).where(eq(knowledgeEdges.roleModelId, roleModelId));
    return edges;
  }

  async getKnowledgeNodeById(id: string): Promise<KnowledgeNode | undefined> {
    const [node] = await db.select().from(knowledgeNodes).where(eq(knowledgeNodes.id, id));
    return node;
  }

  async getKnowledgeEdgeById(id: string): Promise<KnowledgeEdge | undefined> {
    const [edge] = await db.select().from(knowledgeEdges).where(eq(knowledgeEdges.id, id));
    return edge;
  }

  async createKnowledgeNode(node: InsertKnowledgeNode): Promise<KnowledgeNode> {
    const [createdNode] = await db.insert(knowledgeNodes).values(node).returning();
    return createdNode;
  }

  async createKnowledgeEdge(edge: InsertKnowledgeEdge): Promise<KnowledgeEdge> {
    const [createdEdge] = await db.insert(knowledgeEdges).values(edge).returning();
    return createdEdge;
  }

  async updateKnowledgeNode(id: string, node: Partial<InsertKnowledgeNode>): Promise<KnowledgeNode | undefined> {
    const [updatedNode] = await db.update(knowledgeNodes).set(node).where(eq(knowledgeNodes.id, id)).returning();
    return updatedNode;
  }

  async updateKnowledgeEdge(id: string, edge: Partial<InsertKnowledgeEdge>): Promise<KnowledgeEdge | undefined> {
    const [updatedEdge] = await db.update(knowledgeEdges).set(edge).where(eq(knowledgeEdges.id, id)).returning();
    return updatedEdge;
  }

  async deleteKnowledgeNode(id: string): Promise<boolean> {
    const [deletedNode] = await db.delete(knowledgeNodes).where(eq(knowledgeNodes.id, id)).returning();
    return !!deletedNode;
  }

  async deleteKnowledgeEdge(id: string): Promise<boolean> {
    const [deletedEdge] = await db.delete(knowledgeEdges).where(eq(knowledgeEdges.id, id)).returning();
    return !!deletedEdge;
  }

  async deleteKnowledgeNodesByRoleModelId(roleModelId: string): Promise<boolean> {
    const result = await db.delete(knowledgeNodes).where(eq(knowledgeNodes.roleModelId, roleModelId)).returning();
    return result.length > 0;
  }

  async deleteKnowledgeEdgesByRoleModelId(roleModelId: string): Promise<boolean> {
    const result = await db.delete(knowledgeEdges).where(eq(knowledgeEdges.roleModelId, roleModelId)).returning();
    return result.length > 0;
  }

  // キーワード関連
  async getRoleModelKeywordsByRoleModelId(roleModelId: string): Promise<RoleModelKeyword[]> {
    const keywords = await db.select().from(roleModelKeywords).where(eq(roleModelKeywords.roleModelId, roleModelId));
    return keywords;
  }

  async createRoleModelKeyword(keyword: InsertRoleModelKeyword): Promise<RoleModelKeyword> {
    const [createdKeyword] = await db.insert(roleModelKeywords).values(keyword).returning();
    return createdKeyword;
  }

  async deleteRoleModelKeyword(id: string): Promise<boolean> {
    const [deletedKeyword] = await db.delete(roleModelKeywords).where(eq(roleModelKeywords.id, id)).returning();
    return !!deletedKeyword;
  }

  async deleteRoleModelKeywordsByRoleModelId(roleModelId: string): Promise<boolean> {
    const result = await db.delete(roleModelKeywords).where(eq(roleModelKeywords.roleModelId, roleModelId)).returning();
    return result.length > 0;
  }

  // 業界関連
  async getIndustry(id: string): Promise<Industry | undefined> {
    const [industry] = await db.select().from(industries).where(eq(industries.id, id));
    return industry;
  }

  async getIndustries(): Promise<Industry[]> {
    const industryList = await db.select().from(industries);
    return industryList;
  }

  async getIndustryByName(name: string): Promise<Industry | undefined> {
    const [industry] = await db.select().from(industries).where(eq(industries.name, name));
    return industry;
  }

  async createIndustry(industry: InsertIndustry): Promise<Industry> {
    const [createdIndustry] = await db.insert(industries).values(industry).returning();
    return createdIndustry;
  }

  async getRoleModelIndustriesByRoleModelId(roleModelId: string): Promise<RoleModelIndustry[]> {
    const roleModelIndustryList = await db.select().from(roleModelIndustries).where(eq(roleModelIndustries.roleModelId, roleModelId));
    return roleModelIndustryList;
  }

  async createRoleModelIndustry(roleModelIndustry: InsertRoleModelIndustry): Promise<RoleModelIndustry> {
    const [createdRoleModelIndustry] = await db.insert(roleModelIndustries).values(roleModelIndustry).returning();
    return createdRoleModelIndustry;
  }

  async deleteRoleModelIndustry(id: string): Promise<boolean> {
    const [deletedRoleModelIndustry] = await db.delete(roleModelIndustries).where(eq(roleModelIndustries.id, id)).returning();
    return !!deletedRoleModelIndustry;
  }

  async deleteRoleModelIndustriesByRoleModelId(roleModelId: string): Promise<boolean> {
    const result = await db.delete(roleModelIndustries).where(eq(roleModelIndustries.roleModelId, roleModelId)).returning();
    return result.length > 0;
  }

  // サマリー関連
  async getSummariesByRoleModelId(roleModelId: string): Promise<Summary[]> {
    const summaryList = await db.select().from(summaries).where(eq(summaries.roleModelId, roleModelId)).orderBy(desc(summaries.createdAt));
    return summaryList;
  }

  async getSummary(id: string): Promise<Summary | undefined> {
    const [summary] = await db.select().from(summaries).where(eq(summaries.id, id));
    return summary;
  }

  async createSummary(summary: InsertSummary): Promise<Summary> {
    const [createdSummary] = await db.insert(summaries).values(summary).returning();
    return createdSummary;
  }

  async updateSummary(id: string, summary: Partial<InsertSummary>): Promise<Summary | undefined> {
    const [updatedSummary] = await db.update(summaries).set(summary).where(eq(summaries.id, id)).returning();
    return updatedSummary;
  }

  async deleteSummary(id: string): Promise<boolean> {
    const [deletedSummary] = await db.delete(summaries).where(eq(summaries.id, id)).returning();
    return !!deletedSummary;
  }

  // 情報収集プラン関連
  async getCollectionPlanById(id: string): Promise<CollectionPlan | undefined> {
    const [plan] = await db.select().from(collectionPlans).where(eq(collectionPlans.id, id));
    return plan;
  }

  async getCollectionPlansByRoleModelId(roleModelId: string): Promise<CollectionPlan[]> {
    const plans = await db.select().from(collectionPlans).where(eq(collectionPlans.roleModelId, roleModelId));
    return plans;
  }

  async getCollectionPlansByUserId(userId: string): Promise<CollectionPlan[]> {
    const plans = await db.select().from(collectionPlans).where(eq(collectionPlans.createdBy, userId));
    return plans;
  }

  async getActiveCollectionPlansByUserId(userId: string): Promise<CollectionPlan[]> {
    const plans = await db.select().from(collectionPlans).where(
      and(
        eq(collectionPlans.createdBy, userId),
        eq(collectionPlans.isActive, true)
      )
    );
    return plans;
  }

  async createCollectionPlan(plan: InsertCollectionPlan): Promise<CollectionPlan> {
    const [createdPlan] = await db.insert(collectionPlans).values(plan).returning();
    return createdPlan;
  }

  async updateCollectionPlan(id: string, plan: Partial<InsertCollectionPlan>): Promise<CollectionPlan | undefined> {
    const [updatedPlan] = await db.update(collectionPlans).set(plan).where(eq(collectionPlans.id, id)).returning();
    return updatedPlan;
  }

  async deleteCollectionPlan(id: string): Promise<boolean> {
    const [deletedPlan] = await db.delete(collectionPlans).where(eq(collectionPlans.id, id)).returning();
    return !!deletedPlan;
  }

  async activateCollectionPlan(id: string): Promise<CollectionPlan | undefined> {
    // まず指定されたユーザーのすべてのアクティブプランを非アクティブにする
    const [planToActivate] = await db.select().from(collectionPlans).where(eq(collectionPlans.id, id));
    if (!planToActivate) return undefined;

    // このユーザーの他のすべてのアクティブプランを非アクティブにする
    await db.update(collectionPlans)
      .set({ isActive: false })
      .where(
        and(
          eq(collectionPlans.createdBy, planToActivate.createdBy),
          eq(collectionPlans.isActive, true)
        )
      );

    // 指定されたプランをアクティブにする
    const [activatedPlan] = await db.update(collectionPlans)
      .set({ isActive: true })
      .where(eq(collectionPlans.id, id))
      .returning();

    return activatedPlan;
  }

  async deactivateCollectionPlan(id: string): Promise<CollectionPlan | undefined> {
    const [deactivatedPlan] = await db.update(collectionPlans)
      .set({ isActive: false })
      .where(eq(collectionPlans.id, id))
      .returning();

    return deactivatedPlan;
  }

  // 情報ソース関連
  async getCollectionSourceById(id: string): Promise<CollectionSource | undefined> {
    const [source] = await db.select().from(collectionSources).where(eq(collectionSources.id, id));
    return source;
  }

  async getCollectionSourcesByPlanId(planId: string): Promise<CollectionSource[]> {
    const sources = await db.select().from(collectionSources)
      .where(eq(collectionSources.collectionPlanId, planId))
      .orderBy(desc(collectionSources.collectedAt));
    return sources;
  }

  async getCollectionSourcesByExecutionId(executionId: string): Promise<CollectionSource[]> {
    const sources = await db.select().from(collectionSources)
      .where(eq(collectionSources.executionId, executionId))
      .orderBy(desc(collectionSources.relevanceScore));
    return sources;
  }

  async createCollectionSource(source: InsertCollectionSource): Promise<CollectionSource> {
    const [createdSource] = await db.insert(collectionSources).values(source).returning();
    return createdSource;
  }

  async deleteCollectionSource(id: string): Promise<boolean> {
    const [deletedSource] = await db.delete(collectionSources).where(eq(collectionSources.id, id)).returning();
    return !!deletedSource;
  }

  // 要約結果関連
  async getCollectionSummaryById(id: string): Promise<CollectionSummary | undefined> {
    const [summary] = await db.select().from(collectionSummaries).where(eq(collectionSummaries.id, id));
    return summary;
  }

  async getCollectionSummariesByPlanId(planId: string): Promise<CollectionSummary[]> {
    const summaries = await db.select().from(collectionSummaries)
      .where(eq(collectionSummaries.collectionPlanId, planId))
      .orderBy(desc(collectionSummaries.generatedAt));
    return summaries;
  }

  async getCollectionSummaryByExecutionId(executionId: string): Promise<CollectionSummary | undefined> {
    const [summary] = await db.select().from(collectionSummaries).where(eq(collectionSummaries.executionId, executionId));
    return summary;
  }

  async createCollectionSummary(summary: InsertCollectionSummary): Promise<CollectionSummary> {
    const [createdSummary] = await db.insert(collectionSummaries).values(summary).returning();
    return createdSummary;
  }

  async updateCollectionSummary(id: string, summary: Partial<InsertCollectionSummary>): Promise<CollectionSummary | undefined> {
    const [updatedSummary] = await db.update(collectionSummaries).set(summary).where(eq(collectionSummaries.id, id)).returning();
    return updatedSummary;
  }

  async deleteCollectionSummary(id: string): Promise<boolean> {
    const [deletedSummary] = await db.delete(collectionSummaries).where(eq(collectionSummaries.id, id)).returning();
    return !!deletedSummary;
  }
}

export const storage = new DatabaseStorage();