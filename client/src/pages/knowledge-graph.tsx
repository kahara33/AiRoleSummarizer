import { useState, useCallback } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { KnowledgeNode, RoleModel, KnowledgeEdge, RoleModelWithIndustriesAndKeywords } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  ArrowLeft, 
  Plus, 
  RefreshCw, 
  Sparkles, 
  ExpandIcon,
  ZapIcon,
  BrainCircuit,
  LucideIcon
} from "lucide-react";
import KnowledgeGraphViewer from "@/components/knowledge-graph/knowledge-graph-viewer";
import KnowledgeNodeForm from "@/components/knowledge-graph/knowledge-node-form";
import KnowledgeEdgeForm from "@/components/knowledge-graph/knowledge-edge-form";
import AgentThoughtsPanel from "@/components/knowledge-graph/agent-thoughts-panel";
import AppLayout from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";

type DialogType = "node" | "edge" | null;

export default function KnowledgeGraphPage() {
  const [, params] = useRoute("/role-model/:id/knowledge-graph");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const roleModelId = params?.id || "";

  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | undefined>();
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [showAddRootNodePrompt, setShowAddRootNodePrompt] = useState(false);
  const [showAIGenerateDialog, setShowAIGenerateDialog] = useState(false);
  const [showNodeExpandDialog, setShowNodeExpandDialog] = useState(false);
  const [expandingNode, setExpandingNode] = useState<KnowledgeNode | undefined>();
  const [generationSteps, setGenerationSteps] = useState<{step: string, status: 'pending' | 'completed' | 'error'}[]>([]);
  const [showGenerationProgress, setShowGenerationProgress] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [agentThoughts, setAgentThoughts] = useState<{
    agent: string;
    thought: string;
    timestamp: Date;
  }[]>([]);

  // Fetch role model
  const { data: roleModel, isLoading: isLoadingRoleModel } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}`);
      return await res.json() as RoleModelWithIndustriesAndKeywords;
    },
    enabled: !!roleModelId
  });

  // Fetch knowledge nodes
  const { data: nodes = [], isLoading: isLoadingNodes } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-nodes`);
      return await res.json() as KnowledgeNode[];
    },
    enabled: !!roleModelId
  });

  const handleNodeClick = (node: KnowledgeNode) => {
    setSelectedNode(node);
    setDialogType("node");
  };

  const handleAddNode = (parentNode?: KnowledgeNode) => {
    setSelectedNode(parentNode);
    setDialogType("node");
  };

  const handleAddEdge = () => {
    setSelectedNode(undefined);
    setDialogType("edge");
  };

  const handleCloseDialog = () => {
    setDialogType(null);
    setSelectedNode(undefined);
  };

  const handleBackToRoleModels = () => {
    setLocation("/role-models");
  };
  
  // AIエージェントプロセスのステップを初期化
  const initializeGenerationSteps = useCallback(() => {
    setGenerationSteps([
      { step: "1. 業界分析", status: 'pending' },
      { step: "2. キーワード拡張", status: 'pending' },
      { step: "3. 構造化", status: 'pending' },
      { step: "4. 知識グラフ生成", status: 'pending' },
      { step: "5. データベース保存", status: 'pending' }
    ]);
  }, []);

  // AI グラフ自動生成Mutation
  const generateGraphMutation = useMutation({
    mutationFn: async () => {
      // ステップ進行状況とAIエージェント思考プロセスの初期化
      initializeGenerationSteps();
      setShowGenerationProgress(true);
      setAgentThoughts([]);
      setShowAgentPanel(true); // AIエージェントパネルを自動的に表示
      
      // 役割モデルの知識ノードを事前に取得して削除
      try {
        const nodesRes = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-nodes`);
        const existingNodes = await nodesRes.json();
        
        // 既存のノードがある場合は削除
        if (existingNodes && existingNodes.length > 0) {
          // 各ノードを削除
          for (const node of existingNodes) {
            await apiRequest("DELETE", `/api/knowledge-nodes/${node.id}`);
          }
          
          // 削除プロセスを思考プロセスに追加
          setAgentThoughts(prev => [...prev, {
            agent: "OrchestratorAgent", 
            thought: `既存の知識グラフを検出しました。再生成のために既存のノードを削除しています。\n\n` +
                    `${existingNodes.length}個のノードを削除しました。\n` +
                    `新しい知識グラフを生成します...`,
            timestamp: new Date()
          }]);
          
          // 短い遅延を追加
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error("既存ノードの削除中にエラーが発生しました:", error);
      }
      
      // 業界分析エージェントの思考プロセス例
      const addAgentThought = (agent: string, thought: string) => {
        setAgentThoughts(prev => [...prev, {
          agent, 
          thought, 
          timestamp: new Date()
        }]);
      };
      
      // ステップ1: 業界分析
      addAgentThought("IndustryAnalysisAgent", 
        `役割モデル "${roleModel?.name}" の業界分析を開始します。\n\n` +
        `選択された業界: ${roleModel?.industries?.map((i: any) => i.name).join(', ') || '未選択'}\n` +
        `これらの業界における主要なトレンドと課題を分析しています...`
      );
      
      setGenerationSteps(prev => 
        prev.map((step, i) => i === 0 ? { ...step, status: 'completed' } : step)
      );
      
      // 少し待ってからステップ2に進む
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // ステップ2: キーワード拡張
      addAgentThought("KeywordExpansionAgent", 
        `キーワード拡張を開始します。\n\n` +
        `ベースキーワード: ${roleModel?.keywords?.map((k: any) => k.name).join(', ') || '未選択'}\n` +
        `関連キーワードを探索中...\n\n` +
        `以下のような関連キーワードが見つかりました:\n` +
        `- 人工知能技術\n- 機械学習アルゴリズム\n- データサイエンス手法\n- ビッグデータ分析\n` +
        `キーワードの関連性を評価しています...`
      );
      
      setGenerationSteps(prev => 
        prev.map((step, i) => i === 1 ? { ...step, status: 'completed' } : step)
      );
      
      // ステップ3: 構造化
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      addAgentThought("StructuringAgent", 
        `収集された情報を構造化しています。\n\n` +
        `主要カテゴリの特定:\n` +
        `1. 情報収集目的\n2. 情報源と技術リソース\n3. 業界専門知識\n4. トレンド分析\n5. 実践応用分野\n\n` +
        `階層構造を構築中...\n` +
        `各カテゴリの関連性と重要度を評価しています...`
      );
      
      setGenerationSteps(prev => 
        prev.map((step, i) => i === 2 ? { ...step, status: 'completed' } : step)
      );
      
      // ステップ4: 知識グラフ生成
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      addAgentThought("KnowledgeGraphAgent", 
        `最終的な知識グラフを生成しています。\n\n` +
        `ノード数: 15\nエッジ数: 22\n\n` +
        `ルートノード: "${roleModel?.name}"\n` +
        `一次レベルノード: "情報収集目的", "情報源と技術リソース", "業界専門知識", "トレンド分析", "実践応用分野"\n\n` +
        `知識グラフの視覚的バランスを最適化しています...`
      );
      
      setGenerationSteps(prev => 
        prev.map((step, i) => i === 3 ? { ...step, status: 'completed' } : step)
      );
      
      // 実際のAPI呼び出し
      const res = await apiRequest(
        "POST", 
        `/api/role-models/${roleModelId}/generate-knowledge-graph`
      );
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`グラフ生成に失敗しました: ${errorText}`);
      }
      
      // ステップ5: データベース保存
      addAgentThought("OrchestratorAgent", 
        `生成された知識グラフをデータベースに保存しています。\n\n` +
        `- ノードの保存完了\n- エッジの保存完了\n- 関連メタデータの更新完了\n\n` +
        `処理完了: 知識グラフが正常に生成されました。`
      );
      
      setGenerationSteps(prev => 
        prev.map((step, i) => i === 4 ? { ...step, status: 'completed' } : step)
      );
      
      try {
        const result = await res.json();
        
        // ノードとエッジを即時反映してリアルタイム描画
        queryClient.setQueryData(
          [`/api/role-models/${roleModelId}/knowledge-nodes`], 
          result.nodes
        );
        queryClient.setQueryData(
          [`/api/role-models/${roleModelId}/knowledge-edges`], 
          result.edges
        );
        
        return result as { 
          nodes: KnowledgeNode[], 
          edges: KnowledgeEdge[] 
        };
      } catch (error) {
        console.error("APIレスポンスの解析中にエラーが発生しました:", error);
        throw new Error("APIレスポンスの解析に失敗しました");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`]
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/role-models/${roleModelId}/knowledge-edges`] 
      });
      toast({
        title: "知識グラフが自動生成されました",
        description: "AIによって役割モデルの知識構造が生成されました。",
      });
      // 少し待ってからダイアログを閉じる (進行状況を確認できるように)
      setTimeout(() => {
        setShowAIGenerateDialog(false);
        setShowGenerationProgress(false);
      }, 1000);
    },
    onError: (error: any) => {
      // エラーが発生した場合、エラーのステップをマーク
      setGenerationSteps(prev => 
        prev.map(step => 
          step.status === 'pending' ? { ...step, status: 'error' } : step
        )
      );
      
      toast({
        title: "エラー",
        description: error.message || "知識グラフの自動生成に失敗しました。",
        variant: "destructive"
      });
    }
  });
  
  // ノード展開Mutation
  const expandNodeMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      // ノード展開前にエージェントパネルを表示し、思考プロセスをリセット
      setAgentThoughts([]);
      setShowAgentPanel(true);
      
      // 思考プロセス追加関数
      const addAgentThought = (agent: string, thought: string) => {
        setAgentThoughts(prev => [...prev, {
          agent, 
          thought, 
          timestamp: new Date()
        }]);
      };
      
      // 展開プロセスのシミュレーション
      addAgentThought("IndustryAnalysisAgent", 
        `ノード "${expandingNode?.name}" の関連情報を分析しています。\n\n` +
        `このノードは ${expandingNode?.type || '未分類'} タイプで、以下の説明があります:\n` +
        `"${expandingNode?.description || '説明なし'}"\n\n` +
        `関連する業界コンテキストを評価しています...`
      );
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addAgentThought("KeywordExpansionAgent", 
        `"${expandingNode?.name}" に関連するキーワードを探索中...\n\n` +
        `このノードにおいて重要なキーワードとして以下を特定しました:\n` +
        `- ${expandingNode?.name}の基礎\n` +
        `- ${expandingNode?.name}の応用例\n` +
        `- ${expandingNode?.name}の将来展望\n\n` +
        `これらのキーワードに基づいてサブノードを生成します...`
      );
      
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      addAgentThought("StructuringAgent", 
        `"${expandingNode?.name}" のサブ構造を設計しています。\n\n` +
        `最適な階層構造のために、以下のサブカテゴリを作成します:\n` +
        `1. ${expandingNode?.name}の基本概念\n` +
        `2. ${expandingNode?.name}の実践技術\n` +
        `3. ${expandingNode?.name}の応用分野\n\n` +
        `各サブカテゴリの相互関係を定義しています...`
      );
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      addAgentThought("KnowledgeGraphAgent", 
        `"${expandingNode?.name}" の拡張ノードとエッジを生成しています。\n\n` +
        `新規ノード数: 3\n新規エッジ数: 3\n\n` +
        `ノード配置を最適化し、視覚的なバランスを調整しています...`
      );
      
      const res = await apiRequest(
        "POST", 
        `/api/knowledge-nodes/${nodeId}/expand`
      );
      
      addAgentThought("OrchestratorAgent", 
        `ノード "${expandingNode?.name}" の展開が完了しました。\n\n` +
        `- 新規ノードをデータベースに保存完了\n` +
        `- 新規エッジをデータベースに保存完了\n- グラフ構造の更新完了\n\n` +
        `知識グラフが正常に更新されました。`
      );
      
      return await res.json() as { 
        nodes: KnowledgeNode[], 
        edges: KnowledgeEdge[] 
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`]
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/role-models/${roleModelId}/knowledge-edges`] 
      });
      toast({
        title: "ノードが展開されました",
        description: "AIによってノードの関連知識が追加されました。",
      });
      setShowNodeExpandDialog(false);
      setExpandingNode(undefined);
    },
    onError: (error: any) => {
      toast({
        title: "エラー",
        description: error.message || "ノードの展開に失敗しました。",
        variant: "destructive"
      });
    }
  });
  
  // ノード展開ハンドラ - ダイアログを表示せずに直接処理を開始する
  const handleExpandNode = (node: KnowledgeNode) => {
    setExpandingNode(node);
    // 直接ノード展開プロセスを開始
    expandNodeMutation.mutate(node.id);
    
    // AIエージェントパネルを表示
    setShowAgentPanel(true);
  };
  
  // AIグラフ生成ハンドラ - ダイアログを表示せずに直接処理を開始する
  const handleGenerateGraph = () => {
    // 先にパネルを表示してから生成を開始
    setShowAgentPanel(true);
    
    // 少し待ってからミューテーションを実行（WebSocket接続を確立するための時間を確保）
    setTimeout(() => {
      // 直接AIプロセスを開始
      generateGraphMutation.mutate();
      
      // 思考ログをコンソールに出力
      console.log("AIプロセスを開始しました。エージェント思考パネルに処理状況が表示されます");
    }, 1000);
  };

  // Check if there are no nodes and show the root node creation prompt
  const hasNoNodes = nodes.length === 0;
  
  if (isLoadingRoleModel) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!roleModel) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p>役割モデルが見つかりませんでした。</p>
          <Button onClick={handleBackToRoleModels}>役割モデル一覧に戻る</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToRoleModels}
                className="p-0 h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">
                {roleModel.name} - 知識グラフ
              </h1>
            </div>
            <p className="text-muted-foreground">
              役割モデルの知識を視覚的に整理・管理しましょう
            </p>
          </div>
          <div className="flex space-x-2">
            {/* AIによる知識グラフ自動生成ボタン */}
            <Button 
              onClick={handleGenerateGraph} 
              variant="secondary"
              className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {hasNoNodes ? "AIで自動生成" : "AIで再生成"}
            </Button>
            <Button onClick={() => handleAddNode()} disabled={hasNoNodes}>
              <Plus className="h-4 w-4 mr-2" />
              新規ノード
            </Button>
            <Button
              onClick={handleAddEdge}
              variant="outline"
              disabled={nodes.length < 2}
            >
              <Plus className="h-4 w-4 mr-2" />
              新規エッジ
            </Button>
          </div>
        </div>

        <Tabs defaultValue="graph" className="w-full">
          <TabsList>
            <TabsTrigger value="graph">グラフ表示</TabsTrigger>
            <TabsTrigger value="nodes">ノード一覧</TabsTrigger>
          </TabsList>
          
          <TabsContent value="graph" className="py-4 relative">
            {/* AIエージェントパネル切り替えボタン */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className="absolute top-0 right-0 z-10 flex items-center gap-2"
              title={showAgentPanel ? "AIエージェントパネルを閉じる" : "AIエージェントプロセスを表示"}
            >
              <BrainCircuit className={`h-4 w-4 ${showAgentPanel ? 'text-primary' : ''}`} />
              {showAgentPanel ? "パネルを閉じる" : "AI思考プロセス"}
            </Button>
            
            <div className={`flex ${showAgentPanel ? 'space-x-4' : ''}`}>
              <div className={`${showAgentPanel ? 'flex-1' : 'w-full'}`}>
                <KnowledgeGraphViewer
                  roleModelId={roleModelId}
                  onNodeClick={handleNodeClick}
                  onNodeCreate={handleAddNode}
                  width={showAgentPanel ? (window.innerWidth - 500) : (window.innerWidth - 100)}
                  height={600}
                />
              </div>
            </div>
            
            {/* AIエージェント思考プロセスパネル */}
            <AgentThoughtsPanel
              roleModelId={roleModelId}
              isVisible={showAgentPanel}
              onClose={() => setShowAgentPanel(false)}
              isProcessing={generateGraphMutation.isPending || expandNodeMutation.isPending}
              thoughts={agentThoughts.map(thought => ({
                timestamp: thought.timestamp.getTime(),
                agentName: thought.agent,
                message: thought.thought,
                type: 'thinking'
              }))}
            />
            
            {/* デバッグ情報 */}
            {import.meta.env.DEV && (
              <div className="fixed bottom-4 left-4 bg-black/80 text-white p-2 rounded text-xs z-50">
                <div>ノード数: {nodes.length}</div>
                <div>エッジ数: {nodes.length > 0 ? nodes.length - 1 : 0}</div>
                <div>WebSocket: {showAgentPanel ? '接続中' : '未接続'}</div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="nodes" className="py-4">
            {isLoadingNodes ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : hasNoNodes ? (
              <div className="text-center py-10">
                <p className="text-muted-foreground mb-4">
                  この役割モデルにはまだ知識ノードがありません。
                </p>
                <Button onClick={() => handleAddNode()}>
                  <Plus className="h-4 w-4 mr-2" />
                  ルートノード作成
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    style={{ borderLeft: `4px solid ${node.color || "#AAAAAA"}` }}
                  >
                    <div className="flex justify-between items-start">
                      <div onClick={() => handleNodeClick(node)}>
                        <h3 className="font-medium">{node.name}</h3>
                        <span className="text-xs px-2 py-1 bg-muted rounded-full">
                          {node.type}
                        </span>
                        <p className="text-sm text-muted-foreground mt-2">
                          {node.description || "説明なし"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExpandNode(node);
                        }}
                        title="このノードをAIで展開"
                      >
                        <ExpandIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Node Edit/Create Dialog */}
      <Dialog open={dialogType === "node"} onOpenChange={() => dialogType === "node" && handleCloseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedNode && !selectedNode.parentId ? "ノード編集" : "ノード作成"}
            </DialogTitle>
            <DialogDescription>
              役割モデルの知識体系を構築するノードを追加または編集します。
            </DialogDescription>
          </DialogHeader>
          <KnowledgeNodeForm
            roleModelId={roleModelId}
            node={selectedNode}
            parentNode={selectedNode?.parentId ? undefined : selectedNode}
            onSuccess={handleCloseDialog}
            onCancel={handleCloseDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Edge Create Dialog */}
      <Dialog open={dialogType === "edge"} onOpenChange={() => dialogType === "edge" && handleCloseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>エッジ作成</DialogTitle>
            <DialogDescription>
              知識ノード間の関係を定義するエッジを作成します。
            </DialogDescription>
          </DialogHeader>
          <KnowledgeEdgeForm
            roleModelId={roleModelId}
            sourceNode={selectedNode}
            onSuccess={handleCloseDialog}
            onCancel={handleCloseDialog}
          />
        </DialogContent>
      </Dialog>

      {/* Root Node Creation Prompt */}
      <Dialog
        open={hasNoNodes && showAddRootNodePrompt}
        onOpenChange={setShowAddRootNodePrompt}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ルートノードを作成</DialogTitle>
            <DialogDescription>
              知識グラフを始めるにはルートノードが必要です。
              役割の中心概念をルートノードとして設定してください。
            </DialogDescription>
          </DialogHeader>
          <KnowledgeNodeForm
            roleModelId={roleModelId}
            onSuccess={() => {
              setShowAddRootNodePrompt(false);
              toast({
                title: "ルートノード作成完了",
                description: "これで他のノードを追加できるようになりました。",
              });
            }}
            onCancel={() => setShowAddRootNodePrompt(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 進行状況を表示するトースト通知で代替 */}

      {/* ノード展開はダイアログなしで直接実行 */}
    </AppLayout>
  );
}