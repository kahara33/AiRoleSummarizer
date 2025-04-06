import React, { useState, useEffect, useRef } from 'react';
import { initSocket, addSocketListener, removeSocketListener } from '@/lib/socket';
import { KnowledgeNode } from '@shared/schema';
import { Brain, Search, Network, Share2, User, MessageSquare, Filter, X, Lightbulb, Settings, RefreshCw } from 'lucide-react';

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
  thoughts?: string; // 互換性のため
  message?: string; // 互換性のため
}

interface ChatPanelProps {
  selectedNode?: KnowledgeNode | null;
  height?: number | string;
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
      console.log('Agent thoughts received in ChatPanel:', data);
      
      // データのログを詳細に出力して問題を特定
      console.log('Agent thoughts data details:', {
        agent: data.agent,
        agentName: data.agentName,
        thoughts: data.thoughts || data.content || data.message,
        timestamp: data.timestamp,
        roleModelId: data.roleModelId,
        dataKeys: Object.keys(data)
      });
      
      // content, thoughts, messageフィールドのいずれかを使用
      const messageContent = data.thoughts || data.content || data.message || 'No thoughts content';
      
      // messageContentが明らかに空や無効な値の場合はスキップ
      if (messageContent === 'No thoughts content' || messageContent.trim().length === 0) {
        console.log('空または無効なエージェント思考をスキップします');
        return;
      }
      
      // エージェント名とタイプの標準化
      const agentName = data.agentName || data.agent || 'エージェント';
      const rawAgentType = data.agentType || data.type || 'system';
      const agentType = mapAgentType(rawAgentType);
      
