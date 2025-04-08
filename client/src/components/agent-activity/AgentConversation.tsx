import React, { useState, useEffect, useRef } from 'react';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket-fixed';
import { AgentThought } from '@/hooks/use-multi-agent-websocket-fixed';
import AgentMessage, { AgentMessageType } from './AgentMessage';
import AgentThinking from './AgentThinking';
import { X, Maximize2, Minimize2, RefreshCw, Bot, BrainCircuit } from 'lucide-react';
import './styles.css';

interface AgentConversationProps {
  roleModelId?: string;
  height?: string;
  width?: string;
  showHeader?: boolean;
  title?: string;
}

interface GroupedMessage {
  agentName: string;
  messages: Array<{
    id: string;
    content: string;
    timestamp: string;
    type: AgentMessageType;
  }>;
}

/**
 * マルチエージェントの会話を表示するコンポーネント
 */
const AgentConversation: React.FC<AgentConversationProps> = ({
  roleModelId,
  height = '500px',
  width = '100%',
  showHeader = true,
  title = 'AI エージェント思考プロセス'
}) => {
  const [minimized, setMinimized] = useState(false);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const contentRef = useRef<HTMLDivElement>(null);
  
  // WebSocket フックから思考データを取得
  const { 
    agentThoughts, 
    connect, 
    isConnected,
    isProcessing,
    clearMessages
  } = useMultiAgentWebSocket();
  
  // ロールモデルIDが変更されたら再接続
  useEffect(() => {
    if (roleModelId) {
      connect(roleModelId);
    }
  }, [roleModelId, connect]);

  // 新しいメッセージが来たら自動スクロール
  useEffect(() => {
    if (contentRef.current && agentThoughts.length > 0) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [agentThoughts]);

  // アクティブなエージェントを追跡
  useEffect(() => {
    const agents = new Set<string>();
    agentThoughts.forEach(thought => {
      if (thought.agentName) {
        agents.add(thought.agentName);
      }
    });
    setActiveAgents(agents);
  }, [agentThoughts]);

  // エージェントの思考をメッセージとしてマッピング
  const mapThoughtsToMessages = () => {
    return agentThoughts.map(thought => {
      // タイプ判定のための正規表現
      const isActionType = /^アクション:|^実行:|^Action:/i.test(thought.thought || '');
      const isResultType = /^結果:|^出力:|^Result:/i.test(thought.thought || '');
      const isErrorType = /^エラー:|^失敗:|^Error:/i.test(thought.thought || '');
      
      // 思考内容からメッセージタイプを判断
      let messageType: AgentMessageType = 'thought';
      if (thought.type === 'thinking') {
        messageType = 'thinking';
      } else if (isActionType) {
        messageType = 'action';
      } else if (isResultType) {
        messageType = 'result';
      } else if (isErrorType) {
        messageType = 'error';
      }
      
      return {
        id: thought.id || `thought-${Math.random().toString(36).substr(2, 9)}`,
        agentName: thought.agentName,
        content: thought.thought || thought.message || '',
        timestamp: thought.timestamp,
        type: messageType
      };
    });
  };

  // メッセージをエージェントごとにグループ化
  const groupMessagesByAgent = (): GroupedMessage[] => {
    const messages = mapThoughtsToMessages();
    const grouped: Record<string, GroupedMessage> = {};
    
    messages.forEach(msg => {
      if (!grouped[msg.agentName]) {
        grouped[msg.agentName] = {
          agentName: msg.agentName,
          messages: []
        };
      }
      
      grouped[msg.agentName].messages.push({
        id: msg.id,
        content: msg.content,
        timestamp: msg.timestamp,
        type: msg.type
      });
    });
    
    return Object.values(grouped);
  };

  const handleClearMessages = () => {
    clearMessages();
  };

  // メッセージが空の場合の表示
  const renderEmptyState = () => (
    <div className="agent-conversation-empty">
      <BrainCircuit size={48} />
      <h3>まだ会話がありません</h3>
      <p>AIエージェントが処理を開始すると、ここにその思考プロセスが表示されます。</p>
    </div>
  );

  if (minimized) {
    return (
      <div 
        className="agent-conversation"
        style={{
          width: 'auto',
          height: 'auto',
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000
        }}
      >
        <div className="agent-conversation-header">
          <h3>{title}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setMinimized(false)}
              style={{ 
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="agent-conversation"
      style={{ 
        height, 
        width,
        ...(width === '100%' ? { maxWidth: '100%' } : {})
      }}
    >
      {showHeader && (
        <div className="agent-conversation-header">
          <h3>
            {isProcessing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} className="animate-spin" />
                {title} (処理中...)
              </span>
            ) : (
              title
            )}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleClearMessages}
              style={{ 
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
              title="会話をクリア"
            >
              <RefreshCw size={16} />
            </button>
            <button 
              onClick={() => setMinimized(true)}
              style={{ 
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
              title="最小化"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>
      )}
      
      <div className="agent-conversation-content" ref={contentRef}>
        {agentThoughts.length === 0 ? (
          renderEmptyState()
        ) : (
          groupMessagesByAgent().map(group => (
            <div key={group.agentName} className="agent-message-group">
              {group.messages.map((message, idx) => (
                <AgentMessage
                  key={message.id}
                  agentName={group.agentName}
                  content={message.content}
                  timestamp={message.timestamp}
                  type={message.type}
                  showAvatar={idx === 0}
                />
              ))}
            </div>
          ))
        )}
        
        {isProcessing && Array.from(activeAgents).map(agent => (
          <AgentThinking key={`thinking-${agent}`} agentName={agent} />
        ))}
      </div>
    </div>
  );
};

export default AgentConversation;