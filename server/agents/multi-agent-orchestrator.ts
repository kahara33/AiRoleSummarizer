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
  IndustryAnalysisInput, KeywordExpansionInput, StructuringInput, KnowledgeGraphInput,
  ProgressStatus, ProgressStep
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
    
    // 業界分析の詳細な進捗情報を初期化
    const industryProgressSteps: ProgressStep[] = [
      { step: '業界データ収集', progress: 0, status: 'pending', message: '' },
      { step: 'トレンド分析', progress: 0, status: 'pending', message: '' },
      { step: '重要キーワード特定', progress: 0, status: 'pending', message: '' },
      { step: '業界レポート生成', progress: 0, status: 'pending', message: '' }
    ];
    
    // 詳細な進捗情報付きで初期進捗を送信
    sendProgressUpdate('業界分析を開始します', 0, input.roleModelId, {
      stage: 'industry_analysis',
      subStage: 'preparation',
      detailedProgress: industryProgressSteps
    });
    
    // 詳細な思考プロセス情報を初期化
    const industryThinkingSteps = [
      {
        step: '準備',
        content: `${input.roleName}の役割に関連する業界分析を開始します。対象業界: ${input.industries.join(', ')}`,
        timestamp: new Date().toISOString()
      }
    ];
    
    // 詳細な思考プロセス情報付きで初期思考を送信
    sendAgentThoughts('Industry Analysis Agent', '業界分析を開始します...', input.roleModelId, {
      agentType: 'industry-analysis',
      stage: 'industry_analysis',
      thinking: industryThinkingSteps,
      context: {
        roleName: input.roleName,
        industries: input.industries,
        keywords: input.keywords
      }
    });
    
    // 進捗ステップを更新
    industryProgressSteps[0].status = 'processing';
    industryProgressSteps[0].progress = 30;
    sendProgressUpdate('業界データを収集中...', 5, input.roleModelId, {
      stage: 'industry_analysis',
      subStage: 'data_collection',
      detailedProgress: industryProgressSteps
    });
    
    // 業界分析エージェントを実行
    const industryResult = await analyzeIndustries(industryAnalysisInput);
    
    if (industryResult.success) {
      // 進捗更新
      industryProgressSteps[0].status = 'completed';
      industryProgressSteps[0].progress = 100;
      industryProgressSteps[1].status = 'completed';
      industryProgressSteps[1].progress = 100;
      industryProgressSteps[2].status = 'completed';
      industryProgressSteps[2].progress = 100;
      industryProgressSteps[3].status = 'completed';
      industryProgressSteps[3].progress = 100;
      
      // 詳細な思考プロセスを追加
      industryThinkingSteps.push({
        step: 'データ収集完了',
        content: `${input.industries.length}つの業界に関する情報を収集しました`,
        timestamp: new Date().toISOString()
      });
      
      industryThinkingSteps.push({
        step: '分析完了',
        content: `${industryResult.data.keywords.length}つの重要キーワードを特定しました`,
        timestamp: new Date().toISOString()
      });
      
      // 詳細な思考プロセス情報付きで完了メッセージを送信
      sendAgentThoughts('Industry Analysis Agent', '業界分析が完了しました', input.roleModelId, {
        agentType: 'industry-analysis',
        stage: 'industry_analysis',
        thinking: industryThinkingSteps,
        reasoning: `${input.roleName}の役割に最適な業界情報とキーワードを特定するために分析を行いました。`,
        decision: `${industryResult.data.keywords.length}個の重要キーワードを特定し、次のステップに進みます。`,
        outputData: {
          keywordCount: industryResult.data.keywords.length,
          topKeywords: industryResult.data.keywords.slice(0, 5)
        }
      });
      
      sendProgressUpdate('業界分析が完了しました', 25, input.roleModelId, {
        stage: 'industry_analysis',
        subStage: 'completed',
        detailedProgress: industryProgressSteps
      });
      
      console.log('業界分析結果:', industryResult.data);
    } else {
      const errorMessage = getErrorMessage(industryResult.error);
      
      // エラー状態を更新
      const errorIndex = industryProgressSteps.findIndex(step => step.status === 'processing');
      if (errorIndex >= 0) {
        industryProgressSteps[errorIndex].status = 'error';
        industryProgressSteps[errorIndex].message = errorMessage;
      }
      
      // 詳細な思考プロセスにエラー情報を追加
      industryThinkingSteps.push({
        step: 'エラー発生',
        content: `業界分析中にエラーが発生しました: ${errorMessage}`,
        timestamp: new Date().toISOString()
      });
      
      // エラー情報付きでメッセージを送信
      sendAgentThoughts('Industry Analysis Agent', `エラー: ${errorMessage}`, input.roleModelId, {
        agentType: 'industry-analysis',
        stage: 'industry_analysis',
        thinking: industryThinkingSteps,
        reasoning: '業界データの分析中に問題が発生しました。',
        decision: 'プロセスを中止し、エラーを報告します。'
      });
      
      sendProgressUpdate(`業界分析エラー: ${errorMessage}`, 10, input.roleModelId, {
        stage: 'industry_analysis',
        subStage: 'error',
        detailedProgress: industryProgressSteps
      });
      
      return {
        success: false,
        error: `業界分析エラー: ${errorMessage}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    // ステップ2: キーワード拡張エージェントを実行
    
    // キーワード拡張の詳細な進捗情報を初期化
    const keywordProgressSteps: ProgressStep[] = [
      { step: '基本キーワード分析', progress: 0, status: 'pending', message: '' },
      { step: '関連キーワード生成', progress: 0, status: 'pending', message: '' },
      { step: 'キーワード関係マッピング', progress: 0, status: 'pending', message: '' },
      { step: '最終キーワードセット生成', progress: 0, status: 'pending', message: '' }
    ];
    
    // 詳細な進捗情報付きで初期進捗を送信
    sendProgressUpdate('キーワード拡張を開始します', 25, input.roleModelId, {
      stage: 'keyword_expansion',
      subStage: 'preparation',
      detailedProgress: keywordProgressSteps
    });
    
    const keywordExpansionInput: KeywordExpansionInput = {
      ...input,
      industries: industryResult.data.industries,
      keywords: industryResult.data.keywords
    };
    
    // 詳細な思考プロセス情報を初期化
    const keywordThinkingSteps = [
      {
        step: '準備',
        content: `業界分析から得られたキーワード (${industryResult.data.keywords.length}個) を元に拡張を開始します`,
        timestamp: new Date().toISOString()
      }
    ];
    
    // 詳細な思考プロセス情報付きで初期思考を送信
    sendAgentThoughts('Keyword Expansion Agent', 'キーワード拡張を開始します...', input.roleModelId, {
      agentType: 'keyword-expansion',
      stage: 'keyword_expansion',
      thinking: keywordThinkingSteps,
      context: {
        baseKeywords: industryResult.data.keywords.slice(0, 5),
        industries: industryResult.data.industries
      }
    });
    
    // 進捗ステップを更新
    keywordProgressSteps[0].status = 'processing';
    keywordProgressSteps[0].progress = 50;
    sendProgressUpdate('基本キーワードを分析中...', 30, input.roleModelId, {
      stage: 'keyword_expansion',
      subStage: 'keyword_analysis',
      detailedProgress: keywordProgressSteps
    });
    
    // キーワード拡張エージェントを実行
    const keywordResult = await expandKeywords(keywordExpansionInput);
    
    if (keywordResult.success) {
      // 進捗更新
      keywordProgressSteps[0].status = 'completed';
      keywordProgressSteps[0].progress = 100;
      keywordProgressSteps[1].status = 'completed';
      keywordProgressSteps[1].progress = 100;
      keywordProgressSteps[2].status = 'completed';
      keywordProgressSteps[2].progress = 100;
      keywordProgressSteps[3].status = 'completed';
      keywordProgressSteps[3].progress = 100;
      
      // 詳細な思考プロセスを追加
      keywordThinkingSteps.push({
        step: '拡張完了',
        content: `元の${industryResult.data.keywords.length}個のキーワードから${keywordResult.data.expandedKeywords.length}個の拡張キーワードを生成しました`,
        timestamp: new Date().toISOString()
      });
      
      keywordThinkingSteps.push({
        step: '関係マッピング',
        content: `${keywordResult.data.keywordRelations.length}個のキーワード関係を特定しました`,
        timestamp: new Date().toISOString()
      });
      
      // 詳細な思考プロセス情報付きで完了メッセージを送信
      sendAgentThoughts('Keyword Expansion Agent', 'キーワード拡張が完了しました', input.roleModelId, {
        agentType: 'keyword-expansion',
        stage: 'keyword_expansion',
        thinking: keywordThinkingSteps,
        reasoning: `${input.roleName}の役割に関連するキーワードをより広範囲に特定するために、業界分析結果をもとに拡張を行いました。`,
        decision: `${keywordResult.data.expandedKeywords.length}個の拡張キーワードと${keywordResult.data.keywordRelations.length}個の関係を特定し、次のステップに進みます。`,
        outputData: {
          expandedKeywordCount: keywordResult.data.expandedKeywords.length,
          relationCount: keywordResult.data.keywordRelations.length,
          topExpandedKeywords: keywordResult.data.expandedKeywords.slice(0, 5)
        }
      });
      
      sendProgressUpdate('キーワード拡張が完了しました', 50, input.roleModelId, {
        stage: 'keyword_expansion',
        subStage: 'completed',
        detailedProgress: keywordProgressSteps
      });
      
      console.log('キーワード拡張結果:', keywordResult.data);
    } else {
      const errorMessage = getErrorMessage(keywordResult.error);
      
      // エラー状態を更新
      const errorIndex = keywordProgressSteps.findIndex(step => step.status === 'processing');
      if (errorIndex >= 0) {
        keywordProgressSteps[errorIndex].status = 'error';
        keywordProgressSteps[errorIndex].message = errorMessage;
      }
      
      // 詳細な思考プロセスにエラー情報を追加
      keywordThinkingSteps.push({
        step: 'エラー発生',
        content: `キーワード拡張中にエラーが発生しました: ${errorMessage}`,
        timestamp: new Date().toISOString()
      });
      
      // エラー情報付きでメッセージを送信
      sendAgentThoughts('Keyword Expansion Agent', `エラー: ${errorMessage}`, input.roleModelId, {
        agentType: 'keyword-expansion',
        stage: 'keyword_expansion',
        thinking: keywordThinkingSteps,
        reasoning: 'キーワード拡張処理中に問題が発生しました。',
        decision: 'プロセスを中止し、エラーを報告します。'
      });
      
      sendProgressUpdate(`キーワード拡張エラー: ${errorMessage}`, 30, input.roleModelId, {
        stage: 'keyword_expansion',
        subStage: 'error',
        detailedProgress: keywordProgressSteps
      });
      
      return {
        success: false,
        error: `キーワード拡張エラー: ${errorMessage}`,
        data: { nodes: [], edges: [] }
      };
    }
    
    // ステップ3: 構造化エージェントを実行
    
    // 構造化の詳細な進捗情報を初期化
    const structuringProgressSteps: ProgressStep[] = [
      { step: 'キーワード分類', progress: 0, status: 'pending', message: '' },
      { step: 'カテゴリ作成', progress: 0, status: 'pending', message: '' },
      { step: '階層構造生成', progress: 0, status: 'pending', message: '' },
      { step: '関係性マッピング', progress: 0, status: 'pending', message: '' }
    ];
    
    // 詳細な進捗情報付きで初期進捗を送信
    sendProgressUpdate('情報構造化を開始します', 50, input.roleModelId, {
      stage: 'structuring',
      subStage: 'preparation',
      detailedProgress: structuringProgressSteps
    });
    
    const structuringInput: StructuringInput = {
      ...input,
      industries: industryResult.data.industries,
      keywords: industryResult.data.keywords,
      expandedKeywords: keywordResult.data.expandedKeywords,
      keywordRelations: keywordResult.data.keywordRelations
    };
    
    // 詳細な思考プロセス情報を初期化
    const structuringThinkingSteps = [
      {
        step: '準備',
        content: `${keywordResult.data.expandedKeywords.length}個のキーワードと${keywordResult.data.keywordRelations.length}個の関係性に基づいた構造化を開始します`,
        timestamp: new Date().toISOString()
      }
    ];
    
    // 詳細な思考プロセス情報付きで初期思考を送信
    sendAgentThoughts('Structuring Agent', '情報構造化を開始します...', input.roleModelId, {
      agentType: 'structuring',
      stage: 'structuring',
      thinking: structuringThinkingSteps,
      context: {
        keywordCount: keywordResult.data.expandedKeywords.length,
        relationCount: keywordResult.data.keywordRelations.length,
        industries: industryResult.data.industries
      }
    });
    
    // 進捗ステップを更新
    structuringProgressSteps[0].status = 'processing';
    structuringProgressSteps[0].progress = 30;
    sendProgressUpdate('キーワードを分類中...', 55, input.roleModelId, {
      stage: 'structuring',
      subStage: 'keyword_classification',
      detailedProgress: structuringProgressSteps
    });
    
    // 構造化エージェントを実行
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
    
    // 知識グラフ生成の詳細な進捗情報を初期化
    const graphProgressSteps: ProgressStep[] = [
      { step: 'エンティティ準備', progress: 0, status: 'pending', message: '' },
      { step: 'ノード生成', progress: 0, status: 'pending', message: '' },
      { step: 'エッジ生成', progress: 0, status: 'pending', message: '' },
      { step: 'グラフ最適化', progress: 0, status: 'pending', message: '' }
    ];
    
    // 詳細な進捗情報付きで初期進捗を送信
    sendProgressUpdate('知識グラフ生成を開始します', 75, input.roleModelId, {
      stage: 'knowledge_graph',
      subStage: 'preparation',
      detailedProgress: graphProgressSteps
    });
    
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
    
    // 詳細な思考プロセス情報を初期化
    const graphThinkingSteps = [
      {
        step: '準備',
        content: `構造化された${structureResult.data.entities?.length || 0}個のエンティティと${structureResult.data.relationships?.length || 0}個の関係性に基づいた知識グラフ生成を開始します`,
        timestamp: new Date().toISOString()
      }
    ];
    
    // 詳細な思考プロセス情報付きで初期思考を送信
    sendAgentThoughts('Knowledge Graph Agent', '知識グラフ生成を開始します...', input.roleModelId, {
      agentType: 'knowledge-graph',
      stage: 'knowledge_graph',
      thinking: graphThinkingSteps,
      context: {
        entityCount: structureResult.data.entities?.length || 0,
        relationshipCount: structureResult.data.relationships?.length || 0,
        keywords: keywordResult.data.expandedKeywords.length
      }
    });
    
    // 進捗ステップを更新
    graphProgressSteps[0].status = 'processing';
    graphProgressSteps[0].progress = 40;
    sendProgressUpdate('エンティティ情報を準備中...', 80, input.roleModelId, {
      stage: 'knowledge_graph',
      subStage: 'entity_preparation',
      detailedProgress: graphProgressSteps
    });
    
    // もう1つの思考ステップを追加
    graphThinkingSteps.push({
      step: 'エンティティ分析',
      content: '役割モデルに関連する主要エンティティを分析し、知識グラフのノードとして適切な構造を特定します',
      timestamp: new Date().toISOString()
    });
    
    // 更新された思考プロセスを送信
    sendAgentThoughts('Knowledge Graph Agent', 'エンティティを分析中...', input.roleModelId, {
      agentType: 'knowledge-graph',
      stage: 'knowledge_graph',
      subStage: 'entity_analysis', // 型定義を更新したのでsubStageも送信可能に
      thinking: graphThinkingSteps,
      reasoning: '各エンティティの重要性と関連性を評価し、グラフの中心的要素を特定します'
    });
    
    // 知識グラフエージェントを実行
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