/**
 * CrewAIエージェント定義
 * 複数のAIエージェントをチームとして協調させるための設定
 */

import { Agent, Crew, Task, Process } from 'crewai-js';
import { RoleModelInput } from './types';
import { IndustryAnalysisData } from './industry-analysis';
import { KeywordExpansionData } from './keyword-expansion';
import { StructuringData } from './structuring';
import { KnowledgeGraphData } from './knowledge-graph';
import { createAzureOpenAIModel } from './langchain-utils';
import { sendAgentThoughts, sendProgressUpdate } from '../websocket';

// エージェント用のモデルを作成
const azureOpenAIModel = createAzureOpenAIModel(0.7, 2000);

/**
 * 業界分析エージェントを作成
 */
export function createIndustryAnalysisAgent() {
  return new Agent({
    role: '業界分析エキスパート',
    goal: '役割モデルに関連する業界の深い洞察を提供する',
    backstory: '業界分析のスペシャリストとして、様々な産業の動向やトレンドを追跡し、戦略的な洞察を提供します。',
    llm: azureOpenAIModel,
    verbose: true
  });
}

/**
 * キーワード拡張エージェントを作成
 */
export function createKeywordExpansionAgent() {
  return new Agent({
    role: 'キーワード拡張スペシャリスト',
    goal: '役割に関連する重要なキーワードを特定し拡張する',
    backstory: '情報検索と知識マッピングの専門家として、関連性の高いキーワードのネットワークを構築することに長けています。',
    llm: azureOpenAIModel,
    verbose: true
  });
}

/**
 * 知識構造化エージェントを作成
 */
export function createStructuringAgent() {
  return new Agent({
    role: '知識体系アーキテクト',
    goal: '複雑な情報を論理的で階層的な構造に整理する',
    backstory: '知識管理と情報アーキテクチャの専門家として、散在する情報を意味のある構造に統合することに特化しています。',
    llm: azureOpenAIModel,
    verbose: true
  });
}

/**
 * 知識グラフ生成エージェントを作成
 */
export function createKnowledgeGraphAgent() {
  return new Agent({
    role: '知識グラフ生成スペシャリスト',
    goal: '知識の関係性を視覚的に表現できるグラフ構造を作成する',
    backstory: 'データビジュアライゼーションと知識表現の専門家として、複雑な情報構造をグラフとして表現することを得意としています。',
    llm: azureOpenAIModel,
    verbose: true
  });
}

/**
 * 業界分析タスクを作成
 */
export function createIndustryAnalysisTask(
  agent: Agent,
  input: RoleModelInput
) {
  return new Task({
    description: `
      以下の役割モデルについて詳細な業界分析を行ってください：
      
      役割名: ${input.roleName}
      役割の説明: ${input.description || '説明なし'}
      業界: ${input.industries.join(', ') || '指定なし'}
      キーワード: ${input.keywords.join(', ') || '指定なし'}
      
      分析結果は以下の形式でJSON出力してください：
      {
        "industryInsights": ["洞察1", "洞察2", ...],  // 業界全般の重要な洞察（5-7項目）
        "targetAudience": ["対象者1", "対象者2", ...], // この役割が対象とする顧客や組織（3-5項目）
        "keyTrends": ["トレンド1", "トレンド2", ...],  // 業界の主要なトレンド（4-6項目）
        "businessModels": ["モデル1", "モデル2", ...], // 関連するビジネスモデルや収益源（3-5項目）
        "challengesOpportunities": ["項目1", "項目2", ...] // 主な課題と機会（4-6項目）
      }
      
      各項目は40-60文字程度の具体的な記述にしてください。
    `,
    expected_output: 'JSON形式の詳細な業界分析データ',
    agent: agent
  });
}

/**
 * キーワード拡張タスクを作成
 */
