import { storage } from './storage';
import { InsertSummary, Tag, InsertKnowledgeNode, InsertKnowledgeEdge } from '@shared/schema';

import fetch from 'node-fetch';

// Function to get Azure OpenAI API key from environment variables
const getAPIKey = (): string => {
  const key = process.env.AZURE_OPENAI_KEY || 
              process.env.AZURE_OPENAI_API_KEY || 
              '';
  console.log(`Azure OpenAI Key configured: ${key ? 'Yes (Length: ' + key.length + ')' : 'No'}`);
  return key;
};

// Function to get Azure OpenAI endpoint from environment variables
const getEndpoint = (): string => {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
  console.log(`Azure OpenAI Endpoint: ${endpoint}`);
  return endpoint;
};

// Function to get Azure OpenAI deployment name from environment variables
const getDeploymentName = (): string => {
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  console.log(`Azure OpenAI Deployment: ${deployment}`);
  return deployment;
};

// Azure OpenAI API request function
export async function callAzureOpenAI(messages: any[], temperature = 0.7, maxTokens = 1500): Promise<string> {
  const apiKey = getAPIKey();
  const endpoint = getEndpoint();
  const deploymentName = getDeploymentName();
  
  if (!apiKey || !endpoint) {
    throw new Error('Azure OpenAI API key or endpoint not configured');
  }
  
  const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`;
  
  try {
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
        response_format: { type: "json_object" }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
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
      return data.choices[0].message.content;
    } else {
      throw new Error('Invalid response structure from Azure OpenAI API');
    }
  } catch (error) {
    console.error('Error calling Azure OpenAI:', error);
    throw error;
  }
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

// Type definitions for knowledge graph generation
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

type KnowledgeGraphData = {
  nodes: KnowledgeNodeData[];
  edges: KnowledgeEdgeData[];
};

// Function to generate a knowledge graph for a role model using Azure OpenAI
export async function generateKnowledgeGraph(
  roleModelId: string,
  roleName: string,
  roleDescription: string
): Promise<boolean> {
  try {
    console.log(`Generating knowledge graph for role model: ${roleName}`);
    
    // 業界とキーワードデータを取得
    let industries: string[] = [];
    let keywords: string[] = [];
    
    try {
      // 業界データを取得
      const roleModelIndustries = await storage.getRoleModelIndustriesWithData(roleModelId);
      if (roleModelIndustries && roleModelIndustries.length > 0) {
        industries = roleModelIndustries.map(i => i.name);
      }
      
      // キーワードデータを取得
      const roleModelKeywords = await storage.getRoleModelKeywordsWithData(roleModelId);
      if (roleModelKeywords && roleModelKeywords.length > 0) {
        keywords = roleModelKeywords.map(k => k.name);
      }
      
      console.log(`Retrieved ${industries.length} industries and ${keywords.length} keywords for role model`);
    } catch (error) {
      console.error("Error retrieving industries and keywords:", error);
      // エラーが発生しても処理を続行 - 空の配列を使用
    }
    
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
    return true;
    
  } catch (error) {
    console.error('Error generating knowledge graph:', error);
    return false;
  }
}

// Function to update knowledge graph based on chat prompt
export async function updateKnowledgeGraphByChat(
  roleModelId: string,
  prompt: string
): Promise<boolean> {
  try {
    console.log(`Updating knowledge graph for role model ${roleModelId} with prompt: ${prompt}`);
    
    // Get existing nodes and edges
    const existingNodes = await storage.getKnowledgeNodes(roleModelId);
    const existingEdges = await storage.getKnowledgeEdges(roleModelId);
    
    if (existingNodes.length === 0) {
      throw new Error("ナレッジグラフが存在しません。まず基本的なグラフを生成してください。");
    }
    
    // Format existing data for context
    const nodesInfo = existingNodes.map(node => 
      `ID: ${node.id}, 名前: ${node.name}, レベル: ${node.level}, タイプ: ${node.type}, 親: ${node.parentId || 'なし'}`
    ).join('\n');
    
    const edgesInfo = existingEdges.map(edge => 
      `ID: ${edge.id}, ソース: ${edge.sourceId}, ターゲット: ${edge.targetId}, ラベル: ${edge.label || 'なし'}`
    ).join('\n');
    
    // Ask OpenAI for graph updates
    const messages = [
      {
        role: "system",
        content: "あなたは知識グラフを更新する専門家です。ユーザーの指示に基づいて既存の知識グラフを拡張・修正します。\n\n現在の知識グラフ構造は以下の通りです：\n\n【ノード一覧】\n" + nodesInfo + "\n\n【エッジ（関連性）一覧】\n" + edgesInfo + "\n\nユーザーの指示に基づいて、追加・修正すべきノードとエッジを提案してください。出力は以下のJSON形式で行ってください：\n\n{\n  \"addNodes\": [\n    {\n      \"name\": \"新しいノード名\",\n      \"level\": 2,\n      \"type\": \"subcategory\",\n      \"parentId\": \"親ノードのID\",\n      \"description\": \"ノードの説明\",\n      \"color\": \"#hexcode\"\n    },\n    ...\n  ],\n  \"addEdges\": [\n    {\n      \"sourceId\": \"始点ノードのID\",\n      \"targetId\": \"終点ノードのID\",\n      \"label\": \"関係性の説明\",\n      \"strength\": 3\n    },\n    ...\n  ],\n  \"updateNodes\": [\n    {\n      \"id\": \"更新するノードのID\",\n      \"name\": \"新しい名前\",\n      \"description\": \"新しい説明\",\n      \"color\": \"新しい色\"\n    },\n    ...\n  ]\n}\n\n注意点：\n1. 新しいノードを追加する場合は、必ず既存のノード構造と整合性を保つこと\n2. エッジを追加する場合は、実在するノードIDを使用すること\n3. ノードを更新する場合は、必ず実在するノードIDを使用すること\n4. ユーザーの指示に直接応答せず、JSONデータのみを出力すること"
      },
      {
        role: "user",
        content: `以下のユーザー指示に基づいて知識グラフを更新してください：\n\n"${prompt}"`
      }
    ];
    
    const responseContent = await callAzureOpenAI(messages, 0.7, 2000);
    const updates = JSON.parse(responseContent);
    
    // Process node additions
    if (updates.addNodes && Array.isArray(updates.addNodes)) {
      for (const node of updates.addNodes) {
        // Find parent ID if specified by name instead of ID
        let parentId = node.parentId;
        if (parentId && !existingNodes.some(n => n.id === parentId)) {
          // This might be a node name, not an ID
          const parentNode = existingNodes.find(n => n.name === parentId);
          if (parentNode) {
            parentId = parentNode.id;
          } else {
            parentId = null;
          }
        }
        
        const nodeData: InsertKnowledgeNode = {
          name: node.name,
          roleModelId,
          level: node.level || 2,
          type: node.type || 'keyword',
          parentId: parentId,
          description: node.description || null,
          color: node.color || null
        };
        
        const createdNode = await storage.createKnowledgeNode(nodeData);
        
        // Connect to parent if exists
        if (parentId) {
          const edgeData: InsertKnowledgeEdge = {
            sourceId: parentId,
            targetId: createdNode.id,
            roleModelId,
            label: "contains",
            strength: 3
          };
          
          await storage.createKnowledgeEdge(edgeData);
        }
        
        console.log(`Created new node: ${node.name} -> ${createdNode.id}`);
      }
    }
    
    // Process edge additions
    if (updates.addEdges && Array.isArray(updates.addEdges)) {
      for (const edge of updates.addEdges) {
        // Ensure source and target nodes exist
        let sourceId = edge.sourceId;
        let targetId = edge.targetId;
        
        // Check if IDs are actually node names
        if (sourceId && !existingNodes.some(n => n.id === sourceId)) {
          const sourceNode = existingNodes.find(n => n.name === sourceId);
          if (sourceNode) sourceId = sourceNode.id;
        }
        
        if (targetId && !existingNodes.some(n => n.id === targetId)) {
          const targetNode = existingNodes.find(n => n.name === targetId);
          if (targetNode) targetId = targetNode.id;
        }
        
        if (!sourceId || !targetId) {
          console.warn(`Cannot create edge: Invalid source or target ID`);
          continue;
        }
        
        const edgeData: InsertKnowledgeEdge = {
          sourceId,
          targetId,
          roleModelId,
          label: edge.label || null,
          strength: edge.strength || 2
        };
        
        const createdEdge = await storage.createKnowledgeEdge(edgeData);
        console.log(`Created new edge: ${sourceId} -> ${targetId}`);
      }
    }
    
    // Process node updates
    if (updates.updateNodes && Array.isArray(updates.updateNodes)) {
      for (const nodeUpdate of updates.updateNodes) {
        if (!nodeUpdate.id) continue;
        
        const updateData: Partial<InsertKnowledgeNode> = {};
        if (nodeUpdate.name) updateData.name = nodeUpdate.name;
        if (nodeUpdate.description) updateData.description = nodeUpdate.description;
        if (nodeUpdate.color) updateData.color = nodeUpdate.color;
        
        await storage.updateKnowledgeNode(nodeUpdate.id, updateData);
        console.log(`Updated node: ${nodeUpdate.id}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error updating knowledge graph by chat:', error);
    return false;
  }
}

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
  return {
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
    edges: []
  };
  
  // エッジを自動的に生成
  const edges: KnowledgeEdgeData[] = [];
  
  // 中心ノードからレベル1のカテゴリへのエッジ
  const centralNode = "ビジネスアーキテクト";
  const level1Nodes = [
    "情報収集目的",
    "情報源と技術リソース",
    "業界専門知識",
    "トレンド分析",
    "実践応用分野"
  ];
  
  // 中心からレベル1へのエッジ
  level1Nodes.forEach(targetNode => {
    edges.push({
      source: centralNode,
      target: targetNode,
      label: "必要とする",
      strength: 5
    });
  });
  
  // レベル1からレベル2へのエッジ
  const level2Mapping: {[key: string]: string[]} = {
    "情報収集目的": [
      "ビジネス戦略策定",
      "意思決定支援",
      "イノベーション促進",
      "リスク管理"
    ],
    "情報源と技術リソース": [
      "業界レポート",
      "テクノロジーブログ",
      "オンライン学習プラットフォーム",
      "ネットワーキングイベント"
    ],
    "業界専門知識": [
      "デジタルトランスフォーメーション",
      "クラウドコンピューティング",
      "データアナリティクス",
      "エンタープライズアーキテクチャ"
    ]
  };
  
  // レベル1からレベル2へのエッジを追加
  Object.entries(level2Mapping).forEach(([source, targets]) => {
    targets.forEach(target => {
      edges.push({
        source,
        target,
        label: "含む",
        strength: 4
      });
    });
  });
  
  // 関連するノード間のエッジ
  edges.push(
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
  );
  
  return {
    nodes: node => node,
    edges: edges
  };
}

