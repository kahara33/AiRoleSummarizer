import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import KnowledgeGraphViewer from '@/components/knowledge-graph/KnowledgeGraphViewer';
import { useToast } from "@/hooks/use-toast";
import MultiAgentChatPanel from '@/components/chat/MultiAgentChatPanel';
import { useMultiAgentWebSocket } from '@/hooks/use-multi-agent-websocket-fixed';
import AgentConversation from '@/components/agent-activity/AgentConversation';

import type { ProgressUpdate } from '@/hooks/use-multi-agent-websocket-fixed';
// UIコンポーネントではなく、直接ボタンを使用
import { 
  Plus, 
  FileText, 
  ExternalLink, 
  RefreshCw,
  BrainCircuit,
  Sparkles,
  Maximize2,
  Minimize2,
  Send
} from 'lucide-react';
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

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
  const [showAgentPanel, setShowAgentPanel] = useState<boolean>(true); // デフォルトで表示
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState<boolean>(false);
  const [mainPanelMaximized, setMainPanelMaximized] = useState<boolean>(false);
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
    forceResetProcessing
  } = useMultiAgentWebSocket();
  
  // KnowledgeGraphViewerからのデータ有無状態を更新する関数
  const handleKnowledgeGraphData = (hasData: boolean) => {
    setHasKnowledgeGraph(hasData);
  };
  
  // チャットメッセージ用の状態
  const [messages, setMessages] = useState<any[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  
  // デバッグ用のログ出力
  useEffect(() => {
    console.log("エージェント思考の数:", agentThoughts.length);
    console.log("進捗更新の数:", progressUpdates.length);
    console.log("処理中フラグ:", isProcessing);
    
    // テスト用の処理（この実装はテスト後に削除してください）
    if (agentThoughts.length === 0 && roleModelId) {
      console.log("WebSocketメッセージングのテスト - Replitのエージェントチャットライクな表示");
      
      // テスト用にWebSocketメッセージを追加する代わりに、WebSocketメッセージを手動で送信
      if (send) {
        // 一連のエージェント思考と進捗更新を時間差で送信
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
      }
    }
  }, [agentThoughts.length, progressUpdates.length, isProcessing, roleModelId, send]);
  
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
  
  // 定期的にWebSocket接続を確認し、切断されていたら再接続
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (roleModelId && !isConnected) {
        console.log('WebSocket接続が切断されています。再接続を試みます...');
        connect(roleModelId);
      }
    }, 10000); // 10秒ごとに確認
    
    return () => clearInterval(checkInterval);
  }, [roleModelId, isConnected, connect]);
  
  // エージェントの思考が届いたらパネルを表示する
  useEffect(() => {
    if (agentThoughts.length > 0) {
      setShowAgentPanel(true);
      // エージェントプロセスはタブではなく、右パネルに表示されるようになったため
      // タブの自動切り替えは行わない
    }
  }, [agentThoughts]);
  
  // パネルのサイズを調整する
  useEffect(() => {
    // 両方のパネルが閉じられている場合はメインパネルを100%にする
    if (leftPanelCollapsed && !showAgentPanel) {
      setMainPanelMaximized(true);
    } else if (!leftPanelCollapsed || showAgentPanel) {
      // どちらかのパネルが表示されたらメインパネルの最大化を解除
      setMainPanelMaximized(false);
    }
    
    // 必要があればリサイズイベントを強制的に発火させる
    window.dispatchEvent(new Event('resize'));
  }, [leftPanelCollapsed, showAgentPanel]);
  
  // メインパネルが最大化されている場合は他のパネルを閉じる
  useEffect(() => {
    if (mainPanelMaximized) {
      setLeftPanelCollapsed(true);
      setShowAgentPanel(false);
    }
  }, [mainPanelMaximized]);
  
  // メッセージ送信関数
  const handleSendMessage = (message: string) => {
    if (!send || !roleModelId) return;
    
    // チャットメッセージを送信
    send('chat_message', {
      roleModelId,
      message
    });
    
    console.log("ユーザーメッセージを送信:", message);
  };
  
  // CrewAIで知識グラフを生成する関数
  const generateGraphMutation = useMutation({
    mutationFn: async () => {
      // WebSocketが切断されている場合は再接続
      if (!isConnected && roleModelId && roleModelId !== 'default') {
        console.log(`WebSocketを接続: ${roleModelId}`);
        connect(roleModelId);
        
        // WebSocket接続をしっかり確立するために少し待機
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // エージェントパネルを確実に表示
      setShowAgentPanel(true);
      
      // AIエージェント間の対話をシミュレーションするためのテストコード
      if (send) {
        // 複数のメッセージをシーケンシャルに送信
        console.log("エージェント間対話シミュレーションを開始");
        
        const agents = [
          { name: "オーケストレーター", type: "orchestrator" },
          { name: "ドメイン分析エージェント", type: "domain_analyst" },
          { name: "トレンド調査エージェント", type: "trend_researcher" },
          { name: "コンテキストマッピングエージェント", type: "context_mapper" },
          { name: "プラン戦略エージェント", type: "plan_strategist" },
          { name: "批判的思考エージェント", type: "critical_thinker" }
        ];
        
        const thoughts = [
          "ナレッジグラフと情報収集プランの生成プロセスを開始します。各エージェントに役割を割り当てました。",
          "業界分析を開始しています。主要な動向とパターンを特定しています。",
          "最新の技術トレンドを収集中です。AIと関連技術の発展について調査しています。",
          "関連情報間の関係性を構築中です。主要な概念をマッピングしています。",
          "最適な情報収集戦略を策定中です。収集頻度と情報源の優先順位を決定しています。",
          "構築されたナレッジグラフと情報収集プランの整合性を評価しています。"
        ];
        
        let delay = 500;
        agents.forEach((agent, index) => {
          setTimeout(() => {
            // エージェント思考メッセージ
            send('agent_thoughts', {
              id: `generated-thought-${index + 1}`,
              roleModelId: roleModelId,
              agentName: agent.name,
              agentType: agent.type,
              thought: thoughts[index],
              message: thoughts[index],
              type: "thinking",
              timestamp: new Date().toISOString()
            });
            
            // 少し遅れて進捗更新
            setTimeout(() => {
              send('progress', {
                roleModelId: roleModelId,
                stage: `プロセス進行中`,
                progress: Math.min(15 * (index + 1), 90),
                message: `プロセスが${Math.min(15 * (index + 1), 90)}%完了しました`,
                details: { step: agent.type },
                percent: Math.min(15 * (index + 1), 90)
              });
            }, 300);
          }, delay);
          
          delay += 1500; // 次のエージェントのディレイを増加
        });
        
        // 最後に成功メッセージ
        setTimeout(() => {
          send('agent_thoughts', {
            id: "generated-thought-completion",
            roleModelId: roleModelId,
            agentName: "オーケストレーター",
            agentType: "orchestrator",
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
      }
      
      // 実際のAPIを呼び出す
      return apiRequest("POST", `/api/knowledge-graph/generate-with-crewai/${roleModelId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "プロセス開始",
        description: "CrewAIによるナレッジグラフと情報収集プランの生成を開始しました。進捗状況はエージェントパネルで確認できます。"
      });
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

  // エージェントパネルを表示するヘルパー関数
  const showAgentPanelHandler = useCallback(() => {
    setShowAgentPanel(true);
    
    // WebSocketが切断されている場合は再接続
    if (!isConnected && roleModelId) {
      console.log('WebSocketを再接続します');
      connect(roleModelId);
    }
  }, [isConnected, roleModelId, connect]);
  
  return (
    <div className="flex flex-col h-screen overflow-hidden panel-container">
      <div className="bg-white border-b px-4 py-0.5 flex justify-between items-center">
        <h1 className="text-base font-semibold">
          情報整理ダッシュボード（{roleModel?.name || 'ロール定義名'}）
        </h1>
        <div className="flex items-center gap-2">
          {roleModelId !== 'default' && (
            <>
              <Button 
                variant="ghost" 
                size="sm" 
                className="px-2"
                onClick={() => {
                  toast({
                    title: "最新情報に更新",
                    description: "最新のデータに更新しました"
                  });
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="px-2"
                onClick={() => {
                  setShowAgentPanel(!showAgentPanel);
                  if (showAgentPanel) {
                    toast({
                      title: "パネルを最小化",
                      description: "AIエージェント思考パネルを最小化しました"
                    });
                  } else {
                    toast({
                      title: "パネルを表示",
                      description: "AIエージェント思考パネルを表示しました"
                    });
                  }
                }}
                title={showAgentPanel ? "AIエージェントパネルを最小化" : "AIエージェントパネルを表示"}
              >
                {showAgentPanel ? 
                  <BrainCircuit className="h-4 w-4 text-purple-600" /> : 
                  <BrainCircuit className="h-4 w-4" />
                }
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden panel-container">
        <PanelGroup direction="horizontal" className="relative" id="panel-group-main">
          {/* 左側パネルが最小化されているときのアイコン */}
          {leftPanelCollapsed && (
            <div className="w-8 border-r bg-gray-50 flex flex-col items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 mt-2" 
                onClick={() => {
                  // 最小化状態を解除
                  setLeftPanelCollapsed(false);
                  // メインパネルが最大化されていた場合は元に戻す
                  if (mainPanelMaximized) {
                    setMainPanelMaximized(false);
                  }
                  toast({
                    title: "パネルを展開",
                    description: "情報収集プランパネルを展開しました"
                  });
                }}
                title="パネルを展開"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {/* 左側パネル: 情報収集プラン一覧とプラン詳細 */}
          {!leftPanelCollapsed && (
            <>
              <Panel
                id="left-panel"
                defaultSize={20} 
                minSize={15} 
                maxSize={30}
                className="border-r"
                onResize={(size) => {
                  // パネルのサイズがminWidthよりも小さくなったら自動的に最小化
                  if (size < 8 && !leftPanelCollapsed) {
                    setLeftPanelCollapsed(true);
                    toast({
                      title: "パネルを最小化",
                      description: "情報収集プランパネルを最小化しました"
                    });
                  }
                }}
              >
                <div className="h-full overflow-hidden flex flex-col bg-gray-50">
                  <div className="px-4 py-3 border-b bg-white flex justify-between items-center">
                    <h2 className="font-semibold text-sm">情報収集プラン</h2>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 w-5 p-0" 
                      onClick={() => {
                        const newState = !leftPanelCollapsed;
                        setLeftPanelCollapsed(newState);
                        
                        // パネルを展開する場合は、メインパネルが最大化されていたら元に戻す
                        if (!newState && mainPanelMaximized) {
                          setMainPanelMaximized(false);
                        }
                        
                        if (newState) {
                          toast({
                            title: "パネルを最小化",
                            description: "情報収集プランパネルを最小化しました"
                          });
                        } else {
                          toast({
                            title: "パネルを展開",
                            description: "情報収集プランパネルを展開しました"
                          });
                        }
                      }}
                      title={leftPanelCollapsed ? "パネルを展開" : "パネルを最小化"}
                    >
                      {leftPanelCollapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>

                  <div className="flex-1 overflow-auto p-4">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left px-2 py-0.5 font-medium text-xs">プラン名</th>
                          <th className="text-left px-2 py-0.5 font-medium text-xs">作成日</th>
                          <th className="text-left px-2 py-0.5 font-medium text-xs">更新日</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mockCollectionPlans.map((plan) => (
                          <tr 
                            key={plan.id}
                            className={`hover:bg-gray-100 cursor-pointer ${selectedPlan === plan.id ? 'bg-blue-50' : ''}`}
                            onClick={() => setSelectedPlan(plan.id)}
                          >
                            <td className="px-2 py-0.5 border-t border-gray-200 text-xs">プラン{plan.id.replace('plan', '')}</td>
                            <td className="px-2 py-0.5 border-t border-gray-200 text-xs">{plan.createdAt}</td>
                            <td className="px-2 py-0.5 border-t border-gray-200 text-xs">{plan.updatedAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t mt-2 overflow-auto">
                    <div className="px-4 py-3 bg-white">
                      <h2 className="font-semibold text-sm">プラン詳細</h2>
                    </div>
                    <div className="p-4 space-y-2">
                      <div>
                        <h3 className="text-sm font-medium">収集プラン</h3>
                        <p className="text-xs text-gray-600">
                          次回の収集予定: 2025年4月10日
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">実行単位</h3>
                        <p className="text-xs text-gray-600">
                          週次（毎週月曜日）
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">通知先</h3>
                        <p className="text-xs text-gray-600">
                          user@example.com
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium flex justify-between items-center">
                          <span>利用ツール</span>
                        </h3>
                        <ul className="text-xs text-gray-600 list-disc list-inside">
                          {mockPlanDetails.tools.map((tool, index) => (
                            <li key={index}>{tool}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium flex justify-between items-center">
                          <span>情報ソース</span>
                          <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleAddSource}>
                            <Plus className="h-3 w-3 mr-1" />
                            追加
                          </Button>
                        </h3>
                        <ul className="text-xs text-gray-600 list-disc list-inside">
                          {mockPlanDetails.sources.map((source) => (
                            <li key={source.id} className="flex items-start space-x-1 my-1">
                              <span className="truncate flex-1">{source.media}</span>
                              <a href={source.media} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                <ExternalLink className="h-3 w-3 text-blue-500" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
              <PanelResizeHandle className="w-1.5 bg-gray-200 hover:bg-blue-500 transition-colors duration-200 cursor-col-resize" />
            </>
          )}

          {/* 中央パネル: グラフビューワー */}
          <Panel id="main-panel" defaultSize={leftPanelCollapsed && !showAgentPanel ? 100 : 50}>
            <div className="h-full flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <div className="bg-white px-4 border-b flex justify-between items-center">
                  <TabsList>
                    <TabsTrigger value="knowledgeGraph">ナレッジグラフ</TabsTrigger>
                    <TabsTrigger value="summaryResults">要約結果</TabsTrigger>
                    <TabsTrigger value="notes">メモ</TabsTrigger>
                  </TabsList>
                  
                  {roleModelId !== 'default' && (
                    <div className="flex gap-2">
                      {hasKnowledgeGraph && (
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          エクスポート
                        </Button>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 text-xs whitespace-nowrap"
                          onClick={() => {
                            // CrewAIによるグラフ生成を開始
                            generateGraphMutation.mutate();
                            
                            // 3秒後に状態をチェック（正常ケースで早期リセット）
                            setTimeout(() => {
                              console.log("3秒後のチェック: ボタン状態のリセット確認");
                              if (isProcessing) {
                                if (progressUpdates.length > 0) {
                                  // 最後の進捗が100%なら処理完了と判断し状態をリセット
                                  const lastProgress = progressUpdates[progressUpdates.length - 1];
                                  if ((lastProgress.percent || 0) >= 100 || (lastProgress.status === 'completed')) {
                                    console.log("処理は完了しているようです - 強制リセット");
                                    forceResetProcessing();
                                  }
                                }
                              }
                            }, 3000);
                            
                            // 最大10秒後に強制的に処理中ステータスをリセット（安全策）
                            setTimeout(() => {
                              // バックアップ: 最大処理時間をオーバーした場合は強制的にリセット
                              if (isProcessing) {
                                console.log("10秒タイムアウト: 強制リセット - 進捗完了イベントを送信");
                                if (send) {
                                  send('progress', {
                                    roleModelId: roleModelId,
                                    stage: "完了",
                                    progress: 100,
                                    message: "処理が完了しました",
                                    details: { step: "completion" },
                                    status: "completed",
                                    percent: 100
                                  });
                                }
                                
                                // 直接リセット関数を呼び出す
                                forceResetProcessing();
                              }
                            }, 10000);
                          }}
                          disabled={generateGraphMutation.isPending || isProcessing}
                        >
                          <BrainCircuit className="h-3.5 w-3.5 mr-1" />
                          {generateGraphMutation.isPending || isProcessing ? '実行中...' : 'CrewAIでナレッジグラフと情報収集プランを生成'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs whitespace-nowrap"
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          CrewAIで情報収集プランを作成
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <TabsContent value="knowledgeGraph" className="flex-1 overflow-hidden p-0">
                  <div className="h-full relative">
                    {/* 知識グラフビューワー */}
                    <KnowledgeGraphViewer roleModelId={roleModelId} />
                  </div>
                </TabsContent>
                
                <TabsContent value="summaryResults" className="flex-1 overflow-auto p-4">
                  <div className="h-full">
                    <h3 className="text-lg font-medium mb-4">要約結果</h3>
                    <div className="bg-white rounded-lg border p-4">
                      <p className="text-gray-600 text-sm">
                        AIエージェント分析による要約結果がここに表示されます。
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="notes" className="flex-1 overflow-auto p-4">
                  <div className="h-full">
                    <h3 className="text-lg font-medium mb-4">メモ</h3>
                    <Textarea 
                      placeholder="重要なポイントのメモをここに残せます..." 
                      className="min-h-[300px] w-full"
                    />
                    
                    {/* 生成中の表示 */}
                    {isProcessing && (
                      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
                        <div className="animate-pulse flex gap-1">
                          <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
                          <div className="h-2 w-2 bg-blue-600 rounded-full animation-delay-200"></div>
                          <div className="h-2 w-2 bg-blue-600 rounded-full animation-delay-400"></div>
                        </div>
                        <span className="text-sm font-medium">処理中... {progressUpdates[progressUpdates.length - 1]?.percent || 0}%</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-500 hover:text-red-500"
                          onClick={() => {
                            // 処理のキャンセル
                            forceResetProcessing();
                            toast({
                              title: "処理をキャンセル",
                              description: "処理がキャンセルされました",
                              variant: "destructive"
                            });
                          }}
                          title="処理をキャンセル"
                        >
                          <Minimize2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </Panel>

          {/* 右側パネル: マルチAIエージェント会話パネル */}
          {showAgentPanel && (
            <>
              <PanelResizeHandle className="w-1.5 bg-gray-200 hover:bg-blue-500 transition-colors duration-200 cursor-col-resize" />
              <Panel 
                id="right-panel"
                defaultSize={30} 
                minSize={20} 
                className="border-l relative z-10"
                onResize={(size) => {
                  // パネルのサイズが10%以下になったら自動的に最小化
                  if (size < 8 && showAgentPanel) {
                    setShowAgentPanel(false);
                    toast({
                      title: "パネルを最小化",
                      description: "AIエージェント会話パネルを最小化しました"
                    });
                  }
                }}
              >
                <div className="h-full flex flex-col">
                  <div className="px-4 py-2 border-b flex justify-between items-center">
                    <h2 className="font-semibold text-sm">AIエージェントとの対話</h2>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 w-5 p-0" 
                      onClick={() => {
                        setShowAgentPanel(false);
                        toast({
                          title: "パネルを最小化",
                          description: "AIエージェント会話パネルを最小化しました"
                        });
                      }}
                      title="AIエージェントパネルを最小化"
                    >
                      <Minimize2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                      {agentThoughts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <div className="bg-blue-50 p-3 rounded-full mb-4">
                            <BrainCircuit size={40} className="text-blue-500" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">AIエージェント会話</h3>
                          <p className="text-gray-600">エージェントからのメッセージがここに表示されます</p>
                        </div>
                      ) : (
                        <div className="space-y-3 pb-4">
                          {agentThoughts.map((thought, index) => {
                            // エージェント名を分かりやすく変更
                            let displayName = thought.agentName || "AIエージェント";
                            let agentIcon = BrainCircuit;
                            let iconColorClass = "text-blue-500";
                            let bgColorClass = "bg-blue-100";
                            
                            // エージェント名によってカスタマイズ
                            if (displayName.includes("オーケストレーター") || displayName.includes("orchestrator")) {
                              displayName = "調整役";
                              iconColorClass = "text-purple-500";
                              bgColorClass = "bg-purple-100";
                            } else if (displayName.includes("ドメイン分析") || displayName.includes("domain_analyst")) {
                              displayName = "専門分析";
                              agentIcon = FileText;
                              iconColorClass = "text-blue-500";
                              bgColorClass = "bg-blue-100";
                            } else if (displayName.includes("トレンド調査") || displayName.includes("trend_researcher")) {
                              displayName = "トレンド調査";
                              agentIcon = Sparkles;
                              iconColorClass = "text-green-500";
                              bgColorClass = "bg-green-100";
                            } else if (displayName.includes("コンテキストマッパー") || displayName.includes("context_mapper")) {
                              displayName = "情報構造化";
                              agentIcon = RefreshCw;
                              iconColorClass = "text-orange-500";
                              bgColorClass = "bg-orange-100";
                            } else if (displayName.includes("プランストラテジスト") || displayName.includes("plan_strategist")) {
                              displayName = "計画立案";
                              agentIcon = FileText;
                              iconColorClass = "text-cyan-500";
                              bgColorClass = "bg-cyan-100";
                            } else if (displayName.includes("クリティカルシンカー") || displayName.includes("critical_thinker")) {
                              displayName = "評価検証";
                              agentIcon = RefreshCw;
                              iconColorClass = "text-red-500";
                              bgColorClass = "bg-red-100";
                            } else if (displayName.includes("デバッグ") || displayName.includes("debug")) {
                              displayName = "システム";
                              agentIcon = RefreshCw;
                              iconColorClass = "text-gray-500";
                              bgColorClass = "bg-gray-100";
                            }
                            
                            // メッセージの表示状態を決定（前のメッセージと同じエージェントからの場合はアイコンを省略）
                            const showAgentHeader = index === 0 || agentThoughts[index-1].agentName !== thought.agentName;
                            const messageType = thought.type || "thinking";
                            const messageText = thought.message || thought.thought || "";
                            
                            // メッセージの背景色
                            let messageBgClass = "bg-blue-50";
                            if (messageType === "success") messageBgClass = "bg-green-50";
                            else if (messageType === "error") messageBgClass = "bg-red-50";
                            
                            const IconComponent = agentIcon;
                            
                            return (
                              <div key={index} className="mb-4 animate-fadeIn">
                                <div className={`flex gap-3 ${showAgentHeader ? 'mt-4' : 'mt-2'}`}>
                                  {showAgentHeader && (
                                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${bgColorClass}`}>
                                      <IconComponent className={`h-4 w-4 ${iconColorClass}`} />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    {showAgentHeader && (
                                      <div className="flex items-center mb-1">
                                        <span className="font-medium text-sm">{displayName}</span>
                                        <span className="text-xs text-gray-500 ml-2">
                                          {new Date(thought.timestamp).toLocaleTimeString('ja-JP')}
                                        </span>
                                      </div>
                                    )}
                                    <div className={`p-3 rounded-lg text-sm ${messageBgClass}`}>
                                      {messageText}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 border-t sticky bottom-0 bg-white">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="メッセージを入力..."
                          className="min-h-[40px] resize-none text-sm flex-1"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                        />
                        <Button
                          size="icon"
                          onClick={() => {
                            if (userInput.trim() && roleModelId) {
                              handleSendMessage(userInput);
                              setUserInput('');
                            }
                          }}
                          disabled={!userInput.trim() || !roleModelId}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
};

export default InformationDashboard;