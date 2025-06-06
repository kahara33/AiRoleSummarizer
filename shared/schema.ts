import { pgTable, uuid, text, timestamp, boolean, jsonb, decimal, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ユーザーロールの定義
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  MANAGER: 'manager'
} as const;

// ユーザー
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').default('individual_user'),
  // 実際のデータベースでは company_id として定義されている
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  // プランや有効期限フィールドがDBに存在
  subscriptionPlan: text('subscription_plan'),
  subscriptionExpiresAt: timestamp('subscription_expires_at', { withTimezone: true }),
  // データベースには created_at と updated_at カラムが存在しない
  // createdAt: timestamp('created_at').defaultNow(),
  // updatedAt: timestamp('updated_at').defaultNow()
});

// 組織
export const organizations = pgTable('organizations', {
  id: integer('id').primaryKey(), // 実際のデータベースではinteger型、シリアル
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// 会社テーブル
export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
});

// ロールモデル
export const roleModels = pgTable('role_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  // 実際のデータベースでは user_id として定義されている
  createdBy: uuid('user_id').references(() => users.id),
  // 実際のデータベースでは company_id として定義されている
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'set null' }),
  // 共有設定フラグ
  isShared: integer('is_shared').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  // データベースには updated_at が存在しない
  // updatedAt: timestamp('updated_at').defaultNow()
});

// 知識ノード
export const knowledgeNodes = pgTable('knowledge_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleModelId: uuid('role_model_id').references(() => roleModels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  level: integer('level').notNull(),
  type: text('type').default('keyword'),
  parentId: uuid('parent_id'), // 自己参照を避けるため、後でreferencesを追加
  description: text('description'),
  color: text('color'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// 知識エッジ
export const knowledgeEdges = pgTable('knowledge_edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleModelId: uuid('role_model_id').references(() => roleModels.id, { onDelete: 'cascade' }),
  sourceId: uuid('source_id').references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  label: text('label'),
  strength: integer('strength').default(1)
});

// ナレッジグラフスナップショット (保存された状態)
export const knowledgeGraphSnapshots = pgTable('knowledge_graph_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleModelId: uuid('role_model_id').references(() => roleModels.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  graphData: jsonb('graph_data').notNull(), // ノードとエッジの完全なスナップショット
  createdAt: timestamp('created_at').defaultNow().notNull(),
  isActive: boolean('is_active').default(false) // 現在アクティブなスナップショットか
});

// キーワード
export const keywords = pgTable('keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  parentId: uuid('parent_id').references(() => keywords.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id),
  isCommon: boolean('is_common').default(false),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// ロールモデルとキーワードの関連付け
export const roleModelKeywords = pgTable('role_model_keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleModelId: uuid('role_model_id').references(() => roleModels.id, { onDelete: 'cascade' }),
  keywordId: uuid('keyword_id').references(() => keywords.id, { onDelete: 'cascade' })
});

// 業界カテゴリ
export const industryCategories = pgTable('industry_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  displayOrder: integer('display_order'),
  createdAt: timestamp('created_at').defaultNow()
});

// 業界サブカテゴリ
export const industrySubcategories = pgTable('industry_subcategories', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => industryCategories.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  displayOrder: integer('display_order'),
  createdAt: timestamp('created_at').defaultNow()
});

// 業界 (従来のテーブル)
export const industries = pgTable('industries', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// ロールモデルと業界の関連付け
export const roleModelIndustries = pgTable('role_model_industries', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleModelId: uuid('role_model_id').references(() => roleModels.id, { onDelete: 'cascade' }),
  industryId: uuid('industry_subcategory_id').references(() => industrySubcategories.id, { onDelete: 'cascade' })
});

// サマリー
export const summaries = pgTable('summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  sources: jsonb('sources').$type<string[]>(),
  roleModelId: uuid('role_model_id').references(() => roleModels.id, { onDelete: 'cascade' }),
  feedback: integer('feedback'),
  createdAt: timestamp('created_at').defaultNow()
});

