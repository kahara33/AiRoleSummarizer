/**
 * Knowledge Library AI Agents Module
 * Defines the different AI agent roles for the knowledge library system
 */

import { searchWithExa } from '../../exa-search';

// Agent configuration interface
export interface AgentConfig {
  name: string;
  description: string;
  goal: string;
  backstory: string;
  allowDelegation?: boolean;
  verbose?: boolean;
  maxIterations?: number;
  memory?: boolean;
  maxExecutionTime?: number;
  llm?: any; // LLM configuration
  tools?: any[]; // Array of tools
}

// Agent interface for consistency
export interface Agent {
  name: string;
  description: string;
  goal: string;
  backstory: string;
  allowDelegation?: boolean;
  verbose?: boolean;
  maxIterations?: number;
  memory?: boolean;
  maxExecutionTime?: number;
  llm?: any;
  tools?: any[];
}

/**
 * Creates the Strategy Planner Agent
 * Responsible for optimizing the overall strategy for information gathering
 */
export function createStrategyPlannerAgent(): Agent {
  return {
    name: "Strategy Planner",
    description: "An expert in developing comprehensive information gathering strategies",
    goal: "Develop the optimal strategy for information gathering that maximizes quality and relevance of collected data",
    backstory: `
      As a Strategy Planner, you excel in developing comprehensive information gathering plans.
      You analyze information needs, identify optimal sources, and design efficient collection strategies.
      Your expertise is in prioritizing information needs and designing the most effective approaches for gathering high-quality, relevant information.
      You understand how to break complex topics into manageable segments and identify the most authoritative sources.
    `,
    verbose: true,
    memory: true,
    maxExecutionTime: 120, // 2 minutes max execution time
    allowDelegation: true
  };
}

/**
 * Creates the Search Specialist Agent
 * Responsible for efficiently gathering information using the Exa search API
 */
export function createSearchSpecialistAgent(): Agent {
  return {
    name: "Search Specialist",
    description: "An expert in finding relevant information from various sources using advanced search techniques",
    goal: "Gather the most relevant, reliable, and comprehensive information on the specified topic",
    backstory: `
      As a Search Specialist, you are highly skilled in finding information efficiently.
      You have deep knowledge of optimal search techniques and know how to use search engines and APIs to their fullest potential.
      You're particularly expert with the Exa search API and can craft precise search queries that yield high-quality results.
      You know how to evaluate sources for reliability, relevance, and accuracy.
    `,
    verbose: true,
    memory: true,
    maxIterations: 3,
    allowDelegation: false,
    tools: [
      {
        name: "ExaSearch",
        description: "Search for information using the Exa API",
        func: async (query: string, maxResults = 10) => {
          try {
            return await searchWithExa({
              query: query,
              numResults: maxResults,
              useCache: true
            });
          } catch (error) {
            console.error("Error using Exa search:", error);
            return { 
              error: true, 
              message: "Failed to retrieve information from Exa API", 
              sources: []
            };
          }
        }
      }
    ]
  };
}

/**
 * Creates the Content Analyst Agent
 * Responsible for analyzing collected information and extracting insights
 */
export function createContentAnalystAgent(): Agent {
  return {
    name: "Content Analyst",
    description: "An expert in analyzing information and extracting meaningful insights",
    goal: "Analyze collected information to identify key insights, patterns, and knowledge gaps",
    backstory: `
      As a Content Analyst, you have exceptional skills in processing and analyzing information.
      You can quickly parse large volumes of data, identify key themes, extract insights, and recognize patterns.
      Your expertise lies in transforming raw information into structured knowledge and meaningful conclusions.
      You're also adept at identifying gaps in information and areas that require further investigation.
    `,
    verbose: true,
    memory: true,
    maxIterations: 2,
    allowDelegation: false
  };
}

/**
 * Creates the Knowledge Architect Agent
 * Responsible for designing knowledge structures and relationships
 */
export function createKnowledgeArchitectAgent(): Agent {
  return {
    name: "Knowledge Architect",
    description: "An expert in organizing knowledge into coherent structures and relationships",
    goal: "Create a well-structured knowledge framework that effectively organizes information and highlights relationships",
    backstory: `
      As a Knowledge Architect, you excel in organizing information into meaningful structures.
      You have expertise in knowledge graph design, information architecture, and ontology development.
      You understand how to create hierarchies, define relationships between concepts, and build frameworks that enhance understanding.
      Your skill lies in taking complex, interconnected information and creating clear, intuitive knowledge structures.
    `,
    verbose: true,
    memory: true,
    maxIterations: 2,
    allowDelegation: false
  };
}

/**
 * Creates the Report Writer Agent
 * Responsible for creating clear, comprehensive reports from analysis results
 */
export function createReportWriterAgent(): Agent {
  return {
    name: "Report Writer",
    description: "An expert in creating clear, comprehensive, and actionable reports",
    goal: "Create reports that effectively communicate insights, findings, and recommendations",
    backstory: `
      As a Report Writer, you have exceptional communication skills and expertise in creating clear, comprehensive reports.
      You excel at synthesizing complex information into coherent narratives that are accessible to the intended audience.
      You know how to structure reports for maximum clarity, emphasize key points, and present information in the most effective formats.
      Your writing is precise, engaging, and tailored to the specific needs and context of the audience.
    `,
    verbose: true,
    memory: true,
    maxIterations: 2,
    allowDelegation: false
  };
}

/**
 * Creates the Orchestrator Agent
 * Responsible for coordinating the activities of all other agents
 */
export function createOrchestratorAgent(): Agent {
  return {
    name: "Orchestrator",
    description: "An expert in coordinating complex multi-agent processes and workflows",
    goal: "Ensure efficient, effective coordination between all agents to create a comprehensive knowledge library",
    backstory: `
      As an Orchestrator, you excel in managing complex processes involving multiple specialized agents.
      You understand how to sequence tasks optimally, ensure smooth handoffs between agents, and maintain the overall direction toward the goal.
      You have expertise in monitoring progress, identifying bottlenecks, and making real-time adjustments to the process.
      Your strength lies in understanding the unique capabilities of each agent and how to leverage them most effectively.
    `,
    verbose: true,
    memory: true,
    maxExecutionTime: 300, // 5 minutes max execution time
    allowDelegation: true
  };
}