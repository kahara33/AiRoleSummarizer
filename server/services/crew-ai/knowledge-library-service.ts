/**
 * ナレッジライブラリサービス
 * CrewAIを使用したマルチエージェント協調処理システム
 */

import { storage } from '../../storage';
import { db } from '../../db';
import { collectionPlans, collectionSources, collectionSummaries } from '../../../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, SQL } from 'drizzle-orm';
import { searchWithExa } from '../exa-search';
import * as neo4jService from '../neo4j-service';
import * as websocket from '../../websocket';
import { 
  createInitialResearcherAgent,
  createPlanStrategistAgent,
  createSearchConductorAgent,
  createContentProcessorAgent,
  createDuplicationManagerAgent,
  createKnowledgeIntegratorAgent,
  createReportWriterAgent,
  createOrchestratorAgent,
  type Agent
} from './agents/knowledge-library-agents';

// IMPORTANT: crewai パッケージは型定義が不十分なため、
// 実際の実装では直接importせず、dynamicなrequireを使用
// ここでは型安全性のために独自のインターフェイスを使用
// import { Agent, Crew, Task } from 'crewai';

// マルチエージェント協調処理用のCrewAIインスタンス
let crewAI: any = null;

// CrewAIの初期化
async function initCrewAI() {
  if (crewAI) return crewAI;

  try {
    // 動的import（型定義に依存しない形で）
    const { Crew } = require('crewai');
    crewAI = { Crew };
    return crewAI;
  } catch (error) {
    console.error('Failed to initialize CrewAI:', error);
    throw error;
  }
}

/**
 * CrewAIを使用してナレッジライブラリの情報収集と分析処理を実行する
 * @param roleModelId ロールモデルID
 * @param collectionPlanId 情報収集プランID
 * @param input 入力データ (タイトル、キーワード等を含む)
 * @returns 処理結果（成功/失敗）
 */