// --------------- 情報収集プラン機能の新しいスキーマ ---------------

// 情報収集プラン
export const collectionPlans = pgTable('collection_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  roleModelId: uuid('role_model_id').references(() => roleModels.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  frequency: text('frequency').default('daily'),
  toolsConfig: jsonb('tools_config').$type<ToolsConfig>().default({ enabledTools: [] }),
  deliveryConfig: jsonb('delivery_config').$type<DeliveryConfig>().default({ emailEnabled: false, webhookEnabled: false }),
});

// 情報ソース
export const collectionSources = pgTable('collection_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  collectionPlanId: uuid('collection_plan_id').references(() => collectionPlans.id, { onDelete: 'cascade' }),
  executionId: uuid('execution_id').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  category: text('category'),
  relevanceScore: decimal('relevance_score', { precision: 5, scale: 2 }),
  collectedAt: timestamp('collected_at').defaultNow(),
  content: text('content'),
  contentType: text('content_type'), // 'text', 'html', 'json', etc.
  toolUsed: text('tool_used'), // 'google_search', 'rss_feed', etc.
  metadata: jsonb('metadata').default({}),
});

// 要約結果
export const collectionSummaries = pgTable('collection_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  collectionPlanId: uuid('collection_plan_id').references(() => collectionPlans.id, { onDelete: 'cascade' }),
  executionId: uuid('execution_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  keyTopics: jsonb('key_topics').$type<string[]>().default([]),
  sourceIds: jsonb('source_ids').$type<string[]>().default([]), // collectionSources の ID 配列
  generatedAt: timestamp('generated_at').defaultNow(),
  aiProcessLog: text('ai_process_log'),
  deliveryStatus: jsonb('delivery_status').$type<DeliveryStatus>().default({ emailDelivered: false, webhookDelivered: false }),
});

