import { storage } from './storage';
import { 
  InsertKnowledgeNode, 
  InsertKnowledgeEdge 
} from '@shared/schema';

// 知識グラフデータの型定義
// ノードデータの型
export type KnowledgeNodeData = {
  name: string;
  level: number;
  type?: string;
  parentId?: string | null;
  description?: string | null;
  color?: string | null;
};

// エッジデータの型
export type KnowledgeEdgeData = {
  source: string;
  target: string;
  label?: string | null;
  strength?: number;
};

// 知識グラフデータの型定義
export type KnowledgeGraphData = {
  nodes: KnowledgeNodeData[];
  edges: KnowledgeEdgeData[];
};

import fetch from 'node-fetch';

// Function to get Azure OpenAI API key from environment variables
const getAPIKey = (): string => {
  const key = process.env.AZURE_OPENAI_KEY || 
              process.env.AZURE_OPENAI_API_KEY || 
              '';
  console.log(`[Azure OpenAI] APIキー設定状況: ${key ? '設定済み (長さ: ' + key.length + ')' : '未設定'}`);
  
  if (!key || key.length < 10) { // 有効なAPIキーの最小長をチェック
    console.warn('[Azure OpenAI] 警告: Azure OpenAI APIキーが正しく設定されていないか、短すぎます');
  }
  
  return key;
};

// Function to get Azure OpenAI endpoint from environment variables
const getEndpoint = (): string => {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
  console.log(`[Azure OpenAI] エンドポイント: ${endpoint || '未設定'}`);
  
  if (!endpoint || !endpoint.startsWith('https://')) {
    console.warn('[Azure OpenAI] 警告: Azure OpenAI エンドポイントが正しく設定されていないようです。通常はhttps://で始まります。');
  }
  
  return endpoint;
};

// Function to get Azure OpenAI deployment name from environment variables
const getDeploymentName = (): string => {
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  console.log(`[Azure OpenAI] デプロイメント名: ${deployment}`);
  
  return deployment;
};