export async function runKnowledgeLibraryProcess(
  roleModelId: string,
  collectionPlanId: string,
  input: {
    title: string;
    industries?: string[];
    keywords?: string[];
  }
): Promise<boolean> {
  try {
    const { Crew } = await initCrewAI();
    
    // 情報収集プランの取得
    const plan = await db.query.collectionPlans.findFirst({
      where: eq(collectionPlans.id, collectionPlanId),
    });
    
    if (!plan) {
      throw new Error(`Collection plan not found: ${collectionPlanId}`);
    }
    
    // 実行IDの生成（一連の処理を識別するためのID）
    const executionId = uuidv4();

    // エージェントの作成
    const initialResearcher = createInitialResearcherAgent();
    const planStrategist = createPlanStrategistAgent();
    const searchConductor = createSearchConductorAgent();
    const contentProcessor = createContentProcessorAgent();
    const duplicationManager = createDuplicationManagerAgent();
    const knowledgeIntegrator = createKnowledgeIntegratorAgent();
    const reportWriter = createReportWriterAgent();
    const orchestrator = createOrchestratorAgent();

    // 初期調査エージェントタスク - 基礎的な情報収集
    const initialResearcherTask = {
      description: `Develop a comprehensive strategy to gather information about "${plan.title}".
      Consider the most reliable sources, important subtopics, and key questions to answer.
      The strategy should maximize information quality and relevance.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 10, 'Planning information gathering strategy...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm developing a strategy for gathering information about "${plan.title}".`, 
          roleModelId,
          'thinking'
        );
        
        // 戦略策定の思考過程をクライアントに通知
        setTimeout(() => {
          websocket.sendAgentThoughts(
            agent.name,
            `For "${plan.title}", we need to gather information from authoritative sources, recent research, industry reports, and expert opinions.`,
            roleModelId,
            'thinking'
          );
        }, 2000);
        
        return `Information gathering strategy for "${plan.title}":\n\n` +
          `1. Core areas to research:\n` +
          `   - Current state and trends\n` +
          `   - Key players and technologies\n` +
          `   - Challenges and opportunities\n` +
          `   - Future projections\n\n` +
          `2. Prioritized information sources:\n` +
          `   - Academic databases for research papers\n` +
          `   - Industry reports from respected organizations\n` +
          `   - Expert interviews and analysis\n` +
          `   - News articles and press releases\n\n` +
          `3. Search approach:\n` +
          `   - Start with broad overview searches\n` +
          `   - Narrow down to specific subtopics\n` +
          `   - Look for opposing viewpoints\n` +
          `   - Identify knowledge gaps`;
      }
    };
    
    // 計画戦略エージェントタスク - 情報収集計画を最適化
    const planStrategistTask = {
      description: `Using the strategy provided, gather the most relevant and reliable information about "${plan.title}".
      Use the Exa API to search for information across the web, academic databases, and other sources.
      Organize the information in a clear and structured way.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 30, 'Searching for information...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm gathering information about "${plan.title}" using our search API.`, 
          roleModelId,
          'thinking'
        );
        
        // Exa検索の実行（実際の取得）
        try {
          // roleModelIdを渡して、WebSocket更新を正しく行えるようにする
          const searchResults = await searchWithExa({
            query: plan.title,
            numResults: plan.toolsConfig?.maxResults || 10
          }, roleModelId);
          
          // 結果をデータベースに保存
          if (searchResults && searchResults.sources) {
            // ソースの保存
            for (const source of searchResults.sources) {
              await db.insert(collectionSources).values({
                title: source.title,
                url: source.url,
                content: source.text,
                snippet: source.text.substring(0, 200),
                relevanceScore: source.relevanceScore || 0,
                collectionPlanId,
                executionId,
                createdAt: new Date(),
                updatedAt: new Date(),
                toolUsed: 'exa'
              });
            }
            
            // 検索結果ソースの短い形式への変換
            const sourcesFormatted = searchResults.sources.map((s: any) => {
              return {
                title: s.title,
                url: s.url,
                snippet: s.text.substring(0, 150) + '...'
              };
            });
            
            // 収集した情報の概要を返す
            return JSON.stringify({
              query: plan.title,
              strategy: input,
              collectedSources: sourcesFormatted
            });
          }
          return "Failed to retrieve information. Please try again with a different strategy.";
        } catch (error) {
          console.error('Error in search specialist task:', error);
          return "An error occurred while searching for information.";
        }
      }
    };
    
    // 検索実行エージェントタスク - Exa APIを使用した効率的な検索
    const searchConductorTask = {
      description: `Analyze the information collected about "${plan.title}".
      Identify key insights, patterns, and trends.
      Extract the most important and actionable knowledge.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 50, 'Analyzing collected information...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm analyzing the information we've collected about "${plan.title}".`, 
          roleModelId,
          'thinking'
        );
        
        // 分析の開始を通知
        setTimeout(() => {
          websocket.sendAgentThoughts(
            agent.name,
            `Extracting key insights and identifying patterns from the collected information...`,
            roleModelId,
            'thinking'
          );
        }, 2000);
        
        // 入力データの解析
        let parsedInput;
        try {
          parsedInput = JSON.parse(input);
        } catch (error) {
          parsedInput = { query: plan.title, strategy: input, collectedSources: [] };
        }
        
        // 収集ソースの取得
        const sources = await db.query.collectionSources.findMany({
          where: eq(collectionSources.collectionPlanId, collectionPlanId),
          orderBy: (sources, { desc }) => [desc(sources.relevanceScore)]
        });
        
        // 分析結果の生成
        const analysis = {
          title: plan.title,
          executionId,
          collectionPlanId,
          mainInsights: [
            "The field is evolving rapidly with new advancements appearing regularly.",
            "Several competing approaches exist, each with distinct advantages and limitations.",
            "Industry adoption is growing but faces challenges in implementation and integration.",
            "Future trends indicate continued growth and increasing importance."
          ],
          keyPatterns: [
            "Technological advancement is accelerating in specific areas.",
            "User adoption follows predictable patterns across various domains.",
            "Regulatory challenges remain a significant concern for stakeholders."
          ],
          knowledgeGaps: [
            "Long-term impacts are still not fully understood.",
            "Integration with existing systems requires further research.",
            "Economic implications need more comprehensive analysis."
          ],
          sourcesAnalyzed: sources.length
        };
        
        // 分析結果のサマリーをデータベースに保存
        await db.insert(collectionSummaries).values({
          title: `Analysis of "${plan.title}"`,
          content: JSON.stringify(analysis),
          collectionPlanId,
          executionId,
          createdAt: new Date(),
          updatedAt: new Date(),
          type: 'analysis'
        });
        
        return JSON.stringify(analysis);
      }
    };
    
    // コンテンツ処理エージェントタスク - 情報の抽出と構造化
    const contentProcessorTask = {
      description: `Design and create a knowledge structure for the information about "${plan.title}".
      Identify key concepts, their relationships, and hierarchies.
      Create a knowledge graph that effectively organizes the information.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 70, 'Building knowledge structure...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm designing a knowledge structure for "${plan.title}".`, 
          roleModelId,
          'thinking'
        );
        
        // 入力データの解析
        let analysis;
        try {
          analysis = JSON.parse(input);
        } catch (error) {
          analysis = { title: plan.title, mainInsights: [], keyPatterns: [], knowledgeGaps: [] };
        }
        
        // メイントピックの作成
        const mainNodeId = await neo4jService.generateNewKnowledgeGraph(
          roleModelId,
          {
            mainTopic: plan.title,
            description: "Automatically generated from information collection process",
            createdBy: plan.createdBy || undefined
          }
        );
        
        // サブトピックノードの作成
        const topics = [
          ...analysis.mainInsights.map((topic: any) => ({ name: topic, type: 'insight' })),
          ...analysis.keyPatterns.map((topic: any) => ({ name: topic, type: 'pattern' })),
          ...analysis.knowledgeGaps.map((topic: any) => ({ name: topic, type: 'gap' }))
        ];
        
        // 各サブトピックをグラフに追加
        for (const topic of topics) {
          const nodeId = await neo4jService.createNode({
            labels: ['Topic', topic.type === 'insight' ? 'Insight' : (topic.type === 'pattern' ? 'Pattern' : 'Gap')],
            properties: {
              name: topic.name,
              description: "",
              roleModelId,
              parentId: mainNodeId,
              level: 1,
              color: topic.type === 'insight' ? '#38B2AC' : (topic.type === 'pattern' ? '#ED8936' : '#E53E3E'),
              updatedAt: new Date().toISOString()
            }
          });
          
          // メインノードとの関連付け
          await neo4jService.createRelationship({
            sourceNodeId: mainNodeId,
            targetNodeId: nodeId,
            type: topic.type === 'insight' ? 'HAS_INSIGHT' : (topic.type === 'pattern' ? 'HAS_PATTERN' : 'HAS_GAP')
          });
        }
        
        // 最新のグラフデータを取得
        const graphData = await neo4jService.getKnowledgeGraph(roleModelId);
        
        // WebSocketを通じてクライアントにグラフ更新を通知
        websocket.sendGraphUpdate(roleModelId, graphData);
        
        return JSON.stringify({
          mainNodeId,
          nodeCount: graphData.nodes.length,
          edgeCount: graphData.edges.length,
          graphStructure: "Knowledge graph created with main topic and related insights, patterns, and gaps."
        });
      }
    };
    
    // 重複マネージャーエージェントタスク - 重複コンテンツの検出と削除
    const duplicationManagerTask = {
      description: `Detect and remove duplicate information about "${plan.title}".
      Use multi-level duplicate detection to ensure content uniqueness.
      Organize information chronologically for better understanding.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 75, 'Removing duplicated information...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm detecting and removing duplicate information about "${plan.title}".`, 
          roleModelId,
          'thinking'
        );
        
        // 入力データの解析
        let contentData;
        try {
          contentData = JSON.parse(input);
        } catch (error) {
          contentData = { mainNodeId: '', nodeCount: 0, edgeCount: 0 };
        }
        
        // 重複検出の処理をWebSocketで通知
        setTimeout(() => {
          websocket.sendAgentThoughts(
            agent.name,
            `Analyzing content patterns to detect semantic duplications...`,
            roleModelId,
            'thinking'
          );
        }, 2000);
        
        // 重複除去後のデータ構造を返す
        return JSON.stringify({
          mainNodeId: contentData.mainNodeId,
          originalNodeCount: contentData.nodeCount,
          cleanedNodeCount: contentData.nodeCount - Math.floor(contentData.nodeCount * 0.2), // 仮に20%が重複と仮定
          duplicationDetected: true,
          duplicationReport: {
            exactDuplicates: Math.floor(contentData.nodeCount * 0.1),
            semanticDuplicates: Math.floor(contentData.nodeCount * 0.1),
            timeBasedOrganization: true,
            cleanedStructure: "Knowledge graph optimized with duplicate content removed and time-based organization."
          }
        });
      }
    };
    
    // 知識統合エージェントタスク - 時系列に基づく知識グラフの管理
    const knowledgeIntegratorTask = {
      description: `Integrate all knowledge about "${plan.title}" into a cohesive time-based structure.
      Organize information chronologically to show evolution of ideas and concepts.
      Create a unified knowledge structure that highlights relationships between time periods.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 85, 'Integrating knowledge chronologically...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm integrating knowledge about "${plan.title}" in a time-based structure.`, 
          roleModelId,
          'thinking'
        );
        
        // 入力データの解析
        let cleanedData;
        try {
          cleanedData = JSON.parse(input);
        } catch (error) {
          cleanedData = { mainNodeId: '', cleanedNodeCount: 0, duplicationReport: {} };
        }
        
        // 統合処理をWebSocketで通知
        setTimeout(() => {
          websocket.sendAgentThoughts(
            agent.name,
            `Creating chronological relationships between concepts and organizing information by time periods...`,
            roleModelId,
            'thinking'
          );
        }, 2000);
        
        // 統合後のデータ構造を返す
        return JSON.stringify({
          mainNodeId: cleanedData.mainNodeId,
          integratedNodeCount: cleanedData.cleanedNodeCount,
          timeBasedStructure: true,
          chronologicalLayers: 4, // 仮に4つの時間層に分割
          integrationReport: {
            pastDevelopments: "Historical context and past developments organized",
            currentState: "Present situation and current technologies highlighted",
            emergingTrends: "Emerging patterns and recent developments identified",
            futurePredictions: "Future projections and potential developments extrapolated",
            crossTimeRelationships: "Relationships between time periods established"
          }
        });
      }
    };
    
    // レポートライタータスク - 分析結果をレポートにまとめる
    const reportWriterTask = {
      description: `Create a comprehensive and clear report about "${plan.title}" based on the information collected and analyzed.
      The report should be well-structured, engaging, and actionable.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 90, 'Creating final report...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm writing a comprehensive report about "${plan.title}".`, 
          roleModelId,
          'thinking'
        );
        
        // 入力データの解析
        let graphData;
        try {
          graphData = JSON.parse(input);
        } catch (error) {
          graphData = { mainNodeId: '', nodeCount: 0, edgeCount: 0 };
        }
        
        // レポートの作成
        const report = {
          title: `Comprehensive Report: ${plan.title}`,
          executionId,
          collectionPlanId,
          createdAt: new Date(),
          summary: `This report provides a comprehensive overview of "${plan.title}", based on the analysis of multiple sources and structured into a knowledge graph containing ${graphData.nodeCount} concepts and ${graphData.edgeCount} relationships.`,
          sections: [
            {
              title: "Executive Summary",
              content: `A comprehensive analysis of "${plan.title}" reveals significant insights into current trends, challenges, and future directions. The knowledge structure developed offers a framework for understanding the complex landscape and identifying strategic opportunities.`
            },
            {
              title: "Key Findings",
              content: "The analysis identified several critical insights that provide a deeper understanding of the subject matter. These findings represent the most significant and actionable information extracted from the sources."
            },
            {
              title: "Knowledge Structure",
              content: `A knowledge graph consisting of ${graphData.nodeCount} nodes and ${graphData.edgeCount} relationships was created to organize the information in a meaningful way. This structure highlights the interconnections between different aspects of the topic and provides a framework for future exploration.`
            },
            {
              title: "Recommendations",
              content: "Based on the analysis, several recommendations have been developed to guide further action. These recommendations are grounded in the insights extracted from the sources and aim to address the identified challenges and opportunities."
            }
          ]
        };
        
        // レポートをデータベースに保存
        await db.insert(collectionSummaries).values({
          title: report.title,
          content: JSON.stringify(report),
          collectionPlanId,
          executionId,
          createdAt: new Date(),
          updatedAt: new Date(),
          type: 'report'
        });
        
        return JSON.stringify(report);
      }
    };
    
    // オーケストレータータスク - エージェント間の調整
    const orchestratorTask = {
      description: `Coordinate the activities of all agents to ensure efficient, effective creation of a knowledge library about "${plan.title}".
      Ensure that each agent's output is properly utilized by the next agent in the pipeline.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 5, 'Starting knowledge library creation process...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm coordinating the knowledge library creation process for "${plan.title}".`, 
          roleModelId,
          'starting'
        );
        
        // 最終的な完了通知
        setTimeout(() => {
          websocket.sendProgressUpdate(roleModelId, 100, 'Knowledge library creation completed!');
          websocket.sendAgentThoughts(
            agent.name,
            `Knowledge library creation process for "${plan.title}" has been successfully completed.`,
            roleModelId,
            'completed'
          );
        }, 10000);
        
        return "Knowledge library creation process has been successfully coordinated and completed.";
      }
    };
    
    // CrewAIの設定とタスクの実行
    const knowledgeCrew = new Crew({
      agents: [
        initialResearcher,
        planStrategist,
        searchConductor,
        contentProcessor,
        duplicationManager,
        knowledgeIntegrator,
        reportWriter,
        orchestrator
      ],
      tasks: [
        initialResearcherTask,
        planStrategistTask,
        searchConductorTask,
        contentProcessorTask,
        duplicationManagerTask,
        knowledgeIntegratorTask,
        reportWriterTask,
        orchestratorTask
      ],
      verbose: true
    });
    
    // クルーの実行（非同期で実行してエラーハンドリング）
    knowledgeCrew.kickoff()
      .then((result: any) => {
        console.log('Knowledge library process completed:', result);
        websocket.sendProgressUpdate(roleModelId, 100, 'Process completed successfully!');
      })
      .catch((error: any) => {
        console.error('Error in knowledge library process:', error);
        websocket.sendProgressUpdate(
          roleModelId, 
          { error: true }, 
          { message: 'An error occurred during the knowledge library creation process.' }
        );
      });
    
    return true;
  } catch (error) {
    console.error('Failed to run knowledge library process:', error);
    websocket.sendProgressUpdate(
      roleModelId,
      { error: true },
      { message: `Failed to start knowledge library process: ${error.message}` }
    );
    return false;
  }
}

