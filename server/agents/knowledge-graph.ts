// 知識グラフ生成エージェント
// 構造化された情報からD3.js互換のナレッジグラフを生成

import { AgentResult, RoleModelInput, KnowledgeGraphData } from './types';
import { StructuringData, HierarchicalCategory } from './structuring';
import { callAzureOpenAI } from '../azure-openai';
import { v4 as uuidv4 } from 'uuid';

/**
 * 知識グラフ生成エージェント
 * 構造化データを視覚的なナレッジグラフに変換
 */
export async function generateKnowledgeGraph(
  input: RoleModelInput,
  structuringData?: StructuringData
): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    console.log(`Generating knowledge graph for role: ${input.roleName}`);
    
    // 構造化データがない場合は、シンプルなグラフを生成
    if (!structuringData || !structuringData.hierarchicalCategories || structuringData.hierarchicalCategories.length === 0) {
      console.log('No structuring data available, generating simple knowledge graph');
      return await generateSimpleKnowledgeGraph(input);
    }
    
    const { hierarchicalCategories } = structuringData;
    console.log(`Converting ${hierarchicalCategories.length} categories to knowledge graph`);
    
    // カテゴリをノードに変換
    const nodes = hierarchicalCategories.map(category => {
      // ノードの色をレベルに基づいて決定
      const color = getCategoryColor(category.level);
      
      return {
        id: category.id,
        name: category.name,
        description: category.description || `${category.name}に関する情報`,
        level: category.level,
        parentId: category.parentId,
        type: getCategoryType(category.level),
        color
      };
    });
    
    // エッジを生成（親子関係に基づく）
    const edges = hierarchicalCategories
      .filter(category => category.parentId) // ルートノードを除外
      .map(category => ({
        source: category.parentId as string,
        target: category.id,
        label: getRelationshipLabel(category),
        strength: getEdgeStrength(category.level)
      }));
    
    // キーワードを最下位レベルのノードとして追加
    const keywordNodes: any[] = [];
    const keywordEdges: any[] = [];
    
    hierarchicalCategories.forEach(category => {
      if (category.keywords && category.keywords.length > 0) {
        // 各キーワードに対してノードを作成
        category.keywords.forEach(keyword => {
          const keywordId = `kw-${uuidv4().slice(0, 8)}`;
          
          // キーワードノードを追加
          keywordNodes.push({
            id: keywordId,
            name: keyword,
            description: `${keyword}に関する情報`,
            level: category.level + 1,
            parentId: category.id,
            type: 'keyword',
            color: getCategoryColor(category.level + 1)
          });
          
          // キーワードとカテゴリを結ぶエッジを追加
          keywordEdges.push({
            source: category.id,
            target: keywordId,
            label: 'includes',
            strength: 0.7
          });
        });
      }
    });
    
    // キーワードノードとエッジを追加
    const allNodes = [...nodes, ...keywordNodes];
    const allEdges = [...edges, ...keywordEdges];
    
    const graphData: KnowledgeGraphData = {
      nodes: allNodes,
      edges: allEdges
    };
    
    console.log(`Knowledge graph generated with ${allNodes.length} nodes and ${allEdges.length} edges`);
    
    return {
      success: true,
      data: graphData
    };
    
  } catch (error: any) {
    console.error('Error in knowledge graph generation:', error);
    return {
      success: false,
      error: `Knowledge graph generation failed: ${error.message}`
    };
  }
}

/**
 * シンプルなグラフを生成するフォールバック関数
 */
