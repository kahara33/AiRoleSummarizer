import React, { useState, useEffect } from 'react';
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AgentConversation from "@/components/agent-activity/AgentConversation";

const agentNames = [
  "ドメイン分析者",
  "トレンドリサーチャー",
  "コンテキストマッパー",
  "プランストラテジスト",
  "クリティカルシンカー",
  "オーケストレーター"
];

const messageTypes = [
  { value: "domain_analysis", label: "ドメイン分析" },
  { value: "trend_research", label: "トレンド調査" },
  { value: "context_mapping", label: "コンテキストマッピング" },
  { value: "plan_strategy", label: "プラン戦略" },
  { value: "critical_thinking", label: "批判的思考" },
  { value: "info", label: "情報" },
  { value: "success", label: "成功" },
  { value: "error", label: "エラー" },
  { value: "thinking", label: "思考中" },
  { value: "debug", label: "デバッグ" }
];

export default function WebsocketDebug() {
  const { toast } = useToast();
  const [roleModelId, setRoleModelId] = useState('');
  const [agentName, setAgentName] = useState(agentNames[0]);
  const [messageType, setMessageType] = useState(messageTypes[0].value);
  const [thoughtText, setThoughtText] = useState('');
  const [loading, setLoading] = useState(false);
  
  // メッセージの送信
  const sendTestThought = async () => {
    if (!roleModelId) {
      toast({
        title: "エラー",
        description: "ロールモデルIDを入力してください",
        variant: "destructive"
      });
      return;
    }
    
    if (!thoughtText) {
      toast({
        title: "エラー",
        description: "思考テキストを入力してください",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/debug/send-agent-thought', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentName,
          thought: thoughtText,
          roleModelId,
          type: messageType
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "送信成功",
          description: `エージェント思考「${data.details.thoughtPreview}...」を送信しました`,
        });
      } else {
        toast({
          title: "送信エラー",
          description: data.message || "エージェント思考の送信に失敗しました",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("送信エラー:", error);
      toast({
        title: "送信エラー",
        description: "ネットワークエラーが発生しました",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // シミュレーションの開始
  const startSimulation = async () => {
    if (!roleModelId) {
      toast({
        title: "エラー",
        description: "ロールモデルIDを入力してください",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/debug/simulate-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roleModelId,
          industry: "人工知能"
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "シミュレーション開始",
          description: "エージェントシミュレーションを開始しました。メッセージパネルを確認してください。",
        });
      } else {
        toast({
          title: "シミュレーションエラー",
          description: data.message || "シミュレーションの開始に失敗しました",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("シミュレーションエラー:", error);
      toast({
        title: "シミュレーションエラー",
        description: "ネットワークエラーが発生しました",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // サンプルの思考テキスト
  const sampleThoughts = {
    "ドメイン分析者": "人工知能業界の主要概念と関係性を分析しています。深層学習、自然言語処理、コンピュータビジョンなどの技術分野を特定し、それらの関係を分析しています。企業、研究機関、オープンソースコミュニティなどの主要プレイヤーを特定しています。",
    "トレンドリサーチャー": "GPT-4などの大規模言語モデル、マルチモーダルAI、AIの倫理と規制などの最新トレンドを特定しています。OpenAI、Google DeepMind、Anthropicなどの主要企業の動向を追跡しています。",
    "コンテキストマッパー": "収集された情報に基づいて、AIの技術的発展、応用分野、倫理的課題、未来予測を含む効率的なナレッジグラフ構造を設計しています。",
    "プランストラテジスト": "最新の研究論文、技術ブログ、業界レポート、専門家インタビューなどの情報源からの情報収集の優先順位を設定しています。",
    "クリティカルシンカー": "生成されたナレッジグラフの論理的一貫性、完全性、バイアスの有無を評価しています。生成AIの倫理的側面、セキュリティリスク、社会的影響などの重要な観点が十分に考慮されているか確認しています。",
    "オーケストレーター": "すべてのエージェントの作業を調整し、一貫したナレッジグラフと情報収集プランを生成するためのワークフローを管理しています。"
  };

  // 選択されたエージェントに応じてサンプルテキストを設定
  useEffect(() => {
    // エージェント名をインデックスとして使用して適切なサンプルテキストを取得
    // TypeScriptの型チェックを回避するため、キーとして存在するか確認
    if (agentName in sampleThoughts) {
      setThoughtText(sampleThoughts[agentName as keyof typeof sampleThoughts]);
    } else {
      setThoughtText('');
    }
  }, [agentName]);

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">WebSocket デバッグツール</h1>
      <p className="mb-8 text-muted-foreground">
        このツールは、WebSocketを使用したAIエージェント通信をテストするためのものです。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <Tabs defaultValue="single">
            <TabsList className="mb-4">
              <TabsTrigger value="single">単一メッセージ</TabsTrigger>
              <TabsTrigger value="simulation">シミュレーション</TabsTrigger>
            </TabsList>
            
            <TabsContent value="single">
              <Card>
                <CardHeader>
                  <CardTitle>テスト思考の送信</CardTitle>
                  <CardDescription>
                    単一のエージェント思考メッセージをWebSocketで送信します
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      ロールモデルID
                    </label>
                    <Input
                      placeholder="ロールモデルIDを入力"
                      value={roleModelId}
                      onChange={(e) => setRoleModelId(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      エージェント名
                    </label>
                    <Select
                      value={agentName}
                      onValueChange={setAgentName}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="エージェントを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {agentNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      メッセージタイプ
                    </label>
                    <Select
                      value={messageType}
                      onValueChange={setMessageType}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="タイプを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {messageTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      思考テキスト
                    </label>
                    <Textarea
                      placeholder="エージェントの思考内容を入力"
                      value={thoughtText}
                      onChange={(e) => setThoughtText(e.target.value)}
                      rows={8}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={sendTestThought} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "送信中..." : "送信"}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            <TabsContent value="simulation">
              <Card>
                <CardHeader>
                  <CardTitle>エージェントシミュレーション</CardTitle>
                  <CardDescription>
                    複数のエージェントによる思考プロセスをシミュレートします
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      ロールモデルID
                    </label>
                    <Input
                      placeholder="ロールモデルIDを入力"
                      value={roleModelId}
                      onChange={(e) => setRoleModelId(e.target.value)}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      シミュレーションでは、オーケストレーター、ドメイン分析者、トレンドリサーチャーなど、
                      すべてのエージェントからの思考メッセージが順番に送信されます。
                      これにより、実際のAIエージェント処理をシミュレートします。
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={startSimulation} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "開始中..." : "シミュレーション開始"}
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        <div>
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>エージェントメッセージ</CardTitle>
              <CardDescription>
                WebSocketで受信したメッセージを表示します
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-auto">
              {/* エージェント会話コンポーネント */}
              <div className="border rounded-md overflow-hidden h-[600px]">
                <AgentConversation
                  roleModelId={roleModelId || undefined}
                  height="600px"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}