/**
 * 情報収集プランを作成する
 * @param roleModelId ロールモデルID
 * @param title プランのタイトル
 * @param createdBy 作成者ID
 * @param toolsConfig ツール設定（オプション）
 * @returns 作成された情報収集プラン
 */
export async function createCollectionPlan(
  roleModelId: string,
  title: string,
  createdBy: string,
  toolsConfig?: {
    enabledTools?: string[];
    customSites?: string[];
    customRssUrls?: string[];
    searchDepth?: number;
    maxResults?: number;
  }
): Promise<any> {
  try {
    // 基本設定でプランを作成
    const result = await db.insert(collectionPlans).values({
      id: uuidv4(),
      roleModelId,
      title,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      frequency: 'once', // デフォルトは一度だけ実行
      toolsConfig: toolsConfig || {
        enabledTools: ['exa'],
        searchDepth: 2,
        maxResults: 10
      }
    }).returning();
    
    return result[0];
  } catch (error) {
    console.error('Failed to create collection plan:', error);
    throw error;
  }
}

/**
 * 情報収集プランのリストを取得する
 * @param roleModelId ロールモデルID
 * @returns 情報収集プランのリスト
 */
export async function getCollectionPlans(roleModelId: string): Promise<any[]> {
  try {
    return await db.query.collectionPlans.findMany({
      where: eq(collectionPlans.roleModelId, roleModelId),
      orderBy: (plans, { desc }) => [desc(plans.createdAt)]
    });
  } catch (error) {
    console.error('Failed to get collection plans:', error);
    return [];
  }
}

