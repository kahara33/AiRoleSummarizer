import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { KnowledgeNode, RoleModel, KnowledgeEdge } from "@shared/schema";
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
  ZapIcon 
} from "lucide-react";
import KnowledgeGraphViewer from "@/components/knowledge-graph/knowledge-graph-viewer";
import KnowledgeNodeForm from "@/components/knowledge-graph/knowledge-node-form";
import KnowledgeEdgeForm from "@/components/knowledge-graph/knowledge-edge-form";
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

  // Fetch role model
  const { data: roleModel, isLoading: isLoadingRoleModel } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}`);
      return await res.json() as RoleModel;
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
    window.location.href = "/role-models";
  };
  
  // AI グラフ自動生成Mutation
  const generateGraphMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST", 
        `/api/role-models/${roleModelId}/generate-knowledge-graph`
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
        title: "知識グラフが自動生成されました",
        description: "AIによって役割モデルの知識構造が生成されました。",
      });
      setShowAIGenerateDialog(false);
    },
    onError: (error: any) => {
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
      const res = await apiRequest(
        "POST", 
        `/api/knowledge-nodes/${nodeId}/expand`
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
  
  // ノード展開ハンドラ
  const handleExpandNode = (node: KnowledgeNode) => {
    setExpandingNode(node);
    setShowNodeExpandDialog(true);
  };
  
  // AIグラフ生成ハンドラ
  const handleGenerateGraph = () => {
    setShowAIGenerateDialog(true);
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
            {hasNoNodes && (
              <Button 
                onClick={handleGenerateGraph} 
                variant="secondary"
                className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AIで自動生成
              </Button>
            )}
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
          
          <TabsContent value="graph" className="py-4">
            <KnowledgeGraphViewer
              roleModelId={roleModelId}
              onNodeClick={handleNodeClick}
              onNodeCreate={handleAddNode}
              width={window.innerWidth - 100}
              height={600}
            />
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

      {/* AI Graph Generation Dialog */}
      <Dialog
        open={showAIGenerateDialog}
        onOpenChange={setShowAIGenerateDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AIによる知識グラフ自動生成</DialogTitle>
            <DialogDescription>
              Azure OpenAI APIを利用して、この役割モデルに適した知識グラフを自動生成します。
              生成されたグラフはいつでも編集や拡張が可能です。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              役割名: <span className="font-medium text-foreground">{roleModel.name}</span>
            </p>
            {roleModel.description && (
              <p className="text-sm text-muted-foreground">
                役割の説明: <span className="font-medium text-foreground">{roleModel.description}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAIGenerateDialog(false)}
            >
              キャンセル
            </Button>
            <Button
              onClick={() => generateGraphMutation.mutate()}
              disabled={generateGraphMutation.isPending}
              className="bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600"
            >
              {generateGraphMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  自動生成する
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Node Expansion Dialog */}
      <Dialog
        open={showNodeExpandDialog}
        onOpenChange={setShowNodeExpandDialog}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ノード展開</DialogTitle>
            <DialogDescription>
              AIを使用して選択したノードを展開し、関連する新しいサブノードを生成します。
            </DialogDescription>
          </DialogHeader>
          {expandingNode && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground mb-2">
                展開するノード:
              </p>
              <div 
                className="border rounded-lg p-4 mb-4"
                style={{ borderLeft: `4px solid ${expandingNode.color || "#AAAAAA"}` }}
              >
                <h3 className="font-medium">{expandingNode.name}</h3>
                <span className="text-xs px-2 py-1 bg-muted rounded-full">
                  {expandingNode.type}
                </span>
                <p className="text-sm text-muted-foreground mt-2">
                  {expandingNode.description || "説明なし"}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                このノードに関連する新しいサブノードをAIが自動的に生成します。
              </p>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNodeExpandDialog(false);
                setExpandingNode(undefined);
              }}
            >
              キャンセル
            </Button>
            <Button
              onClick={() => expandingNode && expandNodeMutation.mutate(expandingNode.id)}
              disabled={expandNodeMutation.isPending || !expandingNode}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
            >
              {expandNodeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  展開中...
                </>
              ) : (
                <>
                  <ExpandIcon className="h-4 w-4 mr-2" />
                  ノードを展開する
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}