/**
 * AI/LLMサービスの実装
 * 各エージェントのツールが利用する関数群
 */
import { ChatOpenAI } from '@langchain/openai';
import { CacheClient } from './cache-client';

// キャッシュクライアントのインスタンス
const cacheClient = new CacheClient();

// OpenAIモデルの初期化
const model = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.7,
});

// モデルに対する基本的なプロンプト処理
async function processPrompt(prompt: string, temperature: number = 0.7) {
  try {
    // キャッシュからの取得を試みる
    const cachedResult = await cacheClient.get(prompt);
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }

    // モデルにプロンプトを送信し、応答を取得
    const response = await model.invoke(prompt);
    
    // ChatOpenAIの応答からテキスト部分を抽出
    let responseText = '';
    
    // ChatOpenAIからの応答を文字列に変換
    if (typeof response === 'string') {
      responseText = response;
    } else if (response && typeof response === 'object') {
      // 'content'プロパティが存在する場合（ChatOpenAIの新しいバージョン）
      if ('content' in response) {
        const content = response.content;
        if (typeof content === 'string') {
          responseText = content;
        } else if (Array.isArray(content)) {
          // 各要素を安全に文字列に変換して結合
          responseText = content
            .map(item => {
              if (typeof item === 'string') return item;
              // オブジェクトの場合はJSONに変換して返す
              if (item && typeof item === 'object') {
                if ('text' in item && typeof item.text === 'string') {
                  return item.text;
                }
                // いずれにも当てはまらない場合は空文字を返す
                return JSON.stringify(item);
              }
              return '';
            })
            .join('');
        }
      } else if ('text' in response && typeof response.text === 'string') {
        // 'text'プロパティが存在する場合（古いバージョン）
        responseText = response.text;
      } else {
        // その他の場合はオブジェクト全体を文字列化
        responseText = JSON.stringify(response);
      }
    } else {
      // それ以外の場合は空文字列
      responseText = '';
    }
    
    let result;
    try {
      // JSON形式の場合はパース
      result = JSON.parse(responseText);
    } catch (e) {
      // テキスト形式の場合はそのまま使用
      result = { text: responseText };
    }
    
    // 結果をキャッシュに保存
    await cacheClient.set(prompt, JSON.stringify(result));
    
    return result;
  } catch (error: any) {
    console.error('AIサービス呼び出しエラー:', error);
    throw new Error(`モデル呼び出し中にエラーが発生しました: ${error.message}`);
  }
}

// --------- ドメインアナリスト関連の関数 ---------

/**
 * 業界とキーワードから関連キーワードを取得
 */
export async function getIndustryKeywords(industry: string, keywords: string[]) {
  const prompt = `
    あなたは${industry}業界の専門家です。
    以下のキーワードに関連する重要なキーワードを10個生成してください。
    各キーワードには、関連度スコア(0-1)と簡単な説明を付けてください。
    
    キーワード: ${keywords.join(', ')}
    
    JSONフォーマットで回答してください:
    [
      {
        "keyword": "キーワード1",
        "relevanceScore": 0.95,
        "description": "このキーワードの説明"
      },
      ...
    ]
  `;
  
  return await processPrompt(prompt);
}

/**
 * キーワード間の意味的関連度を分析
 */
export async function analyzeSimilarity(sourceKeyword: string, targetKeyword: string) {
  const prompt = `
    以下の2つのキーワード間の意味的関連度を0から1の数値で評価し、
    その関係性を簡潔に説明してください。
    
    ソースキーワード: ${sourceKeyword}
    ターゲットキーワード: ${targetKeyword}
    
    JSONフォーマットで回答してください:
    {
      "score": 0.75,
      "relationship": "関係性の説明"
    }
  `;
  
  return await processPrompt(prompt);
}

/**
 * キーワードを階層的な構造に分類整理
 */