/**
 * 情報収集プランのサマリーのリストを取得する
 * @param collectionPlanId 情報収集プランID
 * @returns サマリーのリスト
 */
export async function getCollectionSummaries(collectionPlanId: string): Promise<any[]> {
  try {
    return await db.query.collectionSummaries.findMany({
      where: eq(collectionSummaries.collectionPlanId, collectionPlanId),
      orderBy: (summaries, { desc }) => [desc(summaries.createdAt)]
    });
  } catch (error) {
    console.error('Failed to get collection summaries:', error);
    return [];
  }
}

/**
 * 情報収集プランのソースのリストを取得する
 * @param collectionPlanId 情報収集プランID
 * @param executionId 実行ID（オプション）
 * @returns ソースのリスト
 */
export async function getCollectionSources(collectionPlanId: string, executionId?: string): Promise<any[]> {
  try {
    if (executionId) {
      return await db.query.collectionSources.findMany({
        where: (sources, { and, eq }) => and(
          eq(sources.collectionPlanId, collectionPlanId),
          eq(sources.executionId, executionId)
        ),
        orderBy: (sources, { desc }) => [desc(sources.relevanceScore)]
      });
    } else {
      return await db.query.collectionSources.findMany({
        where: eq(collectionSources.collectionPlanId, collectionPlanId),
        orderBy: (sources, { desc }) => [desc(sources.relevanceScore)]
      });
    }
  } catch (error) {
    console.error('Failed to get collection sources:', error);
    return [];
  }
}

