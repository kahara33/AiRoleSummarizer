import React from 'react';
import './styles.css';
import { Brain } from 'lucide-react';

interface AgentThinkingProps {
  agentName: string;
}

/**
 * エージェントが思考中であることを示すアニメーション付きコンポーネント
 */
const AgentThinking: React.FC<AgentThinkingProps> = ({ agentName }) => {
  // エージェント名から CSS クラス名を生成
  const getAgentClass = (name: string): string => {
    const normalizedName = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    const knownAgents: Record<string, string> = {
      'strategyplanner': 'strategy-planner',
      '戦略プランナー': 'strategy-planner',
      'strategy_planner': 'strategy-planner',
      'searchspecialist': 'search-specialist',
      '検索スペシャリスト': 'search-specialist',
      'search_specialist': 'search-specialist',
      'contentanalyst': 'content-analyst',
      'コンテンツアナリスト': 'content-analyst',
      'content_analyst': 'content-analyst',
      'knowledgearchitect': 'knowledge-architect',
      'ナレッジアーキテクト': 'knowledge-architect',
      'knowledge_architect': 'knowledge-architect',
      'reportwriter': 'report-writer',
      'レポートライター': 'report-writer',
      'report_writer': 'report-writer',
      'orchestrator': 'orchestrator',
      'オーケストレーター': 'orchestrator',
    };
    
    return knownAgents[normalizedName] || normalizedName;
  };

  const agentClass = getAgentClass(agentName);
  
  return (
    <div className="agent-thinking-container my-3">
      <div className="agent-thinking">
        <div className={`agent-thinking-avatar agent-${agentClass}`}>
          <Brain size={16} />
        </div>
        <div className="agent-thinking-content">
          <div className="agent-thinking-name">
            {agentName}
          </div>
          <div className="agent-thinking-indicator">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentThinking;