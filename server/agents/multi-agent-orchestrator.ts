/**
 * マルチエージェントオーケストレーター
 * 複数のAIエージェントを調整し、知識グラフ生成プロセスを管理する
 */

import { analyzeIndustries } from './industry-analysis';
import { expandKeywords } from './keyword-expansion';
import { structureContent } from './structuring';
import { generateKnowledgeGraph } from './knowledge-graph';
import { 
  AgentResult, KnowledgeGraphData, RoleModelInput,
  IndustryAnalysisInput, KeywordExpansionInput, StructuringInput, KnowledgeGraphInput
} from './types';
import { sendProgressUpdate, sendAgentThoughts } from '../websocket';

/**
 * エラーメッセージを安全に抽出する
 * @param error エラーオブジェクトまたはエラーメッセージ
 * @returns 文字列化されたエラーメッセージ
 */
function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * 役割モデルの処理を実行する
 * @param input 役割モデル入力データ
 * @returns 知識グラフデータ
 */
export async function processRoleModel(
  input: RoleModelInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    console.log(`マルチエージェントオーケストレーター起動: ${input.roleName}`);
    
    // ステップ1: 業界分析エージェントを実行
    sendProgressUpdate('業界分析を開始します', 0, input.roleModelId);
    
    // inputのdescriptionが任意なので、デフォルト値を設定
    const industryAnalysisInput: IndustryAnalysisInput = {
      ...input,
      description: input.description || `${input.roleName}の役割`
    };
    
    sendAgentThoughts('Industry Analysis Agent', '業界分析を開始します...', input.roleModelId);
    const industryResult = await analyzeIndustries(industryAnalysisInput);
    
    if (industryResult.success) {
      sendAgentThoughts('Industry Analysis Agent', '業界分析が完了しました', input.roleModelId);
      sendProgressUpdate('業界分析が完了しました', 25, input.roleModelId);
      console.log('業界分析結果:', industryResult.data);
    } else {
      const errorMessage = getErrorMessage(industryResult.error);
      sendAgentThoughts('Industry Analysis Agent', `エラー: ${errorMessage}`, input.roleModelId);
      sendProgressUpdate(`業界分析エラー: ${errorMessage}`, 10, input.roleModelId);
      return {
        success: false,
        error: `業界分析エラー: ${errorMessage}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    // ステップ2: キーワード拡張エージェントを実行
    sendProgressUpdate('キーワード拡張を開始します', 25, input.roleModelId);
    
    const keywordExpansionInput: KeywordExpansionInput = {
      ...input,
      industries: industryResult.data.industries,
      keywords: industryResult.data.keywords
    };
    
    sendAgentThoughts('Keyword Expansion Agent', 'キーワード拡張を開始します...', input.roleModelId);
    const keywordResult = await expandKeywords(keywordExpansionInput);
    
    if (keywordResult.success) {
      sendAgentThoughts('Keyword Expansion Agent', 'キーワード拡張が完了しました', input.roleModelId);
      sendProgressUpdate('キーワード拡張が完了しました', 50, input.roleModelId);
      console.log('キーワード拡張結果:', keywordResult.data);
    } else {
      const errorMessage = getErrorMessage(keywordResult.error);
      sendAgentThoughts('Keyword Expansion Agent', `エラー: ${errorMessage}`, input.roleModelId);
      sendProgressUpdate(`キーワード拡張エラー: ${errorMessage}`, 30, input.roleModelId);
      return {
        success: false,
        error: `キーワード拡張エラー: ${errorMessage}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    // ステップ3: 構造化エージェントを実行
    sendProgressUpdate('情報構造化を開始します', 50, input.roleModelId);
    
    const structuringInput: StructuringInput = {
      ...input,
      industries: industryResult.data.industries,
      keywords: industryResult.data.keywords,
      expandedKeywords: keywordResult.data.expandedKeywords,
      keywordRelations: keywordResult.data.keywordRelations
    };
    
    sendAgentThoughts('Structuring Agent', '情報構造化を開始します...', input.roleModelId);
    const structureResult = await structureContent(structuringInput);
    
    if (structureResult.success) {
      sendAgentThoughts('Structuring Agent', '情報構造化が完了しました', input.roleModelId);
      sendProgressUpdate('情報構造化が完了しました', 75, input.roleModelId);
      console.log('構造化結果:', structureResult.data);
    } else {
      const errorMessage = getErrorMessage(structureResult.error);
      sendAgentThoughts('Structuring Agent', `エラー: ${errorMessage}`, input.roleModelId);
      sendProgressUpdate(`情報構造化エラー: ${errorMessage}`, 60, input.roleModelId);
      return {
        success: false,
        error: `情報構造化エラー: ${errorMessage}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    // ステップ4: 知識グラフ生成エージェントを実行
    sendProgressUpdate('知識グラフ生成を開始します', 75, input.roleModelId);
    
    const graphInput: KnowledgeGraphInput = {
      ...input,
      industries: industryResult.data.industries,
      keywords: industryResult.data.keywords,
      expandedKeywords: keywordResult.data.expandedKeywords,
      keywordRelations: keywordResult.data.keywordRelations,
      structuredContent: structureResult.data.structuredContent,
      entities: structureResult.data.entities,
      relationships: structureResult.data.relationships
    };
    
    sendAgentThoughts('Knowledge Graph Agent', '知識グラフ生成を開始します...', input.roleModelId);
    const graphResult = await generateKnowledgeGraph(graphInput);
    
    if (graphResult.success) {
      sendAgentThoughts('Knowledge Graph Agent', '知識グラフ生成が完了しました', input.roleModelId);
      sendProgressUpdate('知識グラフ生成が完了しました', 100, input.roleModelId);
      console.log('知識グラフ生成結果:', graphResult.data);
      
      // 最終結果を返す
      return {
        success: true,
        data: graphResult.data
      };
    } else {
      const errorMessage = getErrorMessage(graphResult.error);
      sendAgentThoughts('Knowledge Graph Agent', `エラー: ${errorMessage}`, input.roleModelId);
      sendProgressUpdate(`知識グラフ生成エラー: ${errorMessage}`, 80, input.roleModelId);
      return {
        success: false,
        error: `知識グラフ生成エラー: ${errorMessage}`,
        data: { nodes: [], edges: [] }
      };
    }
    
  } catch (error) {
    console.error('マルチエージェントオーケストレーターエラー:', error);
    const errorMessage = getErrorMessage(error);
    sendProgressUpdate(`エラーが発生しました: ${errorMessage}`, 0, input.roleModelId);
    
    return {
      success: false,
      error: `マルチエージェントオーケストレーターエラー: ${errorMessage}`,
      data: { nodes: [], edges: [] }
    };
  }
}

// 知識グラフの更新処理
type NodeUpdate = {
  id: string;
  name: string;
  type: string;
  level: number;
  description: string;
  color: string;
  parentId?: string;
};

type EdgeUpdate = {
  source: string;
  target: string;
  label: string;
  strength: number;
};

type KnowledgeGraphUpdate = {
  nodes: NodeUpdate[];
  edges: EdgeUpdate[];
};

/**
 * 既存の知識グラフを拡張する
 * @param roleModelId ロールモデルID
 * @param nodeId 拡張するノードID
 * @param existingGraph 既存の知識グラフ
 * @returns 更新された知識グラフ部分
 */
export async function expandKnowledgeGraph(
  roleModelId: string,
  nodeId: string,
  existingGraph: KnowledgeGraphData
): Promise<AgentResult<KnowledgeGraphUpdate>> {
  try {
    console.log(`知識グラフ拡張開始: ノードID ${nodeId}, ロールモデルID ${roleModelId}`);
    
    // 拡張するノードを見つける
    const targetNode = existingGraph.nodes.find(node => node.id === nodeId);
    if (!targetNode) {
      return {
        success: false,
        error: `指定されたノードID ${nodeId} が見つかりません`,
        data: { nodes: [], edges: [] }
      };
    }
    
    // モックデータ: 実際にはAIを使用して拡張するノードと関係を生成する
    // これは例示用のものであり、実際の実装ではAIを使用してより適切なデータを生成する必要がある
    
    // 新しいノードの作成（例）
    const newNodes: NodeUpdate[] = [
      {
        id: `${nodeId}-child-1`,
        name: `${targetNode.name} サブトピック 1`,
        type: targetNode.type || 'concept',
        level: (targetNode.level || 0) + 1,
        description: `${targetNode.name}の詳細サブトピック 1`,
        color: targetNode.color || '#3498db',
        parentId: nodeId
      },
      {
        id: `${nodeId}-child-2`,
        name: `${targetNode.name} サブトピック 2`,
        type: targetNode.type || 'concept',
        level: (targetNode.level || 0) + 1,
        description: `${targetNode.name}の詳細サブトピック 2`,
        color: targetNode.color || '#2ecc71',
        parentId: nodeId
      },
      {
        id: `${nodeId}-child-3`,
        name: `${targetNode.name} サブトピック 3`,
        type: targetNode.type || 'concept',
        level: (targetNode.level || 0) + 1,
        description: `${targetNode.name}の詳細サブトピック 3`,
        color: targetNode.color || '#e74c3c',
        parentId: nodeId
      }
    ];
    
    // 新しいエッジの作成（例）
    const newEdges: EdgeUpdate[] = [
      {
        source: nodeId,
        target: `${nodeId}-child-1`,
        label: '関連',
        strength: 0.8
      },
      {
        source: nodeId,
        target: `${nodeId}-child-2`,
        label: '関連',
        strength: 0.7
      },
      {
        source: nodeId,
        target: `${nodeId}-child-3`,
        label: '関連',
        strength: 0.6
      },
      {
        source: `${nodeId}-child-1`,
        target: `${nodeId}-child-2`,
        label: '相互関係',
        strength: 0.4
      }
    ];
    
    return {
      success: true,
      data: {
        nodes: newNodes,
        edges: newEdges
      }
    };
    
  } catch (error) {
    console.error('知識グラフ拡張エラー:', error);
    const errorMessage = getErrorMessage(error);
    
    return {
      success: false,
      error: `知識グラフ拡張エラー: ${errorMessage}`,
      data: { nodes: [], edges: [] }
    };
  }
}