export function createKeywordExpansionTask(
  agent: Agent,
  input: RoleModelInput,
  industryData: IndustryAnalysisData
) {
  // 業界分析データからコンテキストを作成
  const industryContext = `
    【業界洞察】
    ${industryData.industryInsights.map((insight, i) => `${i+1}. ${insight}`).join('\n')}
    
    【主要トレンド】
    ${industryData.keyTrends.map((trend, i) => `${i+1}. ${trend}`).join('\n')}
    
    【ターゲット対象】
    ${industryData.targetAudience.map((audience, i) => `${i+1}. ${audience}`).join('\n')}
    
    【ビジネスモデル】
    ${industryData.businessModels.map((model, i) => `${i+1}. ${model}`).join('\n')}
    
    【課題と機会】
    ${industryData.challengesOpportunities.map((item, i) => `${i+1}. ${item}`).join('\n')}
  `;

  return new Task({
    description: `
      以下の役割モデルとその業界分析結果に基づいて、関連するキーワードを拡張してください：
      
      役割名: ${input.roleName}
      役割の説明: ${input.description || '説明なし'}
      業界: ${input.industries.join(', ') || '指定なし'}
      初期キーワード: ${input.keywords.join(', ') || '指定なし'}
      
      業界分析情報:
      ${industryContext}
      
      この役割に重要と思われるキーワードを追加してください。
      本人の日々の情報収集や自己成長に役立つものを優先してください。
      入力キーワードは最重要キーワードとして必ず含めてください。
      
      以下の形式でJSON出力してください：
      {
        "expandedKeywords": ["キーワード1", "キーワード2", ...],  // オリジナルのキーワードを含め、合計15-20個程度
        "relevance": {
          "キーワード1": 0.95,  // 関連度（0.0-1.0）
          "キーワード2": 0.85,
          ...
        }
      }
      
      キーワードは短く具体的（5-15文字程度）で検索可能なものにしてください。
      技術用語、ツール名、概念名など具体的なキーワードを重視してください。
    `,
    expected_output: 'JSON形式の拡張キーワードと関連度データ',
    agent: agent,
    context: [
      { role: 'industry_analysis', content: JSON.stringify(industryData, null, 2) }
    ]
  });
}

/**
 * 知識構造化タスクを作成
 */
export function createStructuringTask(
  agent: Agent,
  input: RoleModelInput,
  industryData: IndustryAnalysisData,
  keywordData: KeywordExpansionData
) {
  return new Task({
    description: `
      以下の役割モデル、業界分析結果、キーワードに基づいて、階層的な知識構造を生成してください：
      
      役割名: ${input.roleName}
      役割の説明: ${input.description || '説明なし'}
      業界: ${input.industries.join(', ') || '指定なし'}
      
      キーワード（重要度順）:
      ${keywordData.expandedKeywords.map(kw => 
        `- ${kw} (関連度: ${keywordData.relevance[kw] || 0})`
      ).join('\n')}
      
      業界分析:
      ${JSON.stringify(industryData, null, 2)}
      
      この役割モデルに必要な知識・スキルを階層的に整理してください。
      中心的なコンセプトを頂点として、複数のメインカテゴリに分類し、
      各カテゴリはサブカテゴリと具体的なスキルに展開します。
      
      以下の形式でJSON出力してください：
      {
        "centralConcept": "中心となるコンセプト/テーマ",
        "mainCategories": [
          {
            "name": "カテゴリ名",
            "description": "カテゴリの説明",
            "subcategories": [
              {
                "name": "サブカテゴリ名",
                "description": "サブカテゴリの説明",
                "skills": [
                  {
                    "name": "スキル名",
                    "description": "スキルの説明"
                  },
                  ...
                ]
              },
              ...
            ]
          },
          ...
        ]
      }
    `,
    expected_output: 'JSON形式の階層的な知識構造データ',
    agent: agent,
    context: [
      { role: 'industry_analysis', content: JSON.stringify(industryData, null, 2) },
      { role: 'keywords', content: JSON.stringify(keywordData, null, 2) }
    ]
  });
}

/**
 * 知識グラフ生成タスクを作成
 */
