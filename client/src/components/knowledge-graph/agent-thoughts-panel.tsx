import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Brain, Bot, Lightbulb, AlertCircle, RefreshCw } from 'lucide-react';

interface AgentThought {
  userId: string;
  roleModelId: string;
  agentName: string;
  thought: string;
  timestamp: number;
}

interface AgentThoughtsPanelProps {
  roleModelId: string;
  thoughts: AgentThought[];
}

export const AgentThoughtsPanel: React.FC<AgentThoughtsPanelProps> = ({ roleModelId, thoughts }) => {
  const [filteredThoughts, setFilteredThoughts] = useState<AgentThought[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  
  // エージェント一覧を取得
  const agents = Array.from(new Set(thoughts.map(t => t.agentName)));
  
  // エージェントのアイコンを取得
  const getAgentIcon = (agentName: string) => {
    if (agentName.includes('Industry')) return <Bot size={18} />;
    if (agentName.includes('Keyword')) return <Brain size={18} />;
    if (agentName.includes('Structure')) return <RefreshCw size={18} />;
    if (agentName.includes('Knowledge') || agentName.includes('Graph')) return <Lightbulb size={18} />;
    return <AlertCircle size={18} />;
  };
  
  // エージェントのカラーを取得
  const getAgentColor = (agentName: string) => {
    if (agentName.includes('Industry')) return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    if (agentName.includes('Keyword')) return 'bg-green-100 text-green-800 hover:bg-green-200';
    if (agentName.includes('Structure')) return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
    if (agentName.includes('Knowledge') || agentName.includes('Graph')) return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
    return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  };
  
  // 思考の時間をフォーマット
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  // エージェントフィルターが変更されたときに思考をフィルタリング
  useEffect(() => {
    setFilteredThoughts(
      selectedAgent 
        ? thoughts.filter(t => t.agentName === selectedAgent)
        : thoughts
    );
  }, [selectedAgent, thoughts]);
  
  return (
    <Card className="shadow-md h-full">
      <CardHeader className="bg-gray-50 pb-2">
        <CardTitle className="text-xl flex items-center gap-2">
          <Brain className="text-primary" />
          AIエージェント思考パネル
        </CardTitle>
        <CardDescription>
          AIエージェントの思考プロセスをリアルタイムで確認できます
        </CardDescription>
        
        {/* エージェントフィルター */}
        <div className="flex flex-wrap gap-2 mt-2 mb-1">
          <Badge 
            variant={selectedAgent === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedAgent(null)}
          >
            すべて
          </Badge>
          
          {agents.map(agent => (
            <Badge
              key={agent}
              variant={selectedAgent === agent ? "default" : "outline"}
              className={`cursor-pointer ${selectedAgent === agent ? '' : getAgentColor(agent)}`}
              onClick={() => setSelectedAgent(agent)}
            >
              {getAgentIcon(agent)}
              <span className="ml-1">
                {agent.replace('Agent', '')}
              </span>
            </Badge>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="px-3 py-2">
        <ScrollArea className="h-[400px] pr-3">
          {filteredThoughts.length > 0 ? (
            <div className="space-y-4">
              {filteredThoughts.map((thought, index) => (
                <div key={index} className="flex gap-3 p-3 rounded-lg bg-gray-50">
                  <Avatar className="mt-1">
                    <AvatarImage src={`/icons/${thought.agentName.toLowerCase().includes('industry') ? 'industry' : 
                                          thought.agentName.toLowerCase().includes('keyword') ? 'keyword' : 
                                          thought.agentName.toLowerCase().includes('struct') ? 'structure' : 
                                          'knowledge'}-agent.png`} 
                                alt={thought.agentName} />
                    <AvatarFallback className={thought.agentName.toLowerCase().includes('industry') ? 'bg-blue-100 text-blue-800' : 
                                              thought.agentName.toLowerCase().includes('keyword') ? 'bg-green-100 text-green-800' : 
                                              thought.agentName.toLowerCase().includes('struct') ? 'bg-purple-100 text-purple-800' : 
                                              'bg-amber-100 text-amber-800'}>
                      {thought.agentName.substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-medium">
                        {thought.agentName.replace('Agent', '')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatTime(thought.timestamp)}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {thought.thought}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 p-6">
              <Lightbulb className="mb-2 h-10 w-10 opacity-30" />
              <p>エージェントの思考はまだありません</p>
              <p className="text-sm">処理が開始されるとここに表示されます</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};