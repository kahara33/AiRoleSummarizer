import { storage } from './storage';
import { 
  InsertKnowledgeNode, 
  InsertKnowledgeEdge,
  KnowledgeGraphData 
} from '@shared/schema';
import { callAzureOpenAI } from './azure-openai';
import { sendProgressUpdate, sendKnowledgeGraphUpdate } from './websocket';
import { randomUUID } from 'crypto';

/**
 * 役割モデルの知識グラフを生成する関数
 * 
 * @param roleModelId ロールモデルID
 * @param roleName 役割名
 * @param roleDescription 役割の説明
 * @param industries 業界名の配列
 * @param keywords キーワードの配列
 * @returns 生成に成功したかどうか
 */
export async function generateKnowledgeGraphForRoleModel(
  roleModelId: string,
  roleName: string,
  roleDescription: string,
  industries: string[],
  keywords: string[]
): Promise<boolean> {
  try {
    console.log(`Generating knowledge graph for role model: ${roleName}`);
    
    // 進捗状況をWebSocketで通知
    sendProgressUpdate(`知識グラフの生成を開始しています: ${roleName}`, 10, roleModelId);
    
    // 知識グラフの生成
    const graphData = await generateKnowledgeGraph(roleName, roleDescription, industries, keywords);
    sendProgressUpdate(`知識グラフの構造を生成しました（${graphData.nodes.length}ノード, ${graphData.edges.length}エッジ）`, 40, roleModelId);
    
    // 生成した知識グラフをデータベースに保存
    await saveKnowledgeGraphToDatabase(roleModelId, graphData);
    sendProgressUpdate(`知識グラフをデータベースに保存しました`, 100, roleModelId);
    
    console.log(`Successfully created knowledge graph for ${roleName}`);
    return true;
  } catch (error) {
    console.error('Error generating knowledge graph:', error);
    sendProgressUpdate(`知識グラフの生成中にエラーが発生しました: ${error instanceof Error ? error.message : '未知のエラー'}`, 100, roleModelId);
    return false;
  }
}

/**
 * 役割モデルの知識グラフを生成する関数
 * @param roleName 役割名
 * @param roleDescription 役割の説明
 * @param industries 業界名の配列
 * @param keywords キーワードの配列
 * @returns 生成された知識グラフデータ
 */
async function generateKnowledgeGraph(
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
          // 不正な制御文字を削除し、JSONの修復を試みる
          let sanitized = cleanedContent.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            .replace(/\\n/g, ' ')
            .replace(/\\"/g, '"')
            .replace(/"\s+"/g, '","');
          
          // 末尾のカンマの処理（JSON配列内の最後の要素の後のカンマを削除）
          sanitized = sanitized.replace(/,\s*]/g, ']');
          // 閉じられていないブラケットを修正
          const openBrackets = (sanitized.match(/\[/g) || []).length;
          const closeBrackets = (sanitized.match(/\]/g) || []).length;
          if (openBrackets > closeBrackets) {
            sanitized = sanitized + ']'.repeat(openBrackets - closeBrackets);
          }
          // 閉じられていない中括弧を修正
          const openBraces = (sanitized.match(/\{/g) || []).length;
          const closeBraces = (sanitized.match(/\}/g) || []).length;
          if (openBraces > closeBraces) {
            sanitized = sanitized + '}'.repeat(openBraces - closeBraces);
          }
          
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
        // デフォルトの基本的なグラフデータを作成
        graphData = {
          nodes: [
            {
              id: crypto.randomUUID(),
              name: roleName,
              level: 0,
              type: "central",
              color: "#ff5722"
            },
            {
              id: crypto.randomUUID(),
              name: "情報収集目的",
              level: 1,
              type: "category",
              color: "#2196f3"
            },
            {
              id: crypto.randomUUID(),
              name: "情報源と技術リソース",
              level: 1,
              type: "category",
              color: "#4caf50"
            },
            {
              id: crypto.randomUUID(),
              name: "業界専門知識",
              level: 1,
              type: "category",
              color: "#9c27b0"
            },
            {
              id: crypto.randomUUID(),
              name: "トレンド分析",
              level: 1,
              type: "category",
              color: "#ff9800"
            },
            {
              id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
            name: roleName,
            level: 0,
            type: "central",
            color: "#ff5722"
          },
          {
            id: crypto.randomUUID(),
            name: "情報収集目的",
            level: 1,
            type: "category",
            color: "#2196f3"
          },
          {
            id: crypto.randomUUID(),
            name: "情報源と技術リソース",
            level: 1,
            type: "category",
            color: "#4caf50"
          },
          {
            id: crypto.randomUUID(),
            name: "業界専門知識",
            level: 1,
            type: "category",
            color: "#9c27b0"
          },
          {
            id: crypto.randomUUID(),
            name: "トレンド分析",
            level: 1,
            type: "category",
            color: "#ff9800"
          },
          {
            id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
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
async function saveKnowledgeGraphToDatabase(
  roleModelId: string,
  graphData: KnowledgeGraphData
): Promise<boolean> {
  try {
    console.log(`Saving knowledge graph to database for role model ID: ${roleModelId}`);
    console.log(`Graph data contains ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);
    
    // 既存のノードとエッジを削除する
    console.log(`Cleaning up existing knowledge graph data for role model ID: ${roleModelId}`);
    
    try {
      // まずエッジを削除（外部キー制約のため）
      await storage.deleteKnowledgeEdgesByRoleModelId(roleModelId);
      console.log(`Deleted existing edges for role model ID: ${roleModelId}`);
      
      // 次にノードを削除
      await storage.deleteKnowledgeNodesByRoleModelId(roleModelId);
      console.log(`Deleted existing nodes for role model ID: ${roleModelId}`);
    } catch (cleanupError) {
      console.error(`Error cleaning up existing knowledge graph data:`, cleanupError);
      // エラーが発生しても処理を継続
    }
    
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
        const parentId = node.parentId ? nodeIdMap.get(node.parentId as string) : null;
        
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
    
    // WebSocketを通じて知識グラフ更新通知を送信
    try {
      // データベースに保存した後、クライアントに通知を送信
      const graphPayload = {
        nodes: graphData.nodes.map(node => ({
          ...node,
          id: nodeIdMap.get(node.name) || randomUUID()
        })),
        edges: graphData.edges
      };
      
      // 複数の互換性のあるメッセージタイプで知識グラフ更新を通知
      sendKnowledgeGraphUpdate(roleModelId, graphPayload, 'update');
      
      console.log(`WebSocket notification sent for knowledge graph update (${graphData.nodes.length} nodes, ${graphData.edges.length} edges)`);
    } catch (notificationError) {
      console.error('Error sending WebSocket notification for knowledge graph update:', notificationError);
      // 通知エラーは処理成功に影響しない
    }
    
    return true;
  } catch (error) {
    console.error('Error saving knowledge graph to database:', error);
    return false;
  }
}