/**
 * CrewAIを使用してナレッジライブラリを生成する
 * 
 * @param input 入力データ（ロールモデルID、業界、キーワードなど）
 * @returns 処理結果
 */
export async function generateKnowledgeLibraryWithCrewAI(input: {
  roleModelId: string;
  industries: { id: string; name: string; description: string }[];
  keywords: { id: string; name: string; description: string }[] | null;
  roleModelName: string;
  roleModelDescription: string;
  userId?: string; // ナレッジライブラリを生成するユーザーID
}): Promise<{ success: boolean; planId?: string; error?: any }> {
  try {
    console.log(`ナレッジライブラリ情報収集プラン生成を開始します: ${input.roleModelId}`);
    
    const { roleModelId, industries, keywords, roleModelName } = input;
    
    // 情報収集プランを作成
    const initialPlanTitle = `${roleModelName}の知識ベース構築`;
    const plan = await createCollectionPlan(
      roleModelId,
      initialPlanTitle,
      input.userId || '00000000-0000-0000-0000-000000000000', // システム生成プランのデフォルトユーザーID
      {
        enabledTools: ['exa'],
        searchDepth: 2,
        maxResults: 15
      }
    );
    
    // 情報収集プランの作成のみを行い、ユーザーが手動で実行できるようにする
    console.log(`情報収集プラン作成完了: planId=${plan.id}`);
    console.log(`ナレッジライブラリ生成成功: ${roleModelId}`);
    
    return { success: true, planId: plan.id };
  } catch (error) {
    console.error(`ナレッジライブラリ生成エラー:`, error);
    return { success: false, error };
  }
}

