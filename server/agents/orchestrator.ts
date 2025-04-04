// オーケストレーターエージェント
import { AgentResult, RoleModelInput, KnowledgeGraphData } from './types';
import { analyzeIndustries } from './industry-analysis';
import { expandKeywords } from './keyword-expansion';
import { structureKnowledge } from './structuring';
import { generateKnowledgeGraph } from './knowledge-graph';
import { callAzureOpenAI } from '../azure-openai';
import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { roleModelKeywords } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
    console.log('Starting industry analysis...');
    const industryAnalysisResult = await analyzeIndustries(input);
    if (!industryAnalysisResult.success) {
      return {
        success: false,
        error: `Industry analysis failed: ${industryAnalysisResult.error}`
      };
    }
    
    console.log('Industry analysis completed successfully');
    
    // 業界データをRoleModelとして保存 - 実装
    if (input.roleModelId) {
      await saveIndustryData(input.roleModelId, industryAnalysisResult.data);
    }
    
    // 2. キーワード拡張エージェントを実行
    console.log('Starting keyword expansion...');
    const keywordExpansionResult = await expandKeywords(input, industryAnalysisResult.data);
    if (!keywordExpansionResult.success) {
      return {
        success: false,
        error: `Keyword expansion failed: ${keywordExpansionResult.error}`
      };
    }
    
    console.log('Keyword expansion completed successfully');
    
    // キーワードデータをDBに保存 - 実装
    if (input.roleModelId) {
      await saveKeywordData(input.roleModelId, keywordExpansionResult.data);
    }
    
    // 3. 知識構造化エージェントを実行
    console.log('Starting knowledge structuring...');
    const structuringResult = await structureKnowledge(
      input,
      industryAnalysisResult.data,
      keywordExpansionResult.data
    );
    
    if (!structuringResult.success) {
      return {
        success: false,
        error: `Knowledge structuring failed: ${structuringResult.error}`
      };
    }
    
    console.log('Knowledge structuring completed successfully');
    
    // 4. 知識グラフ生成エージェントを実行
    console.log('Starting knowledge graph generation...');
    const graphResult = await generateKnowledgeGraph(
      input,
      structuringResult.data
    );
    
    if (!graphResult.success) {
      console.log('Knowledge graph generation failed, using fallback generator');
      // フォールバックの知識グラフ生成を実装
      return await fallbackGraphGeneration(input);
    }
    
    console.log('Knowledge graph generation completed successfully');
    
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
 * 業界データをデータベースに保存
 */
async function saveIndustryData(roleModelId: string, data: any) {
  try {
    console.log('Saving industry data to database...');
    
    // 既存の業界関連付けがあれば削除
    try {
      await storage.deleteRoleModelIndustriesByRoleModelId(roleModelId);
      console.log(`Deleted existing industry associations for role model ${roleModelId}`);
    } catch (deleteError) {
      console.error('Error deleting existing industry associations:', deleteError);
      // 削除エラーでも続行
    }
    
    // 業界データから業界名を抽出
    const targetAudiences = data.targetAudience || [];
    const keyTrends = data.keyTrends || [];
    const businessModels = data.businessModels || [];
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
            roleModelId: roleModelId,
            industrySubcategoryId: matchingSubcategory.id
          });
          console.log(`業界 "${matchingSubcategory.name}" をロールモデルに関連付けました`);
        } catch (error) {
          console.error(`業界関連付けエラー (${matchingSubcategory.name}):`, error);
          // エラーが発生しても続行
        }
      }
    }
    
    console.log('Industry data saved successfully');
  } catch (error) {
    console.error('業界データの保存中にエラーが発生しました:', error);
    // エラーが発生しても処理を続行
  }
}

/**
 * キーワードデータをデータベースに保存
 */
