import React from 'react';
import './styles.css';

interface AgentThinkingProps {
  agentName: string;
}

/**
 * エージェントが思考中であることを表す視覚的なインジケーター
 */
const AgentThinking: React.FC<AgentThinkingProps> = ({ agentName }) => {
  return (
    <div className="agent-thinking">
      <span>{agentName}が考えています</span>
      <div className="agent-thinking-dots">
        <div className="agent-thinking-dot"></div>
        <div className="agent-thinking-dot"></div>
        <div className="agent-thinking-dot"></div>
      </div>
    </div>
  );
};

export default AgentThinking;