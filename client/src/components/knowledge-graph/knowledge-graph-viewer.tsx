import { useCallback, useEffect, useState, useRef } from "react";
import { KnowledgeNode, KnowledgeEdge, InsertKnowledgeNode } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Edit, Trash, MessageSquarePlus, ZoomIn, ZoomOut, ArrowRight, CornerDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuSeparator,
  ContextMenuRadioGroup,
  ContextMenuRadioItem
} from "@/components/ui/context-menu";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

// 新しいReactFlowベースのコンポーネントをインポート
import ReactFlowKnowledgeGraph from './ReactFlowKnowledgeGraph';
// ReactFlowProviderは必要ないので削除

interface KnowledgeGraphViewerProps {
  roleModelId: string;
  onNodeClick?: (node: KnowledgeNode) => void;
  onNodeCreate?: (parentNode?: KnowledgeNode) => void;
  onNodeExpand?: (node: KnowledgeNode) => void;
  width?: number;
  height?: number;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  level: number;
  color: string | null;
  parentId: string | null;
  description?: string | null;
  // 追加のフォーマット用プロパティ
  val?: number; // ノードの大きさ (重要度)
  x?: number;   // x座標
  y?: number;   // y座標
  fx?: number;  // 固定x座標
  fy?: number;  // 固定y座標
}

interface GraphLink {
  id: string;
  source: string | any; // サーバー側の応答に柔軟に対応
  target: string | any; // サーバー側の応答に柔軟に対応
  label?: string;
  strength?: number | undefined; // null値に対応
}

// ノードタイプに基づく色の取得
function getNodeColor(type: string): string {
  switch (type) {
    case "root":
      return "#FF5733"; // 赤っぽい色
    case "concept":
      return "#33A8FF"; // 青っぽい色
    case "keyword":
      return "#33FF57"; // 緑っぽい色
    case "tool":
      return "#A833FF"; // 紫っぽい色
    default:
      return "#AAAAAA"; // デフォルトグレー
  }
}

export default function KnowledgeGraphViewer({
  roleModelId,
  onNodeClick,
  onNodeCreate,
  onNodeExpand,
  width = 800,
  height = 600
}: KnowledgeGraphViewerProps) {
  // コンテキストメニュー関連のステートは保持
  const [contextMenuNode, setContextMenuNode] = useState<GraphNode | null>(null);
  const [showNodeSizeDialog, setShowNodeSizeDialog] = useState(false);
  const [selectedNodeForSize, setSelectedNodeForSize] = useState<GraphNode | null>(null);
  const [nodeSizeValue, setNodeSizeValue] = useState<number>(10);
  const [showChatPromptDialog, setShowChatPromptDialog] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // チャットプロンプトの送信ハンドラ
  const handleChatPromptSubmit = useCallback(async () => {
    try {
      toast({
        title: "更新中...",
        description: "チャット指示に基づいて知識グラフを更新しています"
      });
      
      // チャット指示でグラフ更新
      const res = await apiRequest("POST", `/api/role-models/${roleModelId}/update-by-chat`, {
        prompt: chatPrompt
      });
      
      if (res.ok) {
        toast({
          title: "更新完了",
          description: "チャット指示に基づいて知識グラフが更新されました"
        });
        
        // クエリの無効化でデータを再取得
        queryClient.invalidateQueries({ queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`] });
        queryClient.invalidateQueries({ queryKey: [`/api/role-models/${roleModelId}/knowledge-edges`] });
      } else {
        toast({
          title: "エラー",
          description: "更新に失敗しました",
          variant: "destructive"
        });
      }
    } catch (e) {
      console.error("Error updating graph:", e);
      toast({
        title: "エラー",
        description: "チャット指示による更新に失敗しました",
        variant: "destructive"
      });
    } finally {
      setShowChatPromptDialog(false);
      setChatPrompt("");
    }
  }, [chatPrompt, roleModelId]);

  // ノードの展開ハンドラ
  const handleExpandNodeWithAI = useCallback((node: GraphNode) => {
    if (onNodeExpand) {
      // KnowledgeNode型に変換してコールバックを呼び出す
      const knowledgeNode: KnowledgeNode = {
        id: node.id,
        name: node.name,
        type: node.type,
        level: node.level,
        color: node.color || null,
        parentId: node.parentId || null,
        roleModelId,
        description: node.description || null,
        createdAt: new Date()
      };
      onNodeExpand(knowledgeNode);
    }
  }, [onNodeExpand, roleModelId]);
  
  // ルートノード作成ハンドラ
  const handleCreateNodeClick = useCallback(() => {
    if (onNodeCreate) {
      onNodeCreate();
    }
  }, [onNodeCreate]);

  // ローディング表示
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={() => {
          // クエリの無効化でデータを再取得
          queryClient.invalidateQueries({ queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`] });
          queryClient.invalidateQueries({ queryKey: [`/api/role-models/${roleModelId}/knowledge-edges`] });
        }}>再試行</Button>
      </div>
    );
  }

  // 新しいReactFlowベースのビューを表示
  const { data: nodes = [] } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-nodes`);
      return await res.json() as KnowledgeNode[];
    },
    enabled: !!roleModelId
  });

  console.log('ノード数:', nodes.length);

  return (
    <>
      <div className="relative">
        <div className="absolute top-4 right-4 z-10 flex space-x-2">
          <Button size="sm" onClick={() => setShowChatPromptDialog(true)}>
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            チャット指示
          </Button>
        </div>

        {nodes.length === 0 ? (
          <div className="flex items-center justify-center" style={{ width, height }}>
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p>知識グラフデータを読み込み中...</p>
              <p className="text-xs text-muted-foreground mt-2">
                データが表示されない場合は、「AI解析結果」タブで処理を実行してください
              </p>
            </div>
          </div>
        ) : (
          <ReactFlowKnowledgeGraph
            roleModelId={roleModelId}
            onNodeClick={onNodeClick}
            onNodeCreate={onNodeCreate}
            onNodeExpand={onNodeExpand}
            width={width}
            height={height}
          />
        )}
      </div>
    
      {/* チャットプロンプトダイアログ */}
      <Dialog open={showChatPromptDialog} onOpenChange={setShowChatPromptDialog}>
        <DialogContent>
          <DialogTitle>チャット指示</DialogTitle>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chatPrompt">知識グラフの更新指示</Label>
              <Textarea
                id="chatPrompt"
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                placeholder="例: 「AIの倫理について追加してください」「DXの最新トレンドを追加」など"
                className="h-32"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChatPromptDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={handleChatPromptSubmit}>更新</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}