// Azure OpenAI API request function
export async function callAzureOpenAI(messages: any[], temperature = 0.7, maxTokens = 1500): Promise<string> {
  const apiKey = getAPIKey();
  const endpoint = getEndpoint();
  const deploymentName = getDeploymentName();
  
  if (!apiKey || !endpoint) {
    console.error('[Azure OpenAI] エラー: API キーまたはエンドポイントが設定されていません');
    throw new Error('Azure OpenAI API key or endpoint not configured');
  }
  
  const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;
  
  try {
    console.log(`[Azure OpenAI] リクエスト送信: ${url} (メッセージ数: ${messages.length})`);
    console.log(`[Azure OpenAI] リクエスト設定: 温度=${temperature}, 最大トークン=${maxTokens}`);
    
    // リクエスト内容の簡易ログ
    const userMessages = messages.filter(msg => msg.role === 'user').map(msg => 
      msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '')
    );
    console.log(`[Azure OpenAI] ユーザーメッセージプレビュー:`, userMessages);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify({
        messages,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "text" } // JSONフォーマットを強制しない
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Azure OpenAI] API エラーレスポンス: ${response.status} ${errorText}`);
      throw new Error(`Azure OpenAI API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json() as {
      choices?: {
        message: {
          content: string;
        };
      }[];
    };
    
    // エージェントモジュール用に応答データから直接コンテンツを抽出して返す
    if (data && data.choices && data.choices.length > 0) {
      const content = data.choices[0].message.content;
      console.log(`[Azure OpenAI] 応答受信: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
      return content;
    } else {
      console.error('[Azure OpenAI] 応答構造が無効です:', data);
      throw new Error('Invalid response structure from Azure OpenAI API');
    }
  } catch (error) {
    console.error('[Azure OpenAI] 呼び出しエラー:', error);
    
    // エラーメッセージを明確に
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
        throw new Error(`Azure OpenAIエンドポイントに接続できません。ネットワーク接続またはエンドポイントURLを確認してください: ${error.message}`);
      } else if (error.message.includes('401')) {
        throw new Error(`Azure OpenAI認証エラー。APIキーが正しいか確認してください: ${error.message}`);
      } else if (error.message.includes('429')) {
        throw new Error(`Azure OpenAIレート制限に達しました。しばらく待ってから再試行してください: ${error.message}`);
      } else if (error.message.includes('500')) {
        throw new Error(`Azure OpenAIサーバーエラー。しばらく待ってから再試行してください: ${error.message}`);
      }
    }
    
    throw error;
  }
}

// タグの型定義
interface Tag {
  id: string;
  name: string;
  category: string;
}

// サマリー挿入用の型定義
interface InsertSummary {
  title: string;
  content: string;
  sources: string[];
  roleModelId: string;
  feedback: number;
}

// Function to generate a summary using Azure OpenAI
export async function generateSummary(
  roleModelId: string, 
  tags: Tag[]
): Promise<InsertSummary | null> {
  try {
    const apiKey = getAPIKey();
    const endpoint = getEndpoint();
    
    if (!apiKey || !endpoint) {
      throw new Error('Azure OpenAI API key or endpoint not configured');
    }
    
    // Construct tags string for the prompt
    const tagNames = tags.map(tag => tag.name).join(', ');
    
    // Fetch related summaries for context
    // In real implementation, we would search for relevant content based on tags
    
    // Simulated delay to represent API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const generateRandomTitle = () => {
      const topics = [
        'The Future of AI in Business',
        'Data Analytics Trends',
        'Machine Learning Applications',
        'Digital Transformation Insights',
        'Business Intelligence Strategies'
      ];
      return topics[Math.floor(Math.random() * topics.length)];
    };
    
    // This is a placeholder that would be replaced with real Azure OpenAI response
    return {
      title: generateRandomTitle(),
      content: `This is a placeholder for content that would be generated by Azure OpenAI based on your role model and tags: ${tagNames}. In production, this would contain actual summarized content from relevant sources.`,
      sources: ['https://example.com/placeholder-source'],
      roleModelId,
      feedback: 0
    };
    
  } catch (error) {
    console.error('Error generating summary:', error);
    return null;
  }
}

// Function to suggest tags based on role model description
export async function suggestTags(
  roleModelName: string, 
  roleModelDescription: string
): Promise<{ name: string, category: string }[]> {
  try {
    const apiKey = getAPIKey();
    const endpoint = getEndpoint();
    
    if (!apiKey || !endpoint) {
      throw new Error('Azure OpenAI API key or endpoint not configured');
    }
    
    // In production, this would make a real API call to Azure OpenAI
    // For now, we'll return some sensible defaults based on common categories
    
    let suggestedTags: { name: string, category: string }[] = [];
    
    // Business tags
    if (roleModelName.toLowerCase().includes('business') || 
        roleModelDescription.toLowerCase().includes('business') ||
        roleModelName.toLowerCase().includes('analyst') || 
        roleModelDescription.toLowerCase().includes('analyst')) {
      suggestedTags = suggestedTags.concat([
        { name: 'Business Strategy', category: 'Business' },
        { name: 'Data Analysis', category: 'Business' },
        { name: 'Market Research', category: 'Business' }
      ]);
    }
    
    // Technology tags
    if (roleModelName.toLowerCase().includes('tech') || 
        roleModelDescription.toLowerCase().includes('tech') ||
        roleModelName.toLowerCase().includes('engineer') || 
        roleModelDescription.toLowerCase().includes('engineer')) {
      suggestedTags = suggestedTags.concat([
        { name: 'Artificial Intelligence', category: 'Technology' },
        { name: 'Cloud Computing', category: 'Technology' },
        { name: 'Web Development', category: 'Technology' }
      ]);
    }
    
    // Default tags if nothing matches
    if (suggestedTags.length === 0) {
      suggestedTags = [
        { name: 'Professional Development', category: 'Career' },
        { name: 'Industry Trends', category: 'Trends' },
        { name: 'Innovation', category: 'Business' }
      ];
    }
    
    // Limit to 5 tags max
    return suggestedTags.slice(0, 5);
    
  } catch (error) {
    console.error('Error suggesting tags:', error);
    return [];
  }
}

// Function to collect information based on role model and tags
export async function collectInformation(
  roleModelId: string
): Promise<boolean> {
  try {
    // This function would trigger the information collection process
    // In production, it would make API calls to search for relevant content

    // For MVP, we'll simulate the process by creating a summary
    const roleModelWithTags = await storage.getRoleModelWithTags(roleModelId);
    
    if (!roleModelWithTags) {
      throw new Error('Role model not found');
    }
    
    // Generate a summary based on the role model and its tags
    const summary = await generateSummary(roleModelId, roleModelWithTags.tags);
    
    if (summary) {
      await storage.createSummary(summary);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error collecting information:', error);
    return false;
  }
}

// 既に冒頭で定義したので削除

/**
 * チャットメッセージに基づいて知識グラフを更新する関数
 * @param roleModelId ロールモデルID
 * @param graphUpdateData グラフ更新データ 
 * @returns 更新に成功したかどうか
 */
export async function updateKnowledgeGraphByChat(
  roleModelId: string,
  graphUpdateData: any
): Promise<boolean> {
  try {
    console.log(`[Azure OpenAI] チャットに基づく知識グラフ更新を開始: ロールモデル ${roleModelId}`);

    // 更新データが有効かチェック
    if (!graphUpdateData || typeof graphUpdateData !== 'object') {
      console.error('[Azure OpenAI] 無効な知識グラフ更新データ:', graphUpdateData);
      return false;
    }

    // ノードとエッジのプロパティが存在するかチェック
    const hasNodes = graphUpdateData.nodes && Array.isArray(graphUpdateData.nodes);
    const hasEdges = graphUpdateData.edges && Array.isArray(graphUpdateData.edges);

    if (!hasNodes && !hasEdges) {
      console.warn('[Azure OpenAI] 更新するノードまたはエッジがありません');
      return false;
    }

    // 既存のノードを取得（名前からIDへのマッピング用）
    const existingNodes = await storage.getKnowledgeNodesByRoleModel(roleModelId);
    
    // ノードの追加
    if (hasNodes) {
      for (const node of graphUpdateData.nodes) {
        // 必須フィールドのチェック
        if (!node.name) {
          console.warn('[Azure OpenAI] ノード名が指定されていません:', node);
          continue;
        }

        // 既存のノードと重複していないかチェック
        const existingNode = existingNodes.find(n => n.name.toLowerCase() === node.name.toLowerCase());
        if (existingNode) {
          console.log(`[Azure OpenAI] 既存のノードが見つかりました: ${node.name} (${existingNode.id})`);
          continue;
        }

        // 親ノードの処理（名前で指定されている場合はIDに変換）
        let parentId = node.parentId || null;
        if (parentId && typeof parentId === 'string') {
          // 親ノードがUUIDでなく名前で指定されている場合
          if (!isUUID(parentId)) {
            const parentNode = existingNodes.find(n => 
              n.name.toLowerCase() === parentId.toLowerCase()
            );
            
            if (parentNode) {
              parentId = parentNode.id;
            } else {
              console.warn(`[Azure OpenAI] 親ノード "${parentId}" が見つかりません。中心ノードに接続します。`);
              // 中心ノード（level 0）を探す
              const centralNode = existingNodes.find(n => n.level === 0);
              parentId = centralNode ? centralNode.id : null;
            }
          }
        }

        // ノードの作成
        const nodeData: InsertKnowledgeNode = {
          name: node.name,
          roleModelId,
          level: node.level || 2, // デフォルトはサブカテゴリレベル
          type: node.type || 'knowledge',
          parentId,
          description: node.description || null,
          color: node.color || null
        };

        try {
          const createdNode = await storage.createKnowledgeNode(nodeData);
          console.log(`[Azure OpenAI] 新しいノードを作成しました: ${node.name} (${createdNode.id})`);
          
          // 作成したノードを既存ノードリストに追加
          existingNodes.push(createdNode);

          // 親ノードが指定されている場合は接続する
          if (parentId) {
            const edgeData: InsertKnowledgeEdge = {
              sourceId: parentId,
              targetId: createdNode.id,
              roleModelId,
              label: node.parentRelation || "contains",
              strength: 3
            };
            
            await storage.createKnowledgeEdge(edgeData);
            console.log(`[Azure OpenAI] ノード間接続を作成: ${parentId} -> ${createdNode.id}`);
          }
        } catch (error) {
          console.error(`[Azure OpenAI] ノード "${node.name}" の作成に失敗:`, error);
        }
      }
    }

    // エッジの追加
    if (hasEdges) {
      for (const edge of graphUpdateData.edges) {
        // 必須フィールドのチェック
        if (!edge.source || !edge.target) {
          console.warn('[Azure OpenAI] エッジのsourceまたはtargetが指定されていません:', edge);
          continue;
        }

        // ソースノードとターゲットノードのIDを解決
        let sourceId = edge.source;
        let targetId = edge.target;

        // 名前からIDへの変換（必要な場合）
        if (!isUUID(sourceId)) {
          const sourceNode = existingNodes.find(n => 
            n.name.toLowerCase() === sourceId.toLowerCase()
          );
          if (sourceNode) {
            sourceId = sourceNode.id;
          } else {
            console.warn(`[Azure OpenAI] ソースノード "${sourceId}" が見つかりません。このエッジをスキップします。`);
            continue;
          }
        }

        if (!isUUID(targetId)) {
          const targetNode = existingNodes.find(n => 
            n.name.toLowerCase() === targetId.toLowerCase()
          );
          if (targetNode) {
            targetId = targetNode.id;
          } else {
            console.warn(`[Azure OpenAI] ターゲットノード "${targetId}" が見つかりません。このエッジをスキップします。`);
            continue;
          }
        }

        // 既存のエッジをチェック
        const existingEdges = await storage.getKnowledgeEdgesByRoleModel(roleModelId);
        const duplicateEdge = existingEdges.find(e => 
          e.sourceId === sourceId && e.targetId === targetId
        );

        if (duplicateEdge) {
          console.log(`[Azure OpenAI] 既存のエッジが見つかりました: ${sourceId} -> ${targetId}`);
          continue;
        }

        // エッジの作成
        const edgeData: InsertKnowledgeEdge = {
          sourceId,
          targetId,
          roleModelId,
          label: edge.label || null,
          strength: edge.strength || 2
        };

        try {
          await storage.createKnowledgeEdge(edgeData);
          console.log(`[Azure OpenAI] 新しいエッジを作成しました: ${sourceId} -> ${targetId}`);
        } catch (error) {
          console.error(`[Azure OpenAI] エッジの作成に失敗: ${sourceId} -> ${targetId}:`, error);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('[Azure OpenAI] 知識グラフ更新エラー:', error);
    return false;
  }
}

// UUIDかどうかを判定する関数
function isUUID(str: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

// Function to generate a knowledge graph for a role model using Azure OpenAI
export async function generateKnowledgeGraph(
  roleModelId: string,
  roleName: string,
  roleDescription: string,
  industries: string[],
  keywords: string[]
): Promise<KnowledgeGraphData> {
  try {
    console.log(`Generating knowledge graph for role model: ${roleName}`);
    console.log(`Industries: ${industries.join(', ')}`);
    console.log(`Keywords: ${keywords.join(', ')}`);
    
    let graphData: KnowledgeGraphData;
    
    try {
      // Try to get data from Azure OpenAI API
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
          throw new Error('Could not parse knowledge graph data from API response');
        }
      }
      
      // 有効な知識グラフ構造かどうかを検証
      if (!graphData || !graphData.nodes || !Array.isArray(graphData.nodes) || graphData.nodes.length === 0 ||
          !graphData.edges || !Array.isArray(graphData.edges)) {
        console.error('Invalid knowledge graph structure:', JSON.stringify(graphData).substring(0, 200) + '...');
        throw new Error('Invalid knowledge graph structure received from API');
      }
      
      // 中心ノード（レベル0）の存在チェック
      const hasCentralNode = graphData.nodes.some(node => node.level === 0);
      if (!hasCentralNode) {
        console.error('Central node (level 0) is missing in the knowledge graph');
        throw new Error('Knowledge graph missing central node (level 0)');
      }
      
      console.log("Successfully generated knowledge graph using Azure OpenAI");
      
    } catch (apiError) {
      console.error("Error calling Azure OpenAI:", apiError);
      console.warn("Falling back to predefined graph templates");
      
      // Fallback to predefined templates
      if (roleName.toLowerCase().includes('business') || 
          roleName.toLowerCase().includes('architect') || 
          roleName.toLowerCase().includes('ビジネス') || 
          roleName.toLowerCase().includes('アーキテクト') ||
          roleDescription.toLowerCase().includes('business architect') ||
          roleDescription.toLowerCase().includes('ビジネスアーキテクト')) {
        graphData = getBusinessArchitectGraph(roleModelId);
      } else {
        // Use a generic graph structure
        graphData = getGenericRoleGraph(roleModelId, roleName);
      }
    }
    
    // Create all the nodes first
    // 最初に親ノード参照がないノードを作成し、次に親参照があるノードを作成する
    // これによりparentIdにノード名ではなく実際のノードIDを使用できる
    const nodeIdMap = new Map<string, string>(); // Maps original node names to their database IDs
    
    // 1. 親がないノード（レベル0と1）を先に作成
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
      
      const createdNode = await storage.createKnowledgeNode(nodeData);
      nodeIdMap.set(node.name, createdNode.id);
      console.log(`Created node without parent: ${node.name} -> ${createdNode.id}`);
    }
    
    // 2. 親が参照されているノードを作成（レベル2以上）- 親のIDをnodeIdMapから取得
    const nodesWithParents = graphData.nodes.filter(node => node.parentId);
    for (const node of nodesWithParents) {
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
      console.log(`Created node with parent: ${node.name} -> ${createdNode.id}, parent: ${parentId}`);
    }
    
    // Create all the edges
    for (const edge of graphData.edges) {
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
      }
    }
    
    console.log(`Successfully created knowledge graph for ${roleName} with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);
    return graphData;
    
  } catch (error) {
    console.error('Error generating knowledge graph:', error);
    throw error;
  }
}

