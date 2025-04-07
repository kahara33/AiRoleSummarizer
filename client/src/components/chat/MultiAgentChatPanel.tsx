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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-multi-agent-websocket';

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
  onSendMessage
}: MultiAgentChatPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [processes, setProcesses] = useState<AgentProcess[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTab, setCurrentTab] = useState('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { subscribe, lastJsonMessage } = useWebSocket();

  // ロールモデルIDが変更されたらWebSocketを購読
  useEffect(() => {
    if (roleModelId) {
      subscribe(roleModelId);
    }
  }, [roleModelId, subscribe]);
  
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
        
        // 新しいプロセスがある場合はプロセスタブに切り替え
        if (newProcesses.length > 0 && currentTab !== 'process') {
          setCurrentTab('process');
        }
        
        return [...prevProcesses, ...newProcesses] as AgentProcess[];
      });
    }
  }, [externalThoughts, currentTab]);

  // WebSocketからのメッセージを処理
  useEffect(() => {
    if (!lastJsonMessage) return;
    
    try {
      console.log('WebSocketメッセージ受信:', lastJsonMessage.type, lastJsonMessage);
      
      // チャットメッセージの処理
      if (lastJsonMessage.type === 'chat_message') {
        // データソースを安全に取得
        const messageContent: string = 
          (lastJsonMessage.data && typeof lastJsonMessage.data.message === 'string') 
            ? lastJsonMessage.data.message 
            : (typeof lastJsonMessage.message === 'string')
              ? lastJsonMessage.message
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
        lastJsonMessage.type === 'agent_thought' || 
        lastJsonMessage.type === 'agent-thought' ||
        lastJsonMessage.type === 'agent_thoughts' || 
        lastJsonMessage.type === 'agent-thoughts'
      ) {
        // データソースを安全に取得
        const agentName: string = 
          (lastJsonMessage.data && typeof lastJsonMessage.data.agentName === 'string')
            ? lastJsonMessage.data.agentName
            : (typeof lastJsonMessage.agentName === 'string')
              ? lastJsonMessage.agentName
              : (typeof lastJsonMessage.agent === 'string')
                ? lastJsonMessage.agent
                : '不明なエージェント';
              
        const agentType: string = 
          (lastJsonMessage.data && typeof lastJsonMessage.data.agentType === 'string')
            ? lastJsonMessage.data.agentType
            : (typeof lastJsonMessage.agentType === 'string')
              ? lastJsonMessage.agentType
              : (typeof lastJsonMessage.agent_type === 'string')
                ? lastJsonMessage.agent_type
                : 'generic';
        
        // メッセージの優先順位で内容を取得
        let content: string = '';
        // data内のフィールドをチェック
        if (lastJsonMessage.data) {
          if (typeof lastJsonMessage.data.message === 'string') {
            content = lastJsonMessage.data.message;
          } else if (typeof lastJsonMessage.data.thought === 'string') {
            content = lastJsonMessage.data.thought;
          } else if (typeof lastJsonMessage.data.thoughts === 'string') {
            content = lastJsonMessage.data.thoughts;
          } else if (typeof lastJsonMessage.data.content === 'string') {
            content = lastJsonMessage.data.content;
          }
        }
        
        // ルートレベルのフィールドをチェック
        if (!content) {
          if (typeof lastJsonMessage.message === 'string') {
            content = lastJsonMessage.message;
          } else if (typeof lastJsonMessage.thought === 'string') {
            content = lastJsonMessage.thought;
          } else if (typeof lastJsonMessage.thoughts === 'string') {
            content = lastJsonMessage.thoughts;
          } else if (typeof lastJsonMessage.content === 'string') {
            content = lastJsonMessage.content;
          }
        }
        
        if (!content) {
          console.log('エージェント思考メッセージのコンテンツが見つかりません', lastJsonMessage);
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
        
        // エージェント処理タブに自動的に切り替え
        if (currentTab !== 'process') {
          setCurrentTab('process');
        }
      } 
      // 進捗更新の処理 (複数のメッセージタイプに対応)
      else if (
        lastJsonMessage.type === 'crewai_progress' || 
        lastJsonMessage.type === 'progress-update' ||
        lastJsonMessage.type === 'progress'
      ) {
        // データソースを安全に取得
        let message: string = '';
        
        // メッセージの優先順位で進捗メッセージを取得
        if (lastJsonMessage.data) {
          if (typeof lastJsonMessage.data.message === 'string') {
            message = lastJsonMessage.data.message;
          } else if (typeof lastJsonMessage.data.stage === 'string') {
            message = lastJsonMessage.data.stage;
          }
        }
        
        if (!message) {
          if (typeof lastJsonMessage.message === 'string') {
            message = lastJsonMessage.message;
          } else if (typeof lastJsonMessage.stage === 'string') {
            message = lastJsonMessage.stage;
          }
        }
        
        if (!message) {
          console.log('進捗メッセージのコンテンツが見つかりません', lastJsonMessage);
          return;
        }
        
        // 進捗情報の取得
        const progress: number = 
          (lastJsonMessage.data && typeof lastJsonMessage.data.progress === 'number')
            ? lastJsonMessage.data.progress
            : (typeof lastJsonMessage.progress === 'number')
              ? lastJsonMessage.progress
              : (typeof lastJsonMessage.progress_update === 'number')
                ? lastJsonMessage.progress_update
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
        
        // 進捗メッセージの場合も、エージェント処理タブに自動的に切り替え
        if (currentTab !== 'process') {
          setCurrentTab('process');
        }
      }
      // エラーメッセージの処理
      else if (lastJsonMessage.type === 'error') {
        // エラーメッセージの取得
        let errorMessage: string = '';
        
        if (lastJsonMessage.data && typeof lastJsonMessage.data.error === 'string') {
          errorMessage = lastJsonMessage.data.error;
        } else if (typeof lastJsonMessage.error === 'string') {
          errorMessage = lastJsonMessage.error;
        } else if (typeof lastJsonMessage.message === 'string') {
          errorMessage = lastJsonMessage.message;
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
      // 接続または購読確認メッセージ
      else if (lastJsonMessage.type === 'connection' || lastJsonMessage.type === 'subscription_confirmed') {
        console.log('WebSocket接続状態メッセージ:', lastJsonMessage.type, lastJsonMessage.message);
      }
      // 処理されないメッセージタイプ
      else {
        console.log('未処理のメッセージタイプ:', lastJsonMessage.type, lastJsonMessage);
      }
    } catch (error) {
      console.error('WebSocketメッセージの処理中にエラーが発生しました:', error);
    }
  }, [lastJsonMessage, currentTab, toast]);

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
    if (currentTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentTab]);

  // 新しいプロセスが追加されたらスクロール
  useEffect(() => {
    if (currentTab === 'process') {
      processesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [processes, currentTab]);

  // 会話をクリア
  const handleClearConversation = () => {
    setMessages([]);
  };

  // プロセスをクリア
  const handleClearProcesses = () => {
    setProcesses([]);
  };

  // Enterキーでメッセージを送信
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // タブ変更時のハンドラ
  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    // タブ切り替え後にスクロール位置を調整
    setTimeout(() => {
      if (value === 'chat') {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if (value === 'process') {
        processesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
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
    <div className="flex flex-col h-full max-h-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center">
          <Network className="h-4 w-4 mr-1 text-primary" />
          <span className="font-medium text-sm">マルチAIエージェント思考</span>
        </div>
        <Tabs 
          defaultValue="chat" 
          value={currentTab} 
          onValueChange={handleTabChange}
          className="w-[260px]"
        >
          <TabsList className="grid w-full grid-cols-2 h-7">
            <TabsTrigger value="chat" className="text-xs">チャット</TabsTrigger>
            <TabsTrigger value="process" className="text-xs">エージェント処理</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex">
          {currentTab === 'chat' ? (
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
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClearProcesses}
              disabled={processes.length === 0}
              title="プロセス履歴をクリア"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className={`h-full ${currentTab === 'chat' ? 'block' : 'hidden'}`}>
          <div className="h-full overflow-y-auto p-2 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Network className="h-12 w-12 mb-4" />
                <p>AIエージェントチームが情報収集のお手伝いをします</p>
                <p className="text-sm">質問や指示を入力してください</p>
              </div>
            ) : (
              messages.map((message) => (
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
                    } rounded-lg p-3`}
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
              ))
            )}
            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 flex items-center">
                  <Bot className="h-4 w-4 mr-2" />
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className={`h-full ${currentTab === 'process' ? 'block' : 'hidden'}`}>
          <div className="h-full overflow-y-auto p-2 space-y-3">
            {processes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Layers className="h-12 w-12 mb-4" />
                <p>AIエージェントの処理状況がここに表示されます</p>
                <p className="text-sm">まだ処理履歴はありません</p>
              </div>
            ) : (
              processes.map((process) => (
                <div key={process.id} className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    {getAgentIcon(process.agentType)}
                    <span className="font-medium text-sm">{process.agentName}</span>
                    <span className="text-xs text-muted-foreground">
                      {process.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className={`
                    ml-6 pl-3 border-l-2 
                    ${process.agentType === 'system' ? 'border-blue-400' : 'border-primary/30'}
                    py-2
                  `}>
                    <div 
                      className={`
                        p-3 rounded-md text-sm whitespace-pre-wrap
                        ${process.agentType === 'system' 
                          ? 'bg-blue-50 dark:bg-blue-950/20' 
                          : 'bg-gray-50 dark:bg-gray-800/20'}
                      `}
                    >
                      {process.content}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={processesEndRef} />
          </div>
        </div>
      </div>

      {/* 入力エリア */}
      <div className="border-t p-2">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="メッセージを入力..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[40px] max-h-[80px] resize-none text-sm"
            disabled={isGenerating}
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={!input.trim() || isGenerating}
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