export async function categorizeKeywords(keywords: string[], industry: string) {
  const prompt = `
    あなたは${industry}業界の情報整理の専門家です。
    以下のキーワードリストを階層的カテゴリに分類してください。
    
    キーワード: ${keywords.join(', ')}
    
    JSONフォーマットで回答してください:
    {
      "categories": [
        {
          "name": "カテゴリ1",
          "subcategories": [
            {
              "name": "サブカテゴリ1",
              "keywords": ["キーワード1", "キーワード2"]
            },
            ...
          ]
        },
        ...
      ]
    }
  `;
  
  return await processPrompt(prompt);
}

// --------- トレンドリサーチャー関連の関数 ---------

/**
 * 情報源の品質評価
 */
export async function evaluateSourceQuality(sourceName: string, sourceUrl: string, industry: string) {
  const prompt = `
    あなたは情報品質評価の専門家です。
    以下の情報源について、${industry}業界の情報収集の観点から品質を評価してください。
    
    情報源名: ${sourceName}
    URL: ${sourceUrl}
    
    JSONフォーマットで回答してください:
    {
      "score": 0.85,
      "reliability": 0.9,
      "expertise": 0.8,
      "freshness": 0.85,
      "recommendation": "この情報源の利用に関する推奨事項"
    }
  `;
  
  return await processPrompt(prompt);
}

/**
 * 業界のトレンド予測
 */
export async function predictIndustryTrends(industry: string, keywords: string[], timeframe: string) {
  const prompt = `
    あなたは${industry}業界のトレンド予測専門家です。
    以下のキーワードに関連する${timeframe}における業界トレンドを予測してください。
    
    キーワード: ${keywords.join(', ')}
    
    JSONフォーマットで回答してください:
    {
      "emergingTrends": [
        {
          "trend": "台頭するトレンド1",
          "impact": "影響度の説明",
          "confidence": 0.8
        },
        ...
      ],
      "decliningTrends": [
        {
          "trend": "衰退するトレンド1",
          "reason": "衰退理由",
          "confidence": 0.7
        },
        ...
      ],
      "keyInfluencers": ["影響力のある要因1", "影響力のある要因2", ...],
      "confidence": 0.75
    }
  `;
  
  return await processPrompt(prompt);
}

/**
 * 情報源のデータ形式を解析
 */
export async function analyzeDataFormats(sourceUrl: string, dataType: string) {
  const prompt = `
    あなたはデータ分析の専門家です。
    以下の情報源から${dataType}のデータを抽出する最適な方法を提案してください。
    
    情報源URL: ${sourceUrl}
    データタイプ: ${dataType}
    
    JSONフォーマットで回答してください:
    {
      "formatType": "データ形式 (JSON/XML/HTML/テキスト等)",
      "complexity": "構造の複雑さ (低/中/高)",
      "extractionMethod": "抽出方法の詳細",
      "parsingRecommendation": "パース方法の推奨",
      "sampleData": "サンプルデータ構造"
    }
  `;
  
  return await processPrompt(prompt);
}

// --------- コンテキストマッパー関連の関数 ---------

/**
 * ナレッジグラフの構造最適化
 */
export async function optimizeGraphStructure(nodes: any[], edges: any[], focusKeywords: string[]) {
  const prompt = `
    あなたはナレッジグラフ最適化の専門家です。
    以下のノードとエッジで構成されるグラフを、
    特に「${focusKeywords.join(', ')}」に焦点を当てて最適化してください。
    
    ノード数: ${nodes.length}
    エッジ数: ${edges.length}
    
    JSONフォーマットで回答してください:
    {
      "nodes": [...],
      "edges": [...],
      "centralNodes": ["中心的なノード1", ...],
      "clusters": [
        {
          "name": "クラスタ1",
          "nodes": ["ノード1", ...]
        },
        ...
      ],
      "score": 0.85
    }
  `;
  
  return await processPrompt(prompt);
}

/**
 * ノード間の関係性抽出
 */
