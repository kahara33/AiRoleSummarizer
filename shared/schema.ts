import { 
  pgTable, 
  text, 
  serial, 
  uuid, 
  timestamp,
  date, 
  integer, 
  foreignKey,
  primaryKey,
  boolean,
  unique,
  doublePrecision
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Company model
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
});

// User model with role-based access control
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("individual_user"),  // system_admin, company_admin, company_user, individual_user
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
});

// Role model
export const roleModels = pgTable("role_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  userId: uuid("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  isShared: integer("is_shared").notNull().default(0), // 0: private, 1: company-shared
  createdAt: timestamp("created_at").defaultNow(),
});

// Knowledge Node model
export const knowledgeNodes = pgTable("knowledge_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("keyword"), // keyword, concept, tool, etc.
  color: text("color"), // for visualization
  roleModelId: uuid("role_model_id").notNull()
    .references(() => roleModels.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  level: integer("level").notNull().default(0), // 0 for root, 1 for first level, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Knowledge Edge model (relationships between nodes)
export const knowledgeEdges = pgTable("knowledge_edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").notNull(),
  targetId: uuid("target_id").notNull(),
  label: text("label"), // CONTAINS, RELATED_TO, etc.
  strength: integer("strength").default(1), // 1-10, for visualization
  roleModelId: uuid("role_model_id").notNull()
    .references(() => roleModels.id, { onDelete: "cascade" }),
});

// Summary model
export const summaries = pgTable("summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sources: text("sources").array(),
  roleModelId: uuid("role_model_id").notNull()
    .references(() => roleModels.id, { onDelete: "cascade" }),
  feedback: integer("feedback").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// 業界大カテゴリマスター
export const industryCategories = pgTable("industry_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 業界中カテゴリマスター
export const industrySubcategories = pgTable("industry_subcategories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  categoryId: uuid("category_id").notNull()
    .references(() => industryCategories.id, { onDelete: "cascade" }),
  description: text("description").notNull().default(""),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// キーワードマスター
export const keywords = pgTable("keywords", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  isCommon: boolean("is_common").notNull().default(true),  // 全ユーザー共通のキーワードかどうか
  status: text("status").notNull().default("active"),  // active, pending, rejected
  parentId: uuid("parent_id"),  // 親キーワード（階層関係）
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),  // 登録ユーザー
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// キーワード同義語・関連語テーブル
export const keywordRelations = pgTable("keyword_relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceKeywordId: uuid("source_keyword_id").notNull()
    .references(() => keywords.id, { onDelete: "cascade" }),
  targetKeywordId: uuid("target_keyword_id").notNull()
    .references(() => keywords.id, { onDelete: "cascade" }),
  relationType: text("relation_type").notNull(),  // synonym（同義語）、related（関連語）
  strength: integer("strength").notNull().default(5),  // 1-10、関連度の強さ
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    unq: unique().on(table.sourceKeywordId, table.targetKeywordId)
  }
});

// キーワード分野タグテーブル
export const keywordFields = pgTable("keyword_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  color: text("color"),  // 表示色
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// キーワードと分野タグの関連付けテーブル
export const keywordFieldRelations = pgTable("keyword_field_relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  keywordId: uuid("keyword_id").notNull()
    .references(() => keywords.id, { onDelete: "cascade" }),
  fieldId: uuid("field_id").notNull()
    .references(() => keywordFields.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    unq: unique().on(table.keywordId, table.fieldId)
  }
});

// 業界とキーワードの関連度テーブル
export const industryKeywordRelevance = pgTable("industry_keyword_relevance", {
  id: uuid("id").primaryKey().defaultRandom(),
  industrySubcategoryId: uuid("industry_subcategory_id").notNull()
    .references(() => industrySubcategories.id, { onDelete: "cascade" }),
  keywordId: uuid("keyword_id").notNull()
    .references(() => keywords.id, { onDelete: "cascade" }),
  relevanceScore: doublePrecision("relevance_score").notNull().default(0),  // 0.0-1.0、関連度スコア
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    unq: unique().on(table.industrySubcategoryId, table.keywordId)
  }
});

