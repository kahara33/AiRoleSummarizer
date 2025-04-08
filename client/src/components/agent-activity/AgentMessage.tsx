import React, { useState, useEffect } from 'react';
import './styles.css';
import { 
  BrainCircuit, Bot, Zap, CheckCircle2, AlertTriangle, 
  Database, Search, Network, BarChart4, Brain, Sparkles
} from 'lucide-react';

export type AgentMessageType = 'thinking' | 'thought' | 'action' | 'result' | 'error' | 'info' | 'success';

interface AgentMessageProps {
  agentName: string;
  content: string;
  timestamp: string | Date;
  type: AgentMessageType;
  showAvatar?: boolean;
}

/**
 * エージェントからのメッセージを表示するコンポーネント
 */
const AgentMessage: React.FC<AgentMessageProps> = ({ 
  agentName, 
  content, 
  timestamp, 
  type, 
  showAvatar = true 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // コンポーネントがマウントされたらアニメーション表示
  useEffect(() => {
    // コンポーネントのマウント後に少し遅れてアニメーション表示
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);
    
    // デバッグ用ログ（常に表示）
    console.log(`AgentMessage表示: ${agentName} - ${type} - コンテンツ: ${content.substring(0, 20)}... - isVisible: ${isVisible}`);
    
    return () => clearTimeout(timer);
  }, [agentName, type, content, isVisible]);
  // エージェント名から CSS クラス名を生成
  const getAgentClass = (name: string): string => {
    const normalizedName = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    const knownAgents: Record<string, string> = {
      'domainanalyst': 'domain-analyst',
      'ドメイン分析エージェント': 'domain-analyst',
      'ドメインアナリスト': 'domain-analyst',
      'domainanalysisagent': 'domain-analyst',
      'trendresearcher': 'trend-researcher',
      'トレンド調査エージェント': 'trend-researcher',
      'トレンドリサーチャー': 'trend-researcher',
      'trendresearchagent': 'trend-researcher',
      'contextmapper': 'context-mapper',
      'コンテキストマッピングエージェント': 'context-mapper',
      'contextmappingagent': 'context-mapper',
      'planstrategist': 'plan-strategist',
      'プラン戦略エージェント': 'plan-strategist',
      'プランストラテジスト': 'plan-strategist',
      'planstrategistagent': 'plan-strategist',
      'criticalthinker': 'critical-thinker',
      '批判的思考エージェント': 'critical-thinker',
      'クリティカルシンカー': 'critical-thinker',
      'criticalthinkingagent': 'critical-thinker',
      'orchestrator': 'orchestrator',
      'オーケストレーターエージェント': 'orchestrator',
      'オーケストレーター': 'orchestrator',
      'orchestratoragent': 'orchestrator',
      'knowledgegraphagent': 'knowledge-graph',
      '知識グラフエージェント': 'knowledge-graph',
      'ナレッジグラフエージェント': 'knowledge-graph',
    };
    
    return knownAgents[normalizedName] || normalizedName;
  };
  
  // タイムスタンプをフォーマット
  const formatTimestamp = (timestamp: string | Date): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  // エージェント名に応じたアイコンを表示
  const getIconForAgent = (agentName: string) => {
    const name = agentName.toLowerCase();
    
    if (name.includes('ドメイン') || name.includes('domain')) {
      return <Database size={16} />;
    } else if (name.includes('トレンド') || name.includes('trend')) {
      return <Search size={16} />;
    } else if (name.includes('コンテキスト') || name.includes('context')) {
      return <Network size={16} />;
    } else if (name.includes('プラン') || name.includes('plan')) {
      return <BarChart4 size={16} />;
    } else if (name.includes('クリティカル') || name.includes('critical')) {
      return <Brain size={16} />;
    } else if (name.includes('オーケストレーター') || name.includes('orchestrator')) {
      return <Sparkles size={16} />;
    } else if (name.includes('システム') || name.includes('system')) {
      return <Bot size={16} />;
    } else {
      // メッセージタイプに応じたアイコンをフォールバックとして使用
      switch (type) {
        case 'thinking':
          return <BrainCircuit size={16} />;
        case 'thought':
          return <Bot size={16} />;
        case 'action':
          return <Zap size={16} />;
        case 'result':
        case 'success':
          return <CheckCircle2 size={16} />;
        case 'error':
          return <AlertTriangle size={16} />;
        case 'info':
          return <Bot size={16} />;
        default:
          return <Bot size={16} />;
      }
    }
  };
  
  // コードブロックを見つけてフォーマットする
  const formatMessageContent = (content: string) => {
    // コードブロックを検出して処理
    const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)```/g;
    let formattedContent = content;
    let match;
    
    // すべてのコードブロックを置換
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1];
      const code = match[2];
      
      formattedContent = formattedContent.replace(
        match[0],
        `<div class="agent-message-code"><pre>${code}</pre></div>`
      );
    }
    
    // インラインコードの処理
    formattedContent = formattedContent.replace(
      /`([^`]+)`/g,
      '<code>$1</code>'
    );
    
    return { __html: formattedContent };
  };
  
  const agentClass = getAgentClass(agentName);
  
  return (
    <div className={`agent-message-container message-type-${type} ${isVisible ? 'agent-message-visible' : 'agent-message-hidden'}`}>
      <div className="agent-message">
        {showAvatar && (
          <div className={`agent-message-avatar agent-${agentClass}`}>
            {getIconForAgent(agentName)}
          </div>
        )}
        <div className="agent-message-content">
          <div className="agent-message-header">
            <span className="agent-message-name">{agentName}</span>
            <span className="agent-message-time">{formatTimestamp(timestamp)}</span>
          </div>
          <div 
            className="agent-message-text"
            dangerouslySetInnerHTML={formatMessageContent(content)}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentMessage;