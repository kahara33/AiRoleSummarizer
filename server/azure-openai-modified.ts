import { storage } from './storage';
import { 
  insertKnowledgeNodeSchema, 
  InsertKnowledgeNode, 
  KnowledgeNode, 
  InsertKnowledgeEdge,
  KnowledgeEdge,
  roleModels,
  KnowledgeGraphData
} from '@shared/schema';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { randomUUID } from 'crypto';

// Azure OpenAI クライアントの初期化
const client = new OpenAIClient(
  process.env.AZURE_OPENAI_ENDPOINT || '',
  new AzureKeyCredential(process.env.AZURE_OPENAI_KEY || '')
);
const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

/**
 * Azure OpenAIにメッセージを送信して応答を受け取る関数
 * @param messages メッセージの配列
 * @param temperature 温度パラメータ
 * @param maxTokens 最大トークン数
 * @returns 生成されたテキスト
 */
export async function callAzureOpenAI(messages: any[], temperature = 0.7, maxTokens = 1500): Promise<string> {
  try {
    const response = await client.getChatCompletions(
      deploymentName,
      messages,
      {
        temperature,
        maxTokens,
      }
    );

    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message?.content || '';
    } else {
      console.warn('Azure OpenAI API returned no choices');
      return '';
    }
  } catch (error) {
    console.error('Azure OpenAI API error:', error);
    throw new Error(`Azure OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// 知識グラフデータの型
type KnowledgeNodeData = {
  name: string;
  level: number;
  type?: string;
  parentId?: string | null;
  description?: string | null;
  color?: string | null;
};

type KnowledgeEdgeData = {
  source: string;
  target: string;
  label?: string | null;
  strength?: number;
};

/**
 * 役割モデルの知識グラフを生成する関数
 * @param roleName 役割名
 * @param roleDescription 役割の説明
 * @param industries 業界名の配列
 * @param keywords キーワードの配列
 * @returns 生成された知識グラフデータ
 */
export async function generateKnowledgeGraph(
  roleName: string,
  roleDescription: string,
  industries: string[],
  keywords: string[]
): Promise<KnowledgeGraphData> {
  try {
    console.log(`Generating knowledge graph for role model: ${roleName}`);
    console.log(`Industries: ${industries.join(', ')}`);
    console.log(`Keywords: ${keywords.join(', ')}`);
    
    let graphData: KnowledgeGraphData = { nodes: [], edges: [] };
    
    try {
      // Azure OpenAI APIからデータを取得
      const messages = [
        {
          role: "system",
          content: "あなたは情報収集支援システムの知識グラフ生成の専門家です。ユーザーが指定した役割、業界、キーワードに基づいて、情報収集を効率的に行うための階層的な知識グラフを作成してください。\n\n出力は2つの配列（\"nodes\"と\"edges\"）を持つJSONオブジェクトである必要があります。\n\n各ノードは以下のプロパティを持ちます：\n- name: ノードの名前（日本語、簡潔で明確な表現）\n- level: 階層レベル（0: 中心、1: 主要カテゴリ、2: サブカテゴリ、3: 具体的なスキルや知識領域）\n- type: タイプ（\"central\", \"category\", \"subcategory\", \"skill\", \"knowledge\"など。デフォルトは\"keyword\"）\n- color: 色（オプション、ヘキサカラーコード）\n- description: ノードの説明（オプション、そのスキルや知識がなぜ重要かを説明）\n- parentId: 親ノードの名前（level 0, 1のノードには不要、level 2, 3のノードには必須）\n\n各エッジは以下のプロパティを持ちます：\n- source: 始点ノードの名前\n- target: 終点ノードの名前\n- label: 関係性の説明（\"必要とする\", \"含む\", \"関連する\"など。オプション）\n- strength: 関係性の強さ（1-5の整数。5が最も強い）\n\n以下の点に注意してください：\n1. 必ず有効なJSONを出力すること。コードブロックや説明文は含めないこと\n2. レベル1のノードは、情報収集に特化した主要カテゴリである必要があります\n3. 情報収集の目的、情報源、収集技術、業界専門知識、実践応用分野などの観点を含めること\n4. 中心ノード（level 0）から各カテゴリへの接続を確実に行うこと\n5. 色は階層レベルや概念のグループごとに一貫性を持たせること\n6. 日本語での表現を優先すること"
        },
        {
          role: "user",
          content: `役割「${roleName}」のための情報収集用知識グラフを作成してください。\n\n役割の説明: ${roleDescription || '特に指定なし'}\n業界: ${industries.length > 0 ? industries.join(', ') : '特に指定なし'}\nキーワード: ${keywords.length > 0 ? keywords.join(', ') : '特に指定なし'}\n\nこの知識グラフは「自律型情報収集サービス」のためのものです。ユーザーが日々効率的に情報収集するために必要な構造を提供します。\n\nレベル1のノードとして以下の5つのカテゴリを必ず含めてください：\n1. 情報収集目的 - なぜ情報を集めるのか、その目的や意図\n2. 情報源と技術リソース - どこから情報を得るか、使用するツールや技術\n3. 業界専門知識 - 特定の業界やドメインに関連する知識\n4. トレンド分析 - 最新動向の把握とその分析方法\n5. 実践応用分野 - 収集した情報をどのように活用するか\n\n各カテゴリの下に、役割や業界、キーワードに合わせた適切なサブカテゴリと具体的な項目を追加してください。\n\n最終的な出力は、必ず以下の形式の有効なJSONのみにしてください。補足説明やマークダウンの区切り記号(\`\`\`)などは一切含めないでください。`
        }
      ];
      
      const responseContent = await callAzureOpenAI(messages, 0.7, 2000);
      console.log(`Received Azure OpenAI response: ${responseContent.length} characters`);
      
      // JSONデータの抽出と処理
      let cleanedContent = responseContent.trim();
      
      // JSONデータから余分なテキスト部分を削除
      if (!cleanedContent.startsWith('{')) {
        const jsonStart = cleanedContent.indexOf('{');
        if (jsonStart >= 0) {
          cleanedContent = cleanedContent.substring(jsonStart);
        }
      }
      
      // JSONデータの末尾に余分なテキストがある場合に削除
      if (!cleanedContent.endsWith('}')) {
        const jsonEnd = cleanedContent.lastIndexOf('}');
        if (jsonEnd >= 0) {
          cleanedContent = cleanedContent.substring(0, jsonEnd + 1);
        }
      }
      
      // マークダウンのコードブロックを抽出する試み
      const patternJsonBlock = /```json\s*([\s\S]*?)\s*```/;
      const patternCodeBlock = /```\s*([\s\S]*?)\s*```/;
      const patternJsonObject = /\{[\s\S]*"nodes"[\s\S]*"edges"[\s\S]*\}/;
      
      const jsonMatch = responseContent.match(patternJsonBlock) || 
                        responseContent.match(patternCodeBlock) ||
                        responseContent.match(patternJsonObject);
      
      if (jsonMatch) {
        cleanedContent = jsonMatch[1] || jsonMatch[0];
        cleanedContent = cleanedContent.trim();
      }
      
      try {
        graphData = JSON.parse(cleanedContent);
        console.log("Successfully parsed knowledge graph JSON data");
      } catch (parseError) {
        console.error('Error parsing knowledge graph JSON:', parseError);
        
        // JSONの修復を試みる
        try {
          // 不正な制御文字を削除
          const sanitized = cleanedContent.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            .replace(/\\n/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/"\s+"/g, '","');
          
          graphData = JSON.parse(sanitized);
          console.log('Recovered JSON after sanitization');
        } catch (secondError) {
          console.error('Could not recover JSON even after sanitization:', secondError);
          // デフォルトの空のグラフデータを返す
          graphData = {
            nodes: [],
            edges: []
          };
        }
      }
      
      // 有効な知識グラフ構造かどうかを検証
      if (!graphData || !graphData.nodes || !Array.isArray(graphData.nodes) || graphData.nodes.length === 0 ||
          !graphData.edges || !Array.isArray(graphData.edges)) {
        console.error('Invalid knowledge graph structure:', JSON.stringify(graphData).substring(0, 200) + '...');
        // デフォルトの空のグラフデータを返す
        graphData = {
          nodes: [
            {
              name: roleName,
              level: 0,
              type: "central",
              color: "#ff5722"
            },
            {
              name: "情報収集目的",
              level: 1,
              type: "category",
              color: "#2196f3"
            },
            {
              name: "情報源と技術リソース",
              level: 1,
              type: "category",
              color: "#4caf50"
            },
            {
              name: "業界専門知識",
              level: 1,
              type: "category",
              color: "#9c27b0"
            },
            {
              name: "トレンド分析",
              level: 1,
              type: "category",
              color: "#ff9800"
            },
            {
              name: "実践応用分野",
              level: 1,
              type: "category",
              color: "#795548"
            }
          ],
          edges: [
            {
              source: roleName,
              target: "情報収集目的",
              strength: 4
            },
            {
              source: roleName,
              target: "情報源と技術リソース",
              strength: 4
            },
            {
              source: roleName,
              target: "業界専門知識",
              strength: 4
            },
            {
              source: roleName,
              target: "トレンド分析",
              strength: 4
            },
            {
              source: roleName,
              target: "実践応用分野",
              strength: 4
            }
          ]
        };
      }
      
      // 中心ノード（レベル0）の存在チェック
      const hasCentralNode = graphData.nodes.some(node => node.level === 0);
      if (!hasCentralNode) {
        console.warn('Central node (level 0) is missing in the knowledge graph, adding default one');
        // 中心ノードを追加
        graphData.nodes.unshift({
          name: roleName,
          level: 0,
          type: "central",
          color: "#ff5722"
        });
        
        // 追加した中心ノードからレベル1のノードへのエッジを追加
        const level1Nodes = graphData.nodes.filter(node => node.level === 1);
        for (const node of level1Nodes) {
          graphData.edges.push({
            source: roleName,
            target: node.name,
            strength: 4
          });
        }
      }
      
      console.log("Successfully generated knowledge graph using Azure OpenAI");
      
    } catch (apiError) {
      console.error("Error calling Azure OpenAI:", apiError);
      // デフォルトの基本的なグラフデータを作成
      graphData = {
        nodes: [
          {
            name: roleName,
            level: 0,
            type: "central",
            color: "#ff5722"
          },
          {
            name: "情報収集目的",
            level: 1,
            type: "category",
            color: "#2196f3"
          },
          {
            name: "情報源と技術リソース",
            level: 1,
            type: "category",
            color: "#4caf50"
          },
          {
            name: "業界専門知識",
            level: 1,
            type: "category",
            color: "#9c27b0"
          },
          {
            name: "トレンド分析",
            level: 1,
            type: "category",
            color: "#ff9800"
          },
          {
            name: "実践応用分野",
            level: 1,
            type: "category",
            color: "#795548"
          }
        ],
        edges: [
          {
            source: roleName,
            target: "情報収集目的",
            strength: 4
          },
          {
            source: roleName,
            target: "情報源と技術リソース",
            strength: 4
          },
          {
            source: roleName,
            target: "業界専門知識",
            strength: 4
          },
          {
            source: roleName,
            target: "トレンド分析",
            strength: 4
          },
          {
            source: roleName,
            target: "実践応用分野",
            strength: 4
          }
        ]
      };
    }
    
    return graphData;  
  } catch (error) {
    console.error('Error generating knowledge graph:', error);
    // エラーの場合も最低限のグラフデータを返す
    return {
      nodes: [
        {
          name: roleName,
          level: 0,
          type: "central",
          color: "#ff5722"
        }
      ],
      edges: []
    };
  }
}

