import { Request, Response } from 'express';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { roleModels, knowledgeNodes, knowledgeEdges } from '@shared/schema';
import { callAzureOpenAI } from '../azure-openai';
import * as neo4j from '../neo4j';
import { KnowledgeGraphData } from '../azure-openai';

/**
 * マルチエージェント処理のためのコントローラ
 * CrewAI・LangChain・LlamaIndexを統合して知識グラフを生成・拡張するエンドポイント
 */

// 役割に基づいてエージェントを作成し、CrewAIを使用して知識グラフを生成する
export async function generateWithCrewAI(req: Request, res: Response): Promise<void> {
  const roleModelId = req.params.roleModelId;

  try {
    // 役割モデルの情報を取得
    const roleModel = await db.query.roleModels.findFirst({
      where: eq(roleModels.id, roleModelId),
    });

    if (!roleModel) {
      res.status(404).json({ error: '役割モデルが見つかりません' });
      return;
    }

    // クライアントに直ちにレスポンスを返し、バックグラウンドで処理を続行
    res.status(202).json({ 
      message: 'マルチエージェント処理を開始しました', 
      roleModelId 
    });

    // バックグラウンドで知識グラフ生成処理を実行
    generateKnowledgeGraphWithMultiAgent(roleModel)
      .then(() => {
        console.log(`ロールモデル ${roleModel.name} の知識グラフ生成が完了しました`);
      })
      .catch(error => {
        console.error(`知識グラフ生成エラー: ${error.message}`);
      });

  } catch (error) {
    console.error('CrewAIによる知識グラフ生成エラー:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: '知識グラフ生成処理中にエラーが発生しました' });
    }
  }
}