export function createKnowledgeGraphTask(
  agent: Agent,
  input: RoleModelInput,
  structuringData: StructuringData
) {
  return new Task({
    description: `
      以下の役割モデルと知識構造に基づいて、ノードとエッジで構成される知識グラフを生成してください：
      
      役割名: ${input.roleName}
      役割の説明: ${input.description || '説明なし'}
      
      知識構造:
      ${JSON.stringify(structuringData, null, 2)}
      
      以下の形式でJSON出力してください：
      {
        "nodes": [
          {
            "id": "一意のID（文字列）",
            "name": "ノード名",
            "description": "ノードの説明",
            "level": 数値（階層レベル: 0=中心、1=メインカテゴリ、2=サブカテゴリ、3=スキル）,
            "type": "ノードタイプ（central、category、subcategory、skill）",
            "color": "ノードの色（カラーコード）"
          },
          ...
        ],
        "edges": [
          {
            "source": "始点ノードID",
            "target": "終点ノードID",
            "label": "関係性の説明（オプション）"
          },
          ...
        ]
      }
      
      知識グラフ生成の留意点:
      1. 中心的コンセプトをルートノード（level=0）として配置
      2. メインカテゴリをレベル1に配置し、中心ノードと接続
      3. サブカテゴリをレベル2に配置し、対応するメインカテゴリと接続
      4. スキルをレベル3に配置し、対応するサブカテゴリと接続
      5. ノードIDは一意の文字列（例: "node-1", "category-finance"など）
      6. 視覚的区別のためノードタイプに応じた色を設定
    `,
    expected_output: 'JSON形式の知識グラフデータ（ノードとエッジの配列）',
    agent: agent,
    context: [
      { role: 'knowledge_structure', content: JSON.stringify(structuringData, null, 2) }
    ]
  });
}

/**
 * エージェントクルー（チーム）を作成
 * @param input 役割モデル入力データ
 * @param websocketHandler WebSocket経由の進捗通知ハンドラ
 */
