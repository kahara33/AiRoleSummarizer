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

// User model
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
});

// Role model
export const roleModels = pgTable("role_models", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  userId: uuid("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertRoleModelSchema = createInsertSchema(roleModels).omit({ id: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true });
export const insertSummarySchema = createInsertSchema(summaries).omit({ id: true, createdAt: true });

// Define types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type RoleModel = typeof roleModels.$inferSelect;
export type InsertRoleModel = z.infer<typeof insertRoleModelSchema>;

export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;

export type Summary = typeof summaries.$inferSelect;
export type InsertSummary = z.infer<typeof insertSummarySchema>;

// Extended types for the application
export type RoleModelWithTags = RoleModel & { tags: Tag[] };
export type SummaryWithTags = Summary & { tags: Tag[] };
