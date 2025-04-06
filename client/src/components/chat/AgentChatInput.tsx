import { useState, FormEvent, KeyboardEvent, ChangeEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { sendAgentChatMessage } from '@/lib/socket';

interface AgentChatInputProps {
  roleModelId: string;
  onSend?: (message: string) => void;
}

const AgentChatInput: React.FC<AgentChatInputProps> = ({ roleModelId, onSend }) => {
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!message.trim() || !roleModelId) return;
    
    try {
      setIsLoading(true);
      
      // WebSocketを通じてメッセージを送信
      sendAgentChatMessage(roleModelId, message);
      
      // 送信完了イベントをトリガー
      if (onSend) {
        onSend(message);
      }
      
      // 入力フィールドをクリア
      setMessage('');
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Ctrl + Enterでフォームを送信
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit(e);
    }
  };

  return (
    <div className="mt-4 border-t border-accent pt-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="AIエージェントに質問やリクエストを送信..."
          className="flex-1 px-4 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={isLoading || !message.trim()}
          className="p-2 rounded-md bg-primary text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
    </div>
  );
};

export default AgentChatInput;