// 構造化エージェント
// キーワードを階層構造に整理するエージェント

import { AgentResult, RoleModelInput } from './types';
import { callAzureOpenAI } from '../azure-openai';

interface StructuringInput extends RoleModelInput {
  expandedKeywords?: any;
}

interface KeywordNode {
  id: string;
  name: string;
  level: number;
  parentId?: string | null;
  description?: string | null;
}

interface StructureOutput {
  hierarchicalStructure: {
    rootNode: KeywordNode;
    childNodes: KeywordNode[];
  }
}

/**
 * 構造化エージェント
 * 拡張されたキーワードを階層構造に整理します
 */
export const structuringAgent = async (
  input: StructuringInput
): Promise<AgentResult> => {
  try {
    console.log('Structuring keywords for role:', input.roleName);
    
    // 拡張キーワードが利用可能か確認
    if (!input.expandedKeywords) {
      throw new Error('Expanded keywords are required for structuring');
    }
    
    const keywordsStr = Array.isArray(input.expandedKeywords.expandedKeywords) 
      ? input.expandedKeywords.expandedKeywords.join(', ')
      : input.keywords.join(', ');
    
    // キーワードカテゴリが利用可能な場合は、それを使用します
    const categoriesStr = input.expandedKeywords.keywordCategories 
      ? JSON.stringify(input.expandedKeywords.keywordCategories, null, 2)
      : '';
    
    const promptMessages = [
      {
        role: "system",
        content: `あなたはナレッジグラフ構造化の専門家です。キーワードを階層構造に整理し、マインドマップの形式で表現できるようにしてください。
        
        出力は以下のJSON形式で返してください：
        {
          "hierarchicalStructure": {
            "rootNode": {
              "id": "root",
              "name": "ロール名",
              "level": 0,
              "description": "ロールの説明"
            },
            "childNodes": [
              {
                "id": "node1",
                "name": "コンセプト1",
                "level": 1,
                "parentId": "root",
                "description": "このコンセプトの説明"
              },
              {
                "id": "node2",
                "name": "コンセプト2",
                "level": 1,
                "parentId": "root",
                "description": "このコンセプトの説明"
              },
              {
                "id": "node1-1",
                "name": "サブコンセプト1",
                "level": 2,
                "parentId": "node1",
                "description": "このサブコンセプトの説明"
              },
              ...
            ]
          }
        }
        
        階層構造の作成にあたって、以下のガイドラインに従ってください：
        1. rootノード（level 0）は1つだけで、提供されたロール名を使用します
        2. 第1階層（level 1）は4〜6個の主要概念で構成します
        3. 第2階層（level 2）は各第1階層ノードに2〜4個のサブ概念を持たせます
        4. 第3階層（level 3）も必要に応じて含めることができますが、必須ではありません
        5. ノードIDは重複しないようにしてください（例：node1, node2, node1-1, node1-2など）
        6. 各ノードには簡潔な説明を付けてください（30〜50文字程度）
        7. 日本語で回答してください`
      },
      {
        role: "user",
        content: `次のキーワードを階層構造に整理してください: ${keywordsStr}
        
        ロール名: ${input.roleName}
        ロールの説明: ${input.description || 'なし'}
        関連業界: ${input.industries.join(', ')}
        
        ${categoriesStr ? `キーワードカテゴリ:\n${categoriesStr}` : ''}`
      }
    ];
    
    // Azure OpenAIを呼び出して構造化を生成
    const responseText = await callAzureOpenAI(promptMessages, 0.7, 2500);
    
    // 応答をJSONとしてパース
    let structureResult: StructureOutput;
    try {
      structureResult = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing structuring JSON response:', e);
      throw new Error('Invalid response format from structuring');
    }
    
    // ノード数をカウント
    const nodeCount = 1 + structureResult.hierarchicalStructure.childNodes.length;
    
    return {
      result: structureResult,
      metadata: {
        nodeCount,
        maxLevel: Math.max(...structureResult.hierarchicalStructure.childNodes.map(node => node.level)),
        promptTokens: promptMessages.reduce((acc, msg) => acc + msg.content.length, 0),
        responseTokens: responseText.length
      }
    };
  } catch (error: any) {
    console.error('Error in structuring agent:', error);
    throw new Error(`Structuring failed: ${error.message}`);
  }
};