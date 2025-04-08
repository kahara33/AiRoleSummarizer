import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CreateCollectionPlanProps {
  defaultIndustry?: string;
  defaultKeywords?: string[];
  onStart?: () => void;
  className?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  useCard?: boolean;
}

export function CreateCollectionPlanWithCrewAIButton({
  defaultIndustry = '',
  defaultKeywords = [],
  onStart,
  className = '',
  variant = 'default',
  size = 'default',
  useCard = false
}: CreateCollectionPlanProps) {
  const { isConnected: connected, sendMessage: send, messages } = useMultiAgentWebSocket();
  const { toast } = useToast();
  
  const [showForm, setShowForm] = useState(false);
  const [industry, setIndustry] = useState(defaultIndustry);
  const [keywords, setKeywords] = useState<string[]>(defaultKeywords);
  const [newKeyword, setNewKeyword] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [newSource, setNewSource] = useState('');
  const [constraints, setConstraints] = useState<string[]>([]);
  const [newConstraint, setNewConstraint] = useState('');
  const [requirements, setRequirements] = useState<string[]>([]);
  const [newRequirement, setNewRequirement] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleAddKeyword = useCallback(() => {
    if (newKeyword.trim() !== '' && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  }, [newKeyword, keywords]);
  
  const handleRemoveKeyword = useCallback((keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  }, [keywords]);
  
  const handleAddSource = useCallback(() => {
    if (newSource.trim() !== '' && !sources.includes(newSource.trim())) {
      setSources([...sources, newSource.trim()]);
      setNewSource('');
    }
  }, [newSource, sources]);
  
  const handleRemoveSource = useCallback((source: string) => {
    setSources(sources.filter(s => s !== source));
  }, [sources]);
  
  const handleAddConstraint = useCallback(() => {
    if (newConstraint.trim() !== '' && !constraints.includes(newConstraint.trim())) {
      setConstraints([...constraints, newConstraint.trim()]);
      setNewConstraint('');
    }
  }, [newConstraint, constraints]);
  
  const handleRemoveConstraint = useCallback((constraint: string) => {
    setConstraints(constraints.filter(c => c !== constraint));
  }, [constraints]);
  
  const handleAddRequirement = useCallback(() => {
    if (newRequirement.trim() !== '' && !requirements.includes(newRequirement.trim())) {
      setRequirements([...requirements, newRequirement.trim()]);
      setNewRequirement('');
    }
  }, [newRequirement, requirements]);
  
  const handleRemoveRequirement = useCallback((requirement: string) => {
    setRequirements(requirements.filter(r => r !== requirement));
  }, [requirements]);
  
  const toggleForm = useCallback(() => {
    setShowForm(!showForm);
  }, [showForm]);
  
  const handleStartCrewAI = useCallback(() => {
    if (!industry.trim()) {
      toast({
        title: "業界を入力してください",
        description: "業界は必須項目です",
        variant: "destructive"
      });
      return;
    }
    
    if (keywords.length === 0) {
      toast({
        title: "キーワードを入力してください",
        description: "少なくとも1つのキーワードが必要です",
        variant: "destructive"
      });
      return;
    }
    
    if (!connected) {
      toast({
        title: "WebSocket未接続",
        description: "サーバーに接続できません。ページを再読み込みしてください。",
        variant: "destructive"
      });
      return;
    }
    
    // 処理開始
    setIsProcessing(true);
    if (onStart) onStart();
    
    // WebSocketでメッセージを送信
    send('create_collection_plan', {
      industry,
      keywords,
      sources,
      constraints,
      requirements
    });
    
    // フォームを閉じる
    setShowForm(false);
    
    toast({
      title: "情報収集プラン作成開始",
      description: "CrewAIでの情報収集プラン作成が開始されました",
    });
    
    // 進捗状況表示のため、処理中状態を維持
    // 完了メッセージは別途WebSocket通信で受け取る
  }, [industry, keywords, sources, constraints, requirements, connected, send, onStart, toast]);
  
  // WebSocketからのメッセージで処理状態を改善された方法で更新
  useEffect(() => {
    // progress関連のメッセージを検索
    const progressMessages = messages.filter(msg => 
      (msg.type === 'progress' || msg.type === 'progress-update' || msg.type === 'crewai_progress') && 
      msg.payload && 
      typeof msg.payload === 'object'
    );
    
    if (progressMessages.length === 0) return;
    
    // 最新のプログレスメッセージを取得
    const latestProgress = progressMessages[progressMessages.length - 1];
    
    console.log('情報収集プラン - 進捗更新を検出:', latestProgress);
    
    // 明示的な状態管理ロジック
    if (latestProgress.payload.percent === 100) {
      // 完了
      console.log('情報収集プラン - 処理完了を検出');
      setTimeout(() => {
        setIsProcessing(false);
        toast({
          title: "情報収集プラン作成完了",
          description: "CrewAIでの情報収集プラン作成が完了しました",
        });
      }, 1000);
    } else if (latestProgress.payload.percent === 0 && isProcessing) {
      // エラー
      console.log('情報収集プラン - エラーを検出');
      setIsProcessing(false);
      toast({
        title: "エラー",
        description: latestProgress.payload.message || "処理中にエラーが発生しました",
        variant: "destructive"
      });
    } else if (latestProgress.payload.percent > 0 && latestProgress.payload.percent < 100) {
      // 処理中（既に処理中状態でない場合のみ更新）
      if (!isProcessing) {
        console.log('情報収集プラン - 処理開始を検出');
        setIsProcessing(true);
      }
    }
  }, [messages, isProcessing, toast]);
  
  const renderBadges = (items: string[], onRemove: (item: string) => void) => {
    return items.map((item, index) => (
      <Badge key={index} className="mr-1 mb-1 px-2 py-1 flex items-center space-x-1">
        <span>{item}</span>
        <button 
          onClick={() => onRemove(item)}
          className="ml-1 h-4 w-4 rounded-full text-xs flex items-center justify-center hover:bg-red-500 hover:text-white"
        >
          <X size={12} />
        </button>
      </Badge>
    ));
  };
  
  // カード形式の入力フォーム
  const renderCardForm = () => {
    if (!showForm) return null;
    
    return (
      <Card className="w-full max-w-md mx-auto mt-4 shadow-lg">
        <CardHeader>
          <CardTitle>情報収集プラン作成</CardTitle>
          <CardDescription>
            CrewAIを使用して情報収集プランを作成します
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="industry">業界（必須）</Label>
            <Input
              id="industry"
              placeholder="例: FinTech"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="keywords">キーワード（必須）</Label>
            <div className="flex">
              <Input
                id="keywords"
                placeholder="例: ブロックチェーン"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                className="flex-1 mr-2"
              />
              <Button type="button" onClick={handleAddKeyword} size="sm">追加</Button>
            </div>
            <div className="flex flex-wrap mt-2">
              {renderBadges(keywords, handleRemoveKeyword)}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="sources">情報源（任意）</Label>
            <div className="flex">
              <Input
                id="sources"
                placeholder="例: 業界レポート"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddSource()}
                className="flex-1 mr-2"
              />
              <Button type="button" onClick={handleAddSource} size="sm">追加</Button>
            </div>
            <div className="flex flex-wrap mt-2">
              {renderBadges(sources, handleRemoveSource)}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="constraints">リソース制約（任意）</Label>
            <div className="flex">
              <Input
                id="constraints"
                placeholder="例: 予算30万円以内"
                value={newConstraint}
                onChange={(e) => setNewConstraint(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddConstraint()}
                className="flex-1 mr-2"
              />
              <Button type="button" onClick={handleAddConstraint} size="sm">追加</Button>
            </div>
            <div className="flex flex-wrap mt-2">
              {renderBadges(constraints, handleRemoveConstraint)}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="requirements">特別要件（任意）</Label>
            <div className="flex">
              <Input
                id="requirements"
                placeholder="例: 海外事例を含める"
                value={newRequirement}
                onChange={(e) => setNewRequirement(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddRequirement()}
                className="flex-1 mr-2"
              />
              <Button type="button" onClick={handleAddRequirement} size="sm">追加</Button>
            </div>
            <div className="flex flex-wrap mt-2">
              {renderBadges(requirements, handleRemoveRequirement)}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={toggleForm} disabled={isProcessing}>
            キャンセル
          </Button>
          <Button onClick={handleStartCrewAI} disabled={isProcessing || !industry.trim() || keywords.length === 0}>
            {isProcessing ? "処理中..." : "プラン作成開始"}
          </Button>
        </CardFooter>
      </Card>
    );
  };
  
  // ボタンのみ表示、またはカードフォームと併せて表示
  if (useCard) {
    return (
      <div className={className}>
        <Button 
          variant={variant} 
          size={size}
          onClick={toggleForm}
          disabled={isProcessing}
          className={`w-full ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
          aria-busy={isProcessing}
        >
          {isProcessing ? (
            <div className="flex items-center space-x-2">
              <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>処理中...</span>
            </div>
          ) : "CrewAIで情報収集プランを作成"}
        </Button>
        {renderCardForm()}
      </div>
    );
  }
  
  // ボタンのみ表示
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            onClick={toggleForm}
            disabled={isProcessing}
            className={`${className} ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
            aria-busy={isProcessing}
          >
            {isProcessing ? (
              <div className="flex items-center space-x-2">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>処理中...</span>
              </div>
            ) : "CrewAIで情報収集プランを作成"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>CrewAIのエージェントを使用して情報収集プランを作成します</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}