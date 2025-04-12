/**
 * Knowledge Library AI Agents Module
 * Defines the different AI agent roles for the knowledge library system
 * 
 * This implementation follows the improved design with 7 specialized agents:
 * 1. Initial Researcher - Initial data collection
 * 2. Plan Strategist - Search strategy optimization
 * 3. Search Conductor - Efficient execution of searches
 * 4. Content Processor - Content extraction and structuring
 * 5. Duplication Manager - Multi-level duplicate detection
 * 6. Knowledge Integrator - Knowledge graph management
 * 7. Report Compiler - Non-redundant report generation
 */

import { searchWithExa, fetchContentWithExa, ExaSearchOptions } from '../../exa-search';

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
 * Creates the Initial Researcher Agent
 * Responsible for initial data collection and basic information mapping
 */
export function createInitialResearcherAgent(): Agent {
  return {
    name: "Initial Researcher",
    description: "An expert in collecting foundational information and creating initial data maps",
    goal: "Gather comprehensive baseline data about the industry and keywords to create a foundation for further research",
    backstory: `
      As an Initial Researcher, you excel at broad information gathering to establish a baseline understanding.
      You have expertise in quickly mapping out an information landscape by identifying key sources, terms, and concepts.
      Your strength is in creating a comprehensive foundation that other specialists can build upon.
      You're skilled at recognizing important subtopics and categorizing information effectively.
    `,
    verbose: true,
    memory: true,
    maxExecutionTime: 120, // 2 minutes max execution time
    allowDelegation: true,
    tools: [
      {
        name: "BroadExaSearch",
        description: "Perform a broad search using the Exa API to establish baseline information",
        func: async (query: string, maxResults = 15) => {
          try {
            return await searchWithExa({
              query: query,
              numResults: maxResults,
              useAutoprompt: true,
              type: 'hybrid',
              highlights: true
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
 * Creates the Plan Strategist Agent
 * Responsible for search strategy optimization and query planning
 */
export function createPlanStrategistAgent(): Agent {
  return {
    name: "Plan Strategist",
    description: "An expert in optimizing search strategies and prioritizing information collection",
    goal: "Analyze initial research results and develop an optimal search plan that maximizes information quality while minimizing duplication",
    backstory: `
      As a Plan Strategist, you excel in analyzing research results and developing efficient search plans.
      You can identify knowledge gaps and prioritize areas for deeper investigation.
      Your expertise is in creating optimized search queries and designing a structured approach to information gathering.
      You understand how to balance breadth, depth, and resource efficiency in research planning.
    `,
    verbose: true,
    memory: true,
    maxExecutionTime: 120, // 2 minutes max execution time
    allowDelegation: true
  };
}

/**
 * Creates the Search Conductor Agent
 * Responsible for efficiently executing searches with optimized parameters
 */
export function createSearchConductorAgent(): Agent {
  return {
    name: "Search Conductor",
    description: "An expert in executing optimized searches with date filtering and parameter tuning",
    goal: "Execute optimized searches to retrieve the most recent and relevant information with maximum efficiency",
    backstory: `
      As a Search Conductor, you excel in optimizing search execution for maximum efficiency.
      You know how to use date filters, boolean operators, and other search parameters to get precise results.
      Your specialty is in incremental searching - retrieving only the newest information since previous searches.
      You understand how to balance API usage efficiency with comprehensive information gathering.
    `,
    verbose: true,
    memory: true,
    maxIterations: 3,
    allowDelegation: false,
    tools: [
      {
        name: "IncrementalExaSearch",
        description: "Execute an optimized search with date filtering to retrieve only the most recent information",
        func: async (query: string, startDate?: string, endDate?: string, maxResults = 10) => {
          try {
            // Set search parameters including date filters if provided
            let searchParams: any = {
              query: query,
              numResults: maxResults,
              highlights: true,
              type: 'hybrid' as 'hybrid'
            };
            
            // Add date parameters if provided
            if (startDate) {
              searchParams.startPublishedDate = startDate;
            }
            
            if (endDate) {
              searchParams.endPublishedDate = endDate;
            }
            
            return await searchWithExa(searchParams);
          } catch (error) {
            console.error("Error using incremental Exa search:", error);
            return { 
              error: true, 
              message: "Failed to retrieve information from Exa API", 
              sources: []
            };
          }
        }
      },
      {
        name: "FetchContent",
        description: "Fetch the full content of specific URLs for deeper analysis",
        func: async (urls: string | string[], useCache = true) => {
          try {
            return await fetchContentWithExa(urls, undefined, useCache);
          } catch (error) {
            console.error("Error fetching content:", error);
            return [];
          }
        }
      }
    ]
  };
}

/**
 * Creates the Content Processor Agent
 * Responsible for extracting, structuring, and analyzing content
 */
export function createContentProcessorAgent(): Agent {
  return {
    name: "Content Processor",
    description: "An expert in extracting, structuring, and analyzing content from various sources",
    goal: "Transform raw content into well-structured, analyzed information with extracted entities and relationships",
    backstory: `
      As a Content Processor, you excel at extracting meaningful information from raw content.
      You have exceptional skills in natural language processing, entity extraction, and content categorization.
      Your expertise lies in identifying key information points, structuring unstructured content, and standardizing metadata.
      You're particularly skilled at extracting entities and their relationships from text to prepare for knowledge graph integration.
    `,
    verbose: true,
    memory: true,
    maxIterations: 2,
    allowDelegation: false
  };
}

/**
 * Creates the Duplication Manager Agent
 * Responsible for detecting and removing duplicate information
 */
export function createDuplicationManagerAgent(): Agent {
  return {
    name: "Duplication Manager",
    description: "An expert in detecting and eliminating duplicate information at multiple levels",
    goal: "Ensure information quality by identifying and removing duplicates while preserving uniquely valuable content",
    backstory: `
      As a Duplication Manager, you excel at identifying redundant information across multiple dimensions.
      You have expertise in comparing content at different levels: exact matches, semantic similarity, and conceptual overlap.
      Your strength is in distinguishing between true duplicates and content that appears similar but contains unique value.
      You're skilled at maintaining a historical perspective on information to track what's truly new versus what's merely repackaged.
    `,
    verbose: true,
    memory: true,
    maxIterations: 2,
    allowDelegation: false
  };
}

/**
 * Creates the Knowledge Integrator Agent
 * Responsible for time-based knowledge graph management
 */
export function createKnowledgeIntegratorAgent(): Agent {
  return {
    name: "Knowledge Integrator",
    description: "An expert in managing temporal knowledge graphs and integrating new information",
    goal: "Create and maintain a chronological knowledge graph that effectively captures information evolution over time",
    backstory: `
      As a Knowledge Integrator, you excel in maintaining time-based knowledge structures.
      You have expertise in tracking how information changes over time and identifying meaningful trends and shifts.
      Your strength is in determining how new information relates to and updates existing knowledge.
      You understand how to create knowledge frameworks that preserve historical context while highlighting what's truly new.
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