export async function extractRelationships(sourceNode: string, targetNode: string, industryContext: string) {
  const prompt = `
    あなたは${industryContext}業界の関係性分析専門家です。
    以下の2つのノード間の関係性を詳細に分析してください。
    
    ソースノード: ${sourceNode}
    ターゲットノード: ${targetNode}
    
    JSONフォーマットで回答してください:
    {
      "type": "関係性の種類",
      "strength": 0.8,
      "directionality": "一方向/双方向",
      "description": "関係性の詳細説明",
      "examples": ["具体例1", "具体例2", ...]
    }
  `;
  
  return await processPrompt(prompt);
}

/**
 * グラフ内の冗長性検出
 */
export async function detectRedundancy(nodes: any[], edges: any[], similarityThreshold: number) {
  const prompt = `
    あなたはナレッジグラフ品質管理の専門家です。
    以下のノードとエッジで構成されるグラフ内の冗長性を検出してください。
    類似度閾値: ${similarityThreshold}
    
    ノード数: ${nodes.length}
    エッジ数: ${edges.length}
    
    JSONフォーマットで回答してください:
    {
      "redundantNodes": ["重複ノード1", ...],
      "similarNodeClusters": [
        ["類似ノード1", "類似ノード2", ...],
        ...
      ],
      "mergeRecommendations": [
        {
          "newNode": "新ノード名",
          "sourceNodes": ["統合元ノード1", ...]
        },
        ...
      ],
      "pruningRecommendations": ["削除推奨ノード1", ...]
    }
  `;
  
  return await processPrompt(prompt);
}

// --------- プランストラテジスト関連の関数 ---------

/**
 * 情報収集プランの生成
 */
export async function generateCollectionPlan(keywords: string[], industries: string[], sources: string[], timeframe: string) {
  const prompt = `
    あなたは情報収集戦略の専門家です。
    以下の条件に基づいて、最適な情報収集プランを策定してください。
    
    キーワード: ${keywords.join(', ')}
    対象業界: ${industries.join(', ')}
    情報源候補: ${sources.join(', ')}
    期間: ${timeframe}
    
    JSONフォーマットで回答してください:
    {
      "name": "プラン名",
      "description": "プラン概要",
      "keyAreas": ["重点領域1", ...],
      "prioritizedKeywords": [
        {
          "keyword": "重要キーワード1",
          "priority": 0.9,
          "justification": "優先度の根拠"
        },
        ...
      ],
      "recommendedSources": [
        {
          "source": "推奨情報源1",
          "relevance": 0.85,
          "targetKeywords": ["関連キーワード1", ...]
        },
        ...
      ],
      "frequency": "収集頻度",
      "expectedOutcomes": ["期待される成果1", ...],
      "evaluationCriteria": ["評価基準1", ...]
    }
  `;
  
  return await processPrompt(prompt);
}

/**
 * 情報の価値評価
 */
export async function evaluateInformationValue(informationItem: string, context: string, existingKnowledge: string) {
  const prompt = `
    あなたは情報価値評価の専門家です。
    以下の情報項目の価値を評価してください。
    
    情報項目: ${informationItem}
    コンテキスト: ${context}
    既存知識: ${existingKnowledge}
    
    JSONフォーマットで回答してください:
    {
      "novelty": 0.8,
      "relevance": 0.9,
      "impact": 0.75,
      "credibility": 0.85,
      "overallValue": 0.82,
      "priority": "高/中/低",
      "justification": "評価理由の詳細説明"
    }
  `;
  
  return await processPrompt(prompt);
}

/**
 * 効率的な情報収集スケジュールの設計
 */
export async function optimizeCollectionSchedule(sources: string[], priorities: any[], constraints: string[], frequency: string) {
  const prompt = `
    あなたは情報収集最適化の専門家です。
    以下の条件に基づいて、効率的な情報収集スケジュールを設計してください。
    
    情報源: ${sources.join(', ')}
    優先事項: ${JSON.stringify(priorities)}
    制約条件: ${constraints.join(', ')}
    基本頻度: ${frequency}
    
    JSONフォーマットで回答してください:
    {
      "overview": "スケジュール概要",
      "sourceSchedules": [
        {
          "source": "情報源1",
          "frequency": "収集頻度",
          "timing": "実行タイミング",
          "priority": "優先度"
        },
        ...
      ],
      "resourceAllocation": {
        "timeAllocation": "時間配分",
        "toolsRequired": ["必要ツール1", ...]
      },
      "priorityAdjustments": "優先度調整ロジック",
      "automationRecommendations": ["自動化推奨事項1", ...],
      "frequencyJustification": "頻度設定の根拠"
    }
  `;
  
  return await processPrompt(prompt);
}