// 廃止した古い関数のコードを削除（重複関数）

// Function to generate knowledge graph for a specific node
export async function generateKnowledgeGraphForNode(
  roleModelId: string,
  nodeName: string,
  nodeId: string
): Promise<boolean> {
  try {
    console.log(`Generating additional knowledge graph for node: ${nodeName}`);
    
    // Get the parent node to determine its level
    const parentNode = await storage.getKnowledgeNode(nodeId);
    if (!parentNode) {
      throw new Error(`Parent node not found: ${nodeId}`);
    }
    
    const childLevel = parentNode.level + 1;
    const subNodes: KnowledgeNodeData[] = [];
    
    try {
      // Try to generate sub-nodes using Azure OpenAI
      const messages = [
        {
          role: "system",
          content: "あなたは知識グラフ生成の専門家です。与えられた概念やスキルを詳細に分解し、適切なサブノードを作成してください。\n\n以下の点に注意してください：\n1. 生成するサブノードは特定的、情報豊富、かつ親概念に直接関連するものにすること\n2. それぞれのサブノードには名前(name)と説明(description)を含めること\n3. サブノードはビジネス/技術領域で実際に使用される具体的な概念やスキルであること\n4. 日本語で出力すること\n5. 出力はJSON形式の配列であること"
        },
        {
          role: "user",
          content: `概念「${nodeName}」のサブノードを4-6個生成してください。\nこれらのサブノードは親概念の一部であるより具体的な概念やスキルを表します。\n\n現在のノードレベルは${parentNode.level}で、サブノードのレベルは${childLevel}になります。\nレベル${childLevel}は${childLevel <= 2 ? 'まだ抽象的な概念' : 'より具体的なスキルや知識'}を表します。\n\nそれぞれのサブノードには下記の情報を含めてください：\n1. name: サブノードの名前（簡潔で明確な表現）\n2. description: このサブノードが${nodeName}に関連する理由や重要性の説明\n3. type: "${childLevel <= 2 ? 'subcategory' : 'skill'}"（すでに設定済み）\n\n以下の形式の有効なJSONで出力してください:\n[\n  {\n    "name": "サブ概念1",\n    "description": "このサブ概念の説明と親概念との関連性"\n  },\n  {\n    "name": "サブ概念2",\n    "description": "このサブ概念の説明と親概念との関連性"\n  },\n  ...\n]`
        }
      ];
      
      const responseContent = await callAzureOpenAI(messages, 0.7, 1000);
      
      try {
        const generatedNodes = JSON.parse(responseContent);
        
        // Convert to the right format
        generatedNodes.forEach((node: any) => {
          subNodes.push({
            name: node.name,
            level: childLevel,
            parentId: nodeId
          });
        });
        
        console.log(`Successfully generated ${subNodes.length} sub-nodes with Azure OpenAI`);
      } catch (err: unknown) {
        if (err instanceof Error) {
          throw new Error("Invalid response from Azure OpenAI: " + err.message);
        } else {
          throw new Error("Invalid response from Azure OpenAI: Unknown error");
        }
      }
    } catch (apiError) {
      console.error("Error calling Azure OpenAI for node expansion:", apiError);
      console.warn("Falling back to predefined templates");
      
      // Fallback to predefined templates
      if (nodeName.toLowerCase().includes('digital')) {
        subNodes.push(
          { name: 'Digital Transformation', level: childLevel, parentId: nodeId },
          { name: 'Digital Marketing', level: childLevel, parentId: nodeId },
          { name: 'Digital Product Design', level: childLevel, parentId: nodeId }
        );
      } else if (nodeName.toLowerCase().includes('data')) {
        subNodes.push(
          { name: 'Data Visualization', level: childLevel, parentId: nodeId },
          { name: 'Data Engineering', level: childLevel, parentId: nodeId },
          { name: 'Business Intelligence', level: childLevel, parentId: nodeId }
        );
      } else if (nodeName.toLowerCase().includes('strategy')) {
        subNodes.push(
          { name: 'Strategic Planning', level: childLevel, parentId: nodeId },
          { name: 'Competitive Analysis', level: childLevel, parentId: nodeId },
          { name: 'Market Positioning', level: childLevel, parentId: nodeId }
        );
      } else {
        // Generate generic sub-nodes
        const prefixes = ['Advanced', 'Strategic', 'Modern', 'Innovative'];
        const suffixes = ['Approach', 'Methodology', 'Framework', 'Practice'];
        
        const numNodes = Math.floor(Math.random() * 3) + 2; // 2-4 nodes
        for (let i = 0; i < numNodes; i++) {
          const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
          const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
          subNodes.push({
            name: `${prefix} ${nodeName} ${suffix}`,
            level: childLevel,
            parentId: nodeId
          });
        }
      }
    }
    
    // Create all sub-nodes in the database
    for (const node of subNodes) {
      const nodeData: InsertKnowledgeNode = {
        name: node.name,
        roleModelId,
        level: node.level,
        type: childLevel <= 2 ? 'subcategory' : 'skill',
        parentId: node.parentId,
        description: node.description || null,
        color: node.color || null
      };
      
      const createdNode = await storage.createKnowledgeNode(nodeData);
      
      // Create edge from parent to this node
      const edgeData: InsertKnowledgeEdge = {
        sourceId: nodeId,
        targetId: createdNode.id,
        roleModelId,
        label: "contains",
        strength: 3
      };
      
      await storage.createKnowledgeEdge(edgeData);
    }
    
    console.log(`Successfully created ${subNodes.length} sub-nodes for ${nodeName}`);
    return true;
  } catch (error) {
    console.error('Error generating knowledge graph for node:', error);
    return false;
  }
}