// マルチエージェントを使用した知識グラフ生成の実装
async function generateKnowledgeGraphWithMultiAgent(roleModel: any): Promise<void> {
  try {
    console.log(`ロールモデル「${roleModel.name}」のマルチエージェント処理を開始します`);
    
    // 1. チーム内のエージェント定義
    const agents = [
      {
        role: 'ドメインエキスパート',
        goal: `「${roleModel.name}」の役割に関する専門知識の提供`,
        backstory: `私は「${roleModel.name}」の分野の専門家で、役割に関する深い知識を持っています。`,
      },
      {
        role: 'アナリスト',
        goal: '情報の分析と構造化',
        backstory: '私は情報を分析し、構造化された知識に変換する専門家です。',
      },
      {
        role: '知識グラフ構築者',
        goal: '階層的な知識グラフの構築',
        backstory: '私は複雑な情報を整理し、階層的で有用な知識グラフに変換します。',
      }
    ];
    
    // 2. 役割モデルから知識グラフ生成のためのプロンプトを作成
    const domainPrompt = `
      役割: ${roleModel.name}
      説明: ${roleModel.description || '特定の説明はありません'}
      業界: ${roleModel.industries?.join(', ') || '特定されていません'}
      キーワード: ${roleModel.keywords?.join(', ') || '特定されていません'}
    `;
    
    // 3. Azure OpenAIを使ってエージェント間の対話を模倣し知識グラフを生成
    console.log('エージェント間の対話を通じて知識グラフを生成します...');
    
    const messages = [
      { role: 'system', content: '複数のAIエージェントが協力して知識グラフを作成しています。それぞれの役割に基づいた対話を通じて、最終的な知識グラフを生成してください。' },
      { role: 'user', content: `
        次の役割モデルに基づいて、階層的な知識グラフを作成してください:
        ${domainPrompt}
        
        エージェント構成:
        - ドメインエキスパート: 専門知識の提供
        - アナリスト: 情報の分析と構造化
        - 知識グラフ構築者: 階層的な知識グラフの構築
        
        以下の形式でJSONオブジェクトを出力してください:
        {
          "nodes": [
            {"id": "uuid", "name": "ノード名", "level": 数値, "type": "concept", "parentId": "親ノードのuuidまたはnull", "description": "説明", "color": "色コード"}
          ],
          "edges": [
            {"source": "始点ノードのuuid", "target": "終点ノードのuuid", "label": "関係の名前", "strength": 数値}
          ]
        }
        
        注意事項:
        - 各ノードには一意のUUIDを割り当ててください
        - レベル0は中心ノード、レベル1は主要概念、レベル2以降は詳細概念を表します
        - 親子関係を正確に表現してください
        - エッジの強度は0.1から1.0の間で設定してください
      ` },
    ];
    
    // Azure OpenAIを呼び出して知識グラフデータを生成
    const jsonResponse = await callAzureOpenAI(messages, 0.7, 4000);
    
    // 生成されたJSON文字列を解析
    let graphData: KnowledgeGraphData;
    try {
      // JSONパース処理
      // 生成されたテキストからJSON部分を抽出
      const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON形式のデータが見つかりませんでした');
      }
      
      graphData = JSON.parse(jsonMatch[0]);
      
      // 必須フィールドの検証
      if (!graphData.nodes || !Array.isArray(graphData.nodes) || !graphData.edges || !Array.isArray(graphData.edges)) {
        throw new Error('知識グラフデータの形式が不正です');
      }
    } catch (error) {
      console.error('JSON解析エラー:', error);
      throw new Error('知識グラフデータの解析に失敗しました');
    }
    
    // 4. 生成された知識グラフをデータベースに保存
    console.log(`知識グラフの保存を開始します: ${graphData.nodes.length}ノード、${graphData.edges.length}エッジ`);
    
    // 既存の知識グラフを削除
    await db.delete(knowledgeNodes).where(eq(knowledgeNodes.roleModelId, roleModel.id));
    await db.delete(knowledgeEdges).where(eq(knowledgeEdges.roleModelId, roleModel.id));
    
    // ノードの保存
    for (const node of graphData.nodes) {
      // nodeにidプロパティがない場合はUUIDを生成
      const nodeId = uuidv4();
      
      // データベースにノードを保存
      const nodeData = {
        id: nodeId,
        roleModelId: roleModel.id,
        name: node.name,
        level: node.level,
        type: node.type || 'concept',
        parentId: node.parentId || null,
        description: node.description || null,
        color: node.color || null,
      };
      
      await db.insert(knowledgeNodes).values(nodeData);
      
      // Neo4jにも保存
      try {
        await neo4j.createNode(
          node.type || 'Concept',
          {
            id: nodeId,
            name: node.name,
            level: node.level,
            parentId: node.parentId || null,
            description: node.description || null,
            color: node.color || null,
          },
          roleModel.id
        );
      } catch (error) {
        console.error(`Neo4jノード作成エラー: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // エッジの保存
    for (const edge of graphData.edges) {
      const edgeId = uuidv4();
      
      // データベースにエッジを保存
      const edgeData = {
        id: edgeId,
        roleModelId: roleModel.id,
        source: edge.source,
        target: edge.target,
        label: edge.label || null,
        strength: edge.strength || 0.5,
      };
      
      await db.insert(knowledgeEdges).values(edgeData);
      
      // Neo4jにも保存
      try {
        await neo4j.createRelationship(
          edge.source,
          edge.target,
          'RELATED_TO',
          {
            label: edge.label || null,
            strength: edge.strength || 0.5,
          },
          roleModel.id
        );
      } catch (error) {
        console.error(`Neo4jエッジ作成エラー: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log(`ロールモデル「${roleModel.name}」の知識グラフ生成が完了しました`);
    
  } catch (error) {
    console.error('マルチエージェント処理エラー:', error);
    throw error;
  }
}

// WebSocketを使用して知識グラフ生成の進捗を通知する
export function notifyGraphGenerationProgress(socket: any, roleModelId: string, progress: number, message: string): void {
  try {
    socket.send(JSON.stringify({
      type: 'crewai_progress',
      roleModelId,
      progress,
      message
    }));
  } catch (error) {
    console.error('進捗通知エラー:', error);
  }
}

// CrewAIによる知識グラフ拡張機能
export async function enhanceKnowledgeGraph(req: Request, res: Response): Promise<void> {
  const { roleModelId, nodeId } = req.params;
  
  try {
    // 対象のノードと役割モデルを取得
    const node = await db.query.knowledgeNodes.findFirst({
      where: eq(knowledgeNodes.id, nodeId),
    });
    
    const roleModel = await db.query.roleModels.findFirst({
      where: eq(roleModels.id, roleModelId),
    });
    
    if (!node || !roleModel) {
      res.status(404).json({ error: 'ノードまたは役割モデルが見つかりません' });
      return;
    }
    
    // クライアントに直ちにレスポンスを返し、バックグラウンドで処理を続行
    res.status(202).json({ 
      message: 'ノード拡張処理を開始しました', 
      nodeId,
      roleModelId
    });
    
    // バックグラウンドでノード拡張処理を実行
    enhanceNodeWithMultiAgent(node, roleModel)
      .then(() => {
        console.log(`ノード ${node.name} の拡張が完了しました`);
      })
      .catch(error => {
        console.error(`ノード拡張エラー: ${error.message}`);
      });
      
  } catch (error) {
    console.error('ノード拡張エラー:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'ノード拡張処理中にエラーが発生しました' });
    }
  }
}

// マルチエージェントを使用したノード拡張の実装
async function enhanceNodeWithMultiAgent(node: any, roleModel: any): Promise<void> {
  try {
    console.log(`ノード「${node.name}」のマルチエージェント拡張処理を開始します`);
    
    // 1. ノード拡張のためのエージェント定義
    const agents = [
      {
        role: 'トピックエキスパート',
        goal: `「${node.name}」に関する専門知識を提供する`,
        backstory: `私は「${node.name}」の概念に関する専門家です。`,
      },
      {
        role: '情報収集エージェント',
        goal: '関連情報の収集と整理',
        backstory: '私は幅広い情報源から情報を収集し、整理する専門家です。',
      },
      {
        role: '知識構造化エージェント',
        goal: '知識の構造化と関連付け',
        backstory: '私は複雑な情報を構造化し、知識グラフに統合します。',
      }
    ];
    
    // 2. ノード拡張のためのプロンプトを作成
    const enhancePrompt = `
      役割: ${roleModel.name}
      親ノード: ${node.name}
      説明: ${node.description || '特定の説明はありません'}
      レベル: ${node.level}
    `;
    
    // 3. Azure OpenAIを使ってノード拡張のための知識サブグラフを生成
    console.log('エージェント間の対話を通じてノードの拡張を行います...');
    
    const messages = [
      { role: 'system', content: '複数のAIエージェントが協力してノードを拡張しています。それぞれの役割に基づいた対話を通じて、ノードの詳細な知識サブグラフを生成してください。' },
      { role: 'user', content: `
        次のノードを詳細に拡張し、サブグラフを作成してください:
        ${enhancePrompt}
        
        エージェント構成:
        - トピックエキスパート: 「${node.name}」に関する専門知識の提供
        - 情報収集エージェント: 関連情報の収集と整理
        - 知識構造化エージェント: 知識の構造化と関連付け
        
        以下の形式でJSONオブジェクトを出力してください:
        {
          "nodes": [
            {"id": "uuid", "name": "ノード名", "level": ${node.level + 1}, "type": "concept", "parentId": "${node.id}", "description": "説明", "color": "色コード"}
          ],
          "edges": [
            {"source": "始点ノードのuuid", "target": "終点ノードのuuid", "label": "関係の名前", "strength": 数値}
          ]
        }
        
        注意事項:
        - 各ノードには一意のUUIDを割り当ててください
        - 全てのノードの親は「${node.name}」（id: ${node.id}）です
        - 新しいノードのレベルは${node.level + 1}です
        - 詳細な説明を加えてください
        - エッジの強度は0.1から1.0の間で設定してください
        - 最低5つ、最大10つの新しいノードを作成してください
      ` },
    ];
    
    // Azure OpenAIを呼び出して知識グラフデータを生成
    const jsonResponse = await callAzureOpenAI(messages, 0.7, 4000);
    
    // 生成されたJSON文字列を解析
    let graphData: KnowledgeGraphData;
    try {
      // JSONパース処理
      // 生成されたテキストからJSON部分を抽出
      const jsonMatch = jsonResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('JSON形式のデータが見つかりませんでした');
      }
      
      graphData = JSON.parse(jsonMatch[0]);
      
      // 必須フィールドの検証
      if (!graphData.nodes || !Array.isArray(graphData.nodes) || !graphData.edges || !Array.isArray(graphData.edges)) {
        throw new Error('知識グラフデータの形式が不正です');
      }
    } catch (error) {
      console.error('JSON解析エラー:', error);
      throw new Error('知識グラフデータの解析に失敗しました');
    }
    
    // 4. 生成された知識サブグラフをデータベースに保存
    console.log(`ノード拡張の保存を開始します: ${graphData.nodes.length}ノード、${graphData.edges.length}エッジ`);
    
    // ノードの保存
    const newNodeIds = [];
    for (const newNode of graphData.nodes) {
      // ノードIDを生成
      const nodeId = uuidv4();
      newNodeIds.push(nodeId);
      
      // データベースにノードを保存
      const nodeData = {
        id: nodeId,
        roleModelId: roleModel.id,
        name: newNode.name,
        level: newNode.level,
        type: newNode.type || 'concept',
        parentId: node.id, // 親ノードIDを固定
        description: newNode.description || null,
        color: newNode.color || null,
      };
      
      await db.insert(knowledgeNodes).values(nodeData);
      
      // Neo4jにも保存
      try {
        await neo4j.createNode(
          newNode.type || 'Concept',
          {
            id: nodeId,
            name: newNode.name,
            level: newNode.level,
            parentId: node.id,
            description: newNode.description || null,
            color: newNode.color || null,
          },
          roleModel.id
        );
      } catch (error) {
        console.error(`Neo4jノード作成エラー: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // 親ノードとの関係を作成
      const parentEdgeId = uuidv4();
      const parentEdgeData = {
        id: parentEdgeId,
        roleModelId: roleModel.id,
        source: node.id,
        target: nodeId,
        label: '含む',
        strength: 0.8,
      };
      
      await db.insert(knowledgeEdges).values(parentEdgeData);
      
      // Neo4jにも保存
      try {
        await neo4j.createRelationship(
          node.id,
          nodeId,
          'CONTAINS',
          {
            label: '含む',
            strength: 0.8,
          },
          roleModel.id
        );
      } catch (error) {
        console.error(`Neo4jエッジ作成エラー: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // ノード間のエッジも保存（エッジを適切に変換）
    for (const edge of graphData.edges) {
      // JSONレスポンスではsource/targetがUUIDではなくインデックスの可能性があるため、
      // 新しいノードIDの配列を使用して正しいUUIDにマッピングする
      let sourceId = edge.source;
      let targetId = edge.target;
      
      // sourceとtargetが数字の場合はインデックスとして扱い、該当するノードIDに変換
      if (typeof edge.source === 'number' || !isNaN(Number(edge.source))) {
        const index = Number(edge.source);
        if (index >= 0 && index < newNodeIds.length) {
          sourceId = newNodeIds[index];
        }
      }
      
      if (typeof edge.target === 'number' || !isNaN(Number(edge.target))) {
        const index = Number(edge.target);
        if (index >= 0 && index < newNodeIds.length) {
          targetId = newNodeIds[index];
        }
      }
      
      const edgeId = uuidv4();
      
      // データベースにエッジを保存
      const edgeData = {
        id: edgeId,
        roleModelId: roleModel.id,
        source: sourceId,
        target: targetId,
        label: edge.label || null,
        strength: edge.strength || 0.5,
      };
      
      await db.insert(knowledgeEdges).values(edgeData);
      
      // Neo4jにも保存
      try {
        await neo4j.createRelationship(
          sourceId,
          targetId,
          'RELATED_TO',
          {
            label: edge.label || null,
            strength: edge.strength || 0.5,
          },
          roleModel.id
        );
      } catch (error) {
        console.error(`Neo4jエッジ作成エラー: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log(`ノード「${node.name}」の拡張が完了しました`);
    
  } catch (error) {
    console.error('ノード拡張処理エラー:', error);
    throw error;
  }
}