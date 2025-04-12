import React, { useState, useEffect, useRef } from 'react';
import './styles.css';
import { Bot, AlertCircle, WifiIcon, WifiOffIcon, Loader2, Send, User } from 'lucide-react';
import AgentMessage from './AgentMessage';
import AgentThinking from './AgentThinking';
import { useUnifiedWebSocket } from '@/hooks/use-unified-websocket';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface AgentConversationProps {
  roleModelId?: string;
  height?: string;
  onSendMessage?: (message: string) => void;
  agentThoughts?: any[];
  progressUpdates?: any[];
  isProcessing?: boolean;
  className?: string;
}

/**
 * AIエージェントの会話を表示するコンポーネント
 * WebSocketを使用してリアルタイムにエージェントからのメッセージを受信し、表示します
 */
const AgentConversation: React.FC<AgentConversationProps> = ({ 
  roleModelId, 
  height = '500px', 
  onSendMessage,
  agentThoughts: externalAgentThoughts,
  progressUpdates: externalProgressUpdates,
  isProcessing: externalIsProcessing,
  className
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [thinkingAgentName, setThinkingAgentName] = useState<string | null>(null);
  const [userInput, setUserInput] = useState<string>('');
  const [userMessages, setUserMessages] = useState<{content: string, timestamp: Date}[]>([]);
  
  const { 
    isConnected,
    connect,
    agentThoughts: internalAgentThoughts,
    progressUpdates: internalProgressUpdates,
    isProcessing: internalIsProcessing,
    sendMessage,
    error
  } = useUnifiedWebSocket();
  
  // 接続中かどうかの状態（useUnifiedWebSocketにはconnecting状態がないため独自に管理）
  const [connecting, setConnecting] = useState(false);
  
  // 親から渡されたプロパティを優先して使用、なければ内部状態を使用
  const agentThoughts = externalAgentThoughts || internalAgentThoughts;
  const progressUpdates = externalProgressUpdates || internalProgressUpdates;
  const isProcessing = externalIsProcessing !== undefined ? externalIsProcessing : internalIsProcessing;
  
  // roleModelIdが変更されたらWebSocket接続を確立
  useEffect(() => {
    if (roleModelId) {
      setConnecting(true);
      connect(roleModelId);
      // 接続状態が変化したときに接続中フラグを更新
      setTimeout(() => {
        setConnecting(false);
      }, 1000);
    }
    
    // 現在のunifiedWebSocketには切断メソッドがない
    return () => {
      // 特に何もしない（現在のuseUnifiedWebSocketにはdisconnectメソッドがない）
    };
  }, [roleModelId, connect]);
  
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
  
  // ユーザーメッセージ送信ハンドラー
  const handleSendMessage = () => {
    if (!userInput.trim() || !roleModelId) return;
    
    // 新しいユーザーメッセージを作成
    const newUserMessage = {
      content: userInput.trim(),
      timestamp: new Date()
    };
    
    // ユーザーメッセージをローカル配列に追加
    setUserMessages(prev => [...prev, newUserMessage]);
    
    // WebSocketを通じてサーバーにメッセージを送信
    if (roleModelId) {
      // 親コンポーネントから渡されたハンドラがあれば使用
      if (onSendMessage) {
        onSendMessage(userInput);
      } else {
        // WebSocketを直接使用
        sendMessage('user_message', {
          content: userInput,
          roleModelId,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log("ユーザーメッセージ送信:", userInput);
    }
    
    // 入力フィールドをクリア
    setUserInput('');
  };
  
  // Enterキーでメッセージを送信
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // メッセージ一覧を表示
  const renderMessages = () => {
    // 表示するメッセージが無い場合
    if (!agentThoughts.length && !progressUpdates.length && !userMessages.length) {
      return renderEmpty();
    }
    
    // すべてのメッセージを一つの配列にまとめて時系列順にソート
    const allMessages = [
      // エージェントの思考メッセージ
      ...agentThoughts.map((thought: any) => ({
        id: thought.id || `thought-${thought.timestamp}`,
        type: 'agent',
        agentName: thought.agentName,
        content: thought.thought || '',
        timestamp: thought.timestamp,
        messageType: ((thought.type as string) || 'thought') as any
      })),
      
      // 進捗更新メッセージ
      ...progressUpdates.map((update: any) => ({
        id: `progress-${update.timestamp}`,
        type: 'system',
        agentName: 'システム',
        content: update.message,
        timestamp: update.timestamp,
        messageType: 'info'
      })),
      
      // ユーザーメッセージ
      ...userMessages.map((msg, index) => ({
        id: `user-${index}-${msg.timestamp.getTime()}`,
        type: 'user',
        agentName: 'ユーザー',
        content: msg.content,
        timestamp: msg.timestamp,
        messageType: 'user'
      }))
    ].sort((a, b) => {
      // タイムスタンプでソート
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
    
    return (
      <div className="p-4">
        {/* 統合されたすべてのメッセージを表示 */}
        {allMessages.map((message) => (
          message.type === 'user' ? (
            // ユーザーメッセージ
            <div key={message.id} className="flex justify-end mb-4">
              <div className="flex items-start max-w-[80%]">
                <div className="bg-primary text-primary-foreground rounded-lg p-3">
                  <div className="flex items-center mb-1">
                    <User size={16} className="mr-2" />
                    <span className="text-sm font-medium">ユーザー</span>
                  </div>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  <div className="text-xs opacity-80 mt-1 text-right">
                    {message.timestamp instanceof Date
                      ? message.timestamp.toLocaleTimeString() 
                      : new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // エージェントまたはシステムメッセージ
            <AgentMessage
              key={message.id}
              agentName={message.agentName}
              content={message.content}
              timestamp={message.timestamp}
              type={message.messageType}
            />
          )
        ))}
        
        {/* エージェントが思考中の表示 */}
        {showThinking && thinkingAgentName && (
          <AgentThinking agentName={thinkingAgentName} />
        )}
      </div>
    );
  };
  
  return (
    <div className={`h-full flex flex-col ${className || ''}`} style={containerStyle}>      
      {/* メッセージ表示エリア */}
      <div className="flex-1 overflow-y-auto bg-white" ref={contentRef}>
        {renderError()}
        {renderMessages()}
      </div>
      
      {/* ユーザー入力エリア */}
      <div className="p-3 border-t border-gray-200 bg-white mt-auto">
        <div className="flex gap-2">
          <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="min-h-[40px] resize-none text-sm flex-1"
            onKeyDown={handleKeyDown}
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={!userInput.trim() || !roleModelId}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AgentConversation;