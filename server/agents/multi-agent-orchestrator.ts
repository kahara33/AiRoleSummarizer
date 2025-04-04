/**
 * マルチエージェントオーケストレーター
 * 複数の専門AIエージェントを調整して役割モデルの知識グラフを生成するモジュール
 */

import { v4 as uuidv4 } from 'uuid';
import { analyzeIndustries, IndustryAnalysisInput } from './industry-analysis';
import { expandKeywords, KeywordExpansionInput } from './keyword-expansion';
import { structureContent, StructuringInput } from './structuring';
import { generateKnowledgeGraph, KnowledgeGraphInput } from './knowledge-graph';
import { RoleModelInput, KnowledgeGraphData, AgentResult } from './types';
import { sendProgressUpdate } from '../websocket';

/**
 * 役割モデルを処理し、複数のエージェントを調整して知識グラフを生成する
 * @param input 役割モデル入力データ
 * @returns 知識グラフデータ
 */
export async function processRoleModel(
  input: RoleModelInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    console.log(`マルチエージェントオーケストレーター起動: ${input.roleName}`);
    
    // 進捗状況の初期化
    sendProgressUpdate(
      input.userId, 
      input.roleModelId, 
      '開始',
      5, 
      { message: '役割モデルの処理を開始します' }
    );
    
    // 1. 業界分析エージェント
    const industryAnalysisInput: IndustryAnalysisInput = {
      roleName: input.roleName,
      description: input.description || `役割: ${input.roleName}`,
      industries: input.industries,
      keywords: input.keywords,
      userId: input.userId,
      roleModelId: input.roleModelId
    };
    
    sendProgressUpdate(input.userId, input.roleModelId, '業界分析', 10, 
      { message: '業界分析を実行中...' }
    );
    
    const industryAnalysisResult = await analyzeIndustries(industryAnalysisInput);
    
    if (!industryAnalysisResult.success) {
      console.error('Industry analysis failed:', industryAnalysisResult.error);
      sendProgressUpdate(input.userId, input.roleModelId, 'エラー', 0, 
        { message: `業界分析に失敗しました: ${industryAnalysisResult.error}` }
      );
      
      return {
        success: false,
        error: `業界分析に失敗しました: ${industryAnalysisResult.error}`,
        data: {
          nodes: [],
          edges: []
        }
      };
    }
    
    // 2. キーワード拡張エージェント
    const keywordExpansionInput: KeywordExpansionInput = {
      roleName: input.roleName,
      description: input.description || `役割: ${input.roleName}`,
      industries: input.industries,
      keywords: input.keywords,
      industryAnalysisData: industryAnalysisResult.data,
      userId: input.userId,
      roleModelId: input.roleModelId
    };
    
    sendProgressUpdate(input.userId, input.roleModelId, 'キーワード拡張', 30, 
      { message: 'キーワードを拡張中...' }
    );
    
    const keywordExpansionResult = await expandKeywords(keywordExpansionInput);
    
    if (!keywordExpansionResult.success) {
      console.error('Keyword expansion failed:', keywordExpansionResult.error);
      sendProgressUpdate(input.userId, input.roleModelId, 'エラー', 0, 
        { message: `キーワード拡張に失敗しました: ${keywordExpansionResult.error}` }
      );
      
      return {
        success: false,
        error: `キーワード拡張に失敗しました: ${keywordExpansionResult.error}`,
        data: {
          nodes: [],
          edges: []
        }
      };
    }
    
    // 3. 構造化エージェント
    const structuringInput: StructuringInput = {
      roleName: input.roleName,
      description: input.description || `役割: ${input.roleName}`,
      industries: input.industries,
      keywords: input.keywords,
      industryAnalysisData: industryAnalysisResult.data,
      keywordExpansionData: keywordExpansionResult.data,
      userId: input.userId,
      roleModelId: input.roleModelId
    };
    
    sendProgressUpdate(input.userId, input.roleModelId, '知識構造化', 50, 
      { message: '知識を構造化中...' }
    );
    
    const structuringResult = await structureContent(structuringInput);
    
    if (!structuringResult.success) {
      console.error('Content structuring failed:', structuringResult.error);
      sendProgressUpdate(input.userId, input.roleModelId, 'エラー', 0, 
        { message: `知識構造化に失敗しました: ${structuringResult.error}` }
      );
      
      return {
        success: false,
        error: `知識構造化に失敗しました: ${structuringResult.error}`,
        data: {
          nodes: [],
          edges: []
        }
      };
    }
    
    // 4. 知識グラフ生成エージェント
    const knowledgeGraphInput: KnowledgeGraphInput = {
      roleName: input.roleName,
      description: input.description || `役割: ${input.roleName}`,
      industries: input.industries,
      keywords: input.keywords,
      industryAnalysisData: industryAnalysisResult.data,
      keywordExpansionData: keywordExpansionResult.data,
      structuringData: structuringResult.data,
      userId: input.userId,
      roleModelId: input.roleModelId
    };
    
    sendProgressUpdate(input.userId, input.roleModelId, '知識グラフ生成', 70, 
      { message: '知識グラフを生成中...' }
    );
    
    const knowledgeGraphResult = await generateKnowledgeGraph(knowledgeGraphInput);
    
    if (!knowledgeGraphResult.success) {
      console.error('Knowledge graph generation failed:', knowledgeGraphResult.error);
      sendProgressUpdate(input.userId, input.roleModelId, 'エラー', 0, 
        { message: `知識グラフ生成に失敗しました: ${knowledgeGraphResult.error}` }
      );
      
      return {
        success: false,
        error: `知識グラフ生成に失敗しました: ${knowledgeGraphResult.error}`,
        data: knowledgeGraphResult.data // エラーでも部分的なグラフデータを返す
      };
    }
    
    // 5. 業界-サブ業界の関連データを保存
    try {
      // サブ業界データの保存処理
      const industriesData = industryAnalysisResult.data.industries;
      const subIndustriesData = industryAnalysisResult.data.subIndustries;
      
      console.log(`Saving industry relationships - roleModelId: ${input.roleModelId}, industries: ${industriesData.length}, subIndustries: ${subIndustriesData.length}`);
      
      // この処理は現在のストレージインターフェースではまだ実装されていません
    } catch (error: any) {
      console.error('Error saving industry relationships:', error);
      // 失敗してもプロセスは続行
    }
    
    // 6. キーワードデータを保存
    try {
      // キーワードデータの保存処理
      const keywordsData = keywordExpansionResult.data.keywords;
      
      console.log(`Saving keywords - roleModelId: ${input.roleModelId}, keywords: ${keywordsData.length}`);
      
      // この処理は現在のストレージインターフェースではまだ実装されていません
    } catch (error: any) {
      console.error('Error saving keywords:', error);
      // 失敗してもプロセスは続行
    }
    
    // 最終的な知識グラフデータを返す
    sendProgressUpdate(input.userId, input.roleModelId, '完了', 100, 
      { message: '役割モデルの知識グラフ生成が完了しました' }
    );
    
    // 知識グラフデータを整形して返す
    return {
      success: true,
      data: knowledgeGraphResult.data
    };
    
  } catch (error: any) {
    console.error('Error in role model processing:', error);
    sendProgressUpdate(input.userId, input.roleModelId, 'エラー', 0, 
      { message: `処理中にエラーが発生しました: ${error.message}` }
    );
    
    // エラー時も最小限のグラフデータを返す
    const rootId = uuidv4();
    const nodes = [
      {
        id: rootId,
        name: input.roleName,
        description: input.description || `${input.roleName}の役割モデル`,
        level: 0,
        type: 'root',
        color: '#FF5733'
      }
    ];
    
    const edges = [];
    
    // 初期キーワードも追加
    input.keywords.forEach(keyword => {
      const keywordId = uuidv4();
      nodes.push({
        id: keywordId,
        name: keyword,
        description: `キーワード: ${keyword}`,
        level: 4,
        type: 'keyword',
        color: '#FFD700'
      });
      
      edges.push({
        source: rootId,
        target: keywordId,
        label: 'has_keyword',
        strength: 0.5
      });
    });
    
    return {
      success: false,
      error: `役割モデルの処理中にエラーが発生しました: ${error.message}`,
      data: {
        nodes,
        edges
      }
    };
  }
}