// Template function for generic role
function getGenericRoleGraph(roleModelId: string, roleName: string): KnowledgeGraphData {
  return {
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
    edges: []
  };
  
  // エッジを自動的に生成
  const edges: KnowledgeEdgeData[] = [];
  
  // 中心ノードからレベル1のカテゴリへのエッジ
  const centralNode = roleName;
  const level1Nodes = [
    "情報収集目的",
    "情報源と技術リソース",
    "業界専門知識",
    "トレンド分析",
    "実践応用分野"
  ];
  
  // 中心からレベル1へのエッジ
  level1Nodes.forEach(targetNode => {
    edges.push({
      source: centralNode,
      target: targetNode,
      label: "必要とする",
      strength: 5
    });
  });
  
  // レベル1からレベル2へのエッジ
  const level2Mapping: {[key: string]: string[]} = {
    "情報収集目的": [
      "専門知識の向上",
      "業界動向の把握",
      "問題解決能力の強化"
    ],
    "情報源と技術リソース": [
      "専門誌と書籍",
      "オンラインコミュニティ",
      "データ分析ツール"
    ],
    "業界専門知識": [
      "基礎理論と概念",
      "最新技術の動向",
      "業界の課題と機会"
    ]
  };
  
  // レベル1からレベル2へのエッジを追加
  Object.entries(level2Mapping).forEach(([source, targets]) => {
    targets.forEach(target => {
      edges.push({
        source,
        target,
        label: "含む",
        strength: 4
      });
    });
  });
  
  // 関連するノード間のエッジ
  edges.push(
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
  );
  
  return {
    nodes: node => node,
    edges: edges
  };
}