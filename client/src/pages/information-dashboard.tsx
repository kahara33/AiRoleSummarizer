import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import KnowledgeGraphViewer from '@/components/knowledge-graph/KnowledgeGraphViewer';
import { useToast } from "@/hooks/use-toast";
import MultiAgentChatPanel from '@/components/chat/MultiAgentChatPanel';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket-fixed';
import AgentThoughtsPanel from '@/components/knowledge-graph/agent-thoughts-panel';
import AgentConversation from '@/components/agent-activity/AgentConversation';
import type { ProgressUpdate } from '@/hooks/use-multi-agent-websocket-fixed';
import { CreateCollectionPlanWithCrewAIButton } from '@/components/knowledge-graph/CreateCollectionPlanWithCrewAIButton';
import { 
  Plus, 
  FileText, 
  ExternalLink, 
  RefreshCw,
  BrainCircuit,
  Sparkles,
  Maximize2,
  Minimize2
} from 'lucide-react';

// モックデータ
const mockCollectionPlans = [
  { id: 'plan1', name: 'プラン1', createdAt: '2025/3/7', updatedAt: '2025/4/7' },
  { id: 'plan2', name: 'プラン2', createdAt: '2025/3/15', updatedAt: '2025/4/5' },
];

// プラン詳細のモックデータ
const mockPlanDetails = {
  name: '収集プラン',
  status: '実行単位',
  completion: '通知先',
  tools: ['Google', 'RSS'],
  sources: [
    { id: 'source1', media: 'https://example.com/news' },
    { id: 'source2', media: 'https://example.org/blog' }
  ]
};

interface InformationDashboardProps {
  id?: string;
}

