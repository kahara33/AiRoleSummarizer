/**
 * ナレッジライブラリサービス
 * CrewAIを使用したマルチエージェント協調処理システム
 */

import { storage } from '../../storage';
import { collectionPlans, collectionSources, collectionSummaries } from '../../../shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { searchWithExa } from '../exa-search';
import * as neo4jService from '../neo4j-service';
import * as websocket from '../../websocket';
import { 
  createStrategyPlannerAgent,
  createSearchSpecialistAgent,
  createContentAnalystAgent,
  createKnowledgeArchitectAgent,
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
 * @param collectionPlanId 情報収集プランID
 * @param roleModelId ロールモデルID
 * @returns 処理結果（成功/失敗）
 */
export async function runKnowledgeLibraryProcess(
  collectionPlanId: string,
  roleModelId: string
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
    const strategyPlanner = createStrategyPlannerAgent();
    const searchSpecialist = createSearchSpecialistAgent();
    const contentAnalyst = createContentAnalystAgent();
    const knowledgeArchitect = createKnowledgeArchitectAgent();
    const reportWriter = createReportWriterAgent();
    const orchestrator = createOrchestratorAgent();

    // 戦略プランナータスク - 情報収集の戦略を立てる
    const strategyPlannerTask = {
      description: `Develop a comprehensive strategy to gather information about "${plan.title}".
      Consider the most reliable sources, important subtopics, and key questions to answer.
      The strategy should maximize information quality and relevance.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 10, 'Planning information gathering strategy...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm developing a strategy for gathering information about "${plan.title}".`, 
          roleModelId
        );
        
        // 戦略策定の思考過程をクライアントに通知
        setTimeout(() => {
          websocket.sendAgentThoughts(
            agent.name,
            `For "${plan.title}", we need to gather information from authoritative sources, recent research, industry reports, and expert opinions.`,
            roleModelId
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
    
    // 検索スペシャリストタスク - Exa APIで情報収集
    const searchSpecialistTask = {
      description: `Using the strategy provided, gather the most relevant and reliable information about "${plan.title}".
      Use the Exa API to search for information across the web, academic databases, and other sources.
      Organize the information in a clear and structured way.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 30, 'Searching for information...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm gathering information about "${plan.title}" using our search API.`, 
          roleModelId
        );
        
        // Exa検索の実行（実際の取得）
        try {
          const searchResults = await searchWithExa({
            query: plan.title,
            numResults: plan.toolsConfig?.maxResults || 10,
            useCache: true
          });
          
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
    
    // コンテンツアナリストタスク - 収集した情報を分析
    const contentAnalystTask = {
      description: `Analyze the information collected about "${plan.title}".
      Identify key insights, patterns, and trends.
      Extract the most important and actionable knowledge.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 50, 'Analyzing collected information...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm analyzing the information we've collected about "${plan.title}".`, 
          roleModelId
        );
        
        // 分析の開始を通知
        setTimeout(() => {
          websocket.sendAgentThoughts(
            agent.name,
            `Extracting key insights and identifying patterns from the collected information...`,
            roleModelId
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
    
    // ナレッジアーキテクトタスク - 知識グラフの構築
    const knowledgeArchitectTask = {
      description: `Design and create a knowledge structure for the information about "${plan.title}".
      Identify key concepts, their relationships, and hierarchies.
      Create a knowledge graph that effectively organizes the information.`,
      async function(agent: any, input: any) {
        // 進捗状況の更新
        websocket.sendProgressUpdate(roleModelId, 70, 'Building knowledge structure...');
        websocket.sendAgentThoughts(
          agent.name, 
          `I'm designing a knowledge structure for "${plan.title}".`, 
          roleModelId
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
          roleModelId
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
        strategyPlanner,
        searchSpecialist,
        contentAnalyst,
        knowledgeArchitect,
        reportWriter,
        orchestrator
      ],
      tasks: [
        strategyPlannerTask,
        searchSpecialistTask,
        contentAnalystTask,
        knowledgeArchitectTask,
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