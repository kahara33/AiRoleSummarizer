import React, { useState, useEffect, useRef } from 'react';
import './styles.css';
import { Bot, AlertCircle, WifiIcon, WifiOffIcon, Loader2 } from 'lucide-react';
import AgentMessage from './AgentMessage';
import AgentThinking from './AgentThinking';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket-fixed';
import { Badge } from '@/components/ui/badge';

interface AgentConversationProps {
  roleModelId?: string;
  height?: string;
}

/**
 * AIエージェントの会話を表示するコンポーネント
 * WebSocketを使用してリアルタイムにエージェントからのメッセージを受信し、表示します
 */
const AgentConversation: React.FC<AgentConversationProps> = ({ roleModelId, height = '500px' }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [thinkingAgentName, setThinkingAgentName] = useState<string | null>(null);
  
  const { 
    isConnected,
    connecting,
    error, 
    agentThoughts,
    progressUpdates,
    isProcessing,
    connect,
    disconnect
  } = useMultiAgentWebSocket();
  
  // roleModelIdが変更されたらWebSocket接続を確立
  useEffect(() => {
    if (roleModelId) {
      connect(roleModelId);
    } else {
      disconnect();
    }
    
    return () => {
      disconnect();
    };
  }, [roleModelId, connect, disconnect]);
  
  // エージェントの思考状態を更新
  useEffect(() => {
    if (isProcessing && agentThoughts.length > 0) {
      // 最新のエージェント名を取得して思考中状態を表示
      const latestThought = agentThoughts[agentThoughts.length - 1];
      setShowThinking(true);
      setThinkingAgentName(latestThought.agentName);
    } else {
      setShowThinking(false);
      setThinkingAgentName(null);
    }
  }, [isProcessing, agentThoughts]);
  
  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [agentThoughts, progressUpdates, showThinking]);
  
  // スタイル設定
  const containerStyle = {
    height: height || '500px'
  };
  
  // エラー表示
  const renderError = () => {
    if (!error) return null;
    
    return (
      <div className="flex items-center gap-2 p-4 mt-2 bg-red-50 text-red-600 rounded-md border border-red-200">
        <AlertCircle size={16} />
        <span className="text-sm">{error}</span>
      </div>
    );
  };
  
  // 空の状態を表示
  const renderEmpty = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        {connecting ? (
          <>
            <div className="bg-blue-50 p-3 rounded-full mb-4">
              <Loader2 size={40} className="text-blue-500 animate-spin" />
            </div>
            <h3 className="text-xl font-semibold mb-2">接続中...</h3>
            <p className="text-gray-600 max-w-sm">
              AIエージェントへの接続を確立しています
            </p>
          </>
        ) : (
          <>
            <div className="bg-blue-50 p-3 rounded-full mb-4">
              <Bot size={40} className="text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AIエージェント会話</h3>
            <p className="text-gray-600 max-w-sm">
              {roleModelId 
                ? 'エージェントからのメッセージがここに表示されます' 
                : 'ロールモデルIDを指定してエージェントに接続してください'}
            </p>
          </>
        )}
      </div>
    );
  };
  
  // メッセージ一覧を表示
  const renderMessages = () => {
    // 表示するメッセージが無い場合
    if (!agentThoughts.length && !progressUpdates.length) {
      return renderEmpty();
    }
    
    return (
      <div className="p-4">
        {/* エージェントの思考メッセージ */}
        {agentThoughts.map((thought, index) => (
          <AgentMessage
            key={`thought-${index}`}
            agentName={thought.agentName}
            content={thought.thought || ''}
            timestamp={thought.timestamp}
            type={((thought.type as string) || 'thought') as any}
          />
        ))}
        
        {/* 進捗更新メッセージ */}
        {progressUpdates.map((update, index) => (
          <AgentMessage
            key={`progress-${index}`}
            agentName={'システム'}
            content={update.message}
            timestamp={update.timestamp}
            type="info"
          />
        ))}
        
        {/* エージェントが思考中の表示 */}
        {showThinking && thinkingAgentName && (
          <AgentThinking agentName={thinkingAgentName} />
        )}
      </div>
    );
  };
  
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden bg-white" style={containerStyle}>
      <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <WifiIcon size={14} className="text-green-600" />
              <span className="text-sm font-medium text-green-600">接続済み</span>
              <Badge variant="outline" className="ml-1 bg-green-50 text-green-700 text-xs border-green-200">
                リアルタイム
              </Badge>
            </>
          ) : (
            <>
              <WifiOffIcon size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-500">未接続</span>
            </>
          )}
        </div>
        {roleModelId && (
          <div className="text-xs text-gray-500">
            ID: {roleModelId.substring(0, 8)}...
          </div>
        )}
      </div>
      
      <div className="h-full overflow-y-auto bg-white" ref={contentRef}>
        {renderError()}
        {renderMessages()}
      </div>
    </div>
  );
};

export default AgentConversation;