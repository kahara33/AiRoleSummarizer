import { 
  User, InsertUser, 
  RoleModel, InsertRoleModel, 
  Tag, InsertTag, 
  Summary, InsertSummary, 
  RoleModelWithTags,
  SummaryWithTags
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Storage interface
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  
  // Summary operations
  getSummaries(roleModelId: string): Promise<Summary[]>;
  getSummaryWithTags(id: string): Promise<SummaryWithTags | undefined>;
  createSummary(summary: InsertSummary): Promise<Summary>;
  updateSummaryFeedback(id: string, feedback: number): Promise<Summary | undefined>;

  // Session store
  sessionStore: session.SessionStore;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private roleModels: Map<string, RoleModel>;
  private tags: Map<string, Tag>;
  private summaries: Map<string, Summary>;
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.roleModels = new Map();
    this.tags = new Map();
    this.summaries = new Map();
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
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
    const roleModel: RoleModel = { ...insertRoleModel, id };
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

  // Summary methods
  async getSummaries(roleModelId: string): Promise<Summary[]> {
    return Array.from(this.summaries.values())
      .filter((summary) => summary.roleModelId === roleModelId)
      .sort((a, b) => {
        // Sort by createdAt in descending order
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
    const summary: Summary = { ...insertSummary, id, createdAt };
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
