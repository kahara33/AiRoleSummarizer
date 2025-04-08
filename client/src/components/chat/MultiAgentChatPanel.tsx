import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, Send, Bot, User, RefreshCw, 
  Brain, Lightbulb, Network, Layers,
  ChevronRight, Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket';

interface MultiAgentChatPanelProps {
  roleModelId: string;
  messages?: {
    id: string;
    content: string;
    sender: 'user' | 'ai';
    timestamp: Date;
  }[];
  agentThoughts?: {
    id: string;
    agentName: string;
    agentType: string;
    thought: string;
    timestamp: Date;
  }[];
  onSendMessage?: (message: string) => void;
  compact?: boolean; // コンパクトモード表示するかどうか
}

// メッセージタイプ
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'agent';
  content: string;
  timestamp: Date;
  agentName?: string;
  agentType?: string;
}

// エージェントのプロセスタイプ
interface AgentProcess {
  id: string;
  agentName: string;
  agentType: string;
  content: string;
  timestamp: Date;
}

export default function MultiAgentChatPanel({ 
  roleModelId, 
  messages: externalMessages, 
  agentThoughts: externalThoughts,
  onSendMessage,
  compact = false // コンパクトモードのデフォルト値はfalse
}: MultiAgentChatPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [processes, setProcesses] = useState<AgentProcess[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { isConnected, connect, sendMessage, messages: wsMessages, agentThoughts: wsThoughts } = useMultiAgentWebSocket();

  // ロールモデルIDが変更されたらWebSocketを接続
  useEffect(() => {
    if (roleModelId) {
      connect(roleModelId);
    }
  }, [roleModelId, connect]);
  
  // 外部から渡されたメッセージを処理
  useEffect(() => {
    if (externalMessages && externalMessages.length > 0) {
      // 外部メッセージをMessage型に変換
      const convertedMessages = externalMessages.map(msg => ({
        id: msg.id,
        role: msg.sender === 'user' ? 'user' : 'assistant' as 'user' | 'assistant' | 'agent',
        content: msg.content,
        timestamp: msg.timestamp
      }));
      
      setMessages(prevMessages => {
        // すでに存在するIDのメッセージを除外して追加
        const existingIds = new Set(prevMessages.map(m => m.id));
        const newMessages = convertedMessages.filter(m => !existingIds.has(m.id));
        return [...prevMessages, ...newMessages] as Message[];
      });
    }
  }, [externalMessages]);
  
  // 外部から渡されたエージェント思考を処理
  useEffect(() => {
    if (externalThoughts && externalThoughts.length > 0) {
      // 外部エージェント思考をAgentProcess型に変換
      const convertedProcesses = externalThoughts.map(thought => ({
        id: thought.id,
        agentName: thought.agentName,
        agentType: thought.agentType,
        content: thought.thought,
        timestamp: thought.timestamp
      }));
      
      setProcesses(prevProcesses => {
        // すでに存在するIDのプロセスを除外して追加
        const existingIds = new Set(prevProcesses.map(p => p.id));
        const newProcesses = convertedProcesses.filter(p => !existingIds.has(p.id));
        
        // スクロール処理
        if (newProcesses.length > 0) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
        
        return [...prevProcesses, ...newProcesses] as AgentProcess[];
      });
    }
  }, [externalThoughts]);

  // WebSocketからのメッセージを処理
  useEffect(() => {
    if (!wsMessages || wsMessages.length === 0) return;

    // 最後のメッセージを取得
    const lastMessage = wsMessages[wsMessages.length - 1];
    if (!lastMessage || !lastMessage.type) return;
    
    try {
      console.log('WebSocketメッセージ受信:', lastMessage.type, lastMessage);
      
      // WebSocketのデバッグ情報
      console.log('WebSocket接続状態:', isConnected, 'ロールモデルID:', roleModelId);
      
      // デバッグブロードキャストを検出して対処
      if (lastMessage.payload && lastMessage.payload._debug_broadcast) {
        console.log('デバッグブロードキャストメッセージを受信しました。通常の処理をスキップします:', lastMessage.type);
        return;
      }
      
      // チャットメッセージの処理
      if (lastMessage.type === 'chat_message') {
        // データソースを安全に取得
        const messageContent: string = 
          (lastMessage.payload && typeof lastMessage.payload.message === 'string') 
            ? lastMessage.payload.message 
            : (typeof lastMessage.payload === 'string')
              ? lastMessage.payload
              : '';
              
        if (!messageContent) return;
        
        const newMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: messageContent,
          timestamp: new Date()
        };
        
        setMessages(prevMessages => [...prevMessages, newMessage]);
        setIsGenerating(false);
      } 
      // エージェント思考の処理 (複数のメッセージタイプに対応)
      else if (
        lastMessage.type === 'agent_thought' || 
        lastMessage.type === 'agent-thought' ||
        lastMessage.type === 'agent_thoughts' || 
        lastMessage.type === 'agent-thoughts'
      ) {
        // データソースを安全に取得
        const agentName: string = 
          (lastMessage.payload && typeof lastMessage.payload.agentName === 'string')
            ? lastMessage.payload.agentName
            : (typeof lastMessage.payload.agent === 'string')
              ? lastMessage.payload.agent
              : '不明なエージェント';
              
        const agentType: string = 
          (lastMessage.payload && typeof lastMessage.payload.agentType === 'string')
            ? lastMessage.payload.agentType
            : (typeof lastMessage.payload.agent_type === 'string')
              ? lastMessage.payload.agent_type
              : 'generic';
        
        // メッセージの優先順位で内容を取得
        let content: string = '';
        // payload内のフィールドをチェック
        if (lastMessage.payload) {
          if (typeof lastMessage.payload.message === 'string') {
            content = lastMessage.payload.message;
          } else if (typeof lastMessage.payload.thought === 'string') {
            content = lastMessage.payload.thought;
          } else if (typeof lastMessage.payload.thoughts === 'string') {
            content = lastMessage.payload.thoughts;
          } else if (typeof lastMessage.payload.content === 'string') {
            content = lastMessage.payload.content;
          }
        }
        
        // ルートレベルのフィールドをチェック
        if (!content) {
          if (typeof lastMessage.payload === 'string') {
            content = lastMessage.payload;
          }
        }
        
        if (!content) {
          console.log('エージェント思考メッセージのコンテンツが見つかりません', lastMessage);
          return;
        }
        
        const newProcess: AgentProcess = {
          id: crypto.randomUUID(),
          agentName,
          agentType,
          content,
          timestamp: new Date()
        };
        
        console.log('エージェント処理を追加:', newProcess);
        setProcesses(prevProcesses => [...prevProcesses, newProcess]);
        
        // 自動スクロール処理
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } 
      // 進捗更新の処理 (複数のメッセージタイプに対応)
      else if (
        lastMessage.type === 'crewai_progress' || 
        lastMessage.type === 'progress-update' ||
        lastMessage.type === 'progress'
      ) {
        // データソースを安全に取得
        let message: string = '';
        
        // メッセージの優先順位で進捗メッセージを取得
        if (lastMessage.payload) {
          if (typeof lastMessage.payload.message === 'string') {
            message = lastMessage.payload.message;
          } else if (typeof lastMessage.payload.stage === 'string') {
            message = lastMessage.payload.stage;
          }
        }
        
        if (!message) {
          if (typeof lastMessage.payload === 'string') {
            message = lastMessage.payload;
          }
        }
        
        if (!message) {
          console.log('進捗メッセージのコンテンツが見つかりません', lastMessage);
          return;
        }
        
        // 進捗情報の取得
        const progress: number = 
          (lastMessage.payload && typeof lastMessage.payload.progress === 'number')
            ? lastMessage.payload.progress
            : (typeof lastMessage.payload === 'object' && typeof lastMessage.payload.progress_update === 'number')
              ? lastMessage.payload.progress_update
              : 0;
        
        const progressMessage = `${message} (${progress}%)`;
        
        const newProcess: AgentProcess = {
          id: crypto.randomUUID(),
          agentName: 'システム',
          agentType: 'system',
          content: progressMessage,
          timestamp: new Date()
        };
        
        console.log('進捗処理を追加:', newProcess);
        setProcesses(prevProcesses => [...prevProcesses, newProcess]);
        
        // 自動スクロール処理
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
      // エラーメッセージの処理
      else if (lastMessage.type === 'error') {
        // エラーメッセージの取得
        let errorMessage: string = '';
        
        if (lastMessage.payload && typeof lastMessage.payload.error === 'string') {
          errorMessage = lastMessage.payload.error;
        } else if (typeof lastMessage.payload === 'object' && typeof lastMessage.payload.message === 'string') {
          errorMessage = lastMessage.payload.message;
        } else if (typeof lastMessage.payload === 'string') {
          errorMessage = lastMessage.payload;
        } else {
          errorMessage = 'エラーが発生しました';
        }
        
        const newProcess: AgentProcess = {
          id: crypto.randomUUID(),
          agentName: 'エラー',
          agentType: 'error',
          content: errorMessage,
          timestamp: new Date()
        };
        
        console.error('エラー処理を追加:', newProcess);
        setProcesses(prevProcesses => [...prevProcesses, newProcess]);
        toast({
          title: 'エラー',
          description: errorMessage,
          variant: 'destructive',
        });
        
        setIsGenerating(false);
      }
      // キャンセル確認メッセージの処理
      else if (lastMessage.type === 'cancel_confirmed' || lastMessage.type === 'operation_cancelled') {
        // キャンセルメッセージの取得
        let cancelMessage: string = '';
        
        if (lastMessage.payload && typeof lastMessage.payload.message === 'string') {
          cancelMessage = lastMessage.payload.message;
        } else if (typeof lastMessage.payload === 'string') {
          cancelMessage = lastMessage.payload;
        } else {
          cancelMessage = '処理がキャンセルされました';
        }
        
        const newProcess: AgentProcess = {
          id: crypto.randomUUID(),
          agentName: 'システム',
          agentType: 'system',
          content: cancelMessage,
          timestamp: new Date()
        };
        
        console.log('キャンセル処理を追加:', newProcess);
        setProcesses(prevProcesses => [...prevProcesses, newProcess]);
        toast({
          title: '処理キャンセル',
          description: cancelMessage,
        });
        
        setIsGenerating(false);
      }
      // 接続または購読確認メッセージ
      else if (lastMessage.type === 'connection' || lastMessage.type === 'subscription_confirmed') {
        console.log('WebSocket接続状態メッセージ:', lastMessage.type, lastMessage.payload);
        
        const newProcess: AgentProcess = {
          id: crypto.randomUUID(),
          agentName: 'システム',
          agentType: 'connection',
          content: `WebSocket${lastMessage.type === 'connection' ? '接続' : '購読'}が確立されました`,
          timestamp: new Date()
        };
        
        console.log('接続/購読確認を追加:', newProcess);
        setProcesses(prevProcesses => [...prevProcesses, newProcess]);
      }
      // 生成完了メッセージの処理
      else if (lastMessage.type === 'knowledge_graph_created' || lastMessage.type === 'generation_complete') {
        // 完了メッセージの取得
        let completeMessage: string = '';
        
        if (lastMessage.payload && typeof lastMessage.payload.message === 'string') {
          completeMessage = lastMessage.payload.message;
        } else if (typeof lastMessage.payload === 'string') {
          completeMessage = lastMessage.payload;
        } else {
          completeMessage = 'ナレッジグラフ生成が完了しました';
        }
        
        const newProcess: AgentProcess = {
          id: crypto.randomUUID(),
          agentName: 'システム',
          agentType: 'success',
          content: completeMessage,
          timestamp: new Date()
        };
        
        console.log('完了処理を追加:', newProcess);
        setProcesses(prevProcesses => [...prevProcesses, newProcess]);
        toast({
          title: '処理完了',
          description: completeMessage,
        });
        
        setIsGenerating(false);
      }
      // 処理されないメッセージタイプ
      else {
        console.log('未処理のメッセージタイプをログに記録:', lastMessage.type, lastMessage);
        
        // 未知のメッセージタイプもパネルに表示（どんなメッセージも見逃さない）
        let unknownMessage = '';
        
        if (typeof lastMessage.payload === 'string') {
          unknownMessage = lastMessage.payload;
        } else if (lastMessage.payload && typeof lastMessage.payload.message === 'string') {
          unknownMessage = lastMessage.payload.message;
        } else if (lastMessage.payload && typeof lastMessage.payload.content === 'string') {
          unknownMessage = lastMessage.payload.content;
        } else {
          unknownMessage = `不明なメッセージ (タイプ: ${lastMessage.type})`;
        }
        
        if (unknownMessage) {
          const newProcess: AgentProcess = {
            id: crypto.randomUUID(),
            agentName: lastMessage.type || '不明',
            agentType: 'unknown',
            content: unknownMessage,
            timestamp: new Date()
          };
          
          console.log('未知のメッセージを追加:', newProcess);
          setProcesses(prevProcesses => [...prevProcesses, newProcess]);
        }
      }
    } catch (error) {
      console.error('WebSocketメッセージの処理中にエラーが発生しました:', error);
      
      // エラーが発生しても安全に回復するためUIを更新
      const errorProcess: AgentProcess = {
        id: crypto.randomUUID(),
        agentName: 'エラー',
        agentType: 'error',
        content: `メッセージ処理中にエラーが発生しました: ${error}`,
        timestamp: new Date()
      };
      
      setProcesses(prevProcesses => [...prevProcesses, errorProcess]);
      setIsGenerating(false);
    }
  }, [wsMessages, toast, roleModelId, isConnected]);

  // チャットミューテーション
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest('POST', `/api/chat/${roleModelId}`, { message });
    },
    onSuccess: () => {
      // WebSocketから応答を受け取るので、ここでは何もしない
      setIsGenerating(true);
    },
    onError: (error) => {
      setIsGenerating(false);
      toast({
        title: 'エラー',
        description: 'メッセージの送信に失敗しました。',
        variant: 'destructive',
      });
    }
  });

  // メッセージ送信ハンドラー
  const handleSendMessage = async () => {
    if (!input.trim() || isGenerating) return;

    // ユーザーメッセージを追加
    const newMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prevMessages => [...prevMessages, newMessage]);
    setInput('');
    
    // 親コンポーネントから渡されたメッセージ送信関数があれば使用
    if (onSendMessage) {
      onSendMessage(input);
      setIsGenerating(true);
    } else {
      // 従来のAPI経由でのメッセージ送信をフォールバックとして使用
      try {
        sendMessageMutation.mutate(input);
      } catch (error) {
        toast({
          title: 'エラー',
          description: 'メッセージの送信に失敗しました。',
          variant: 'destructive',
        });
      }
    }
  };

  // 新しいメッセージが追加されたらスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 新しいプロセスが追加されたらスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [processes]);

  // 会話をクリア (プロセスも同時にクリア)
  const handleClearConversation = () => {
    setMessages([]);
    setProcesses([]);
  };

  // Enterキーでメッセージを送信
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // エージェントアイコンを取得
  const getAgentIcon = (agentType: string) => {
    if (!agentType) return <Bot className="h-4 w-4" />;
    
    const type = agentType.toLowerCase();
    switch (type) {
      case 'analyzer':
      case 'アナリスト':
        return <Brain className="h-4 w-4" />;
      case 'researcher':
      case 'リサーチャー':
        return <Network className="h-4 w-4" />;
      case 'coordinator':
      case 'オーケストレーター':
      case 'orchestrator':
        return <Layers className="h-4 w-4" />;
      case 'domain_expert':
      case 'ドメインエキスパート':
        return <Lightbulb className="h-4 w-4" />;
      case 'system':
        return <Zap className="h-4 w-4" />;
      default:
        return <Bot className="h-4 w-4" />;
    }
  };

  return (
    <div className={`flex flex-col h-full overflow-hidden bg-white rounded-md shadow ${compact ? 'border-t' : ''}`}>
      {/* ヘッダー - コンパクトモードでは表示しない */}
      {!compact && (
        <div className="flex items-center justify-between p-3 border-b bg-white">
          <div className="flex items-center">
            <Network className="h-4 w-4 mr-1 text-primary" />
            <span className="font-medium text-sm">マルチAIエージェント思考</span>
          </div>
          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClearConversation}
              disabled={messages.length === 0 || isGenerating}
              title="会話をクリア"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* チャットとエージェント処理を単一のスクロールエリアに統合 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className={`h-full overflow-y-auto ${compact ? 'p-3' : 'p-6'} space-y-3`}>
          {/* メッセージ表示 */}
          {messages.length === 0 && processes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Network className={`${compact ? 'h-8 w-8 mb-2' : 'h-12 w-12 mb-4'}`} />
              <p>AIエージェントチームが情報収集のお手伝いをします</p>
              {!compact && <p className="text-sm">質問や指示を入力してください</p>}
            </div>
          ) : (
            <>
              {/* ユーザーとAIのメッセージを表示 */}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex max-w-[80%] ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    } rounded-lg ${compact ? 'p-2 text-sm' : 'p-3'}`}
                  >
                    <div className="mr-2 mt-0.5">
                      {message.role === 'user' ? (
                        <User className="h-4 w-4" />
                      ) : message.agentName ? (
                        getAgentIcon(message.agentType || '')
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      {message.agentName && (
                        <div className="text-xs font-medium mb-1">
                          {message.agentName}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      <div className="text-xs opacity-70 mt-1 text-right">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* エージェント処理データを表示 */}
              {processes.map((process) => (
                <div key={process.id} className="flex justify-start">
                  <div className={`flex max-w-[80%] bg-muted rounded-lg ${compact ? 'p-2 text-sm' : 'p-3'}`}>
                    <div className="mr-2 mt-0.5">
                      {getAgentIcon(process.agentType)}
                    </div>
                    <div>
                      <div className="text-xs font-medium mb-1">
                        {process.agentName}
                      </div>
                      <div className="whitespace-pre-wrap">{process.content}</div>
                      <div className="text-xs opacity-70 mt-1 text-right">
                        {process.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* 生成中のインジケーター */}
          {isGenerating && (
            <div className="flex justify-start">
              <div className={`bg-muted rounded-lg ${compact ? 'p-2' : 'p-3'} flex items-center`}>
                <Bot className="h-4 w-4 mr-2" />
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 入力エリア - 常に下部に表示される */}
      <div className={`${compact ? 'p-2' : 'p-4'} border-t bg-white`}>
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="メッセージを入力..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`min-h-[36px] ${compact ? 'max-h-[50px]' : 'max-h-[60px]'} resize-none text-sm border border-gray-300 rounded-md flex-1`}
            disabled={isGenerating}
          />
          <Button
            size={compact ? "sm" : "icon"}
            onClick={handleSendMessage}
            disabled={!input.trim() || isGenerating}
            className="flex-shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}