      // 重複メッセージ防止のための高度なチェック
      setMessages(currentMessages => {
        // 最後の15個のメッセージ内に既に同じまたは似たような内容があるか確認
        const recentMessages = currentMessages.slice(-15);
        
        // より緩やかな重複検出（完全一致ではなく、かなりの部分が一致する場合）
        const isDuplicate = recentMessages.some(m => {
          // 同じエージェントからの似たメッセージかどうか
          if (m.type === 'thought' && m.agentName === agentName) {
            // 短いメッセージは完全一致で確認
            if (messageContent.length < 30) {
              return m.content === messageContent;
            }
            
            // 長いメッセージは部分一致で確認（75%以上の一致度）
            const shorterLength = Math.min(m.content.length, messageContent.length);
            const threshold = shorterLength * 0.75;
            
            // 共通のサブ文字列を探す（簡易アルゴリズム）
            let commonChars = 0;
            for (let i = 0; i < Math.min(m.content.length, messageContent.length); i++) {
              if (m.content[i] === messageContent[i]) {
                commonChars++;
              }
            }
            
            return commonChars >= threshold;
          }
          return false;
        });
        
        if (isDuplicate) {
          console.log('重複または類似するエージェント思考をスキップします:', messageContent.substring(0, 30));
          return currentMessages;
        }
        
        // 新しいメッセージを追加
        return [...currentMessages, {
          id: `thought-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'thought',
          agentId: data.agentId || 'unknown',
          agentName: agentName,
          agentType: agentType,
          content: messageContent,
          timestamp: data.timestamp || new Date().toISOString(),
          relatedNodes: [data.agentId || 'unknown'],
          thoughts: messageContent, // 互換性のため
          message: messageContent // 互換性のため
        }];
      });
    };
    
    // エージェントタイプを標準化する関数
    const mapAgentType = (type: string): string => {
      const typeLower = type.toLowerCase();
      
      if (typeLower.includes('industry') || typeLower.includes('業界')) {
        return 'industry-analysis';
      }
      if (typeLower.includes('keyword') || typeLower.includes('キーワード')) {
        return 'keyword-expansion';
      }
      if (typeLower.includes('structur') || typeLower.includes('構造')) {
        return 'structuring';
      }
      if (typeLower.includes('graph') || typeLower.includes('グラフ')) {
        return 'knowledge-graph';
      }
      if (typeLower.includes('orchestr') || typeLower.includes('オーケストレーター') || typeLower.includes('調整')) {
        return 'orchestrator';
      }
      
      return type;
    };
    
    // エージェント間の通信
    const handleAgentCommunication = (data: any) => {
      console.log('Agent communication received:', data);
      
      // データのログを詳細に出力して問題を特定
      console.log('Agent communication data details:', {
        sourceAgent: data.sourceAgent || data.sourceAgentName,
        targetAgent: data.targetAgent || data.targetAgentName,
        message: data.message || data.content,
        timestamp: data.timestamp,
        dataKeys: Object.keys(data)
      });
      
      // content, message フィールドのいずれかを使用
      const messageContent = data.message || data.content || 'No message content';
      
      // messageContentが明らかに空や無効な値の場合はスキップ
      if (messageContent === 'No message content' || messageContent.trim().length === 0) {
        console.log('空または無効なエージェント通信をスキップします');
        return;
      }
      
      // エージェント名の標準化
      const sourceAgentName = data.sourceAgentName || data.sourceAgent || 'Source';
      const targetAgentName = data.targetAgentName || data.targetAgent || 'Target';
      
      // エージェントタイプの標準化
      const sourceAgentType = data.sourceAgentType || mapAgentType(data.sourceAgent || 'system');
      const targetAgentType = data.targetAgentType || mapAgentType(data.targetAgent || 'system');
      
      // 重複メッセージ防止のための簡易チェック
      setMessages(currentMessages => {
        // 最後の10個のメッセージ内に同様のエージェント通信があるか確認
        const recentMessages = currentMessages.slice(-10);
        const isDuplicate = recentMessages.some(m => 
          m.type === 'communication' && 
          m.sourceAgentName === sourceAgentName && 
          m.targetAgentName === targetAgentName && 
          m.content === messageContent
        );
        
        if (isDuplicate) {
          console.log('重複するエージェント通信をスキップします:', messageContent.substring(0, 30));
          return currentMessages;
        }
        
        // 新しいメッセージを追加
        return [...currentMessages, {
          id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'communication',
          sourceAgentId: data.sourceAgentId || 'unknown',
          sourceAgentName: sourceAgentName,
          sourceAgentType: sourceAgentType,
          targetAgentId: data.targetAgentId || 'unknown',
          targetAgentName: targetAgentName,
          targetAgentType: targetAgentType,
          content: messageContent,
          timestamp: data.timestamp || new Date().toISOString(),
          relatedNodes: [data.sourceAgentId || 'unknown', data.targetAgentId || 'unknown']
        }];
      });
    };
    
    // 処理進捗状況
    const handleProgressUpdate = (data: any) => {
      console.log('Progress update received in ChatPanel:', data);
      
      // データのログを詳細に出力して問題を特定
      console.log('Progress update data details:', {
        message: data.message || data.content,
        progress: data.progress || data.percent,
        stage: data.stage || data.phase,
        timestamp: data.timestamp,
        roleModelId: data.roleModelId,
        dataKeys: Object.keys(data)
      });
      
      // data.progressとdata.percentのどちらかを使用
      const progressValue = typeof data.progress !== 'undefined' ? data.progress : 
                           typeof data.percent !== 'undefined' ? data.percent : 0;
      
      // progressが数値でない場合は標準化
      const normalizedProgress = typeof progressValue === 'string' ? 
                               parseInt(progressValue, 10) : progressValue;
      
      // 数値化に失敗した場合は0とする
      const finalProgress = isNaN(normalizedProgress) ? 0 : normalizedProgress;
      
      // ステージ名を取得
      const stage = data.stage || data.phase || 'system';
      const stageLabel = getStageLabel(stage);
      
      // メッセージ内容
      const message = data.message || data.content || data.description || '';
      
      // 最終的なメッセージ内容
      const messageContent = `${stageLabel} - ${finalProgress}%: ${message}`;
      
      // 重複メッセージ防止のためのより高度なチェック
      setMessages(currentMessages => {
        // 最後の10個のメッセージ内にほぼ同じ進捗情報があるか確認
        const recentMessages = currentMessages.slice(-10);
        
        const similarMessageExists = recentMessages.some(m => {
          // 同じステージで類似した進捗率かどうか
          if (m.type === 'progress' && m.stage === stage) {
            // 進捗率の差が小さい
            const progressDifference = Math.abs((m.progress || 0) - finalProgress);
            
            // 進捗率が同じか近い（5%未満の差）で、かつ同じようなメッセージ内容
            if (progressDifference < 5) {
              // 短いメッセージの場合、内容が含まれているかどうかを確認
              if (message.length < 30) {
                return m.content.includes(message);
              }
              
              // メッセージに類似性があるか（共通の単語が一定数以上含まれているか）
              const mWords = m.content.split(/\s+/).filter(w => w.length > 3);
              const newWords = message.split(/\s+/).filter(w => w.length > 3);
              
              // 共通の単語をカウント
              let commonWords = 0;
              for (const word of newWords) {
                if (mWords.some(w => w.includes(word) || word.includes(w))) {
                  commonWords++;
                }
              }
              
              // 一定以上の共通性がある場合は類似とみなす
              const similarity = newWords.length > 0 ? commonWords / newWords.length : 0;
              return similarity > 0.5; // 50%以上の類似性
            }
          }
          return false;
        });
        
        if (similarMessageExists) {
          console.log('類似した進捗メッセージをスキップします:', message);
          return currentMessages;
        }
        
        // 新しいメッセージを追加
        return [...currentMessages, {
          id: `progress-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'progress',
          stage: stage,
          progress: finalProgress,
          content: messageContent,
          timestamp: data.timestamp || new Date().toISOString(),
          relatedNodes: [stage]
        }];
      });
    };
    
    // グラフ更新
    const handleGraphUpdate = (data: any) => {
      console.log('Graph update received:', data);
      
      // データのログを詳細に出力して問題を特定
      console.log('Graph update data details:', {
        dataType: typeof data.data,
        nodeCount: data.data?.nodes?.length,
        edgeCount: data.data?.edges?.length,
        timestamp: data.timestamp,
        dataKeys: Object.keys(data)
      });
      
      // ノードとエッジのカウント
      const nodeCount = data.data?.nodes?.length || 0;
      const edgeCount = data.data?.edges?.length || 0;
      
      // グラフの変更内容をより詳細に表示
      let updateMessage: string;
      if (data.action === 'add' || data.action === 'create') {
        updateMessage = `ナレッジグラフに新しい情報が追加されました: ${nodeCount}ノード, ${edgeCount}エッジ`;
      } else if (data.action === 'update') {
        updateMessage = `ナレッジグラフが更新されました: ${nodeCount}ノード, ${edgeCount}エッジ`;
      } else if (data.action === 'delete' || data.action === 'remove') {
        updateMessage = `ナレッジグラフから情報が削除されました: 残り${nodeCount}ノード, ${edgeCount}エッジ`;
      } else {
        updateMessage = `ナレッジグラフが変更されました: ${nodeCount}ノード, ${edgeCount}エッジ`;
      }
      
      // 頻繁な更新を防止するため、短時間に同様のメッセージが連続しないようにする
      setMessages(currentMessages => {
        // 最後の5つのメッセージで、同じようなグラフ更新がないか確認
        const recentMessages = currentMessages.slice(-5);
        const isDuplicate = recentMessages.some(m => 
          m.type === 'graph-update' && 
          m.content.includes(`${nodeCount}ノード`) && 
          m.content.includes(`${edgeCount}エッジ`) &&
          // 5秒以内の同様のメッセージはスキップ
          (new Date().getTime() - new Date(m.timestamp).getTime()) < 5000
        );
        
        if (isDuplicate) {
          console.log('短時間内に類似したグラフ更新メッセージが既に存在するため、スキップします');
          return currentMessages;
        }
        
        // 新しいメッセージを追加
        return [...currentMessages, {
          id: `graph-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type: 'graph-update',
          content: updateMessage,
          timestamp: data.timestamp || new Date().toISOString(),
          relatedNodes: ['knowledge-graph']
        }];
      });
    };
    
    // イベントリスナーの登録
    addSocketListener('agent_thoughts', handleAgentThoughts);
    addSocketListener('agent-communication', handleAgentCommunication);
    addSocketListener('progress', handleProgressUpdate);
    addSocketListener('graph-update', handleGraphUpdate);
    
    // 初期メッセージの追加（実用的な情報を含む）
    setTimeout(() => {
      const demoMessages: ChatMessage[] = [
        {
          id: 'welcome',
          type: 'thought',
          content: 'AIエージェントシステムが初期化されました。複数のエージェントが協調して情報収集と知識グラフ構築を行います。',
          timestamp: new Date().toISOString(),
          agentName: 'オーケストレーター',
          agentType: 'orchestrator',
          relatedNodes: []
        },
        {
          id: 'welcome-agents',
          type: 'communication',
          content: '各エージェントが起動しました。業界分析、キーワード拡張、知識構造化、グラフ生成の順に処理が進みます。',
          timestamp: new Date().toISOString(),
          sourceAgentName: 'オーケストレーター',
          sourceAgentType: 'orchestrator',
          targetAgentName: 'システム',
          targetAgentType: 'system',
          relatedNodes: []
        },
        {
          id: 'welcome-2',
          type: 'progress',
          content: '準備完了 - AIエージェントシステムが起動しました',
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
      removeSocketListener('agent_thoughts', handleAgentThoughts);
      removeSocketListener('agent-communication', handleAgentCommunication);
      removeSocketListener('progress', handleProgressUpdate);
      removeSocketListener('graph-update', handleGraphUpdate);
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
    const type = agentType?.toLowerCase() || '';
    
    // より柔軟なマッチング
    if (type.includes('industry') || type.includes('業界')) {
      return <Search size={16} className="text-blue-600" />;
    }
    if (type.includes('keyword') || type.includes('キーワード')) {
      return <Brain size={16} className="text-purple-600" />;
    }
    if (type.includes('structur') || type.includes('構造')) {
      return <Network size={16} className="text-green-600" />;
    }
    if (type.includes('graph') || type.includes('グラフ')) {
      return <Share2 size={16} className="text-orange-600" />;
    }
    if (type.includes('orchestr') || type.includes('オーケスト') || type.includes('調整')) {
      return <Settings size={16} className="text-indigo-600" />;
    }
    if (type.includes('user') || type.includes('ユーザー')) {
      return <User size={16} className="text-gray-600" />;
    }
    if (type.includes('system') || type.includes('システム')) {
      return <Settings size={16} className="text-gray-600" />;
    }
    if (type.includes('assistant') || type.includes('アシスタント')) {
      return <Lightbulb size={16} className="text-amber-600" />;
    }
    if (type.includes('agent') || type.includes('エージェント')) {
      return <RefreshCw size={16} className="text-teal-600" />;
    }
    
    // デフォルト
    return <MessageSquare size={16} className="text-gray-600" />;
  };
  
  // メッセージタイプと内容に基づく背景色（より柔軟な実装）
  const getMessageBackground = (type: string, agentType?: string): string => {
    // エージェントタイプを小文字に変換して処理
    const agentTypeLower = (agentType || '').toLowerCase();
    
    // メッセージタイプに基づく処理
    if (type === 'thought') {
      // 思考メッセージの場合はエージェントタイプに基づく色分け
      if (agentTypeLower.includes('industry') || agentTypeLower.includes('業界')) {
        return 'bg-blue-50 border-blue-200';
      }
      if (agentTypeLower.includes('keyword') || agentTypeLower.includes('キーワード')) {
        return 'bg-purple-50 border-purple-200';
      }
      if (agentTypeLower.includes('structur') || agentTypeLower.includes('構造')) {
        return 'bg-green-50 border-green-200';
      }
      if (agentTypeLower.includes('graph') || agentTypeLower.includes('グラフ')) {
        return 'bg-orange-50 border-orange-200';
      }
      if (agentTypeLower.includes('orchestr') || agentTypeLower.includes('オーケスト') || 
          agentTypeLower.includes('調整')) {
        return 'bg-indigo-50 border-indigo-200';
      }
      if (agentTypeLower.includes('user') || agentTypeLower.includes('ユーザー')) {
        return 'bg-gray-100 border-gray-300';
      }
      if (agentTypeLower.includes('system') || agentTypeLower.includes('システム')) {
        return 'bg-gray-50 border-gray-200';
      }
      if (agentTypeLower.includes('assistant') || agentTypeLower.includes('アシスタント')) {
        return 'bg-amber-50 border-amber-200';
      }
      
      // デフォルトの思考背景
      return 'bg-gray-50 border-gray-200';
    } else if (type === 'communication') {
      // 通信メッセージは独自の色を使用
      return 'bg-indigo-50 border-indigo-200';
    } else if (type === 'progress') {
      // 進捗メッセージは独自の色を使用
      return 'bg-teal-50 border-teal-200';
    } else if (type === 'graph-update') {
      // グラフ更新メッセージは独自の色を使用
      return 'bg-amber-50 border-amber-200';
    }
    
    // その他のメッセージタイプ
    return 'bg-gray-50 border-gray-200';
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