// Template function for business architect role
function getBusinessArchitectGraph(roleModelId: string): KnowledgeGraphData {
  // ノードとエッジを直接定義
  const graph: KnowledgeGraphData = {
    nodes: [
      {
        name: "ビジネスアーキテクト",
        level: 0,
        type: "central",
        color: "#4A90E2",
        description: "ビジネス戦略と技術をつなぐ役割を担う専門家"
      },
      {
        name: "情報収集目的",
        level: 1,
        type: "category",
        color: "#50E3C2",
        description: "ビジネスアーキテクトが情報を収集する目的"
      },
      {
        name: "情報源と技術リソース",
        level: 1,
        type: "category",
        color: "#B8E986",
        description: "情報を取得するための信頼できるソースとツール"
      },
      {
        name: "業界専門知識",
        level: 1,
        type: "category",
        color: "#F5A623",
        description: "特定の業界に関する専門的な知識と洞察"
      },
      {
        name: "トレンド分析",
        level: 1,
        type: "category",
        color: "#F8E71C",
        description: "最新の技術とビジネストレンドの追跡と分析"
      },
      {
        name: "実践応用分野",
        level: 1,
        type: "category",
        color: "#BD10E0",
        description: "収集した情報の具体的な応用分野"
      },
      // レベル2のノード - 情報収集目的
      {
        name: "ビジネス戦略策定",
        level: 2,
        parentId: "情報収集目的",
        type: "subcategory",
        color: "#50E3C2",
        description: "企業の長期的な方向性と成功のための計画立案"
      },
      {
        name: "意思決定支援",
        level: 2,
        parentId: "情報収集目的",
        type: "subcategory",
        color: "#50E3C2",
        description: "データに基づいた効果的な経営判断のサポート"
      },
      {
        name: "イノベーション促進",
        level: 2,
        parentId: "情報収集目的",
        type: "subcategory",
        color: "#50E3C2",
        description: "新しいビジネスモデルや製品・サービスの創出"
      },
      {
        name: "リスク管理",
        level: 2,
        parentId: "情報収集目的",
        type: "subcategory",
        color: "#50E3C2",
        description: "潜在的なリスクの特定と対策の立案"
      },
      // レベル2のノード - 情報源と技術リソース
      {
        name: "業界レポート",
        level: 2,
        parentId: "情報源と技術リソース",
        type: "subcategory",
        color: "#B8E986",
        description: "専門機関による市場分析と業界動向"
      },
      {
        name: "テクノロジーブログ",
        level: 2,
        parentId: "情報源と技術リソース",
        type: "subcategory",
        color: "#B8E986",
        description: "最新技術トレンドと実装事例の情報源"
      },
      {
        name: "オンライン学習プラットフォーム",
        level: 2,
        parentId: "情報源と技術リソース",
        type: "subcategory",
        color: "#B8E986",
        description: "継続的なスキルアップのための教育リソース"
      },
      {
        name: "ネットワーキングイベント",
        level: 2,
        parentId: "情報源と技術リソース",
        type: "subcategory",
        color: "#B8E986",
        description: "業界専門家との交流と知見共有の場"
      },
      // レベル2のノード - 業界専門知識
      {
        name: "デジタルトランスフォーメーション",
        level: 2,
        parentId: "業界専門知識",
        type: "subcategory",
        color: "#F5A623",
        description: "ビジネスモデルのデジタル化と組織変革"
      },
      {
        name: "クラウドコンピューティング",
        level: 2,
        parentId: "業界専門知識",
        type: "subcategory",
        color: "#F5A623",
        description: "クラウドベースのインフラとサービス"
      },
      {
        name: "データアナリティクス",
        level: 2,
        parentId: "業界専門知識",
        type: "subcategory",
        color: "#F5A623",
        description: "ビジネスデータの分析と活用手法"
      },
      {
        name: "エンタープライズアーキテクチャ",
        level: 2,
        parentId: "業界専門知識",
        type: "subcategory",
        color: "#F5A623",
        description: "組織全体のIT構造と業務プロセスの設計"
      }
    ],
    edges: [
      // 中心からレベル1へのエッジ
      {
        source: "ビジネスアーキテクト",
        target: "情報収集目的",
        label: "必要とする",
        strength: 5
      },
      {
        source: "ビジネスアーキテクト",
        target: "情報源と技術リソース",
        label: "必要とする",
        strength: 5
      },
      {
        source: "ビジネスアーキテクト",
        target: "業界専門知識",
        label: "必要とする",
        strength: 5
      },
      {
        source: "ビジネスアーキテクト",
        target: "トレンド分析",
        label: "必要とする",
        strength: 5
      },
      {
        source: "ビジネスアーキテクト",
        target: "実践応用分野",
        label: "必要とする",
        strength: 5
      },
      
      // 情報収集目的からのエッジ
      {
        source: "情報収集目的",
        target: "ビジネス戦略策定",
        label: "含む",
        strength: 4
      },
      {
        source: "情報収集目的",
        target: "意思決定支援",
        label: "含む",
        strength: 4
      },
      {
        source: "情報収集目的",
        target: "イノベーション促進",
        label: "含む",
        strength: 4
      },
      {
        source: "情報収集目的",
        target: "リスク管理",
        label: "含む",
        strength: 4
      },
      
      // 情報源と技術リソースからのエッジ
      {
        source: "情報源と技術リソース",
        target: "業界レポート",
        label: "含む",
        strength: 4
      },
      {
        source: "情報源と技術リソース",
        target: "テクノロジーブログ",
        label: "含む",
        strength: 4
      },
      {
        source: "情報源と技術リソース",
        target: "オンライン学習プラットフォーム",
        label: "含む",
        strength: 4
      },
      {
        source: "情報源と技術リソース",
        target: "ネットワーキングイベント",
        label: "含む",
        strength: 4
      },
      
      // 業界専門知識からのエッジ
      {
        source: "業界専門知識",
        target: "デジタルトランスフォーメーション",
        label: "含む",
        strength: 4
      },
      {
        source: "業界専門知識",
        target: "クラウドコンピューティング",
        label: "含む",
        strength: 4
      },
      {
        source: "業界専門知識",
        target: "データアナリティクス",
        label: "含む",
        strength: 4
      },
      {
        source: "業界専門知識",
        target: "エンタープライズアーキテクチャ",
        label: "含む",
        strength: 4
      },
      
      // 関連するノード間のエッジ
      {
        source: "ビジネス戦略策定",
        target: "デジタルトランスフォーメーション",
        label: "活用する",
        strength: 3
      },
      {
        source: "データアナリティクス",
        target: "意思決定支援",
        label: "促進する",
        strength: 4
      },
      {
        source: "クラウドコンピューティング",
        target: "デジタルトランスフォーメーション",
        label: "支援する",
        strength: 3
      }
    ]
  };
  
  return graph;
}

