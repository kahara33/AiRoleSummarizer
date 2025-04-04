import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";

type AgentThought = {
  agent: string;
  thought: string;
  timestamp: Date;
};

interface AgentThoughtsPanelProps {
  thoughts: AgentThought[];
  isVisible: boolean;
  onClose: () => void;
}

export default function AgentThoughtsPanel({
  thoughts,
  isVisible,
  onClose,
}: AgentThoughtsPanelProps) {
  if (!isVisible) return null;

  const agentColors: Record<string, string> = {
    "IndustryAnalysisAgent": "bg-blue-100 border-blue-300",
    "KeywordExpansionAgent": "bg-green-100 border-green-300",
    "StructuringAgent": "bg-yellow-100 border-yellow-300",
    "KnowledgeGraphAgent": "bg-purple-100 border-purple-300",
    "OrchestratorAgent": "bg-gray-100 border-gray-300",
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-white shadow-lg border-l z-50 flex flex-col">
      <div className="p-4 border-b flex justify-between items-center bg-muted/30">
        <h3 className="font-medium">AIエージェントの思考プロセス</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {thoughts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              AIエージェントの思考プロセスが表示されます
            </p>
          ) : (
            thoughts.map((thought, index) => (
              <div 
                key={index} 
                className={`p-3 rounded-lg border ${agentColors[thought.agent] || "bg-gray-100 border-gray-300"}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-semibold">
                    {thought.agent}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(thought.timestamp, { addSuffix: true, locale: ja })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{thought.thought}</p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}