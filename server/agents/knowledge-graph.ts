/**
 * 知識グラフ生成エージェント
 * 階層的な知識構造から視覚化可能な知識グラフを生成するAIエージェント
 */

import { v4 as uuidv4 } from 'uuid';
import { AgentResult } from './types';
import { IndustryAnalysisData } from './industry-analysis';
import { KeywordExpansionData } from './keyword-expansion';
import { StructuringData, Category, Subcategory, Skill } from './structuring';
import { sendAgentThoughts } from '../websocket';

/**
 * 知識グラフ入力データ
 */
export interface KnowledgeGraphInput {
  roleName: string;               // 役割名
  description: string;            // 役割の説明
  industries: string[];           // 選択された業界
  keywords: string[];             // 初期キーワード
  industryAnalysisData: IndustryAnalysisData; // 業界分析データ
  keywordExpansionData: KeywordExpansionData; // キーワード拡張データ
  structuringData: StructuringData; // 構造化データ
  userId: string;                 // ユーザーID
  roleModelId: string;            // 役割モデルID
}

/**
 * 知識ノード
 */
export interface KnowledgeNode {
  id: string;                     // ノードID
  name: string;                   // ノード名
  description: string;            // 説明
  level: number;                  // 階層レベル（0がルート）
  type?: string;                  // ノードタイプ
  color?: string;                 // 表示色
  parentId?: string;              // 親ノードID
}

/**
 * 知識エッジ
 */
export interface KnowledgeEdge {
  source: string;                 // 始点ノードID
  target: string;                 // 終点ノードID
  label?: string;                 // ラベル
  strength?: number;              // 関連強度
}

/**
 * 知識グラフデータ
 */
export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];         // ノードリスト
  edges: KnowledgeEdge[];         // エッジリスト
}

/**
 * ノードタイプに基づいて色を割り当てる
 */
function getNodeColor(type: string): string {
  switch (type) {
    case 'root':
      return '#FF5733'; // オレンジ（ルート）
    case 'category':
      return '#33A8FF'; // 青（カテゴリ）
    case 'subcategory':
      return '#33FF57'; // 緑（サブカテゴリ）
    case 'skill':
      return '#A833FF'; // 紫（スキル）
    case 'industry':
      return '#FF33A8'; // ピンク（業界）
    case 'trend':
      return '#FFD700'; // 金（トレンド）
    case 'keyword':
      return '#00CED1'; // ターコイズ（キーワード）
    default:
      return '#808080'; // グレー（その他）
  }
}

/**
 * 構造化データと業界分析に基づいて知識グラフを生成する
 * @param input 知識グラフ入力データ
 * @returns 知識グラフデータ
 */