// ロールモデルと業界カテゴリの関連付けテーブル
export const roleModelIndustries = pgTable("role_model_industries", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleModelId: uuid("role_model_id").notNull()
    .references(() => roleModels.id, { onDelete: "cascade" }),
  industrySubcategoryId: uuid("industry_subcategory_id").notNull()
    .references(() => industrySubcategories.id, { onDelete: "cascade" }),
});

// ロールモデルとキーワードの関連付けテーブル
export const roleModelKeywords = pgTable("role_model_keywords", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleModelId: uuid("role_model_id").notNull()
    .references(() => roleModels.id, { onDelete: "cascade" }),
  keywordId: uuid("keyword_id").notNull()
    .references(() => keywords.id, { onDelete: "cascade" }),
});

// よく使われる業界組み合わせを保存するテーブル
export const industryCombinations = pgTable("industry_combinations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  userId: uuid("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isShared: boolean("is_shared").notNull().default(false),  // 組織内で共有するかどうか
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 業界組み合わせの詳細（どのサブカテゴリが含まれるか）
export const industryCombinationDetails = pgTable("industry_combination_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  combinationId: uuid("combination_id").notNull()
    .references(() => industryCombinations.id, { onDelete: "cascade" }),
  industrySubcategoryId: uuid("industry_subcategory_id").notNull()
    .references(() => industrySubcategories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    unq: unique().on(table.combinationId, table.industrySubcategoryId)
  }
});

// よく使われるキーワード組み合わせを保存するテーブル
export const keywordCollections = pgTable("keyword_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  userId: uuid("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isShared: boolean("is_shared").notNull().default(false),  // 組織内で共有するかどうか
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// キーワード組み合わせの詳細（どのキーワードが含まれるか）
export const keywordCollectionDetails = pgTable("keyword_collection_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectionId: uuid("collection_id").notNull()
    .references(() => keywordCollections.id, { onDelete: "cascade" }),
  keywordId: uuid("keyword_id").notNull()
    .references(() => keywords.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    unq: unique().on(table.collectionId, table.keywordId)
  }
});

// Tag table (keeping for backward compatibility until migration is complete)
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  roleModelId: uuid("role_model_id").notNull()
    .references(() => roleModels.id, { onDelete: "cascade" }),
});

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertRoleModelSchema = createInsertSchema(roleModels).omit({ id: true, createdAt: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true });
export const insertKnowledgeNodeSchema = createInsertSchema(knowledgeNodes).omit({ id: true, createdAt: true });
export const insertKnowledgeEdgeSchema = createInsertSchema(knowledgeEdges).omit({ id: true });
export const insertSummarySchema = createInsertSchema(summaries).omit({ id: true, createdAt: true });

// 新規テーブル用のスキーマ
export const insertIndustryCategorySchema = createInsertSchema(industryCategories).omit({ id: true, createdAt: true });
export const insertIndustrySubcategorySchema = createInsertSchema(industrySubcategories).omit({ id: true, createdAt: true });
export const insertKeywordSchema = createInsertSchema(keywords).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRoleModelIndustrySchema = createInsertSchema(roleModelIndustries).omit({ id: true });
export const insertRoleModelKeywordSchema = createInsertSchema(roleModelKeywords).omit({ id: true });