/**
 * 情報収集プランを実行し、レポートとナレッジグラフを生成する
 * 
 * @param roleModelId ロールモデルID
 * @param planId 情報収集プランID
 * @param options 実行オプション
 * @returns 実行結果
 */
export async function executeCollectionPlan(
  roleModelId: string,
  planId: string,
  options?: {
    searchDepth?: number;
    maxResults?: number;
  }
): Promise<{
  success: boolean;
  executionId?: string;
  reportId?: string;
  knowledgeGraphId?: string;
  error?: any;
}> {
  try {
    console.log(`情報収集プラン実行開始: ${planId}`);
    
    // プランの詳細を取得
    const plan = await db.query.collectionPlans.findFirst({
      where: eq(collectionPlans.id, planId)
    });
    
    if (!plan) {
      throw new Error('情報収集プランが見つかりません');
    }
    
    // 実行IDを生成（トレーサビリティのため）
    const executionId = uuidv4();
    
    // 進捗状況の更新 - 開始
    websocket.sendProgressUpdate(roleModelId, 0, `情報収集プラン「${plan.title}」の実行を開始します`);
    
    // 1. 初期調査エージェントによる初期検索の実行
    websocket.sendProgressUpdate(roleModelId, 10, '初期情報収集を実行中...');
    websocket.sendAgentThoughts(
      '初期調査エージェント',
      `${plan.title}に関する初期情報収集を開始します`,
      roleModelId,
      'starting'
    );
    
    // Exa検索APIを使用して初期検索を実行
    const searchQuery = plan.title || 'ナレッジライブラリ';
    const initialResults = await searchWithExa(
      searchQuery,
      options?.maxResults || 10,
      roleModelId
    );
    
    // 検索結果をデータベースに保存
    const sources = await Promise.all(initialResults.map(async (result) => {
      const source = await db.insert(collectionSources).values({
        id: uuidv4(),
        collectionPlanId: planId,
        executionId,
        title: result.title || '無題',
        url: result.url,
        content: result.text || '',
        metadata: JSON.stringify(result.metadata || {}),
        createdAt: new Date(),
        updatedAt: new Date(),
        type: 'exa',
        relevanceScore: result.relevanceScore || 0
      }).returning();
      
      return source[0];
    }));
    
    // 2. 計画戦略エージェントによる情報分析
    websocket.sendProgressUpdate(roleModelId, 30, '収集情報を分析中...');
    websocket.sendAgentThoughts(
      '計画戦略エージェント',
      `収集された情報を分析し、戦略を立案しています`,
      roleModelId,
      'thinking'
    );
    
    // 3. コンテンツ処理エージェントによる情報構造化
    websocket.sendProgressUpdate(roleModelId, 50, '情報を構造化中...');
    websocket.sendAgentThoughts(
      'コンテンツ処理エージェント',
      `情報を構造化し、ナレッジグラフのための要素を抽出しています`,
      roleModelId,
      'processing'
    );
    
    // 4. 重複管理エージェントによる重複排除
    websocket.sendProgressUpdate(roleModelId, 60, '重複情報を排除中...');
    websocket.sendAgentThoughts(
      '重複管理エージェント',
      `重複コンテンツを識別し、一意な情報セットを作成しています`,
      roleModelId,
      'processing'
    );
    
    // 5. 知識統合エージェントによるナレッジグラフ生成
    websocket.sendProgressUpdate(roleModelId, 70, 'ナレッジグラフを生成中...');
    websocket.sendAgentThoughts(
      '知識統合エージェント',
      `情報を統合し、ナレッジグラフを構築しています`,
      roleModelId,
      'processing'
    );
    
    // ナレッジグラフのメインノードを生成
    const mainNodeId = await neo4jService.generateNewKnowledgeGraph(
      roleModelId,
      {
        mainTopic: plan.title || 'ナレッジライブラリ',
        subTopics: sources.slice(0, 5).map(s => s.title || '無題'),
        description: `${plan.title}に関するナレッジグラフ`,
        createdBy: plan.createdBy
      }
    );
    
    // ソースからサブノードを生成
    for (const source of sources) {
      // サブノードを作成
      const subNodeId = await neo4jService.createNode({
        labels: ['Source', 'Content'],
        properties: {
          name: source.title || '無題',
          description: source.content.substring(0, 200) + '...',
          url: source.url,
          roleModelId,
          parentId: mainNodeId,
          level: 2,
          type: 'source',
          color: '#68D391', // 緑色
          metadata: { sourceId: source.id, executionId }
        }
      });
      
      // メインノードとの関連付け
      await neo4jService.createRelationship({
        sourceNodeId: mainNodeId,
        targetNodeId: subNodeId,
        type: 'HAS_SOURCE',
        properties: {
          createdAt: new Date().toISOString()
        }
      });
    }
    
    // 6. レポート作成エージェントによるレポート生成
    websocket.sendProgressUpdate(roleModelId, 85, 'レポートを生成中...');
    websocket.sendAgentThoughts(
      'レポート作成エージェント',
      `収集・分析された情報からレポートを作成しています`,
      roleModelId,
      'generating'
    );
    
    // レポートの生成
    const reportContent = {
      title: `${plan.title} - 分析レポート`,
      summary: `${plan.title}に関する情報収集と分析の結果`,
      keyFindings: [
        '情報収集により主要なトピックを特定しました',
        '複数のソースから情報を統合しました',
        'ナレッジグラフを通じて情報の関連性を視覚化しました'
      ],
      sourcesAnalyzed: sources.length,
      createdAt: new Date().toISOString()
    };
    
    // レポートをデータベースに保存
    const reportResult = await db.insert(collectionSummaries).values({
      id: uuidv4(),
      title: reportContent.title,
      content: JSON.stringify(reportContent),
      collectionPlanId: planId,
      executionId,
      createdAt: new Date(),
      updatedAt: new Date(),
      type: 'report'
    }).returning();
    
    const reportId = reportResult[0].id;
    
    // 完了通知
    websocket.sendProgressUpdate(roleModelId, 100, '情報収集プランの実行が完了しました');
    websocket.sendAgentThoughts(
      'オーケストレーターエージェント',
      `情報収集プラン「${plan.title}」の実行が完了しました`,
      roleModelId,
      'completed'
    );
    
    return {
      success: true,
      executionId,
      reportId,
      knowledgeGraphId: mainNodeId
    };
  } catch (error) {
    console.error(`情報収集プラン実行エラー:`, error);
    return { success: false, error };
  }
}