const InformationDashboard: React.FC<InformationDashboardProps> = () => {
  const params = useParams();
  const { id } = params;
  const roleModelId = id || 'default';
  const [activeTab, setActiveTab] = useState<string>('knowledgeGraph');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [hasKnowledgeGraph, setHasKnowledgeGraph] = useState<boolean>(false);
  const [showAgentThoughts, setShowAgentThoughts] = useState<boolean>(false);
  const { toast } = useToast();

  // ロールモデルデータを取得
  const { data: roleModel } = useQuery<any>({
    queryKey: [`/api/role-models/${roleModelId}`],
    enabled: roleModelId !== 'default',
  });
  
  // WebSocketメッセージを処理
  const { 
    agentThoughts, 
    isConnected, 
    sendMessage: send, 
    connect, 
    isProcessing, 
    progressUpdates,
  } = useMultiAgentWebSocket();
  
  // チャットメッセージ用の状態
  const [messages, setMessages] = useState<any[]>([]);

  // テスト用のエージェント思考処理（本番環境では削除する）
  useEffect(() => {
    if (roleModelId && agentThoughts.length === 0) {
      if (send) {
        const testAgentThoughts = async () => {
          // テスト用のエージェント思考データを遅延実行で送信
          const agents = [
            { name: "ドメイン分析エージェント", type: "domain_analyst" },
            { name: "トレンド調査エージェント", type: "trend_researcher" },
            { name: "コンテキストマッピングエージェント", type: "context_mapper" },
            { name: "プラン戦略エージェント", type: "plan_strategist" },
            { name: "批判的思考エージェント", type: "critical_thinker" }
          ];
          
          const thoughts = [
            "分析を開始しています。情報を収集中...",
            "キーとなる特性とパターンを特定しています。",
            "関連データを評価して、重要な関係性を見つけています。",
            "収集したデータに基づいて戦略を策定しています。",
            "構築された知識構造の整合性と完全性を確認中です。"
          ];
          
          // 複数のメッセージをシーケンシャルに送信
          let delay = 500;
          agents.forEach((agent, index) => {
            setTimeout(() => {
              // エージェント思考メッセージ
              send('agent_thoughts', {
                id: `test-thought-${index + 1}`,
                roleModelId: roleModelId,
                agentName: agent.name,
                agentType: agent.type,
                thought: thoughts[index],
                message: `${agent.name}の思考: ${thoughts[index]}`,
                type: "thinking",
                timestamp: new Date().toISOString()
              });
              
              // 少し遅れて進捗更新
              setTimeout(() => {
                send('progress', {
                  roleModelId: roleModelId,
                  stage: `${agent.name}のフェーズ`,
                  progress: 20 * (index + 1),
                  message: `プロセスが${20 * (index + 1)}%完了しました`,
                  details: { step: agent.type },
                  percent: 20 * (index + 1)
                });
              }, 300);
            }, delay);
            
            delay += 1500; // 次のエージェントのディレイを増加
          });
          
          // 最後に成功メッセージ
          setTimeout(() => {
            send('agent_thoughts', {
              id: "test-thought-completion",
              roleModelId: roleModelId,
              agentName: "システム",
              agentType: "system",
              thought: "全エージェントの処理が完了しました。知識グラフと情報収集プランが正常に生成されました。",
              message: "処理完了: 知識グラフと情報収集プランが生成されました。",
              type: "success",
              timestamp: new Date().toISOString()
            });
            
            // 完了進捗
            send('progress', {
              roleModelId: roleModelId,
              stage: "完了",
              progress: 100,
              message: "処理が完了しました",
              details: { step: "completion" },
              percent: 100
            });
          }, delay + 1000);
        };
        
        //testAgentThoughts(); // 必要に応じてコメントアウトを解除
      }
    }
  }, [roleModelId, agentThoughts.length, send]);
  
  // roleModelIdが設定されたらWebSocketを接続
  useEffect(() => {
    if (roleModelId && !isConnected) {
      console.log('WebSocketを接続します: roleModelId =', roleModelId);
      connect(roleModelId);
    }
    
    // コンポーネントがアンマウントされたときにクリーンアップ
    return () => {
      console.log('情報整理ダッシュボードのWebSocket接続をクリーンアップします');
    };
  }, [roleModelId, isConnected, connect]);
  
  // CrewAIで知識グラフを生成する関数
  const generateGraphMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/knowledge-graph/generate/${roleModelId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "プロセス開始",
        description: "CrewAIによるナレッジグラフと情報収集プランの生成を開始しました。しばらくお待ちください。"
      });
      setShowAgentThoughts(true); // エージェント思考パネルを表示
      
      // WebSocketが切断されている場合は再接続
      if (!isConnected && roleModelId) {
        console.log('ナレッジグラフ生成時にWebSocketを再接続します');
        connect(roleModelId);
      }
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: "知識グラフの生成に失敗しました。",
        variant: "destructive"
      });
    }
  });

  // プランが選択されたときの処理
  useEffect(() => {
    if (mockCollectionPlans.length > 0 && !selectedPlan) {
      setSelectedPlan(mockCollectionPlans[0].id);
    }
  }, [selectedPlan]);

  // 新規ソース追加関数
  const handleAddSource = () => {
    toast({
      title: "新規ソース追加",
      description: "新しい情報ソースを追加する機能は開発中です。"
    });
  };
  
  return (
    <div className="flex flex-col h-screen">
      {/* ヘッダー */}
      <div className="bg-white p-4 border-b">
        <h1 className="text-xl font-semibold">情報整理ダッシュボード（{roleModel?.name || 'ロール定義名'}）</h1>
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左サイドバー - 情報収集プラン */}
        <div className="w-56 border-r bg-slate-50 flex flex-col">
          <div className="p-4 flex justify-between items-center border-b">
            <h2 className="text-sm font-medium">情報収集プラン</h2>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="text-xs">
                <tr>
                  <th className="text-left p-2">プラン名</th>
                  <th className="text-left p-2">作成日</th>
                  <th className="text-left p-2">更新日</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {mockCollectionPlans.map((plan) => (
                  <tr 
                    key={plan.id} 
                    className={`hover:bg-gray-100 cursor-pointer ${selectedPlan === plan.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    <td className="p-2">プラン{plan.id.replace('plan', '')}</td>
                    <td className="p-2">{plan.createdAt}</td>
                    <td className="p-2">{plan.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* プラン詳細 */}
          <div className="p-4 border-t overflow-auto">
            <h2 className="text-sm font-medium mb-2">プラン詳細</h2>
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-medium">収集プラン</h3>
                <p className="text-xs">{mockPlanDetails.name}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-medium">実行頻度</h3>
                <p className="text-xs">{mockPlanDetails.status}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-medium">通知先</h3>
                <p className="text-xs">{mockPlanDetails.completion}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-medium">利用ツール</h3>
                <div className="flex flex-wrap gap-1 mt-1">
                  {mockPlanDetails.tools.map((tool, index) => (
                    <span key={index} className="text-xs px-2 py-0.5 bg-gray-100 rounded-sm">{tool}</span>
                  ))}
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-medium">情報ソース</h3>
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleAddSource}>
                    <Plus className="h-3 w-3 mr-1" />
                    追加
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツエリア */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* タブナビゲーション */}
          <div className="border-b bg-white">
            <div className="flex justify-between items-center px-4 py-2">
              <Tabs 
                value={activeTab} 
                onValueChange={setActiveTab}
                className="w-full"
              >
                <div className="flex justify-between items-center">
                  <TabsList>
                    <TabsTrigger value="knowledgeGraph" className="text-sm">
                      ナレッジグラフ
                    </TabsTrigger>
                    <TabsTrigger value="details" className="text-sm">
                      詳細情報
                    </TabsTrigger>
                    <TabsTrigger value="memo" className="text-sm">
                      メモ
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="flex gap-2">
                    {(roleModelId && roleModelId !== 'default') && (
                      <Button 
                        variant="default" 
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          generateGraphMutation.mutate();
                        }}
                        disabled={generateGraphMutation.isPending}
                      >
                        {generateGraphMutation.isPending ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            処理中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            CrewAIでナレッジグラフと情報収集プランを生成
                          </>
                        )}
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8"
                      onClick={() => setShowAgentThoughts(!showAgentThoughts)}
                    >
                      <BrainCircuit className="h-4 w-4 mr-1" />
                      マルチエージェント思考
                    </Button>
                  </div>
                </div>
              </Tabs>
            </div>
          </div>
            
          {/* タブコンテンツ */}
          <div className="flex-1 overflow-hidden bg-gray-50">
            <TabsContent value="knowledgeGraph" className="h-full p-0 m-0 relative">
              {(roleModelId && roleModelId !== 'default') ? (
                <KnowledgeGraphViewer 
                  roleModelId={roleModelId} 
                  onGraphDataChange={(hasData) => setHasKnowledgeGraph(hasData)}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <FileText className="h-16 w-16 mb-4 opacity-20" />
                  <p>ロールモデルが選択されていません</p>
                </div>
              )}
              
              {/* エージェント思考パネル (右サイドバー) */}
              {showAgentThoughts && (
                <div className="absolute right-0 top-0 w-64 h-full bg-white border-l shadow-lg z-10">
                  <div className="flex justify-between items-center p-2 border-b">
                    <h3 className="text-sm font-medium">AIエージェント思考</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0"
                      onClick={() => setShowAgentThoughts(false)}
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="h-[calc(100%-40px)] overflow-hidden">
                    <AgentConversation 
                      roleModelId={roleModelId}
                      height="100%"
                    />
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="details" className="h-full p-4">
              <div className="bg-white p-4 rounded-lg h-full">
                <h2 className="text-lg font-semibold mb-4">詳細情報</h2>
                <p>このタブは開発中です。</p>
              </div>
            </TabsContent>
            
            <TabsContent value="memo" className="h-full p-4">
              <div className="bg-white p-4 rounded-lg h-full">
                <h2 className="text-lg font-semibold mb-4">メモ</h2>
                <p>このタブは開発中です。</p>
              </div>
            </TabsContent>
          </div>
          
          {/* チャットインターフェース（オプション） */}
          <div className="h-12 border-t bg-white p-2 flex items-center">
            <input 
              type="text" 
              placeholder="メッセージを入力..."
              className="w-full border rounded-md px-3 py-1 text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InformationDashboard;
