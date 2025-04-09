import { KnowledgeNode as BaseKnowledgeNode, KnowledgeEdge } from '@shared/schema';

// ReactFlowで使用するために拡張された知識ノード型
export interface ExtendedKnowledgeNode extends BaseKnowledgeNode {
  // ReactFlowの位置情報
  position?: { x: number; y: number };
  
  // イベントハンドラ
  onEditNode?: (nodeId: string) => void;
  onAddChildNode?: (nodeId: string) => void;
  onAddSiblingNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onExpandNode?: (nodeId: string) => void;
}

// ReactFlowのノードエッジ型
export interface ReactFlowKnowledgeEdge extends KnowledgeEdge {
  // ReactFlowのエッジデータ
  sourceHandle?: string;
  targetHandle?: string;
}