// Template function for generic role
function getGenericRoleGraph(roleModelId: string, roleName: string): KnowledgeGraphData {
  // ノードとエッジを直接定義
  const graph: KnowledgeGraphData = {
    nodes: [
      {
        name: roleName,
        level: 0,
        type: "central",
        color: "#4A90E2",
        description: `${roleName}の役割に関する知識マップ`
      },
      {
        name: "情報収集目的",
        level: 1,
        type: "category",
        color: "#50E3C2",
        description: "情報を収集する主な目的"
      },
      {
        name: "情報源と技術リソース",
        level: 1,
        type: "category",
        color: "#B8E986",
        description: "情報を取得するための信頼できるソースとツール"
      },
      {
        name: "業界専門知識",
        level: 1,
        type: "category",
        color: "#F5A623",
        description: "特定の業界に関する専門的な知識と洞察"
      },
      {
        name: "トレンド分析",
        level: 1,
        type: "category",
        color: "#F8E71C",
        description: "最新の技術とビジネストレンドの追跡と分析"
      },
      {
        name: "実践応用分野",
        level: 1,
        type: "category",
        color: "#BD10E0",
        description: "収集した情報の具体的な応用分野"
      },
      // レベル2のノード - 情報収集目的
      {
        name: "専門知識の向上",
        level: 2,
        parentId: "情報収集目的",
        type: "subcategory",
        color: "#50E3C2",
        description: "自己の専門性を高めるための継続的な学習"
      },
      {
        name: "業界動向の把握",
        level: 2,
        parentId: "情報収集目的",
        type: "subcategory",
        color: "#50E3C2",
        description: "市場の変化や新しいトレンドの理解"
      },
      {
        name: "問題解決能力の強化",
        level: 2,
        parentId: "情報収集目的",
        type: "subcategory",
        color: "#50E3C2",
        description: "様々な課題に対応するための知識とスキルの蓄積"
      },
      // レベル2のノード - 情報源と技術リソース
      {
        name: "専門誌と書籍",
        level: 2,
        parentId: "情報源と技術リソース",
        type: "subcategory",
        color: "#B8E986",
        description: "体系的な知識を得るための信頼性の高い情報源"
      },
      {
        name: "オンラインコミュニティ",
        level: 2,
        parentId: "情報源と技術リソース",
        type: "subcategory",
        color: "#B8E986",
        description: "専門家との知識共有と質問の場"
      },
      {
        name: "データ分析ツール",
        level: 2,
        parentId: "情報源と技術リソース",
        type: "subcategory",
        color: "#B8E986",
        description: "情報の整理と分析のための技術リソース"
      },
      // レベル2のノード - 業界専門知識
      {
        name: "基礎理論と概念",
        level: 2,
        parentId: "業界専門知識",
        type: "subcategory",
        color: "#F5A623",
        description: "業界の基本的な考え方とフレームワーク"
      },
      {
        name: "最新技術の動向",
        level: 2,
        parentId: "業界専門知識",
        type: "subcategory",
        color: "#F5A623",
        description: "新しい技術の発展と応用可能性"
      },
      {
        name: "業界の課題と機会",
        level: 2,
        parentId: "業界専門知識",
        type: "subcategory",
        color: "#F5A623",
        description: "現在の問題点と将来的な成長機会"
      }
    ],
    edges: [
      // 中心からレベル1へのエッジ
      {
        source: roleName,
        target: "情報収集目的",
        label: "必要とする",
        strength: 5
      },
      {
        source: roleName,
        target: "情報源と技術リソース",
        label: "必要とする",
        strength: 5
      },
      {
        source: roleName,
        target: "業界専門知識",
        label: "必要とする",
        strength: 5
      },
      {
        source: roleName,
        target: "トレンド分析",
        label: "必要とする",
        strength: 5
      },
      {
        source: roleName,
        target: "実践応用分野",
        label: "必要とする",
        strength: 5
      },
      
      // 情報収集目的からのエッジ
      {
        source: "情報収集目的",
        target: "専門知識の向上",
        label: "含む",
        strength: 4
      },
      {
        source: "情報収集目的",
        target: "業界動向の把握",
        label: "含む",
        strength: 4
      },
      {
        source: "情報収集目的",
        target: "問題解決能力の強化",
        label: "含む",
        strength: 4
      },
      
      // 情報源と技術リソースからのエッジ
      {
        source: "情報源と技術リソース",
        target: "専門誌と書籍",
        label: "含む",
        strength: 4
      },
      {
        source: "情報源と技術リソース",
        target: "オンラインコミュニティ",
        label: "含む",
        strength: 4
      },
      {
        source: "情報源と技術リソース",
        target: "データ分析ツール",
        label: "含む",
        strength: 4
      },
      
      // 業界専門知識からのエッジ
      {
        source: "業界専門知識",
        target: "基礎理論と概念",
        label: "含む",
        strength: 4
      },
      {
        source: "業界専門知識",
        target: "最新技術の動向",
        label: "含む",
        strength: 4
      },
      {
        source: "業界専門知識",
        target: "業界の課題と機会",
        label: "含む",
        strength: 4
      },
      
      // 関連するノード間のエッジ
      {
        source: "業界動向の把握",
        target: "最新技術の動向",
        label: "関連する",
        strength: 3
      },
      {
        source: "データ分析ツール",
        target: "問題解決能力の強化",
        label: "支援する",
        strength: 3
      }
    ]
  };
  
  return graph;
}