async function saveKeywordData(roleModelId: string, data: any) {
  try {
    console.log('Saving keyword data to database...');
    
    // 既存のキーワード関連付けがあれば削除
    try {
      await storage.deleteRoleModelKeywordsByRoleModelId(roleModelId);
      console.log(`Deleted existing keyword associations for role model ${roleModelId}`);
    } catch (deleteError) {
      console.error('Error deleting existing keyword associations:', deleteError);
      // 削除エラーでも続行
    }
    
    // 拡張されたキーワードリスト
    const expandedKeywords = data.expandedKeywords || [];
    const relevance = data.relevance || {};
    
    for (const keywordName of expandedKeywords) {
      try {
        // 既存のキーワードを検索
        const existingKeywords = await storage.getKeywords(keywordName);
        let keywordId = '';
        
        // 既存のキーワードがあればそれを使う、なければ新規作成
        if (existingKeywords.length > 0) {
          // 名前が完全一致するものを優先
          const exactMatch = existingKeywords.find(k => k.name === keywordName);
          keywordId = exactMatch ? exactMatch.id : existingKeywords[0].id;
        } else {
          // 新しいキーワードを作成
          const newKeyword = await storage.createKeyword({
            name: keywordName,
            description: `${keywordName}に関する情報`,
          });
          keywordId = newKeyword.id;
        }
        
        // キーワードとロールモデルを関連付け
        await storage.createRoleModelKeyword({
          id: uuidv4(),
          roleModelId: roleModelId,
          keywordId: keywordId,
          relevance: relevance[keywordName] || 0.5 // 関連度が指定されていなければデフォルト値を使用
        });
        
        console.log(`キーワード "${keywordName}" をロールモデルに関連付けました`);
      } catch (error) {
        console.error(`キーワード関連付けエラー (${keywordName}):`, error);
        // エラーが発生しても続行
      }
    }
    
    console.log('Keyword data saved successfully');
  } catch (error) {
    console.error('キーワードデータの保存中にエラーが発生しました:', error);
    // エラーが発生しても処理を続行
  }
}

/**
 * フォールバックの知識グラフ生成
 * メインの知識グラフ生成が失敗した場合に使用する単純なグラフを生成
 */
export async function fallbackGraphGeneration(
  input: RoleModelInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    console.log('Using fallback graph generation for', input.roleName);
    
    // 単純な知識グラフ構造を生成
    const nodes = [
      {
        id: 'root',
        name: input.roleName,
        level: 0,
        type: 'central',
        color: '#F9A826'
      },
      {
        id: 'purpose',
        name: '情報収集目的',
        level: 1,
        parentId: 'root',
        type: 'category',
        color: '#4CAF50'
      },
      {
        id: 'sources',
        name: '情報源と技術リソース',
        level: 1,
        parentId: 'root',
        type: 'category',
        color: '#2196F3'
      },
      {
        id: 'domain',
        name: '業界専門知識',
        level: 1,
        parentId: 'root',
        type: 'category',
        color: '#9C27B0'
      },
      {
        id: 'trends',
        name: 'トレンド分析',
        level: 1,
        parentId: 'root',
        type: 'category',
        color: '#FF5722'
      },
      {
        id: 'application',
        name: '実践応用分野',
        level: 1,
        parentId: 'root',
        type: 'category',
        color: '#607D8B'
      }
    ];
    
    // 各カテゴリに業界とキーワードからサブカテゴリをいくつか追加
    if (input.industries.length > 0) {
      input.industries.slice(0, 3).forEach((industry, i) => {
        nodes.push({
          id: `industry_${i}`,
          name: industry,
          level: 2,
          parentId: 'domain',
          type: 'subcategory',
          color: '#CE93D8'
        });
      });
    }
    
    if (input.keywords.length > 0) {
      input.keywords.forEach((keyword, i) => {
        const parentCategories = ['purpose', 'sources', 'trends', 'application'];
        const parentId = parentCategories[i % parentCategories.length];
        
        nodes.push({
          id: `keyword_${i}`,
          name: keyword,
          level: 2,
          parentId: parentId,
          type: 'subcategory',
          color: '#90CAF9'
        });
      });
    }
    
    // エッジを生成（親子関係のみ）
    const edges = nodes
      .filter(node => node.parentId)
      .map(node => ({
        source: node.parentId!,
        target: node.id,
        label: '関連'
      }));
    
    return {
      success: true,
      data: {
        nodes,
        edges
      }
    };
  } catch (error) {
    console.error('Error in fallback graph generation:', error);
    return {
      success: false,
      error: 'Failed to generate fallback graph'
    };
  }
}
