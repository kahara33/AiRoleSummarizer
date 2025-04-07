import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Bot, User, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';

interface ChatPanelProps {
  roleModelId: string;
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export default function ChatPanel({ roleModelId }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { subscribe, lastJsonMessage } = useWebSocket();

  useEffect(() => {
    if (roleModelId) {
      subscribe(roleModelId);
    }
  }, [roleModelId, subscribe]);

  // WebSocketからのメッセージを処理
  useEffect(() => {
    if (lastJsonMessage && lastJsonMessage.type === 'chat_message') {
      setMessages(prevMessages => [
        ...prevMessages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: lastJsonMessage.data.message,
          timestamp: new Date()
        }
      ]);
      setIsGenerating(false);
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

  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 会話をクリア
  const handleClearConversation = () => {
    setMessages([]);
  };

  // Enterキーでメッセージを送信
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* チャットヘッダー */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center">
          <Bot className="h-5 w-5 mr-2 text-primary" />
          <span className="font-medium">AIアシスタント</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClearConversation}
          disabled={messages.length === 0 || isGenerating}
          title="会話をクリア"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot className="h-12 w-12 mb-4" />
            <p>AIアシスタントが情報収集のお手伝いをします</p>
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
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div>
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