// インサートスキーマ
export const insertUserSchema = createInsertSchema(users).omit({
  id: true
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertRoleModelSchema = createInsertSchema(roleModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertKnowledgeNodeSchema = createInsertSchema(knowledgeNodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertKnowledgeEdgeSchema = createInsertSchema(knowledgeEdges).omit({
  id: true,
  // createdAtとupdatedAtはスキーマから削除したので、ここでは省略する必要がない
});

export const insertKeywordSchema = createInsertSchema(keywords).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertRoleModelKeywordSchema = createInsertSchema(roleModelKeywords).omit({
  id: true,
  // createdAt: trueは既に存在しないので削除
});

export const insertRoleModelIndustrySchema = createInsertSchema(roleModelIndustries).omit({
  id: true,
  // createdAt: trueは既に存在しないので削除
});

export const insertIndustryCategorySchema = createInsertSchema(industryCategories).omit({
  id: true,
  createdAt: true
});

export const insertIndustrySubcategorySchema = createInsertSchema(industrySubcategories).omit({
  id: true,
  createdAt: true
});

export const insertIndustrySchema = createInsertSchema(industries).omit({
  id: true,
  createdAt: true
});

export const insertSummarySchema = createInsertSchema(summaries).omit({
  id: true,
  createdAt: true
});

// 新しいスキーマのインサートスキーマ
export const insertCollectionPlanSchema = createInsertSchema(collectionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCollectionSourceSchema = createInsertSchema(collectionSources).omit({
  id: true,
  collectedAt: true
});

export const insertCollectionSummarySchema = createInsertSchema(collectionSummaries).omit({
  id: true,
  generatedAt: true
});

// ナレッジグラフスナップショットのインサートスキーマ
export const insertKnowledgeGraphSnapshotSchema = createInsertSchema(knowledgeGraphSnapshots).omit({
  id: true,
  createdAt: true
});

// インサート型定義
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertRoleModel = z.infer<typeof insertRoleModelSchema>;
export type InsertKnowledgeNode = z.infer<typeof insertKnowledgeNodeSchema>;
export type InsertKnowledgeEdge = z.infer<typeof insertKnowledgeEdgeSchema>;
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type InsertRoleModelKeyword = z.infer<typeof insertRoleModelKeywordSchema>;
export type InsertRoleModelIndustry = z.infer<typeof insertRoleModelIndustrySchema>;
export type InsertIndustryCategory = z.infer<typeof insertIndustryCategorySchema>;
export type InsertIndustrySubcategory = z.infer<typeof insertIndustrySubcategorySchema>;
export type InsertIndustry = z.infer<typeof insertIndustrySchema>;
export type InsertSummary = z.infer<typeof insertSummarySchema>;

// 新しいスキーマのインサート型定義
export type InsertCollectionPlan = z.infer<typeof insertCollectionPlanSchema>;
export type InsertCollectionSource = z.infer<typeof insertCollectionSourceSchema>;
export type InsertCollectionSummary = z.infer<typeof insertCollectionSummarySchema>;
export type InsertKnowledgeGraphSnapshot = z.infer<typeof insertKnowledgeGraphSnapshotSchema>;

// セレクト型定義
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type RoleModel = typeof roleModels.$inferSelect;
export type KnowledgeNode = typeof knowledgeNodes.$inferSelect;
export type KnowledgeEdge = typeof knowledgeEdges.$inferSelect;
export type Keyword = typeof keywords.$inferSelect;
export type RoleModelKeyword = typeof roleModelKeywords.$inferSelect;
export type RoleModelIndustry = typeof roleModelIndustries.$inferSelect;
export type IndustryCategory = typeof industryCategories.$inferSelect;
export type IndustrySubcategory = typeof industrySubcategories.$inferSelect;
export type Industry = typeof industries.$inferSelect;
export type Summary = typeof summaries.$inferSelect;

// 新しいスキーマのセレクト型定義
export type CollectionPlan = typeof collectionPlans.$inferSelect;
export type CollectionSource = typeof collectionSources.$inferSelect;
export type CollectionSummary = typeof collectionSummaries.$inferSelect;
export type KnowledgeGraphSnapshot = typeof knowledgeGraphSnapshots.$inferSelect;

// カスタム型定義
export type RoleModelWithIndustriesAndKeywords = RoleModel & {
  industries: Industry[];
  keywords: string[];
};

// 情報収集プラン関連のカスタム型定義
export type ToolsConfig = {
  enabledTools: string[]; // ['google_search', 'rss_feed']
  customSites?: string[];
  customRssUrls?: string[];
  searchDepth?: number;
  maxResults?: number;
};

export type DeliveryConfig = {
  emailEnabled?: boolean;
  emailAddresses?: string[];
  webhookEnabled?: boolean;
  webhookUrls?: string[];
  webhookType?: 'slack' | 'teams';
};

export type DeliveryStatus = {
  emailDelivered?: boolean;
  emailDeliveryTime?: string;
  webhookDelivered?: boolean;
  webhookDeliveryTime?: string;
  deliveryErrors?: string[];
};

// リレーションの定義
import { relations } from 'drizzle-orm';

// ユーザーとロールモデルの関係
export const usersRelations = relations(users, ({ many }) => ({
  roleModels: many(roleModels),
}));

// 会社とユーザー、ロールモデルの関係
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users, { fields: [companies.id], references: [users.companyId] }),
  roleModels: many(roleModels, { fields: [companies.id], references: [roleModels.companyId] }),
}));

// 組織とユーザー、ロールモデルの関係（旧データモデル互換性維持用）
export const organizationsRelations = relations(organizations, ({ many }) => ({
  // 注意: 実際にはorganizationsとusersの間には直接のリレーションはありません
  users: many(users),
  // 注意: 実際にはorganizationsとroleModelsの間には直接のリレーションはありません
  roleModels: many(roleModels),
}));

// ロールモデルとユーザー、組織、キーワード、業界の関係
export const roleModelsRelations = relations(roleModels, ({ one, many }) => ({
  user: one(users, {
    fields: [roleModels.createdBy],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [roleModels.companyId],
    references: [companies.id],
  }),
  keywords: many(roleModelKeywords),
  industries: many(roleModelIndustries),
  knowledgeNodes: many(knowledgeNodes),
  knowledgeGraphSnapshots: many(knowledgeGraphSnapshots),
}));

// 知識ノードの関係
export const knowledgeNodesRelations = relations(knowledgeNodes, ({ one, many }) => ({
  roleModel: one(roleModels, {
    fields: [knowledgeNodes.roleModelId],
    references: [roleModels.id],
  }),
  parent: one(knowledgeNodes, {
    fields: [knowledgeNodes.parentId],
    references: [knowledgeNodes.id],
  }),
  outgoingEdges: many(knowledgeEdges, { relationName: 'source' }),
  incomingEdges: many(knowledgeEdges, { relationName: 'target' }),
}));

// 知識エッジの関係
export const knowledgeEdgesRelations = relations(knowledgeEdges, ({ one }) => ({
  source: one(knowledgeNodes, {
    fields: [knowledgeEdges.sourceId],
    references: [knowledgeNodes.id],
    relationName: 'source',
  }),
  target: one(knowledgeNodes, {
    fields: [knowledgeEdges.targetId],
    references: [knowledgeNodes.id],
    relationName: 'target',
  }),
}));

// キーワードとロールモデルの関係
export const keywordsRelations = relations(keywords, ({ many }) => ({
  roleModelKeywords: many(roleModelKeywords),
}));

// ロールモデルキーワードの関係
export const roleModelKeywordsRelations = relations(roleModelKeywords, ({ one }) => ({
  roleModel: one(roleModels, {
    fields: [roleModelKeywords.roleModelId],
    references: [roleModels.id],
  }),
  keyword: one(keywords, {
    fields: [roleModelKeywords.keywordId],
    references: [keywords.id],
  }),
}));

// 業界カテゴリと業界サブカテゴリの関係
export const industryCategoriesRelations = relations(industryCategories, ({ many }) => ({
  subcategories: many(industrySubcategories),
}));

// 業界サブカテゴリと業界カテゴリ、ロールモデル業界の関係
export const industrySubcategoriesRelations = relations(industrySubcategories, ({ one, many }) => ({
  category: one(industryCategories, {
    fields: [industrySubcategories.categoryId],
    references: [industryCategories.id],
  }),
  roleModelIndustries: many(roleModelIndustries),
}));

// ロールモデル業界の関係
export const roleModelIndustriesRelations = relations(roleModelIndustries, ({ one }) => ({
  roleModel: one(roleModels, {
    fields: [roleModelIndustries.roleModelId],
    references: [roleModels.id],
  }),
  industry: one(industrySubcategories, {
    fields: [roleModelIndustries.industryId],
    references: [industrySubcategories.id],
  }),
}));

// ナレッジグラフスナップショットの関係
export const knowledgeGraphSnapshotsRelations = relations(knowledgeGraphSnapshots, ({ one }) => ({
  roleModel: one(roleModels, {
    fields: [knowledgeGraphSnapshots.roleModelId],
    references: [roleModels.id],
  }),
}));

// 知識グラフ関連の型定義
export type KnowledgeGraphData = {
  nodes: KnowledgeNodeData[];
  edges: KnowledgeEdgeData[];
};

export type KnowledgeNodeData = {
  id?: string;
  name: string;
  level: number;
  type?: string;
  parentId?: string | null;
  description?: string | null;
  color?: string | null;
};

export type KnowledgeEdgeData = {
  id?: string;
  source: string;
  target: string;
  label?: string | null;
  strength?: number;
};

/**
 * 情報収集プラン関連の型定義
 */
export interface InformationCollectionPlan {
  id: string;
  roleModelId: string;
  title: string;
  description?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  order?: number;
  tags?: string[];
  status?: string;
  priority?: string;
  metaData?: Record<string, any>;
}

export type InformationCollectionPlanData = {
  id?: string;
  roleModelId: string;
  title: string;
  description?: string;
  content: string;
  order?: number;
  tags?: string[];
  status?: string;
  priority?: string;
  metaData?: Record<string, any>;
};