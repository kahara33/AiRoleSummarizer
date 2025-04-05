import React, { useState, useEffect, useRef } from 'react';
import { initSocket, addSocketListener, removeSocketListener } from '@/lib/socket';
import { KnowledgeNode } from '@shared/schema';
import { Brain, Search, Network, Share2, User, MessageSquare, Filter, X } from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'thought' | 'communication' | 'progress' | 'graph-update';
  content: string;
  timestamp: string;
  agentId?: string;
  agentName?: string;
  agentType?: string;
  sourceAgentId?: string;
  sourceAgentName?: string;
  sourceAgentType?: string;
  targetAgentId?: string;
  targetAgentName?: string;
  targetAgentType?: string;
  stage?: string;
  progress?: number;
  relatedNodes?: string[];
}

interface ChatPanelProps {
  selectedNode?: KnowledgeNode | null;
  height?: number;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ selectedNode, height = 500 }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    if (!expandedMessage && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, expandedMessage]);
  
  // WebSocketリスナーの設定
  useEffect(() => {
    const socket = initSocket();
    
    // エージェントの思考プロセス
    const handleAgentThoughts = (data: any) => {
      setMessages(msgs => [...msgs, {
        id: `thought-${Date.now()}`,
        type: 'thought',
        agentId: data.agentId,
        agentName: data.agentName,
        agentType: data.agentType,
        content: data.thoughts,
        timestamp: data.timestamp,
        relatedNodes: [data.agentId]
      }]);
    };
    
    // エージェント間の通信
    const handleAgentCommunication = (data: any) => {
      setMessages(msgs => [...msgs, {
        id: `comm-${Date.now()}`,
        type: 'communication',
        sourceAgentId: data.sourceAgentId,
        sourceAgentName: data.sourceAgentName,
        sourceAgentType: data.sourceAgentType,
        targetAgentId: data.targetAgentId,
        targetAgentName: data.targetAgentName,
        targetAgentType: data.targetAgentType,
        content: data.message,
        timestamp: data.timestamp,
        relatedNodes: [data.sourceAgentId, data.targetAgentId]
      }]);
    };
    
    // 処理進捗状況
    const handleProgressUpdate = (data: any) => {
      setMessages(msgs => [...msgs, {
        id: `progress-${Date.now()}`,
        type: 'progress',
        stage: data.stage,
        progress: data.progress,
        content: `${getStageLabel(data.stage)} - ${data.progress}%: ${data.details.message || ''}`,
        timestamp: data.timestamp,
        relatedNodes: [data.stage]
      }]);
    };
    
    // グラフ更新
    const handleGraphUpdate = (data: any) => {
      setMessages(msgs => [...msgs, {
        id: `graph-${Date.now()}`,
        type: 'graph-update',
        content: `ナレッジグラフが更新されました: ${data.nodes.length}ノード, ${data.edges.length}エッジ`,
        timestamp: data.timestamp,
        relatedNodes: ['knowledge-graph']
      }]);
    };
    
    // イベントリスナーの登録
    addSocketListener('agent-thoughts', handleAgentThoughts);
    addSocketListener('agent-communication', handleAgentCommunication);
    addSocketListener('progress-update', handleProgressUpdate);
    addSocketListener('knowledge-graph-update', handleGraphUpdate);
    
    // 初期メッセージの追加（デモ用）
    setTimeout(() => {
      const demoMessages: ChatMessage[] = [
        {
          id: 'welcome',
          type: 'thought',
          content: 'AIエージェントが初期化されました。情報収集を開始します。',
          timestamp: new Date().toISOString(),
          agentName: 'システム',
          agentType: 'system',
          relatedNodes: []
        },
        {
          id: 'welcome-2',
          type: 'progress',
          content: '準備完了 - エージェントシステムが起動しました',
          timestamp: new Date().toISOString(),
          stage: 'system',
          progress: 100,
          relatedNodes: []
        }
      ];
      
      setMessages(demoMessages);
    }, 500);
    
    return () => {
      // イベントリスナーの解除
      removeSocketListener('agent-thoughts', handleAgentThoughts);
      removeSocketListener('agent-communication', handleAgentCommunication);
      removeSocketListener('progress-update', handleProgressUpdate);
      removeSocketListener('knowledge-graph-update', handleGraphUpdate);
    };
  }, []);
  
  // フィルタリングされたメッセージ
  const filteredMessages = messages.filter(msg => {
    if (filter === 'all') return true;
    
    if (selectedNode) {
      // 選択されたノードに関連するメッセージのみ表示
      return msg.relatedNodes?.includes(selectedNode.id);
    }
    
    return msg.type === filter;
  });
  
  // ステージ名の取得
  const getStageLabel = (stage: string): string => {
    const stageNames: Record<string, string> = {
      'industry_analysis': '業界分析',
      'keyword_expansion': 'キーワード拡張',
      'structuring': '知識の構造化',
      'knowledge_graph': '知識グラフ生成',
      'system': 'システム'
    };
    
    return stageNames[stage] || stage;
  };
  
  // エージェントタイプに基づくアイコン
  const getAgentIcon = (agentType?: string) => {
    switch(agentType) {
      case 'industry-analysis': return <Search size={16} />;
      case 'keyword-expansion': return <Brain size={16} />;
      case 'structuring': return <Network size={16} />;
      case 'knowledge-graph': return <Share2 size={16} />;
      case 'user': return <User size={16} />;
      default: return <MessageSquare size={16} />;
    }
  };
  
  // メッセージタイプに基づく背景色
  const getMessageBackground = (type: string, agentType?: string): string => {
    switch(type) {
      case 'thought':
        switch(agentType) {
          case 'industry-analysis': return 'bg-blue-50 border-blue-200';
          case 'keyword-expansion': return 'bg-purple-50 border-purple-200';
          case 'structuring': return 'bg-green-50 border-green-200';
          case 'knowledge-graph': return 'bg-orange-50 border-orange-200';
          case 'system': return 'bg-gray-50 border-gray-200';
          default: return 'bg-gray-50 border-gray-200';
        }
      case 'communication': return 'bg-indigo-50 border-indigo-200';
      case 'progress': return 'bg-teal-50 border-teal-200';
      case 'graph-update': return 'bg-amber-50 border-amber-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };
  
  // タイムスタンプのフォーマット
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  // メッセージの展開/折りたたみ
  const toggleMessageExpand = (messageId: string) => {
    if (expandedMessage === messageId) {
      setExpandedMessage(null);
    } else {
      setExpandedMessage(messageId);
    }
  };
  
  return (
    <div className="flex flex-col border rounded-md overflow-hidden h-full" style={{ maxHeight: height }}>
      <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
        <h3 className="font-semibold text-lg">AIエージェント対話</h3>
        
        <div className="flex items-center space-x-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="p-1 text-sm border rounded"
          >
            <option value="all">すべて</option>
            <option value="thought">思考プロセス</option>
            <option value="communication">エージェント間通信</option>
            <option value="progress">進捗状況</option>
            <option value="graph-update">グラフ更新</option>
          </select>
          
          {selectedNode && (
            <div className="flex items-center bg-blue-50 px-2 py-1 rounded text-xs">
              <span className="text-gray-600 mr-1">フィルター:</span>
              <span className="font-medium">{selectedNode.name}</span>
              <button 
                className="ml-1 text-gray-400 hover:text-gray-600"
                onClick={() => setFilter('all')}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            メッセージはまだありません
          </div>
        ) : (
          filteredMessages.map((message) => (
            <div
              key={message.id}
              className={`p-3 border rounded-lg transition-all ${
                getMessageBackground(message.type, message.agentType || message.sourceAgentType)
              } ${expandedMessage === message.id ? 'shadow-md' : ''}`}
              onClick={() => toggleMessageExpand(message.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <div className={`p-1.5 rounded mr-2 ${
                    message.type === 'communication' ? 'bg-indigo-100' :
                    message.type === 'progress' ? 'bg-teal-100' :
                    message.type === 'graph-update' ? 'bg-amber-100' :
                    'bg-gray-100'
                  }`}>
                    {message.type === 'communication' ? (
                      <MessageSquare size={14} className="text-indigo-600" />
                    ) : (
                      getAgentIcon(message.agentType)
                    )}
                  </div>
                  <div>
                    {message.type === 'communication' ? (
                      <div className="text-xs font-medium">
                        {message.sourceAgentName} → {message.targetAgentName}
                      </div>
                    ) : message.type === 'progress' ? (
                      <div className="text-xs font-medium">
                        {getStageLabel(message.stage || '')}
                      </div>
                    ) : message.type === 'graph-update' ? (
                      <div className="text-xs font-medium">
                        グラフ更新
                      </div>
                    ) : (
                      <div className="text-xs font-medium">
                        {message.agentName}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {formatTimestamp(message.timestamp)}
                    </div>
                  </div>
                </div>
                <div className="text-xs px-1.5 py-0.5 rounded bg-white bg-opacity-50">
                  {message.type === 'thought' ? '思考' :
                   message.type === 'communication' ? '通信' :
                   message.type === 'progress' ? '進捗' :
                   message.type === 'graph-update' ? '更新' :
                   message.type}
                </div>
              </div>
              
              <div className={`mt-2 text-sm ${
                expandedMessage === message.id ? '' : 'line-clamp-2'
              }`}>
                {message.content}
              </div>
              
              {expandedMessage === message.id && message.type === 'progress' && message.progress !== undefined && (
                <div className="mt-2">
                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${message.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-right text-xs mt-1 text-gray-500">
                    {message.progress}%
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatPanel;