// オーケストレーターエージェント
import { AgentResult, RoleModelInput, KnowledgeGraphData } from './types';
import { analyzeIndustries } from './industry-analysis';
import { expandKeywords } from './keyword-expansion';
import { structureKnowledge } from './structuring';
import { generateKnowledgeGraph } from './knowledge-graph';
import { callAzureOpenAI } from '../azure-openai';
import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';

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
    
    // 業界データをRoleModelとして保存
    if (input.roleModelId) {
      try {
        // 既存の業界関連付けがあれば削除
        try {
          await storage.deleteRoleModelIndustriesByRoleModelId(input.roleModelId);
          console.log(`Deleted existing industry associations for role model ${input.roleModelId}`);
        } catch (deleteError) {
          console.error('Error deleting existing industry associations:', deleteError);
          // 削除エラーでも続行
        }
        
        // 業界データから業界名を抽出
        const targetAudiences = industryAnalysisResult.data.targetAudience || [];
        const keyTrends = industryAnalysisResult.data.keyTrends || [];
        const businessModels = industryAnalysisResult.data.businessModels || [];
        const industries = [...targetAudiences, ...keyTrends, ...businessModels];
        
        // 先に業界サブカテゴリを検索
        const allIndustrySubcategories = await storage.getIndustrySubcategories();
        
        // 各業界名に近いサブカテゴリを見つけて関連付け
        for (const industryName of industries) {
          // 完全一致または部分一致するサブカテゴリを検索
          const matchingSubcategory = allIndustrySubcategories.find(sub => 
            sub.name === industryName || 
            industryName.includes(sub.name) || 
            sub.name.includes(industryName)
          );
          
          if (matchingSubcategory) {
            try {
              // 業界とロールモデルを関連付け
              await storage.createRoleModelIndustry({
                id: uuidv4(),
                roleModelId: input.roleModelId,
                industrySubcategoryId: matchingSubcategory.id
              });
              console.log(`業界 "${matchingSubcategory.name}" をロールモデルに関連付けました`);
            } catch (error) {
              console.error(`業界関連付けエラー (${matchingSubcategory.name}):`, error);
              // エラーが発生しても続行
            }
          }
        }
      } catch (error) {
        console.error('業界データの保存中にエラーが発生しました:', error);
        // エラーが発生しても処理を続行
      }
    }
    
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
    
    // キーワードデータをRoleModelとして保存
    if (input.roleModelId) {
      try {
        // 既存のキーワード関連付けがあれば削除
        try {
          await storage.deleteRoleModelKeywordsByRoleModelId(input.roleModelId);
          console.log(`Deleted existing keyword associations for role model ${input.roleModelId}`);
        } catch (deleteError) {
          console.error('Error deleting existing keyword associations:', deleteError);
          // 削除エラーでも続行
        }
        
        // 拡張キーワードを取得
        const expandedKeywords = keywordExpansionResult.data.expandedKeywords || [];
        
        // 先にキーワードマスタを検索
        const allKeywords = await storage.getKeywords();
        
        // 各キーワードをマスタに追加し、ロールモデルと関連付け
        for (const keywordName of expandedKeywords) {
          // キーワードマスタに存在するか確認
          let existingKeyword = allKeywords.find(k => k.name === keywordName);
          
          // 存在しない場合は作成
          if (!existingKeyword) {
            try {
              existingKeyword = await storage.createKeyword({
                id: uuidv4(),
                name: keywordName,
                description: null,
                createdById: input.userId || null
              });
              console.log(`キーワード "${keywordName}" を作成しました`);
            } catch (keywordError) {
              console.error(`キーワード作成エラー (${keywordName}):`, keywordError);
              continue; // このキーワードはスキップして次へ
            }
          }
          
          try {
            // キーワードとロールモデルを関連付け
            await storage.createRoleModelKeyword({
              id: uuidv4(),
              roleModelId: input.roleModelId,
              keywordId: existingKeyword.id
            });
            console.log(`キーワード "${keywordName}" をロールモデルに関連付けました`);
          } catch (mappingError) {
            console.error(`キーワード関連付けエラー (${keywordName}):`, mappingError);
            // エラーが発生しても続行
          }
        }
      } catch (error) {
        console.error('キーワードデータの保存中にエラーが発生しました:', error);
        // エラーが発生しても処理を続行
      }
    }
    
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