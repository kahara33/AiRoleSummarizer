import { useCallback, useEffect, useState, useRef } from "react";
import { KnowledgeNode, KnowledgeEdge } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Edit, Trash, MessageSquarePlus, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import ForceGraph from "react-force-graph-2d";
import * as d3 from 'd3-force';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuSeparator
} from "@/components/ui/context-menu";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

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
  source: any;
  target: any;
  label?: string;
  strength?: number;
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
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextMenuNode, setContextMenuNode] = useState<GraphNode | null>(null);
  const [showNodeSizeDialog, setShowNodeSizeDialog] = useState(false);
  const [selectedNodeForSize, setSelectedNodeForSize] = useState<GraphNode | null>(null);
  const [nodeSizeValue, setNodeSizeValue] = useState<number>(10);
  const [showChatPromptDialog, setShowChatPromptDialog] = useState(false);
  const [chatPrompt, setChatPrompt] = useState("");
  
  const graphRef = useRef<any>();

  // グラフデータの取得
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch knowledge nodes
      const nodesRes = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-nodes`);
      const knowledgeNodes: KnowledgeNode[] = await nodesRes.json();
      
      // Fetch knowledge edges
      const edgesRes = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-edges`);
      const knowledgeEdges: KnowledgeEdge[] = await edgesRes.json();
      
      // Transform to graph format
      const graphNodes: GraphNode[] = knowledgeNodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        level: node.level,
        color: node.color || getNodeColor(node.type),
        parentId: node.parentId || null,
        description: node.description,
        val: node.level === 0 ? 20 : (3 - Math.min(node.level, 3)) * 5 // 重要度によってサイズを変更
      }));
      
      const graphLinks: GraphLink[] = [
        // Add parent-child links
        ...graphNodes
          .filter(node => node.parentId)
          .map(node => ({
            id: `parent-${node.id}`,
            source: node.parentId!,
            target: node.id,
            label: "CONTAINS"
          })),
        
        // Add explicit edge links
        ...knowledgeEdges.map(edge => ({
          id: edge.id,
          source: edge.sourceId,
          target: edge.targetId,
          label: edge.label || "RELATED_TO",
          strength: edge.strength
        }))
      ];
      
      setNodes(graphNodes);
      setLinks(graphLinks);
    } catch (e) {
      console.error("Error fetching knowledge graph data:", e);
      setError("知識グラフデータの取得に失敗しました。後でもう一度お試しください。");
      toast({
        title: "エラー",
        description: "知識グラフデータの取得に失敗しました。",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [roleModelId]);

  // 初回データ取得
  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);
  
  // ノードの階層構造に基づいて座標を設定する処理
  useEffect(() => {
    if (nodes.length === 0 || !graphRef.current) return;
    
    // ルートノードを中心に配置
    const rootNode = nodes.find(n => n.level === 0);
    if (rootNode) {
      rootNode.fx = width / 2;
      rootNode.fy = height / 3;
    }
    
    // カスタム階層型フォースレイアウトを適用
    const simulation = graphRef.current.d3Force();
    
    // 既存のフォースをクリア
    simulation.force('link', null);
    simulation.force('charge', null);
    simulation.force('center', null);
    
    // 階層ごとに垂直方向に配置するフォース
    simulation.force('y', d3.forceY().y((d: any) => {
      const levelMultiplier = 120; // レベル間の垂直距離
      return height / 3 + (d.level * levelMultiplier);
    }).strength(0.8));
    
    // 同じレベルのノードを水平方向に広げるフォース
    simulation.force('x', d3.forceX().x((d: any) => {
      if (d.level === 0) return width / 2; // ルートノードは中央
      // 親ノードのx座標を基準に配置
      const parent = nodes.find(n => n.id === d.parentId);
      return parent && typeof parent.x === 'number' ? parent.x : width / 2;
    }).strength(0.3));
    
    // 同じレベルのノード同士が重ならないようにする
    simulation.force('collision', d3.forceCollide().radius((d: any) => 30 + (d.val || 10)));
    
    // より強いリンク制約を設定
    simulation.force('link', d3.forceLink(links)
      .id((d: any) => d.id)
      .distance((link: any) => {
        // 親子関係のリンクは距離を短く
        if (link.label === "CONTAINS") return 100;
        // その他の関係は距離を長く
        return 200;
      })
      .strength(0.7)
    );
    
    // グラフを再加熱して新しい力を適用
    simulation.alpha(1).restart();
  }, [nodes, links, width, height]);

  // ノードの右クリックハンドラ
  const handleNodeRightClick = useCallback((node: GraphNode) => {
    setContextMenuNode(node);
  }, []);

  // ノードクリックハンドラ
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (!onNodeClick) return;
    
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
    onNodeClick(knowledgeNode);
  }, [onNodeClick, roleModelId]);
  
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
        fetchGraphData();
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
  }, [chatPrompt, fetchGraphData, roleModelId]);

  // ノードサイズ変更ハンドラ
  const handleNodeSizeChange = useCallback(async (nodeId: string, newSize: number) => {
    try {
      // APIリクエストでノードサイズを更新
      const res = await apiRequest("PATCH", `/api/knowledge-nodes/${nodeId}`, {
        importance: newSize
      });
      
      if (res.ok) {
        // 現在のノードを更新
        setNodes(prevNodes => 
          prevNodes.map(node => 
            node.id === nodeId 
              ? { ...node, val: newSize } 
              : node
          )
        );
        
        toast({
          title: "更新完了",
          description: "ノードの重要度を更新しました"
        });
      } else {
        toast({
          title: "エラー",
          description: "ノードの重要度の更新に失敗しました",
          variant: "destructive"
        });
      }
    } catch (e) {
      console.error("Error updating node size:", e);
      toast({
        title: "エラー",
        description: "ノードサイズの更新に失敗しました",
        variant: "destructive"
      });
    } finally {
      setShowNodeSizeDialog(false);
      setSelectedNodeForSize(null);
    }
  }, []);
  
  // 親ノードに子ノードを追加
  const handleAddChildNode = useCallback((parentNode: GraphNode) => {
    if (onNodeCreate) {
      // 親ノードのKnowledgeNode形式に変換
      const knowledgeParentNode: KnowledgeNode = {
        id: parentNode.id,
        name: parentNode.name,
        type: parentNode.type,
        level: parentNode.level,
        color: parentNode.color,
        parentId: parentNode.parentId,
        roleModelId,
        description: parentNode.description || null,
        createdAt: new Date()
      };
      onNodeCreate(knowledgeParentNode);
    }
  }, [onNodeCreate, roleModelId]);
  
  // ノード展開ハンドラ
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
    } else {
      toast({
        title: "情報",
        description: "ノード展開ハンドラが設定されていません",
      });
    }
  }, [onNodeExpand, roleModelId]);

  // 新規ノード作成ハンドラ
  const handleCreateNodeClick = useCallback(() => {
    if (onNodeCreate) {
      onNodeCreate();
    }
  }, [onNodeCreate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={fetchGraphData}>再試行</Button>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">この役割モデルにはまだ知識ノードがありません。</p>
        <Button onClick={handleCreateNodeClick}>ルートノードを作成</Button>
      </div>
    );
  }

  // Mapify風のマインドマップビューを表示
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="relative border rounded-lg">
          <div className="absolute top-4 right-4 z-10 flex space-x-2">
            <Button size="sm" onClick={() => setShowChatPromptDialog(true)}>
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              チャット指示
            </Button>
            <Button size="sm" onClick={handleCreateNodeClick}>
              <Plus className="h-4 w-4 mr-2" /> 
              ノード追加
            </Button>
            <Button size="sm" variant="outline" onClick={fetchGraphData}>更新</Button>
          </div>
          
          <ForceGraph
            ref={graphRef}
            graphData={{ nodes, links }}
            nodeId="id"
            nodeVal="val"
            nodeLabel="name"
            nodeColor={(node: any) => node.color || getNodeColor(node.type)}
            nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
              const { id, name, color, val = 10 } = node as GraphNode;
              const fontSize = val * 0.3; // ノードの大きさに応じたフォントサイズ
              const radius = val * 0.6; // ノードの大きさに応じた半径
              
              // ノードの描画
              ctx.beginPath();
              ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI);
              ctx.fillStyle = color || getNodeColor((node as GraphNode).type);
              ctx.fill();
              
              // テキストの描画
              ctx.font = `${fontSize}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#FFF';
              // 長いノード名を適切に表示する
              const displayName = name.length > 10 ? name.substring(0, 10) + '...' : name;
              ctx.fillText(displayName, node.x || 0, node.y || 0);
              
              // ホバー時のノード情報を表示
              if ((node as any).__hover) {
                const boxPadding = 5;
                const textWidth = ctx.measureText(name).width;
                const boxWidth = textWidth + (boxPadding * 2);
                const boxHeight = fontSize + (boxPadding * 2);
                
                // 情報ボックスの背景
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(
                  (node.x || 0) - boxWidth / 2,
                  (node.y || 0) - radius - boxHeight - 5,
                  boxWidth,
                  boxHeight
                );
                
                // ノード名の表示
                ctx.fillStyle = 'white';
                ctx.fillText(
                  name,
                  node.x || 0,
                  (node.y || 0) - radius - 5 - boxHeight / 2
                );
              }
            }}
            onNodeHover={(node: any) => {
              if (node) {
                (node as any).__hover = true;
              }
              // 前回ホバーしていたノードの__hoverフラグをリセット
              nodes.forEach(n => {
                if (n.id !== node?.id) {
                  (n as any).__hover = false;
                }
              });
            }}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={3}
            linkWidth={(link) => (link.label === "CONTAINS") ? 2 : 1}
            linkColor={(link) => (link.label === "CONTAINS") ? '#77AADD' : '#BBBBBB'}
            linkCurvature={(link) => (link.label === "CONTAINS") ? 0 : 0.25}
            width={width}
            height={height}
            cooldownTicks={50}
          />
        </div>
      </ContextMenuTrigger>
      
      {/* 右クリックメニュー */}
      <ContextMenuContent>
        {contextMenuNode && (
          <>
            <ContextMenuItem onClick={() => handleNodeClick(contextMenuNode)}>
              <Edit className="h-4 w-4 mr-2" />
              編集
            </ContextMenuItem>
            
            <ContextMenuItem onClick={() => {
              setSelectedNodeForSize(contextMenuNode);
              setNodeSizeValue(contextMenuNode.val || 10);
              setShowNodeSizeDialog(true);
            }}>
              <ZoomIn className="h-4 w-4 mr-2" />
              重要度を変更
            </ContextMenuItem>
            
            <ContextMenuItem onClick={() => handleAddChildNode(contextMenuNode)}>
              <Plus className="h-4 w-4 mr-2" />
              子ノードを追加
            </ContextMenuItem>
            
            <ContextMenuItem onClick={() => handleExpandNodeWithAI(contextMenuNode)}>
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              AIで展開
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
      
      {/* ノード重要度変更ダイアログ */}
      <Dialog open={showNodeSizeDialog} onOpenChange={setShowNodeSizeDialog}>
        <DialogContent className="max-w-md">
          <DialogTitle>ノードの重要度を設定</DialogTitle>
          <div className="py-4">
            {selectedNodeForSize && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="nodeSize">重要度: {nodeSizeValue}</Label>
                  <span className="text-muted-foreground text-sm">
                    (1 = 最小, 20 = 最大)
                  </span>
                </div>
                <Slider 
                  id="nodeSize"
                  min={1} 
                  max={20} 
                  step={1}
                  value={[nodeSizeValue]} 
                  onValueChange={([value]) => setNodeSizeValue(value)} 
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNodeSizeDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={() => selectedNodeForSize && handleNodeSizeChange(selectedNodeForSize.id, nodeSizeValue)}>
              適用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* チャット指示ダイアログ */}
      <Dialog open={showChatPromptDialog} onOpenChange={setShowChatPromptDialog}>
        <DialogContent className="max-w-md">
          <DialogTitle>チャット指示でグラフを更新</DialogTitle>
          <div className="py-4">
            <div className="space-y-4">
              <Label htmlFor="chatPrompt">指示内容</Label>
              <Textarea
                id="chatPrompt"
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                placeholder="例: 「AIエンジニアにDeep Learningの知識を追加して」「データサイエンスとの関連性を追加」"
                className="min-h-32"
              />
              <p className="text-sm text-muted-foreground">
                自然言語の指示でナレッジグラフを更新できます。新しいノードの追加や関連付けの作成などを指示できます。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChatPromptDialog(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={handleChatPromptSubmit}
              disabled={!chatPrompt.trim()}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700"
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContextMenu>
  );
}