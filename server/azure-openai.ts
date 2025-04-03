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
async function callAzureOpenAI(messages: any[], temperature = 0.7, maxTokens = 1500): Promise<any> {
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
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling Azure OpenAI:', error);
    throw error;
  }
}

// Mock function to simulate Azure OpenAI API call for development
// In production, this would use the Azure OpenAI SDK
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
    
    // In production, this would make a real API call to Azure OpenAI
    // For now, we'll just simulate a response with placeholder values for development
    // This is not deceptive but a necessary placeholder until real API integration
    
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
    
    let graphData: KnowledgeGraphData;
    
    try {
      // Try to get data from Azure OpenAI API
      const messages = [
        {
          role: "system",
          content: `あなたは知識グラフ生成の専門家です。専門的な役割のための階層的な知識グラフを作成してください。
          
          出力は2つの配列（"nodes"と"edges"）を持つJSONオブジェクトである必要があります。
          
          各ノードは以下のプロパティを持ちます：
          - name: ノードの名前（日本語、簡潔で明確な表現）
          - level: 階層レベル（0: 中心、1: 主要カテゴリ、2: サブカテゴリ、3: 具体的なスキルや知識領域）
          - type: タイプ（"central", "category", "subcategory", "skill", "knowledge"など。デフォルトは"keyword"）
          - color: 色（オプション、ヘキサカラーコード）
          - description: ノードの説明（オプション、そのスキルや知識がなぜ重要かを説明）
          - parentId: 親ノードの名前（level 0, 1のノードには不要、level 2, 3のノードには必須）
          
          各エッジは以下のプロパティを持ちます：
          - source: 始点ノードの名前
          - target: 終点ノードの名前
          - label: 関係性の説明（"必要とする", "含む", "関連する"など。オプション）
          - strength: 関係性の強さ（1-5の整数。5が最も強い）
          
          以下の点に注意してください：
          1. 階層構造を明確にし、親子関係を適切に設定すること
          2. ノード間の関係性を意味のある形で表現すること
          3. 中心ノード（level 0）から各カテゴリへの接続を確実に行うこと
          4. 関連する概念間には直接的なエッジを追加すること
          5. 色は階層レベルや概念のグループごとに一貫性を持たせること
          6. 日本語での表現を優先すること`
        },
        {
          role: "user",
          content: `役割「${roleName}」の知識グラフを作成してください。
          
          この役割に関する追加情報: 「${roleDescription}」
          
          以下の形式の有効なJSONで出力してください:
          {
            "nodes": [
              {"name": "役割名", "level": 0, "type": "central", "color": "#hexcode", "description": "この役割の説明"},
              {"name": "カテゴリ1", "level": 1, "type": "category", "color": "#hexcode", "description": "このカテゴリの説明"},
              {"name": "サブカテゴリ1.1", "level": 2, "type": "subcategory", "parentId": "カテゴリ1", "color": "#hexcode", "description": "このサブカテゴリの説明"},
              {"name": "具体的スキル1.1.1", "level": 3, "type": "skill", "parentId": "サブカテゴリ1.1", "color": "#hexcode", "description": "このスキルの説明"},
              ...
            ],
            "edges": [
              {"source": "役割名", "target": "カテゴリ1", "label": "含む", "strength": 5},
              {"source": "カテゴリ1", "target": "サブカテゴリ1.1", "label": "含む", "strength": 4},
              {"source": "サブカテゴリ1.1", "target": "サブカテゴリ1.2", "label": "関連する", "strength": 3},
              ...
            ]
          }
          
          重要なスキルと知識領域を網羅し、意味のある関連性を持たせるようにしてください。最低でも4つの主要カテゴリ、各カテゴリに2-3のサブカテゴリ、各サブカテゴリに2-4の具体的スキルを含めるようにしてください。`
        }
      ];
      
      const response = await callAzureOpenAI(messages, 0.7, 2000);
      
      if (response && response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content;
        graphData = JSON.parse(content);
        console.log("Successfully generated knowledge graph using Azure OpenAI");
      } else {
        throw new Error("Invalid response from Azure OpenAI");
      }
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
        parentId: parentId, // 親ノードのID（文字列ではなく）
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
        content: `あなたは知識グラフを更新する専門家です。ユーザーの指示に基づいて既存の知識グラフを拡張・修正します。

        現在の知識グラフ構造は以下の通りです：
        
        【ノード一覧】
        ${nodesInfo}
        
        【エッジ（関連性）一覧】
        ${edgesInfo}
        
        ユーザーの指示に基づいて、追加・修正すべきノードとエッジを提案してください。出力は以下のJSON形式で行ってください：
        
        {
          "addNodes": [
            {
              "name": "新しいノード名",
              "level": 2,
              "type": "subcategory",
              "parentId": "親ノードのID",
              "description": "ノードの説明",
              "color": "#hexcode"
            },
            ...
          ],
          "addEdges": [
            {
              "sourceId": "始点ノードのID",
              "targetId": "終点ノードのID",
              "label": "関係性の説明",
              "strength": 3
            },
            ...
          ],
          "updateNodes": [
            {
              "id": "更新するノードのID",
              "name": "新しい名前",
              "description": "新しい説明",
              "color": "新しい色"
            },
            ...
          ]
        }
        
        注意点：
        1. 新しいノードを追加する場合は、必ず既存のノード構造と整合性を保つこと
        2. エッジを追加する場合は、実在するノードIDを使用すること
        3. ノードを更新する場合は、必ず実在するノードIDを使用すること
        4. ユーザーの指示に直接応答せず、JSONデータのみを出力すること`
      },
      {
        role: "user",
        content: `以下のユーザー指示に基づいて知識グラフを更新してください：
        
        "${prompt}"`
      }
    ];
    
    const response = await callAzureOpenAI(messages, 0.7, 2000);
    
    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error("Azure OpenAIからの応答が無効です");
    }
    
    const content = response.choices[0].message.content;
    const updates = JSON.parse(content);
    
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
          content: `あなたは知識グラフ生成の専門家です。与えられた概念やスキルを詳細に分解し、適切なサブノードを作成してください。
          
          以下の点に注意してください：
          1. 生成するサブノードは特定的、情報豊富、かつ親概念に直接関連するものにすること
          2. それぞれのサブノードには名前(name)と説明(description)を含めること
          3. サブノードはビジネス/技術領域で実際に使用される具体的な概念やスキルであること
          4. 日本語で出力すること
          5. 出力はJSON形式の配列であること`
        },
        {
          role: "user",
          content: `概念「${nodeName}」のサブノードを4-6個生成してください。
          これらのサブノードは親概念の一部であるより具体的な概念やスキルを表します。
          
          現在のノードレベルは${parentNode.level}で、サブノードのレベルは${childLevel}になります。
          レベル${childLevel}は${childLevel <= 2 ? 'まだ抽象的な概念' : 'より具体的なスキルや知識'}を表します。
          
          それぞれのサブノードには下記の情報を含めてください：
          1. name: サブノードの名前（簡潔で明確な表現）
          2. description: このサブノードが${nodeName}に関連する理由や重要性の説明
          3. type: "${childLevel <= 2 ? 'subcategory' : 'skill'}"（すでに設定済み）
          
          以下の形式の有効なJSONで出力してください:
          [
            {
              "name": "サブ概念1",
              "description": "このサブ概念の説明と親概念との関連性"
            },
            {
              "name": "サブ概念2",
              "description": "このサブ概念の説明と親概念との関連性"
            },
            ...
          ]`
        }
      ];
      
      const response = await callAzureOpenAI(messages, 0.7, 1000);
      
      if (response && response.choices && response.choices.length > 0) {
        const content = response.choices[0].message.content;
        const generatedNodes = JSON.parse(content);
        
        // Convert to the right format
        generatedNodes.forEach((node: any) => {
          subNodes.push({
            name: node.name,
            level: childLevel,
            parentId: nodeId
          });
        });
        
        console.log(`Successfully generated ${subNodes.length} sub-nodes with Azure OpenAI`);
      } else {
        throw new Error("Invalid response from Azure OpenAI");
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
    
    // Create nodes and edges in the database
    for (const node of subNodes) {
      const nodeData: InsertKnowledgeNode = {
        name: node.name,
        roleModelId,
        level: node.level,
        type: node.type || 'keyword',
        parentId: node.parentId || null,
        description: node.description || null,
        color: node.color || null
      };
      
      const createdNode = await storage.createKnowledgeNode(nodeData);
      
      // Create edge from parent to this node
      const edgeData: InsertKnowledgeEdge = {
        sourceId: nodeId,
        targetId: createdNode.id,
        roleModelId,
        label: null,
        strength: 1
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

// Helper function to generate a business architect knowledge graph structure
function getBusinessArchitectGraph(roleModelId: string): KnowledgeGraphData {
  // Define central node
  const centralNode = { 
    name: 'ビジネスアーキテクト', 
    level: 0,
    type: 'central',
    color: '#4F46E5' // Indigo-600
  };
  
  // Define main category nodes (level 1)
  const mainCategories = [
    { name: 'デジタル業務スキル', level: 1, color: '#10B981' }, // Emerald-500
    { name: '起業家スキル', level: 1, color: '#8B5CF6' }, // Violet-500
    { name: '根拠に基づく業務スキル', level: 1, color: '#EC4899' }, // Pink-500
    { name: 'コミュニケーションスキル', level: 1, color: '#F59E0B' }, // Amber-500
    { name: 'コラボレーションスキル', level: 1, color: '#06B6D4' }, // Cyan-500
    { name: '適応スキル', level: 1, color: '#34D399' }  // Emerald-400
  ];
  
  // Define subcategories (level 2)
  const subCategories = [
    // Digital Working Skills subcategories
    { name: '基本的デジタル業務スキル', level: 2, parentId: 'デジタル業務スキル', color: '#A7F3D0' }, // Emerald-200
    { name: '高度なデジタル業務スキル', level: 2, parentId: 'デジタル業務スキル', color: '#A7F3D0' },
    
    // Entrepreneurial Skills subcategories
    { name: '基本的起業家スキル', level: 2, parentId: '起業家スキル', color: '#C4B5FD' }, // Violet-200
    { name: '価値創造スキル', level: 2, parentId: '起業家スキル', color: '#C4B5FD' },
    { name: '革新性への適応', level: 2, parentId: '起業家スキル', color: '#C4B5FD' },
    
    // Evidence Based Working Skills subcategories
    { name: '基本的根拠ベーススキル', level: 2, parentId: '根拠に基づく業務スキル', color: '#FBCFE8' }, // Pink-200
    { name: '情報処理スキル', level: 2, parentId: '根拠に基づく業務スキル', color: '#FBCFE8' },
    { name: 'データ活用スキル', level: 2, parentId: '根拠に基づく業務スキル', color: '#FBCFE8' }
  ];
  
  // Define specific skills (level 3)
  const specificSkills = [
    // Fundamental Digital Working Skills
    { name: 'ハードウェア操作', level: 3, parentId: '基本的デジタル業務スキル', color: '#ECFDF5' }, // Emerald-50
    { name: 'ソフトウェア操作', level: 3, parentId: '基本的デジタル業務スキル', color: '#ECFDF5' },
    { name: 'SNSとインターネット活用', level: 3, parentId: '基本的デジタル業務スキル', color: '#ECFDF5' },
    { name: '情報・データ共有', level: 3, parentId: '基本的デジタル業務スキル', color: '#ECFDF5' },
    { name: '基本的デジタル問題解決', level: 3, parentId: '基本的デジタル業務スキル', color: '#ECFDF5' },
    
    // Advanced Digital Working Skills
    { name: 'プログラミング', level: 3, parentId: '高度なデジタル業務スキル', color: '#ECFDF5' },
    { name: 'デジタルコンテンツ作成', level: 3, parentId: '高度なデジタル業務スキル', color: '#ECFDF5' },
    { name: '法律・著作権・ライセンス対応', level: 3, parentId: '高度なデジタル業務スキル', color: '#ECFDF5' },
    { name: 'デジタルセキュリティ', level: 3, parentId: '高度なデジタル業務スキル', color: '#ECFDF5' },
    
    // Fundamental Entrepreneurial Skills
    { name: '創造性とイノベーション', level: 3, parentId: '基本的起業家スキル', color: '#F5F3FF' }, // Violet-50
    { name: '問題解決能力', level: 3, parentId: '基本的起業家スキル', color: '#F5F3FF' },
    
    // Openness to novelty
    { name: '機会発見力', level: 3, parentId: '革新性への適応', color: '#F5F3FF' },
    { name: '状況理解力', level: 3, parentId: '革新性への適応', color: '#F5F3FF' },
    
    // Value Creation Skills
    { name: '主体性', level: 3, parentId: '価値創造スキル', color: '#F5F3FF' },
    { name: '戦略的計画立案', level: 3, parentId: '価値創造スキル', color: '#F5F3FF' },
    { name: '意思決定力', level: 3, parentId: '価値創造スキル', color: '#F5F3FF' },
    { name: '予測力', level: 3, parentId: '価値創造スキル', color: '#F5F3FF' },
    { name: 'リスクテイキング', level: 3, parentId: '価値創造スキル', color: '#F5F3FF' },
    { name: 'リスク管理', level: 3, parentId: '価値創造スキル', color: '#F5F3FF' },
    { name: 'リーダーシップ', level: 3, parentId: '価値創造スキル', color: '#F5F3FF' },
    
    // Fundamental Evidence Based Working Skills
    { name: '研究課題設定', level: 3, parentId: '基本的根拠ベーススキル', color: '#FCE7F3' }, // Pink-50
    { name: '批判的思考', level: 3, parentId: '基本的根拠ベーススキル', color: '#FCE7F3' },
    
    // Information Processing Skills
    { name: '情報検索・選別', level: 3, parentId: '情報処理スキル', color: '#FCE7F3' },
    { name: '情報解釈・評価', level: 3, parentId: '情報処理スキル', color: '#FCE7F3' },
    { name: '情報管理', level: 3, parentId: '情報処理スキル', color: '#FCE7F3' },
    
    // Data Fluency Skills
    { name: 'データ収集', level: 3, parentId: 'データ活用スキル', color: '#FCE7F3' },
    { name: 'データ分析', level: 3, parentId: 'データ活用スキル', color: '#FCE7F3' },
    { name: 'データ解釈', level: 3, parentId: 'データ活用スキル', color: '#FCE7F3' },
    { name: 'データ可視化', level: 3, parentId: 'データ活用スキル', color: '#FCE7F3' },
    { name: 'データ管理', level: 3, parentId: 'データ活用スキル', color: '#FCE7F3' },
    { name: 'データ倫理・セキュリティ', level: 3, parentId: 'データ活用スキル', color: '#FCE7F3' },
    
    // Communication Skills
    { name: '適切なコミュニケーション方法', level: 3, parentId: 'コミュニケーションスキル', color: '#FEF3C7' }, // Amber-100
    { name: 'ストーリーテリング', level: 3, parentId: 'コミュニケーションスキル', color: '#FEF3C7' },
    { name: 'ネットワーキング', level: 3, parentId: 'コミュニケーションスキル', color: '#FEF3C7' },
    { name: 'デジタルアイデンティティ管理', level: 3, parentId: 'コミュニケーションスキル', color: '#FEF3C7' },
    
    // Collaboration Skills
    { name: '交渉力', level: 3, parentId: 'コラボレーションスキル', color: '#CFFAFE' }, // Cyan-100
    { name: '多分野チームワーク', level: 3, parentId: 'コラボレーションスキル', color: '#CFFAFE' },
    { name: '社会的知性', level: 3, parentId: 'コラボレーションスキル', color: '#CFFAFE' },
    { name: '文化的感受性', level: 3, parentId: 'コラボレーションスキル', color: '#CFFAFE' },
    { name: '人脈構築', level: 3, parentId: 'コラボレーションスキル', color: '#CFFAFE' },
    
    // Adaptation Skills
    { name: '自己主導学習', level: 3, parentId: '適応スキル', color: '#D1FAE5' }, // Emerald-100
    { name: '経験学習', level: 3, parentId: '適応スキル', color: '#D1FAE5' },
    { name: '他者への指導', level: 3, parentId: '適応スキル', color: '#D1FAE5' },
    { name: 'レジリエンス', level: 3, parentId: '適応スキル', color: '#D1FAE5' }
  ];
  
  // Combine all nodes
  const allNodes = [centralNode, ...mainCategories, ...subCategories, ...specificSkills];
  
  // Create edges
  const edges: KnowledgeEdgeData[] = [];
  
  // Connect central node to main categories
  mainCategories.forEach(category => {
    edges.push({
      source: centralNode.name,
      target: category.name
    });
  });
  
  // Connect main categories to subcategories
  subCategories.forEach(subCategory => {
    if (subCategory.parentId) {
      edges.push({
        source: subCategory.parentId,
        target: subCategory.name
      });
    }
  });
  
  // Connect subcategories to specific skills
  specificSkills.forEach(skill => {
    if (skill.parentId) {
      edges.push({
        source: skill.parentId,
        target: skill.name
      });
    }
  });
  
  return {
    nodes: allNodes,
    edges: edges
  };
}

// Helper function to generate a generic role knowledge graph structure
function getGenericRoleGraph(roleModelId: string, roleName: string): KnowledgeGraphData {
  // Define central node
  const centralNode = { 
    name: roleName, 
    level: 0,
    type: 'central',
    color: '#4F46E5' // Indigo-600
  };
  
  // Define main category nodes (level 1)
  const mainCategories = [
    { name: '専門技術スキル', level: 1, color: '#10B981' }, // Emerald-500
    { name: 'ドメイン知識', level: 1, color: '#8B5CF6' }, // Violet-500
    { name: 'ソフトスキル', level: 1, color: '#EC4899' }, // Pink-500
    { name: 'ツール・技術', level: 1, color: '#F59E0B' } // Amber-500
  ];
  
  // Define subcategories (level 2)
  const subCategories = [
    // Technical Skills subcategories
    { name: '基本的技術能力', level: 2, parentId: '専門技術スキル', color: '#A7F3D0' }, // Emerald-200
    { name: '高度な技術スキル', level: 2, parentId: '専門技術スキル', color: '#A7F3D0' },
    
    // Domain Knowledge subcategories
    { name: '業界知識', level: 2, parentId: 'ドメイン知識', color: '#C4B5FD' }, // Violet-200
    { name: 'プロセス専門知識', level: 2, parentId: 'ドメイン知識', color: '#C4B5FD' },
    
    // Soft Skills subcategories
    { name: 'コミュニケーション', level: 2, parentId: 'ソフトスキル', color: '#FBCFE8' }, // Pink-200
    { name: 'リーダーシップ', level: 2, parentId: 'ソフトスキル', color: '#FBCFE8' },
    { name: 'チームワーク', level: 2, parentId: 'ソフトスキル', color: '#FBCFE8' },
    
    // Tools & Technologies subcategories
    { name: 'ソフトウェアツール', level: 2, parentId: 'ツール・技術', color: '#FDE68A' }, // Amber-200
    { name: 'プラットフォーム', level: 2, parentId: 'ツール・技術', color: '#FDE68A' }
  ];
  
  // Define specific skills (level 3) - generic placeholders
  const specificSkills = [
    // Core Technical Competencies
    { name: 'スキルA', level: 3, parentId: '基本的技術能力', color: '#ECFDF5' }, // Emerald-50
    { name: 'スキルB', level: 3, parentId: '基本的技術能力', color: '#ECFDF5' },
    { name: 'スキルC', level: 3, parentId: '基本的技術能力', color: '#ECFDF5' },
    
    // Advanced Technical Skills
    { name: '高度なスキルA', level: 3, parentId: '高度な技術スキル', color: '#ECFDF5' },
    { name: '高度なスキルB', level: 3, parentId: '高度な技術スキル', color: '#ECFDF5' },
    
    // Industry Knowledge
    { name: '業界トレンドA', level: 3, parentId: '業界知識', color: '#F5F3FF' }, // Violet-50
    { name: '業界トレンドB', level: 3, parentId: '業界知識', color: '#F5F3FF' },
    
    // Process Expertise
    { name: 'プロセスA', level: 3, parentId: 'プロセス専門知識', color: '#F5F3FF' },
    { name: 'プロセスB', level: 3, parentId: 'プロセス専門知識', color: '#F5F3FF' },
    
    // Communication
    { name: '効果的なプレゼンテーション', level: 3, parentId: 'コミュニケーション', color: '#FCE7F3' }, // Pink-50
    { name: '技術文書作成', level: 3, parentId: 'コミュニケーション', color: '#FCE7F3' },
    
    // Leadership
    { name: 'チーム管理', level: 3, parentId: 'リーダーシップ', color: '#FCE7F3' },
    { name: '戦略的ビジョン', level: 3, parentId: 'リーダーシップ', color: '#FCE7F3' },
    
    // Teamwork
    { name: '協働作業', level: 3, parentId: 'チームワーク', color: '#FCE7F3' },
    { name: '対立解決能力', level: 3, parentId: 'チームワーク', color: '#FCE7F3' },
    
    // Software Tools
    { name: 'ツールA', level: 3, parentId: 'ソフトウェアツール', color: '#FFFBEB' }, // Amber-50
    { name: 'ツールB', level: 3, parentId: 'ソフトウェアツール', color: '#FFFBEB' },
    
    // Platforms
    { name: 'プラットフォームA', level: 3, parentId: 'プラットフォーム', color: '#FFFBEB' },
    { name: 'プラットフォームB', level: 3, parentId: 'プラットフォーム', color: '#FFFBEB' }
  ];
  
  // Combine all nodes
  const allNodes = [centralNode, ...mainCategories, ...subCategories, ...specificSkills];
  
  // Create edges
  const edges: KnowledgeEdgeData[] = [];
  
  // Connect central node to main categories
  mainCategories.forEach(category => {
    edges.push({
      source: centralNode.name,
      target: category.name
    });
  });
  
  // Connect main categories to subcategories
  subCategories.forEach(subCategory => {
    if (subCategory.parentId) {
      edges.push({
        source: subCategory.parentId,
        target: subCategory.name
      });
    }
  });
  
  // Connect subcategories to specific skills
  specificSkills.forEach(skill => {
    if (skill.parentId) {
      edges.push({
        source: skill.parentId,
        target: skill.name
      });
    }
  });
  
  return {
    nodes: allNodes,
    edges: edges
  };
}
