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

export default function MultiAgentChatPanel({ roleModelId }: MultiAgentChatPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [processes, setProcesses] = useState<AgentProcess[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTab, setCurrentTab] = useState('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { subscribe, lastJsonMessage } = useWebSocket();

  useEffect(() => {
    if (roleModelId) {
      subscribe(roleModelId);
    }
  }, [roleModelId, subscribe]);

  // WebSocketからのメッセージを処理
  useEffect(() => {
    if (!lastJsonMessage) return;
    
    try {
      if (lastJsonMessage.type === 'chat_message') {
        // 通常のチャットメッセージ
        const messageContent = lastJsonMessage.data.message;
        const newMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: messageContent,
          timestamp: new Date()
        };
        
        setMessages(prevMessages => [...prevMessages, newMessage]);
        setIsGenerating(false);
      } else if (lastJsonMessage.type === 'agent_thought') {
        // エージェントの思考プロセス
        const agentName = lastJsonMessage.data.agentName || '不明なエージェント';
        const agentType = lastJsonMessage.data.agentType || 'generic';
        const content = lastJsonMessage.data.message;
        
        const newProcess: AgentProcess = {
          id: crypto.randomUUID(),
          agentName,
          agentType,
          content,
          timestamp: new Date()
        };
        
        setProcesses(prevProcesses => [...prevProcesses, newProcess]);
      } else if (lastJsonMessage.type === 'crewai_progress') {
        // CrewAIの進捗更新
        const message = lastJsonMessage.data.message;
        const progress = lastJsonMessage.data.progress || 0;
        const progressMessage = `${message} (${progress}%)`;
        
        const newProcess: AgentProcess = {
          id: crypto.randomUUID(),
          agentName: 'システム',
          agentType: 'system',
          content: progressMessage,
          timestamp: new Date()
        };
        
        setProcesses(prevProcesses => [...prevProcesses, newProcess]);
      }
    } catch (error) {
      console.error('WebSocketメッセージの処理中にエラーが発生しました:', error);
    }
  }, [lastJsonMessage]);

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
    
    // API経由でメッセージを送信
    try {
      sendMessageMutation.mutate(input);
    } catch (error) {
      toast({
        title: 'エラー',
        description: 'メッセージの送信に失敗しました。',
        variant: 'destructive',
      });
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
    switch (agentType.toLowerCase()) {
      case 'analyzer':
      case 'アナリスト':
        return <Brain className="h-4 w-4" />;
      case 'researcher':
      case 'リサーチャー':
        return <Network className="h-4 w-4" />;
      case 'coordinator':
      case 'オーケストレーター':
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
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center">
          <Network className="h-5 w-5 mr-2 text-primary" />
          <span className="font-medium">マルチAIエージェント思考</span>
        </div>
        <Tabs 
          defaultValue="chat" 
          value={currentTab} 
          onValueChange={handleTabChange}
          className="w-[300px]"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat">チャット</TabsTrigger>
            <TabsTrigger value="process">エージェント処理</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex">
          {currentTab === 'chat' ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearConversation}
              disabled={messages.length === 0 || isGenerating}
              title="会話をクリア"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearProcesses}
              disabled={processes.length === 0}
              title="プロセス履歴をクリア"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden">
        <div className={`h-full ${currentTab === 'chat' ? 'block' : 'hidden'}`}>
          <div className="h-full overflow-y-auto p-4 space-y-4">
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
          <div className="h-full overflow-y-auto p-4 space-y-4">
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
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="メッセージを入力..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[60px] resize-none"
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