async function generateSimpleKnowledgeGraph(input: RoleModelInput): Promise<AgentResult<KnowledgeGraphData>> {
  try {
    // プロンプトを生成
    const prompt = [
      {
        role: "system",
        content: `あなたは知識グラフのエキスパートです。役割モデルに基づいた知識グラフを生成してください。
        結果は指定されたJSON形式で返してください。`
      },
      {
        role: "user",
        content: `次の役割モデルに関する知識グラフを生成してください：
        
        役割名: ${input.roleName}
        説明: ${input.description || '特に指定なし'}
        業界: ${input.industries.join(', ')}
        キーワード: ${input.keywords.join(', ')}
        
        知識グラフは以下の要件を満たす必要があります：
        - 中心ノードは役割名そのもの
        - レベル1のノードは主要カテゴリ（4〜6個）
        - レベル2のノードはサブカテゴリ（各主要カテゴリに2〜4個）
        - レベル3のノードは具体的なスキルやキーワード（必要に応じて）
        
        以下の形式でJSON出力してください：
        {
          "nodes": [
            {
              "id": "unique-id",  // 一意のID文字列
              "name": "ノード名",   // 表示名
              "description": "説明文", // 簡潔な説明
              "level": 0,        // 階層レベル（0: 中心、1: 主要カテゴリ、2: サブカテゴリ、3: スキル/キーワード）
              "parentId": null,  // 親ノードID（ルートの場合はnull）
              "type": "central", // ノードタイプ（central, category, subcategory, skill, keyword）
              "color": "#4C51BF" // 色コード
            },
            ...
          ],
          "edges": [
            {
              "source": "親ノードID",
              "target": "子ノードID",
              "label": "関係性ラベル", // 例: "含む", "必要とする", "関連する"
              "strength": 1.0      // 接続の強さ（0〜1）
            },
            ...
          ]
        }
        
        注意事項：
        - ノード名は簡潔に（15文字以内）
        - 説明は30〜50文字程度
        - 色は階層ごとに統一感のある配色に
        - 全体の一貫性を保ちつつ、役割に必要な知識・スキル体系を表現
        - ノード数は15〜25個程度
        - 日本語で回答してください`
      }
    ];
    
    // Azure OpenAIを呼び出し
    const responseContent = await callAzureOpenAI(prompt, 0.7, 2500);
    
    // 結果をパース
    try {
      let graphData: KnowledgeGraphData;
      
      // JSON形式の部分を抽出
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        graphData = JSON.parse(jsonMatch[0]);
      } else {
        graphData = JSON.parse(responseContent);
      }
      
      // データの検証
      if (!graphData.nodes || !Array.isArray(graphData.nodes)) {
        graphData.nodes = [];
      }
      
      if (!graphData.edges || !Array.isArray(graphData.edges)) {
        graphData.edges = [];
      }
      
      // ノードIDを確実に一意にする
      const idMap = new Map<string, string>();
      graphData.nodes = graphData.nodes.map(node => {
        const originalId = node.id;
        const newId = `${node.id || 'node'}-${uuidv4().slice(0, 6)}`;
        idMap.set(originalId, newId);
        return { ...node, id: newId };
      });
      
      // エッジのsource/targetを更新されたIDにマップ
      graphData.edges = graphData.edges.map(edge => {
        return {
          ...edge,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target
        };
      });
      
      console.log(`Simple knowledge graph generated with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);
      
      return {
        success: true,
        data: graphData
      };
    } catch (parseError: any) {
      console.error('Error parsing knowledge graph response:', parseError);
      return {
        success: false,
        error: `Failed to parse knowledge graph data: ${parseError.message}`
      };
    }
  } catch (error: any) {
    console.error('Error in simple knowledge graph generation:', error);
    return {
      success: false,
      error: `Simple knowledge graph generation failed: ${error.message}`
    };
  }
}

// ヘルパー関数
function getCategoryColor(level: number): string {
  // レベルに基づいた色の割り当て
  const colors = [
    '#4C51BF', // インディゴ-800（レベル0: ルート）
    '#2C5282', // ブルー-800（レベル1: 主要カテゴリ）
    '#2B6CB0', // ブルー-700（レベル2: サブカテゴリ）
    '#3182CE', // ブルー-600（レベル3: 具体的なスキル）
    '#4299E1'  // ブルー-500（レベル4: キーワード）
  ];
  
  return colors[Math.min(level, colors.length - 1)];
}

function getCategoryType(level: number): string {
  const types = [
    'central',      // レベル0: ルート
    'category',     // レベル1: 主要カテゴリ 
    'subcategory',  // レベル2: サブカテゴリ
    'skill',        // レベル3: スキル
    'keyword'       // レベル4: キーワード
  ];
  
  return types[Math.min(level, types.length - 1)];
}

function getRelationshipLabel(category: HierarchicalCategory): string {
  // レベルに基づいた関係性ラベルの割り当て
  if (category.level === 1) {
    return '必要とする'; // ルート → 主要カテゴリ
  } else if (category.level === 2) {
    return '含む'; // 主要カテゴリ → サブカテゴリ
  } else {
    return '関連する'; // その他
  }
}

function getEdgeStrength(level: number): number {
  // レベルが深いほど弱く
  return Math.max(0.4, 1.0 - (level * 0.2));
}