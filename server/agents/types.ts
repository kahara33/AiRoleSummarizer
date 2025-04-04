// エージェントと共通タイプの定義
export interface KnowledgeNode {
  id: string;
  name: string;
  level: number;
  type?: string;
  parentId?: string | null;
  description?: string | null;
  color?: string | null;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  label?: string | null;
  strength?: number;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface RoleModelInput {
  roleName: string;
  industries: string[]; // 業界名の配列
  keywords: string[]; // キーワード名の配列
  description?: string;
}

export interface AgentResult {
  result: any;
  metadata?: any;
}

export interface AgentTask {
  id: string;
  name: string;
  description: string;
  input: any;
  expectedOutput: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  agent: string;
}

export type AIAgentToolkit = {
  [key: string]: (...args: any[]) => Promise<any>;
};