export async function generateKnowledgeGraph(
  input: KnowledgeGraphInput
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    console.log(`知識グラフ生成エージェント起動: ${input.roleName}`);
    sendAgentThoughts(input.userId, input.roleModelId, 'KnowledgeGraphAgent', `役割「${input.roleName}」の知識グラフ生成を開始します。`);
    
    // ノードとエッジのリストを初期化
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    
    // ルートノードを作成
    const rootId = uuidv4();
    nodes.push({
      id: rootId,
      name: input.roleName,
      description: input.description || `${input.roleName}の役割モデル`,
      level: 0,
      type: 'root',
      color: getNodeColor('root')
    });
    
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'KnowledgeGraphAgent',
      `ルートノード「${input.roleName}」を作成しました。カテゴリ、サブカテゴリ、スキルの階層構造をグラフに変換しています。`
    );
    
    // 構造化データからカテゴリノードを追加
    input.structuringData.categories.forEach(category => {
      const categoryId = category.id;
      
      // カテゴリノードを追加
      nodes.push({
        id: categoryId,
        name: category.name,
        description: category.description,
        level: 1,
        type: 'category',
        color: getNodeColor('category'),
        parentId: rootId
      });
      
      // ルートとカテゴリを接続
      edges.push({
        source: rootId,
        target: categoryId,
        label: 'has_category',
        strength: 1.0
      });
      
      // サブカテゴリを処理
      category.subcategories.forEach(subcategory => {
        const subcategoryId = subcategory.id;
        
        // サブカテゴリノードを追加
        nodes.push({
          id: subcategoryId,
          name: subcategory.name,
          description: subcategory.description,
          level: 2,
          type: 'subcategory',
          color: getNodeColor('subcategory'),
          parentId: categoryId
        });
        
        // カテゴリとサブカテゴリを接続
        edges.push({
          source: categoryId,
          target: subcategoryId,
          label: 'has_subcategory',
          strength: 0.8
        });
        
        // スキルを処理
        subcategory.skills.forEach(skill => {
          const skillId = skill.id;
          
          // スキルノードを追加
          nodes.push({
            id: skillId,
            name: skill.name,
            description: skill.description,
            level: 3,
            type: 'skill',
            color: getNodeColor('skill'),
            parentId: subcategoryId
          });
          
          // サブカテゴリとスキルを接続
          edges.push({
            source: subcategoryId,
            target: skillId,
            label: 'requires_skill',
            strength: 0.6
          });
          
          // キーワードとスキルの関連付け
          const matchingKeywords = input.keywordExpansionData.keywords.filter(keyword => 
            keyword.name.toLowerCase() === skill.name.toLowerCase() ||
            skill.name.toLowerCase().includes(keyword.name.toLowerCase()) ||
            keyword.name.toLowerCase().includes(skill.name.toLowerCase())
          );
          
          matchingKeywords.forEach(keyword => {
            // キーワードIDを探す（既に存在する場合は再利用）
            let keywordNode = nodes.find(node => 
              node.type === 'keyword' && node.name.toLowerCase() === keyword.name.toLowerCase()
            );
            
            let keywordId;
            
            if (!keywordNode) {
              keywordId = uuidv4();
              
              // キーワードノードを追加
              nodes.push({
                id: keywordId,
                name: keyword.name,
                description: keyword.description,
                level: 4,
                type: 'keyword',
                color: getNodeColor('keyword')
              });
            } else {
              keywordId = keywordNode.id;
            }
            
            // スキルとキーワードを接続
            edges.push({
              source: skillId,
              target: keywordId,
              label: 'related_to',
              strength: 0.4
            });
          });
        });
      });
    });
    
    // 業界を追加
    input.industryAnalysisData.industries.forEach(industry => {
      const industryId = uuidv4();
      
      // 業界ノードを追加
      nodes.push({
        id: industryId,
        name: industry.name,
        description: industry.description,
        level: 1,
        type: 'industry',
        color: getNodeColor('industry')
      });
      
      // ルートと業界を接続
      edges.push({
        source: rootId,
        target: industryId,
        label: 'in_industry',
        strength: 0.9
      });
      
      // トレンドを追加
      const industryTrends = input.industryAnalysisData.trends.slice(0, 5);
      
      industryTrends.forEach(trend => {
        const trendId = uuidv4();
        
        // トレンドノードを追加
        nodes.push({
          id: trendId,
          name: trend,
          description: `${industry.name}業界のトレンド: ${trend}`,
          level: 2,
          type: 'trend',
          color: getNodeColor('trend'),
          parentId: industryId
        });
        
        // 業界とトレンドを接続
        edges.push({
          source: industryId,
          target: trendId,
          label: 'has_trend',
          strength: 0.5
        });
      });
    });
    
    // 重要キーワードをルートに直接接続
    const topKeywords = input.keywordExpansionData.keywords
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
    
    topKeywords.forEach(keyword => {
      // 既に追加されたキーワードか確認
      let keywordNode = nodes.find(node => 
        node.type === 'keyword' && node.name.toLowerCase() === keyword.name.toLowerCase()
      );
      
      let keywordId;
      
      if (!keywordNode) {
        keywordId = uuidv4();
        
        // キーワードノードを追加
        nodes.push({
          id: keywordId,
          name: keyword.name,
          description: keyword.description,
          level: 1,
          type: 'keyword',
          color: getNodeColor('keyword')
        });
      } else {
        keywordId = keywordNode.id;
      }
      
      // まだ接続されていない場合のみ、ルートとキーワードを接続
      const existingEdge = edges.find(edge => 
        edge.source === rootId && edge.target === keywordId
      );
      
      if (!existingEdge) {
        edges.push({
          source: rootId,
          target: keywordId,
          label: 'key_concept',
          strength: 0.7
        });
      }
    });
    
    // グラフの複雑さを制限（ノード数が多すぎる場合はスキルレベルのノードを減らす）
    if (nodes.length > 150) {
      console.log(`グラフが複雑すぎるため、一部のノードを削減します。元のノード数: ${nodes.length}`);
      
      // スキルノードを重要度でフィルタリング
      const skillNodes = nodes.filter(node => node.type === 'skill');
      const subcategoryNodes = nodes.filter(node => node.type === 'subcategory');
      
      if (skillNodes.length > 50) {
        // 各サブカテゴリから最大3つのスキルのみを保持
        const nodesToKeep = new Set<string>();
        
        // 必須ノードをリストに追加
        nodes.filter(node => node.type !== 'skill').forEach(node => {
          nodesToKeep.add(node.id);
        });
        
        // 各サブカテゴリから最大3つのスキルを選択
        subcategoryNodes.forEach(subcategory => {
          const skills = skillNodes.filter(skill => skill.parentId === subcategory.id);
          skills.slice(0, 3).forEach(skill => {
            nodesToKeep.add(skill.id);
          });
        });
        
        // ノードを絞り込む
        const filteredNodes = nodes.filter(node => nodesToKeep.has(node.id));
        
        // エッジも対応するノードのみに制限
        const filteredEdges = edges.filter(edge => 
          nodesToKeep.has(edge.source) && nodesToKeep.has(edge.target)
        );
        
        console.log(`ノード削減後: ${filteredNodes.length}ノード, ${filteredEdges.length}エッジ`);
        
        nodes.length = 0;
        nodes.push(...filteredNodes);
        
        edges.length = 0;
        edges.push(...filteredEdges);
      }
    }
    
    sendAgentThoughts(
      input.userId,
      input.roleModelId,
      'KnowledgeGraphAgent',
      `知識グラフ生成完了: ${nodes.length}ノード、${edges.length}エッジを生成しました。`
    );
    
    return {
      success: true,
      data: {
        nodes,
        edges
      }
    };
    
  } catch (error: any) {
    console.error('Error in knowledge graph generation:', error);
    sendAgentThoughts(input.userId, input.roleModelId, 'KnowledgeGraphAgent', `エラー: 知識グラフ生成の実行中にエラーが発生しました。`);
    
    // エラー時の最小限のデータを作成
    const rootId = uuidv4();
    const nodes: KnowledgeNode[] = [
      {
        id: rootId,
        name: input.roleName,
        description: input.description || `${input.roleName}の役割モデル`,
        level: 0,
        type: 'root',
        color: getNodeColor('root')
      }
    ];
    
    const edges: KnowledgeEdge[] = [];
    
    // 初期キーワードをルートに接続
    input.keywords.forEach(keyword => {
      const keywordId = uuidv4();
      
      nodes.push({
        id: keywordId,
        name: keyword,
        description: `キーワード: ${keyword}`,
        level: 1,
        type: 'keyword',
        color: getNodeColor('keyword')
      });
      
      edges.push({
        source: rootId,
        target: keywordId,
        label: 'has_keyword',
        strength: 0.5
      });
    });
    
    // 業界をルートに接続
    input.industries.forEach(industry => {
      const industryId = uuidv4();
      
      nodes.push({
        id: industryId,
        name: industry,
        description: `業界: ${industry}`,
        level: 1,
        type: 'industry',
        color: getNodeColor('industry')
      });
      
      edges.push({
        source: rootId,
        target: industryId,
        label: 'in_industry',
        strength: 0.7
      });
    });
    
    return {
      success: false,
      error: `知識グラフ生成の実行中にエラーが発生しました: ${error.message}`,
      data: {
        nodes,
        edges
      }
    };
  }
}