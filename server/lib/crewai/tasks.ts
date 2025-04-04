/**
 * CrewAIタスク定義
 * マルチエージェントのワークフローを構成するタスク
 */

import { Task, TaskOptions } from 'crewai-js';
import { Agent } from 'crewai-js';
import { RoleModelInput } from '../../agents/types';

/**
 * 業界分析タスク
 * 役割に関連する業界の詳細分析を実行
 */
export const createIndustryAnalysisTask = (input: RoleModelInput, agent: Agent): Task => {
  const taskConfig: TaskOptions = {
    description: `
      以下の役割に関連する業界の詳細分析を行ってください。
      
      役割名: ${input.roleName}
      役割の説明: ${input.description || '指定なし'}
      関連業界: ${input.industries.join(', ') || '指定なし'}
      関連キーワード: ${input.keywords.join(', ') || '指定なし'}
      
      分析すべき項目:
      1. 業界全般の重要な洞察（5-7項目）
      2. この役割が対象とする顧客や組織（3-5項目）
      3. 業界の主要なトレンド（4-6項目）
      4. 関連するビジネスモデルや収益源（3-5項目）
      5. 主な課題と機会（4-6項目）
      
      以下のJSON形式で結果を出力してください:
      {
        "industryInsights": ["洞察1", "洞察2", ...],
        "targetAudience": ["対象者1", "対象者2", ...],
        "keyTrends": ["トレンド1", "トレンド2", ...],
        "businessModels": ["モデル1", "モデル2", ...],
        "challengesOpportunities": ["項目1", "項目2", ...]
      }
      
      各項目は40-60文字程度の簡潔な日本語で記述してください。
    `,
    agent: agent,
    async_execution: false,
    expected_output: "JSON形式の業界分析データ",
  };

  return new Task(taskConfig);
};

/**
 * キーワード拡張タスク
 * 関連キーワードの拡張と関連度評価
 */
export const createKeywordExpansionTask = (
  input: RoleModelInput, 
  agent: Agent, 
  industryAnalysisOutput: string
): Task => {
  const taskConfig: TaskOptions = {
    description: `
      以下の役割と業界分析に基づいて関連キーワードを拡張してください。
      
      役割名: ${input.roleName}
      役割の説明: ${input.description || '指定なし'}
      初期キーワード: ${input.keywords.join(', ') || '指定なし'}
      
      業界分析データ:
      ${industryAnalysisOutput}
      
      この役割に関連する重要なキーワードを特定し、各キーワードの関連度（0.0～1.0）を評価してください。
      情報収集や自己成長に役立つ具体的なキーワードを優先し、初期キーワードは必ず含めてください。
      
      以下のJSON形式で結果を出力してください:
      {
        "expandedKeywords": ["キーワード1", "キーワード2", ...],
        "relevance": {
          "キーワード1": 0.95,
          "キーワード2": 0.85,
          ...
        }
      }
      
      キーワードは合計15-20個程度、各5-15文字の簡潔な日本語で記述してください。
      技術用語、ツール名、概念名など、具体的で検索可能なキーワードを含めてください。
    `,
    agent: agent,
    async_execution: false,
    expected_output: "JSON形式のキーワード拡張データ",
  };

  return new Task(taskConfig);
};

/**
 * 構造化タスク
 * 知識の階層構造を設計
 */
export const createStructuringTask = (
  input: RoleModelInput, 
  agent: Agent,
  industryAnalysisOutput: string,
  keywordExpansionOutput: string
): Task => {
  const taskConfig: TaskOptions = {
    description: `
      以下の役割、業界分析、拡張キーワードに基づいて知識の階層構造を設計してください。
      
      役割名: ${input.roleName}
      役割の説明: ${input.description || '指定なし'}
      
      業界分析データ:
      ${industryAnalysisOutput}
      
      拡張キーワードデータ:
      ${keywordExpansionOutput}
      
      この役割に必要な知識を階層的に構造化してください。ルートノード（レベル0）から始まり、
      最大3階層（レベル0～2）の構造を作成してください。各ノードには名前、説明、階層レベル、
      親ノードの情報を含めてください。
      
      以下のJSON形式で結果を出力してください:
      {
        "structure": [
          {
            "id": "root",
            "name": "${input.roleName}",
            "description": "ルートノードの説明",
            "level": 0,
            "parentId": null
          },
          {
            "id": "category1",
            "name": "カテゴリ1",
            "description": "カテゴリ1の説明",
            "level": 1,
            "parentId": "root"
          },
          ...
        ]
      }
      
      各ノードの説明は50-100文字程度の簡潔な日本語で記述してください。
      レベル1のカテゴリは4-6個、レベル2のサブカテゴリは各カテゴリに3-5個程度を目安としてください。
    `,
    agent: agent,
    async_execution: false,
    expected_output: "JSON形式の階層構造データ",
  };

  return new Task(taskConfig);
};

/**
 * 知識グラフ生成タスク
 * 最終的な知識グラフを設計
 */
export const createKnowledgeGraphTask = (
  input: RoleModelInput,
  agent: Agent,
  structureOutput: string
): Task => {
  const taskConfig: TaskOptions = {
    description: `
      以下の役割と階層構造に基づいて知識グラフを生成してください。
      
      役割名: ${input.roleName}
      役割の説明: ${input.description || '指定なし'}
      
      階層構造データ:
      ${structureOutput}
      
      上記の階層構造をベースに完全な知識グラフを設計してください。
      ノード間の関連性（エッジ）を明確にし、各ノードにタイプと色の情報を追加してください。
      
      以下のJSON形式で結果を出力してください:
      {
        "nodes": [
          {
            "id": "node1",
            "name": "ノード1",
            "description": "ノード1の説明",
            "level": 0,
            "parentId": null,
            "type": "central",
            "color": "#4285F4"
          },
          ...
        ],
        "edges": [
          {
            "source": "node1",
            "target": "node2",
            "label": "包含する",
            "strength": 0.9
          },
          ...
        ]
      }
      
      ノードタイプは central, category, subcategory, skill, concept などから適切なものを選択してください。
      エッジの強度は0.1～1.0の値で表してください。
    `,
    agent: agent,
    async_execution: false,
    expected_output: "JSON形式の知識グラフデータ",
  };

  return new Task(taskConfig);
};