export async function runKnowledgeGraphCrew(
  input: RoleModelInput
): Promise<{
  success: boolean;
  industryData?: IndustryAnalysisData;
  keywordData?: KeywordExpansionData;
  structuringData?: StructuringData;
  graphData?: KnowledgeGraphData;
  error?: string;
}> {
  try {
    // WebSocketで開始通知
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        'オーケストレーション',
        10,
        { stage: '初期化', message: 'AIエージェントチームを初期化中...' }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'オーケストレーター',
        `知識グラフ生成プロセスを開始します...\n役割: ${input.roleName}\n業界: ${input.industries.join(', ') || '指定なし'}\n\nマルチAIエージェントチームを編成しています。`
      );
    }

    // エージェントの作成
    const industryAnalysisAgent = createIndustryAnalysisAgent();
    const keywordExpansionAgent = createKeywordExpansionAgent();
    const structuringAgent = createStructuringAgent();
    const knowledgeGraphAgent = createKnowledgeGraphAgent();
    
    // 業界分析タスクの実行
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        'オーケストレーション',
        20,
        { stage: '業界分析', message: '業界分析エージェントが分析中...' }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'オーケストレーター',
        `業界分析エージェントにタスクを割り当てています...\n分析対象業界: ${input.industries.join(', ') || '指定なし'}`
      );
    }
    
    const industryAnalysisTask = createIndustryAnalysisTask(industryAnalysisAgent, input);
    const industryAnalysisResult = await industryAnalysisTask.execute();
    
    // 結果をJSONに変換
    let industryData: IndustryAnalysisData;
    try {
      // JSONを抽出して解析
      const jsonMatch = industryAnalysisResult.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : industryAnalysisResult;
      industryData = JSON.parse(jsonStr);
      
      // 必須フィールドの検証とデフォルト値の設定
      industryData.industryInsights = Array.isArray(industryData.industryInsights) 
        ? industryData.industryInsights 
        : [];
      industryData.targetAudience = Array.isArray(industryData.targetAudience) 
        ? industryData.targetAudience 
        : [];
      industryData.keyTrends = Array.isArray(industryData.keyTrends) 
        ? industryData.keyTrends 
        : [];
      industryData.businessModels = Array.isArray(industryData.businessModels) 
        ? industryData.businessModels 
        : [];
      industryData.challengesOpportunities = Array.isArray(industryData.challengesOpportunities) 
        ? industryData.challengesOpportunities 
        : [];
    } catch (error) {
      console.error('業界分析データの解析に失敗:', error);
      if (input.userId && input.roleModelId) {
        sendAgentThoughts(
          input.userId,
          input.roleModelId,
          'オーケストレーター',
          `業界分析データの解析中にエラーが発生しました。デフォルトデータを使用します。\nエラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      
      // デフォルトの業界データを作成
      industryData = {
        industryInsights: ['業界の動向を継続的に監視することが重要'],
        targetAudience: ['関連する組織と専門家'],
        keyTrends: ['最新の技術動向と市場の変化'],
        businessModels: ['一般的なビジネスモデル'],
        challengesOpportunities: ['変化する市場での機会と課題']
      };
    }
    
    // WebSocket通知
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        'オーケストレーション',
        35,
        { stage: 'キーワード拡張', message: 'キーワード拡張エージェントが処理中...' }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'オーケストレーター',
        `業界分析が完了しました。\n\n主な洞察: ${industryData.industryInsights.slice(0, 2).join('、')}\n\n次に、キーワード拡張エージェントにタスクを割り当てています...`
      );
    }
    
    // キーワード拡張タスクの実行
    const keywordExpansionTask = createKeywordExpansionTask(keywordExpansionAgent, input, industryData);
    const keywordExpansionResult = await keywordExpansionTask.execute();
    
    // 結果をJSONに変換
    let keywordData: KeywordExpansionData;
    try {
      // JSONを抽出して解析
      const jsonMatch = keywordExpansionResult.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : keywordExpansionResult;
      keywordData = JSON.parse(jsonStr);
      
      // 必須フィールドの検証とデフォルト値の設定
      keywordData.expandedKeywords = Array.isArray(keywordData.expandedKeywords) 
        ? keywordData.expandedKeywords 
        : [...input.keywords];
      if (!keywordData.relevance || typeof keywordData.relevance !== 'object') {
        keywordData.relevance = {};
        keywordData.expandedKeywords.forEach(kw => {
          keywordData.relevance[kw] = input.keywords.includes(kw) ? 1.0 : 0.8;
        });
      }
      
      // 元のキーワードが含まれていることを確認
      input.keywords.forEach(kw => {
        if (!keywordData.expandedKeywords.includes(kw)) {
          keywordData.expandedKeywords.unshift(kw);
          keywordData.relevance[kw] = 1.0;
        }
      });
    } catch (error) {
      console.error('キーワード拡張データの解析に失敗:', error);
      if (input.userId && input.roleModelId) {
        sendAgentThoughts(
          input.userId,
          input.roleModelId,
          'オーケストレーター',
          `キーワード拡張データの解析中にエラーが発生しました。元のキーワードのみを使用します。\nエラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      
      // デフォルトのキーワードデータを作成
      keywordData = {
        expandedKeywords: [...input.keywords],
        relevance: {}
      };
      input.keywords.forEach(kw => {
        keywordData.relevance[kw] = 1.0;
      });
    }
    
    // WebSocket通知
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        'オーケストレーション',
        50,
        { stage: '知識構造化', message: '知識構造化エージェントが処理中...' }
      );
      
      // 新しく追加されたキーワードのサンプルを表示
      const newKeywords = keywordData.expandedKeywords
        .filter(kw => !input.keywords.includes(kw))
        .slice(0, 5);
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'オーケストレーター',
        `キーワード拡張が完了しました。\n\n拡張後キーワード数: ${keywordData.expandedKeywords.length}\n追加キーワード例: ${newKeywords.join('、')}\n\n次に、知識構造化エージェントにタスクを割り当てています...`
      );
    }
    
    // 知識構造化タスクの実行
    const structuringTask = createStructuringTask(structuringAgent, input, industryData, keywordData);
    const structuringResult = await structuringTask.execute();
    
    // 結果をJSONに変換
    let structuringData: StructuringData;
    try {
      // JSONを抽出して解析
      const jsonMatch = structuringResult.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : structuringResult;
      structuringData = JSON.parse(jsonStr);
      
      // 必須フィールドの検証
      if (!structuringData.centralConcept) {
        structuringData.centralConcept = input.roleName;
      }
      if (!Array.isArray(structuringData.mainCategories)) {
        structuringData.mainCategories = [];
      }
      
      // カテゴリがない場合はデフォルトを作成
      if (structuringData.mainCategories.length === 0) {
        structuringData.mainCategories = [
          {
            name: '技術スキル',
            description: '役割に必要な技術的能力',
            subcategories: [
              {
                name: '基本スキル',
                description: '基礎となる技術スキル',
                skills: [
                  { name: 'スキル1', description: '基本的なスキル' }
                ]
              }
            ]
          }
        ];
      }
      
      // サブカテゴリとスキルの検証
      structuringData.mainCategories.forEach(category => {
        if (!Array.isArray(category.subcategories)) {
          category.subcategories = [];
        }
        
        category.subcategories.forEach(subcategory => {
          if (!Array.isArray(subcategory.skills)) {
            subcategory.skills = [];
          }
        });
      });
    } catch (error) {
      console.error('知識構造化データの解析に失敗:', error);
      if (input.userId && input.roleModelId) {
        sendAgentThoughts(
          input.userId,
          input.roleModelId,
          'オーケストレーター',
          `知識構造化データの解析中にエラーが発生しました。デフォルト構造を使用します。\nエラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      
      // デフォルトの構造データを作成
      structuringData = {
        centralConcept: input.roleName,
        mainCategories: [
          {
            name: '技術スキル',
            description: '役割に必要な技術的能力',
            subcategories: [
              {
                name: '基本スキル',
                description: '基礎となる技術スキル',
                skills: [
                  { name: input.keywords[0] || 'スキル1', description: '基本的なスキル' }
                ]
              }
            ]
          },
          {
            name: 'ドメイン知識',
            description: '業界に関する専門知識',
            subcategories: [
              {
                name: '業界理解',
                description: '業界の基本的理解',
                skills: [
                  { name: industryData.keyTrends[0] || 'トレンド1', description: '重要なトレンド' }
                ]
              }
            ]
          }
        ]
      };
    }
    
    // WebSocket通知
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        'オーケストレーション',
        75,
        { stage: '知識グラフ生成', message: '知識グラフ生成エージェントが処理中...' }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'オーケストレーター',
        `知識構造化が完了しました。\n\n中心コンセプト: ${structuringData.centralConcept}\nメインカテゴリ: ${structuringData.mainCategories.map(cat => cat.name).join('、')}\n\n最後に、知識グラフ生成エージェントにタスクを割り当てています...`
      );
    }
    
    // 知識グラフ生成タスクの実行
    const knowledgeGraphTask = createKnowledgeGraphTask(knowledgeGraphAgent, input, structuringData);
    const knowledgeGraphResult = await knowledgeGraphTask.execute();
    
    // 結果をJSONに変換
    let graphData: KnowledgeGraphData;
    try {
      // JSONを抽出して解析
      const jsonMatch = knowledgeGraphResult.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : knowledgeGraphResult;
      graphData = JSON.parse(jsonStr);
      
      // 必須フィールドの検証
      if (!Array.isArray(graphData.nodes)) {
        graphData.nodes = [];
      }
      if (!Array.isArray(graphData.edges)) {
        graphData.edges = [];
      }
      
      // ノードが空の場合はデフォルトを作成
      if (graphData.nodes.length === 0) {
        // 中心ノード
        const centralId = 'central-1';
        graphData.nodes.push({
          id: centralId,
          name: structuringData.centralConcept,
          description: `${input.roleName}の中心的概念`,
          level: 0,
          type: 'central',
          color: '#FF6B6B'
        });
        
        // メインカテゴリ
        structuringData.mainCategories.forEach((category, catIdx) => {
          const categoryId = `category-${catIdx + 1}`;
          graphData.nodes.push({
            id: categoryId,
            name: category.name,
            description: category.description,
            level: 1,
            type: 'category',
            color: '#4ECDC4'
          });
          
          // 中心とカテゴリを接続
          graphData.edges.push({
            source: centralId,
            target: categoryId
          });
          
          // サブカテゴリ
          category.subcategories.forEach((subcat, subcatIdx) => {
            const subcategoryId = `subcategory-${catIdx + 1}-${subcatIdx + 1}`;
            graphData.nodes.push({
              id: subcategoryId,
              name: subcat.name,
              description: subcat.description,
              level: 2,
              type: 'subcategory',
              color: '#F7FFF7'
            });
            
            // カテゴリとサブカテゴリを接続
            graphData.edges.push({
              source: categoryId,
              target: subcategoryId
            });
            
            // スキル
            subcat.skills.forEach((skill, skillIdx) => {
              const skillId = `skill-${catIdx + 1}-${subcatIdx + 1}-${skillIdx + 1}`;
              graphData.nodes.push({
                id: skillId,
                name: skill.name,
                description: skill.description,
                level: 3,
                type: 'skill',
                color: '#FFE66D'
              });
              
              // サブカテゴリとスキルを接続
              graphData.edges.push({
                source: subcategoryId,
                target: skillId
              });
            });
          });
        });
      }
    } catch (error) {
      console.error('知識グラフデータの解析に失敗:', error);
      if (input.userId && input.roleModelId) {
        sendAgentThoughts(
          input.userId,
          input.roleModelId,
          'オーケストレーター',
          `知識グラフデータの解析中にエラーが発生しました。デフォルトグラフを使用します。\nエラー: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      
      // デフォルトのグラフデータを作成
      graphData = { nodes: [], edges: [] };
      
      // 中心ノード
      const centralId = 'central-1';
      graphData.nodes.push({
        id: centralId,
        name: input.roleName,
        description: `${input.roleName}の中心的概念`,
        level: 0,
        type: 'central',
        color: '#FF6B6B'
      });
      
      // 基本カテゴリ
      const categories = ['技術スキル', 'ドメイン知識', 'ソフトスキル'];
      categories.forEach((catName, idx) => {
        const catId = `category-${idx + 1}`;
        graphData.nodes.push({
          id: catId,
          name: catName,
          description: `${catName}に関する能力`,
          level: 1,
          type: 'category',
          color: '#4ECDC4'
        });
        
        graphData.edges.push({
          source: centralId,
          target: catId
        });
        
        // 各カテゴリに基本ノードを追加
        const subId = `subcategory-${idx + 1}-1`;
        graphData.nodes.push({
          id: subId,
          name: `基本${catName}`,
          description: `基本的な${catName}`,
          level: 2,
          type: 'subcategory',
          color: '#F7FFF7'
        });
        
        graphData.edges.push({
          source: catId,
          target: subId
        });
      });
    }
    
    // WebSocket通知
    if (input.userId && input.roleModelId) {
      sendProgressUpdate(
        input.userId,
        input.roleModelId,
        'オーケストレーション',
        100,
        { 
          stage: '完了', 
          counts: {
            nodes: graphData.nodes.length,
            edges: graphData.edges.length
          }
        }
      );
      
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'オーケストレーター',
        `知識グラフ生成が完了しました。\n\nノード数: ${graphData.nodes.length}\nエッジ数: ${graphData.edges.length}\n\n全てのAIエージェントのタスクが正常に完了しました。データベースに保存しています...`
      );
    }
    
    return {
      success: true,
      industryData,
      keywordData,
      structuringData,
      graphData
    };
  } catch (error) {
    console.error('知識グラフ生成クルーの実行中にエラーが発生しました:', error);
    
    // WebSocketでエラー通知
    if (input.userId && input.roleModelId) {
      sendAgentThoughts(
        input.userId,
        input.roleModelId,
        'オーケストレーター',
        `エラーが発生しました。処理を中断します。\nエラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '知識グラフ生成中に不明なエラーが発生しました'
    };
  }
}