/**
 * AIで生成した知識グラフデータをデータベースに保存する関数
 * @param roleModelId ロールモデルID
 * @param graphData 知識グラフデータ
 * @returns 成功したかどうか
 */
export async function saveKnowledgeGraphToDatabase(
  roleModelId: string,
  graphData: KnowledgeGraphData
): Promise<boolean> {
  try {
    console.log(`Saving knowledge graph to database for role model ID: ${roleModelId}`);
    console.log(`Graph data contains ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);
    
    // ノード名からデータベースID へのマッピング
    const nodeIdMap = new Map<string, string>();
    
    // 親がないノード（レベル0と1）を先に作成
    const nodesWithoutParents = graphData.nodes.filter(node => !node.parentId);
    for (const node of nodesWithoutParents) {
      const nodeData: InsertKnowledgeNode = {
        name: node.name,
        roleModelId: roleModelId,
        level: node.level,
        type: node.type || 'keyword',
        parentId: null,
        description: node.description || null,
        color: node.color || null
      };
      
      try {
        const createdNode = await storage.createKnowledgeNode(nodeData);
        nodeIdMap.set(node.name, createdNode.id);
        console.log(`Created node without parent: ${node.name} -> ${createdNode.id}`);
      } catch (err) {
        console.error(`Error creating node ${node.name}:`, err);
      }
    }
    
    // 親が参照されているノードを作成（レベル2以上）
    const nodesWithParents = graphData.nodes.filter(node => node.parentId);
    for (const node of nodesWithParents) {
      try {
        const parentId = node.parentId ? nodeIdMap.get(node.parentId) : null;
        
        const nodeData: InsertKnowledgeNode = {
          name: node.name,
          roleModelId: roleModelId,
          level: node.level,
          type: node.type || 'keyword',
          parentId: parentId,
          description: node.description || null,
          color: node.color || null
        };
        
        const createdNode = await storage.createKnowledgeNode(nodeData);
        nodeIdMap.set(node.name, createdNode.id);
        console.log(`Created node with parent: ${node.name} -> ${createdNode.id}, parent: ${node.parentId} -> ${parentId}`);
      } catch (err) {
        console.error(`Error creating node ${node.name} with parent:`, err);
      }
    }
    
    // エッジを作成
    for (const edge of graphData.edges) {
      try {
        const sourceId = nodeIdMap.get(edge.source);
        const targetId = nodeIdMap.get(edge.target);
        
        if (sourceId && targetId) {
          const edgeData: InsertKnowledgeEdge = {
            sourceId,
            targetId,
            roleModelId,
            label: edge.label || null,
            strength: edge.strength || 1
          };
          
          await storage.createKnowledgeEdge(edgeData);
          console.log(`Created edge: ${edge.source} -> ${edge.target}`);
        } else {
          console.warn(`Could not create edge from "${edge.source}" to "${edge.target}" - node IDs not found`);
        }
      } catch (err) {
        console.error(`Error creating edge ${edge.source} -> ${edge.target}:`, err);
      }
    }
    
    console.log(`Successfully saved knowledge graph to database for role model ID: ${roleModelId}`);
    return true;
  } catch (error) {
    console.error('Error saving knowledge graph to database:', error);
    return false;
  }
}