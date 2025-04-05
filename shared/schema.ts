import { pgTable, text, integer, timestamp, boolean, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ユーザーロール定義
export const USER_ROLES = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// 会社テーブル
export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
});

// 会社テーブル関連付け
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  roleModels: many(roleModels),
}));

// 組織テーブル (オリジナルのスキーマとの互換性のため)
export const organizations = pgTable('organizations', {
  id: integer('id').primaryKey(),
  name: text('name'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 組織リレーション定義
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
}));

// ユーザーテーブル
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companies.id),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  role: text('role').default('viewer').notNull(),
});

// ユーザーリレーション定義
export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  roleModels: many(roleModels),
}));

// ロールモデルテーブル
export const roleModels = pgTable('role_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  companyId: uuid('company_id').references(() => companies.id),
  name: text('name').notNull(),
  description: text('description'),
  isShared: integer('is_shared').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ロールモデルリレーション
export const roleModelsRelations = relations(roleModels, ({ one, many }) => ({
  user: one(users, {
    fields: [roleModels.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [roleModels.companyId],
    references: [companies.id],
  }),
  knowledgeNodes: many(knowledgeNodes),
  knowledgeEdges: many(knowledgeEdges),
  industries: many(roleModelIndustries),
  keywords: many(roleModelKeywords),
}));

// 業界テーブル
export const industries = pgTable('industries', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ロールモデルと業界の中間テーブル
export const roleModelIndustries = pgTable('role_model_industries', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleModelId: uuid('role_model_id')
    .notNull()
    .references(() => roleModels.id, { onDelete: 'cascade' }),
  industryId: integer('industry_id')
    .notNull()
    .references(() => industries.id, { onDelete: 'cascade' }),
});

// 中間テーブルのリレーション
export const roleModelIndustriesRelations = relations(roleModelIndustries, ({ one }) => ({
  roleModel: one(roleModels, {
    fields: [roleModelIndustries.roleModelId],
    references: [roleModels.id],
  }),
  industry: one(industries, {
    fields: [roleModelIndustries.industryId],
    references: [industries.id],
  }),
}));

// キーワードテーブル
export const keywords = pgTable('keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status'),
  parentId: uuid('parent_id'), // 循環参照を避けるため、最初はreferencesなしで定義
  isCommon: boolean('is_common').default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// キーワードリレーション
export const keywordsRelations = relations(keywords, ({ one, many }) => ({
  parent: one(keywords, {
    fields: [keywords.parentId],
    references: [keywords.id],
  }),
  children: many(keywords, { relationName: 'parent_children' }),
  creator: one(users, {
    fields: [keywords.createdBy],
    references: [users.id],
  }),
}));

// ロールモデルとキーワードの中間テーブル
export const roleModelKeywords = pgTable('role_model_keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleModelId: uuid('role_model_id')
    .notNull()
    .references(() => roleModels.id, { onDelete: 'cascade' }),
  keywordId: uuid('keyword_id')
    .notNull()
    .references(() => keywords.id, { onDelete: 'cascade' }),
});

// 中間テーブルのリレーション
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

// 知識ノードテーブル
export const knowledgeNodes = pgTable('knowledge_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleModelId: uuid('role_model_id').references(() => roleModels.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id'), // 循環参照を避けるため、最初はreferencesなしで定義
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').default('concept').notNull(),
  level: integer('level').default(0).notNull(),
  color: text('color'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 知識ノードリレーション
export const knowledgeNodesRelations = relations(knowledgeNodes, ({ one, many }) => ({
  roleModel: one(roleModels, {
    fields: [knowledgeNodes.roleModelId],
    references: [roleModels.id],
  }),
  parent: one(knowledgeNodes, {
    fields: [knowledgeNodes.parentId],
    references: [knowledgeNodes.id],
  }),
  children: many(knowledgeNodes, { relationName: 'parent_child' }),
  outgoingEdges: many(knowledgeEdges, { relationName: 'source_edges' }),
  incomingEdges: many(knowledgeEdges, { relationName: 'target_edges' }),
}));

// 知識エッジテーブル
export const knowledgeEdges = pgTable('knowledge_edges', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id')
    .notNull()
    .references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  label: text('label'),
  strength: integer('strength').default(1).notNull(),
  roleModelId: uuid('role_model_id')
    .notNull()
    .references(() => roleModels.id, { onDelete: 'cascade' }),
});

// 知識エッジリレーション
export const knowledgeEdgesRelations = relations(knowledgeEdges, ({ one }) => ({
  roleModel: one(roleModels, {
    fields: [knowledgeEdges.roleModelId],
    references: [roleModels.id],
  }),
  sourceNode: one(knowledgeNodes, {
    fields: [knowledgeEdges.sourceId],
    references: [knowledgeNodes.id],
    relationName: 'source_edges',
  }),
  targetNode: one(knowledgeNodes, {
    fields: [knowledgeEdges.targetId],
    references: [knowledgeNodes.id],
    relationName: 'target_edges',
  }),
}));

// バージョン管理テーブル
export const graphVersions = pgTable('graph_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleModelId: uuid('role_model_id')
    .notNull()
    .references(() => roleModels.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  description: text('description'),
  snapshot: text('snapshot').notNull(), // JSON形式のグラフスナップショット
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: uuid('created_by').references(() => users.id),
});

// バージョン管理リレーション
export const graphVersionsRelations = relations(graphVersions, ({ one }) => ({
  roleModel: one(roleModels, {
    fields: [graphVersions.roleModelId],
    references: [roleModels.id],
  }),
  creator: one(users, {
    fields: [graphVersions.createdBy],
    references: [users.id],
  }),
}));

// Zodスキーマとタイプ
export const insertCompanySchema = createInsertSchema(companies, {
  name: z.string().min(1, '会社名は必須です'),
  description: z.string().nullable().optional(),
}).omit({ id: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export const insertUserSchema = createInsertSchema(users, {
  companyId: z.string().uuid().nullable().optional(),
  role: z.string(),
  name: z.string(),
  email: z.string().email(),
  password: z.string(),
}).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertOrganizationSchema = createInsertSchema(organizations, {
  name: z.string(),
  description: z.string().nullable().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export const insertRoleModelSchema = createInsertSchema(roleModels, {
  userId: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  isShared: z.number().optional(),
}).omit({ id: true, createdAt: true });
export type InsertRoleModel = z.infer<typeof insertRoleModelSchema>;
export type RoleModel = typeof roleModels.$inferSelect;

export const insertIndustrySchema = createInsertSchema(industries, {
  name: z.string(),
  description: z.string().nullable().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIndustry = z.infer<typeof insertIndustrySchema>;
export type Industry = typeof industries.$inferSelect;

export const insertKeywordSchema = createInsertSchema(keywords, {
  name: z.string(),
  description: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  isCommon: z.boolean().optional(),
  createdBy: z.string().uuid().nullable().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywords.$inferSelect;

export const insertKnowledgeNodeSchema = createInsertSchema(knowledgeNodes, {
  id: z.string().uuid().optional(),
  roleModelId: z.string().uuid(),
  parentId: z.string().uuid().nullable().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  type: z.string(),
  level: z.number(),
  color: z.string().nullable().optional(),
}).omit({ createdAt: true });
export type InsertKnowledgeNode = z.infer<typeof insertKnowledgeNodeSchema>;
export type KnowledgeNode = typeof knowledgeNodes.$inferSelect;

export const insertKnowledgeEdgeSchema = createInsertSchema(knowledgeEdges, {
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  label: z.string().nullable().optional(),
  strength: z.number(),
  roleModelId: z.string().uuid(),
}).omit({ id: true });
export type InsertKnowledgeEdge = z.infer<typeof insertKnowledgeEdgeSchema>;
export type KnowledgeEdge = typeof knowledgeEdges.$inferSelect;

export const insertGraphVersionSchema = createInsertSchema(graphVersions, {
  roleModelId: z.string().uuid(),
  version: z.number(),
  description: z.string().nullable().optional(),
  snapshot: z.string(),
  createdBy: z.string().uuid().nullable().optional(),
}).omit({ id: true, createdAt: true });
export type InsertGraphVersion = z.infer<typeof insertGraphVersionSchema>;
export type GraphVersion = typeof graphVersions.$inferSelect;

// 結合タイプ
export type RoleModelWithIndustriesAndKeywords = RoleModel & {
  industries: Industry[];
  keywords: Keyword[];
};

export type KnowledgeGraphData = {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};