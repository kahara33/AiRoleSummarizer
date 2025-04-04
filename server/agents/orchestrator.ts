// オーケストレーターエージェント
import { AgentResult, RoleModelInput, KnowledgeGraphData } from './types';
import { analyzeIndustries } from './industry-analysis';
import { expandKeywords } from './keyword-expansion';
import { structureKnowledge } from './structuring';
import { generateKnowledgeGraph } from './knowledge-graph';
import { callAzureOpenAI } from '../azure-openai';

/**
 * オーケストレーターエージェント
 * 各AIエージェントの連携とプロセスの調整を担当
 */
export async function orchestrator(
  input: RoleModelInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    console.log(`Orchestrator started for role model: ${input.roleName}`);
    console.log(`Industries: ${input.industries.join(', ')}`);
    console.log(`Keywords: ${input.keywords.join(', ')}`);
    
    // 1. 業界分析エージェントを実行
    const industryAnalysisResult = await analyzeIndustries(input);
    if (!industryAnalysisResult.success) {
      return {
        success: false,
        error: `Industry analysis failed: ${industryAnalysisResult.error}`
      };
    }
    
    console.log('Industry analysis completed successfully');
    
    // 2. キーワード拡張エージェントを実行
    const keywordExpansionResult = await expandKeywords(
      input,
      industryAnalysisResult.data || {
        industryInsights: [],
        targetAudience: [],
        keyTrends: [],
        businessModels: [],
        challengesOpportunities: []
      }
    );
    if (!keywordExpansionResult.success) {
      return {
        success: false,
        error: `Keyword expansion failed: ${keywordExpansionResult.error}`
      };
    }
    
    console.log('Keyword expansion completed successfully');
    
    // 3. 知識構造化エージェントを実行
    const structuringResult = await structureKnowledge(
      input,
      industryAnalysisResult.data || {
        industryInsights: [],
        targetAudience: [],
        keyTrends: [],
        businessModels: [],
        challengesOpportunities: []
      },
      keywordExpansionResult.data || {
        expandedKeywords: [],
        relevance: {}
      }
    );
    if (!structuringResult.success) {
      return {
        success: false,
        error: `Knowledge structuring failed: ${structuringResult.error}`
      };
    }
    
    console.log('Knowledge structuring completed successfully');
    
    // 4. 知識グラフ生成エージェントを実行
    const graphResult = await generateKnowledgeGraph(
      input,
      structuringResult.data || {
        hierarchicalCategories: []
      }
    );
    
    if (!graphResult.success) {
      return {
        success: false,
        error: `Knowledge graph generation failed: ${graphResult.error}`
      };
    }
    
    console.log('Knowledge graph generation completed successfully');
    
    // 5. 最終結果を返す
    return {
      success: true,
      data: graphResult.data
    };
  } catch (error) {
    console.error('Error in orchestrator:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in orchestrator'
    };
  }
}

/**
 * フォールバック: Azure OpenAIを直接使用して単純な知識グラフを生成
 */
export async function fallbackGraphGeneration(
  input: RoleModelInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    // プロンプトを生成
    const prompt = [
      {
        role: "system",
        content: `You are an AI expert in knowledge graphs and business domain expertise. 
                  Create a knowledge graph structure for the specific role and industries provided.
                  The response should be a valid JSON object with nodes and edges arrays.`
      },
      {
        role: "user",
        content: `Create a knowledge graph for a role model with the following details:
                  - Role name: ${input.roleName}
                  - Description: ${input.description}
                  - Industries: ${input.industries.join(', ')}
                  - Keywords: ${input.keywords.join(', ')}
                  
                  Return a JSON object with the following structure:
                  {
                    "nodes": [
                      {
                        "id": "unique-id-string", 
                        "name": "Node name",
                        "level": 0, // 0 for root, 1 for first level, etc.
                        "type": "default", // or any other type
                        "parentId": "parent-id-or-null-for-root",
                        "description": "Node description",
                        "color": "#hex-color-code"
                      },
                      ...
                    ],
                    "edges": [
                      {
                        "source": "source-node-id",
                        "target": "target-node-id",
                        "label": "optional label",
                        "strength": 1 // 1-5 scale for edge weight
                      },
                      ...
                    ]
                  }
                  
                  Rules:
                  - Create at least 5-10 nodes with meaningful hierarchy
                  - The root node should have level 0 and parentId null
                  - Make connections between nodes that have logical relationships
                  - Node names should be short but descriptive (max 30 chars)`
      }
    ];
    
    // Azure OpenAIを呼び出し
    const jsonString = await callAzureOpenAI(prompt, 0.7, 2000);
    
    // JSONをパース
    let graphData: KnowledgeGraphData;
    try {
      const startIndex = jsonString.indexOf('{');
      const endIndex = jsonString.lastIndexOf('}') + 1;
      const jsonSubstring = jsonString.substring(startIndex, endIndex);
      graphData = JSON.parse(jsonSubstring);
      
      if (!graphData.nodes || !graphData.edges) {
        throw new Error('Invalid graph data structure');
      }
    } catch (parseError) {
      console.error('Error parsing graph data:', parseError);
      return {
        success: false,
        error: 'Failed to parse graph data from AI response'
      };
    }
    
    return {
      success: true,
      data: graphData
    };
  } catch (error) {
    console.error('Error in fallback graph generation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in fallback graph generation'
    };
  }
}