// --------- クリティカルシンカー関連の関数 ---------

/**
 * プランとグラフの一貫性検証
 */
export async function verifyConsistency(plan: any, knowledgeGraph: any, requirements: string[]) {
  const prompt = `
    あなたは情報整合性検証の専門家です。
    以下の情報収集プランとナレッジグラフの一貫性を検証してください。
    
    プラン概要: ${JSON.stringify(plan)}
    グラフ情報: ノード数=${knowledgeGraph.nodes?.length}、エッジ数=${knowledgeGraph.edges?.length}
    要件: ${requirements.join(', ')}
    
    JSONフォーマットで回答してください:
    {
      "overallScore": 0.85,
      "alignmentScore": 0.8,
      "contradictions": [
        {
          "description": "矛盾点1",
          "severity": "高/中/低"
        },
        ...
      ],
      "gaps": [
        {
          "description": "欠落点1",
          "impact": "影響度の説明"
        },
        ...
      ],
      "requirementsFulfillment": [
        {
          "requirement": "要件1",
          "fulfilled": true/false,
          "comments": "コメント"
        },
        ...
      ],
      "recommendedAdjustments": ["調整推奨事項1", ...]
    }
  `;
  
  return await processPrompt(prompt);
}

/**
 * 情報収集の空白領域分析
 */
export async function analyzeInformationGaps(currentPlan: any, industryBenchmarks: string[], companyNeeds: string[]) {
  const prompt = `
    あなたは情報ギャップ分析の専門家です。
    以下の現在の情報収集プランにおける空白領域を特定してください。
    
    現プラン: ${JSON.stringify(currentPlan)}
    業界ベンチマーク: ${industryBenchmarks.join(', ')}
    企業ニーズ: ${companyNeeds.join(', ')}
    
    JSONフォーマットで回答してください:
    {
      "gaps": [
        {
          "area": "空白領域1",
          "description": "詳細説明",
          "impact": "影響度"
        },
        ...
      ],
      "criticalOmissions": ["重大な見落とし1", ...],
      "unexploredAreas": ["未探索領域1", ...],
      "competitiveDisadvantages": ["競争上の不利点1", ...],
      "importanceRanking": [
        {
          "gap": "空白領域1",
          "importance": 0.9,
          "urgency": "高/中/低"
        },
        ...
      ],
      "remediationSuggestions": [
        {
          "gap": "空白領域1",
          "suggestion": "対策案",
          "effort": "必要な労力"
        },
        ...
      ]
    }
  `;
  
  return await processPrompt(prompt);
}

/**
 * プラン採用理由の論理的説明生成
 */
export async function generateExplanation(plan: any, alternativesConsidered: string[], decisionCriteria: string[]) {
  const prompt = `
    あなたは意思決定説明の専門家です。
    以下の情報収集プラン採用理由を論理的に説明してください。
    
    採用プラン: ${JSON.stringify(plan)}
    検討した代替案: ${alternativesConsidered.join(', ')}
    決定基準: ${decisionCriteria.join(', ')}
    
    JSONフォーマットで回答してください:
    {
      "summary": "端的な説明",
      "rationale": "採用理由の詳細",
      "alternativesAnalysis": [
        {
          "alternative": "代替案1",
          "strengths": ["強み1", ...],
          "weaknesses": ["弱み1", ...],
          "whyRejected": "不採用理由"
        },
        ...
      ],
      "tradeoffs": ["トレードオフ1", ...],
      "benefits": ["期待されるメリット1", ...],
      "risks": ["想定されるリスク1", ...],
      "mitigationStrategies": ["リスク軽減策1", ...]
    }
  `;
  
  return await processPrompt(prompt);
}