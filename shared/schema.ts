import { 
  pgTable, 
  text, 
  serial, 
  uuid, 
  timestamp, 
  integer, 
  foreignKey 
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
  description: text("description").notNull(),
  userId: uuid("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tag model
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: text("category").notNull(),
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

// Insert schemas
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertRoleModelSchema = createInsertSchema(roleModels).omit({ id: true, createdAt: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true });
export const insertSummarySchema = createInsertSchema(summaries).omit({ id: true, createdAt: true });

// Define types
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type RoleModel = typeof roleModels.$inferSelect;
export type InsertRoleModel = z.infer<typeof insertRoleModelSchema>;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export type Summary = typeof summaries.$inferSelect;
export type InsertSummary = z.infer<typeof insertSummarySchema>;

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