// 新しいテーブル用のスキーマ
export const insertKeywordRelationSchema = createInsertSchema(keywordRelations).omit({ id: true, createdAt: true });
export const insertKeywordFieldSchema = createInsertSchema(keywordFields).omit({ id: true, createdAt: true });
export const insertKeywordFieldRelationSchema = createInsertSchema(keywordFieldRelations).omit({ id: true, createdAt: true });
export const insertIndustryKeywordRelevanceSchema = createInsertSchema(industryKeywordRelevance).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIndustryCombinationSchema = createInsertSchema(industryCombinations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIndustryCombinationDetailSchema = createInsertSchema(industryCombinationDetails).omit({ id: true, createdAt: true });
export const insertKeywordCollectionSchema = createInsertSchema(keywordCollections).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKeywordCollectionDetailSchema = createInsertSchema(keywordCollectionDetails).omit({ id: true, createdAt: true });

// Define types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type RoleModel = typeof roleModels.$inferSelect;
export type InsertRoleModel = z.infer<typeof insertRoleModelSchema>;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export type KnowledgeNode = typeof knowledgeNodes.$inferSelect;
export type InsertKnowledgeNode = z.infer<typeof insertKnowledgeNodeSchema>;

export type KnowledgeEdge = typeof knowledgeEdges.$inferSelect;
export type InsertKnowledgeEdge = z.infer<typeof insertKnowledgeEdgeSchema>;

export type Summary = typeof summaries.$inferSelect;
export type InsertSummary = z.infer<typeof insertSummarySchema>;

// 新規テーブル用の型定義
export type IndustryCategory = typeof industryCategories.$inferSelect;
export type InsertIndustryCategory = z.infer<typeof insertIndustryCategorySchema>;

export type IndustrySubcategory = typeof industrySubcategories.$inferSelect;
export type InsertIndustrySubcategory = z.infer<typeof insertIndustrySubcategorySchema>;

export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;

export type RoleModelIndustry = typeof roleModelIndustries.$inferSelect;
export type InsertRoleModelIndustry = z.infer<typeof insertRoleModelIndustrySchema>;

export type RoleModelKeyword = typeof roleModelKeywords.$inferSelect;
export type InsertRoleModelKeyword = z.infer<typeof insertRoleModelKeywordSchema>;

// User role constants
export const USER_ROLES = {
  SYSTEM_ADMIN: 'system_admin',
  COMPANY_ADMIN: 'company_admin',
  COMPANY_USER: 'company_user',
  INDIVIDUAL_USER: 'individual_user'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Extended types for the application
export type RoleModelWithTags = RoleModel & { tags: Tag[] };
export type SummaryWithTags = Summary & { tags: Tag[] };

// 業界カテゴリとサブカテゴリの結合タイプ
export type IndustrySubcategoryWithCategory = IndustrySubcategory & { 
  category: IndustryCategory 
};

// 新しいテーブル用の型定義
export type KeywordRelation = typeof keywordRelations.$inferSelect;
export type InsertKeywordRelation = z.infer<typeof insertKeywordRelationSchema>;

export type KeywordField = typeof keywordFields.$inferSelect;
export type InsertKeywordField = z.infer<typeof insertKeywordFieldSchema>;

export type KeywordFieldRelation = typeof keywordFieldRelations.$inferSelect;
export type InsertKeywordFieldRelation = z.infer<typeof insertKeywordFieldRelationSchema>;

export type IndustryKeywordRelevance = typeof industryKeywordRelevance.$inferSelect;
export type InsertIndustryKeywordRelevance = z.infer<typeof insertIndustryKeywordRelevanceSchema>;

export type IndustryCombination = typeof industryCombinations.$inferSelect;
export type InsertIndustryCombination = z.infer<typeof insertIndustryCombinationSchema>;

export type IndustryCombinationDetail = typeof industryCombinationDetails.$inferSelect;
export type InsertIndustryCombinationDetail = z.infer<typeof insertIndustryCombinationDetailSchema>;

export type KeywordCollection = typeof keywordCollections.$inferSelect;
export type InsertKeywordCollection = z.infer<typeof insertKeywordCollectionSchema>;

export type KeywordCollectionDetail = typeof keywordCollectionDetails.$inferSelect;
export type InsertKeywordCollectionDetail = z.infer<typeof insertKeywordCollectionDetailSchema>;

// キーワード辞書関連の拡張タイプ
export type KeywordWithRelations = Keyword & {
  synonyms?: Keyword[];
  related?: Keyword[];
  parentKeyword?: Keyword;
  childKeywords?: Keyword[];
  fields?: KeywordField[];
};

// 業界・キーワード情報を含むロールモデル
export type RoleModelWithIndustriesAndKeywords = RoleModel & {
  industries: IndustrySubcategoryWithCategory[];
  keywords: Keyword[];
};
