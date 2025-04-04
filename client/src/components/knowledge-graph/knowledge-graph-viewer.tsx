import { useCallback, useEffect, useState, useRef } from "react";
import { KnowledgeNode, KnowledgeEdge, InsertKnowledgeNode } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Edit, Trash, MessageSquarePlus, ZoomIn, ZoomOut, ArrowRight, CornerDownRight } from "lucide-react";
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
  ContextMenuSeparator,
  ContextMenuRadioGroup,
  ContextMenuRadioItem
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
  const [inlineNodeName, setInlineNodeName] = useState("");
  const [editingNode, setEditingNode] = useState<{
    parent: GraphNode | null;
    isSibling: boolean;
    position: { x: number, y: number }
  } | null>(null);
  
  // 新しいノードのアニメーションのためのステート
  const [visibleNodes, setVisibleNodes] = useState<GraphNode[]>([]);
  const [visibleLinks, setVisibleLinks] = useState<GraphLink[]>([]);
  const [animationInProgress, setAnimationInProgress] = useState(false);
  const [animationQueue, setAnimationQueue] = useState<{nodes: GraphNode[], links: GraphLink[]}>({ nodes: [], links: [] });
  
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
      
      console.log("Loaded knowledge nodes:", graphNodes.length);
      
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
          source: edge.sourceId || "", // サーバー側の応答フィールド名に合わせる
          target: edge.targetId || "", // サーバー側の応答フィールド名に合わせる
          label: edge.label || "RELATED_TO",
          strength: edge.strength || undefined // nullの場合はundefinedに変換
        }))
      ];
      
      // ノードのストリーミング表示のための準備
      if (graphNodes.length > 0) {
        console.log("Setting up animation with nodes:", graphNodes.length, "links:", graphLinks.length);
        
        // ルートノードを最初に表示
        const rootNode = graphNodes.find(n => n.level === 0);
        
        // アニメーションで表示するノードとリンクを設定
        setAnimationQueue({
          nodes: graphNodes,
          links: graphLinks
        });
        
        // 初期表示用（ルートノードのみ、または空の配列）
        setVisibleNodes(rootNode ? [rootNode] : []);
        setVisibleLinks([]);
        
        // アニメーション開始
        setAnimationInProgress(true);
      } else {
        console.log("No nodes to display, setting empty graph");
        // ノードがない場合は直接設定
        setNodes(graphNodes);
        setLinks(graphLinks);
      }
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
  
  // ノードアニメーションの管理
  useEffect(() => {
    if (!animationInProgress) return;
    
    // 描画間隔（ミリ秒）
    const ANIMATION_INTERVAL = 150;
    
    // キューからノードとエッジを少しずつ取り出して表示
    const animationTimer = setInterval(() => {
      setVisibleNodes(prevNodes => {
        // すでに表示されているノードのIDリスト
        const existingNodeIds = new Set(prevNodes.map(n => n.id));
        
        // まだ表示されていないノードから次に表示するノードを選択
        // 最初にルートノード、次にレベル1のノード、その後にレベル2...という順番で表示
        const remainingNodes = animationQueue.nodes.filter(n => !existingNodeIds.has(n.id));
        
        if (remainingNodes.length === 0) {
          // すべてのノードが表示された
          setAnimationInProgress(false);
          setNodes(animationQueue.nodes);
          setLinks(animationQueue.links);
          return prevNodes;
        }
        
        // 表示するノードの数（一度に少しずつ表示）
        const nodesToAdd = remainingNodes.slice(0, 2);
        return [...prevNodes, ...nodesToAdd];
      });
      
      setVisibleLinks(prevLinks => {
        // 表示されているノードに関連するリンクのみを表示
        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
        
        // まだ表示されていないリンクのうち、両端のノードが表示されているものを選ぶ
        const newLinks = animationQueue.links.filter(link => {
          // リンクがまだ表示されていないか確認
          if (prevLinks.some(l => l.id === link.id)) return false;
          
          // sourceとtargetを安全に文字列として扱う
          let source = link.source;
          let target = link.target;
          
          if (typeof source === 'object' && source !== null) {
            source = source.id || '';
          }
          
          if (typeof target === 'object' && target !== null) {
            target = target.id || '';
          }
          
          // 両方のノードが表示されているか確認
          return source && target && 
                 visibleNodeIds.has(source.toString()) && 
                 visibleNodeIds.has(target.toString());
        });
        
        return [...prevLinks, ...newLinks.slice(0, 3)]; // 一度に複数のリンクを追加
      });
    }, ANIMATION_INTERVAL);
    
    return () => clearInterval(animationTimer);
  }, [animationInProgress, animationQueue, visibleNodes]);
  
  // Mapifyスタイルの階層構造レイアウト（分離して明確に）
  useEffect(() => {
    if (nodes.length === 0 || !graphRef.current) return;
    
    // 各レベルのノードをグループ化
    const nodesByLevel: Record<number, GraphNode[]> = {};
    nodes.forEach(node => {
      if (!nodesByLevel[node.level]) {
        nodesByLevel[node.level] = [];
      }
      nodesByLevel[node.level].push(node);
    });
    
    // ルートノードを画面下部中央に配置
    const rootNode = nodes.find(n => n.level === 0);
    if (rootNode) {
      rootNode.fx = width / 2;
      rootNode.fy = height - 100; // 画面下部に配置
      rootNode.val = 25; // ルートノードを大きく表示
    }
    
    // 最大レベルを計算
    const maxLevel = Math.max(...nodes.map(n => n.level));
    
    // 各ノードの初期位置を設定（レベルに基づく）
    nodes.forEach(node => {
      if (node.level === 0) return; // ルートノードはスキップ
      
      // レベルに基づいて位置を設定
      const levelCount = nodesByLevel[node.level].length;
      const levelIndex = nodesByLevel[node.level].indexOf(node);
      
      // レベルごとに行を分ける (上から下へ配置)
      const verticalSpacing = (height - 200) / (maxLevel + 1);
      const rowY = 100 + (maxLevel - node.level) * verticalSpacing;
      
      // 1行内での水平配置
      const rowWidth = width - 200;
      const horizontalSpacing = levelCount > 1 ? rowWidth / (levelCount - 1) : 0;
      const rowX = levelCount > 1 
        ? 100 + levelIndex * horizontalSpacing
        : width / 2;
      
      // 初期位置を設定
      node.fx = rowX;
      node.fy = rowY;
      
      // 子ノードが多いノードは大きく表示
      const childNodes = nodes.filter(n => n.parentId === node.id);
      node.val = Math.min(20, 10 + childNodes.length * 2);
    });
    
    // カスタムレイアウトの適用
    setTimeout(() => {
      if (!graphRef.current) return;
      
      const simulation = graphRef.current.d3Force();
      if (!simulation) {
        console.log('Force simulation not initialized yet');
        return;
      }
      
      try {
        // 既存のフォースをクリア
        simulation.force('link', null);
        simulation.force('charge', null);
        simulation.force('center', null);
        simulation.force('radial', null);
        simulation.force('x', null);
        simulation.force('y', null);
        simulation.force('collision', null);
        
        // 同じレベルのノード同士が重ならないようにするための衝突検出
        simulation.force('collision', d3.forceCollide().radius((d: any) => {
          // ノードの大きさに応じた衝突半径
          const baseSize = d.level === 0 ? 100 : 80;
          return baseSize;
        }).strength(1));
        
        // 固定ノードを動かさないようにする
        simulation.force('link', d3.forceLink(links)
          .id((d: any) => d.id)
          .distance(100)
          .strength(0.1) // 弱い接続力
        );
        
        // 一定回数の繰り返し後に全ノードを固定
        let tickCount = 0;
        const TICKS_TO_FREEZE = 10;
        
        simulation.on('tick', () => {
          tickCount++;
          if (tickCount >= TICKS_TO_FREEZE) {
            // すべてのノードを現在の位置で固定
            nodes.forEach(node => {
              node.fx = node.x;
              node.fy = node.y;
            });
            
            // シミュレーションを止める
            simulation.stop();
          }
        });
        
        // 短時間だけシミュレーション実行
        simulation.alpha(0.3).restart();
      } catch (err) {
        console.error('Error configuring force simulation:', err);
      }
    }, 300); // コンポーネントがマウントされて少し時間を置いてから実行
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
  
  // クイック子ノード追加（グラフ上で直接編集）
  const handleAddQuickChildNode = useCallback(async (parentNode: GraphNode) => {
    // 新しいノードの位置を計算（親ノードの少し下）
    const position = {
      x: parentNode.x || width / 2,
      y: (parentNode.y || height / 2) + 100
    };
    
    // 編集モードを開始
    setEditingNode({
      parent: parentNode,
      isSibling: false,
      position
    });
    setInlineNodeName("");
    
    // コンテキストメニューを閉じる
    setContextMenuNode(null);
  }, [width, height]);
  
  // クイック兄弟ノード追加（グラフ上で直接編集）
  const handleAddQuickSiblingNode = useCallback(async (siblingNode: GraphNode) => {
    if (!siblingNode.parentId) return;
    
    // 親ノードを探す
    const parentNode = nodes.find(n => n.id === siblingNode.parentId);
    if (!parentNode) return;
    
    // 新しいノードの位置を計算（兄弟ノードの横）
    const position = {
      x: (siblingNode.x || width / 2) + 150,
      y: siblingNode.y || height / 2
    };
    
    // 編集モードを開始
    setEditingNode({
      parent: parentNode,
      isSibling: true,
      position
    });
    setInlineNodeName("");
    
    // コンテキストメニューを閉じる
    setContextMenuNode(null);
  }, [nodes, width, height]);
  
  // インラインノード追加の確定
  const handleInlineNodeCreate = useCallback(async () => {
    if (!editingNode || !editingNode.parent || !inlineNodeName.trim()) return;
    
    try {
      const parentNode = editingNode.parent;
      
      // 新しいノードを作成
      const newNode: InsertKnowledgeNode = {
        name: inlineNodeName.trim(),
        roleModelId,
        type: "keyword", // デフォルトのタイプ
        level: parentNode.level + (editingNode.isSibling ? 0 : 1),
        parentId: editingNode.isSibling ? parentNode.parentId : parentNode.id,
        color: null,
        description: null
      };
      
      // APIリクエストで新規ノード作成
      const res = await apiRequest("POST", "/api/knowledge-nodes", newNode);
      
      if (res.ok) {
        // グラフを更新
        toast({
          title: "ノード追加完了",
          description: `新しいノード「${inlineNodeName.trim()}」を追加しました`
        });
        fetchGraphData();
      } else {
        toast({
          title: "エラー",
          description: "ノードの追加に失敗しました",
          variant: "destructive"
        });
      }
    } catch (e) {
      console.error("Error creating node:", e);
      toast({
        title: "エラー",
        description: "ノードの追加処理中にエラーが発生しました",
        variant: "destructive"
      });
    } finally {
      // 編集モードを終了
      setEditingNode(null);
      setInlineNodeName("");
    }
  }, [editingNode, inlineNodeName, roleModelId, fetchGraphData]);
  
  // 親ノードに子ノードを追加（従来のダイアログ方式 - バックアップ）
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
            <Button size="sm" variant="outline" onClick={fetchGraphData}>更新</Button>
          </div>
          
          <ForceGraph
            ref={graphRef}
            graphData={{ 
              nodes: animationInProgress ? visibleNodes : nodes, 
              links: animationInProgress ? visibleLinks : links 
            }}
            width={width}
            height={height}
            nodeId="id"
            nodeVal="val"
            nodeLabel="name"
            nodeColor={(node: any) => node.color || getNodeColor(node.type)}
            nodeCanvasObject={(node: any, ctx: any, globalScale: any) => {
              const { id, name, color, val = 10, level = 0 } = node as GraphNode;
              // ノードのサイズとスタイル調整
              const isRoot = level === 0;
              const fontSize = isRoot ? 14 : 12; // フォントサイズを固定
              const nodeWidth = isRoot ? 160 : Math.max(100, Math.min(name.length * 8, 150)); // ノードの幅を名前に応じて調整
              const nodeHeight = isRoot ? 70 : 40; // ノードの高さ
              const cornerRadius = 10; // 角の丸さ
              
              // 位置調整
              const x = node.x || 0;
              const y = node.y || 0;
              
              // 角丸長方形の描画
              ctx.beginPath();
              
              // 角丸長方形のパスを描く
              ctx.moveTo(x - nodeWidth/2 + cornerRadius, y - nodeHeight/2);
              ctx.lineTo(x + nodeWidth/2 - cornerRadius, y - nodeHeight/2);
              ctx.quadraticCurveTo(x + nodeWidth/2, y - nodeHeight/2, x + nodeWidth/2, y - nodeHeight/2 + cornerRadius);
              ctx.lineTo(x + nodeWidth/2, y + nodeHeight/2 - cornerRadius);
              ctx.quadraticCurveTo(x + nodeWidth/2, y + nodeHeight/2, x + nodeWidth/2 - cornerRadius, y + nodeHeight/2);
              ctx.lineTo(x - nodeWidth/2 + cornerRadius, y + nodeHeight/2);
              ctx.quadraticCurveTo(x - nodeWidth/2, y + nodeHeight/2, x - nodeWidth/2, y + nodeHeight/2 - cornerRadius);
              ctx.lineTo(x - nodeWidth/2, y - nodeHeight/2 + cornerRadius);
              ctx.quadraticCurveTo(x - nodeWidth/2, y - nodeHeight/2, x - nodeWidth/2 + cornerRadius, y - nodeHeight/2);
              ctx.closePath();
              
              // ノードの塗りつぶし
              ctx.fillStyle = color || getNodeColor((node as GraphNode).type);
              ctx.fill();
              
              // 枠線の追加（オプション）
              ctx.strokeStyle = isRoot ? '#FFFFFF' : 'rgba(255,255,255,0.3)';
              ctx.lineWidth = isRoot ? 2 : 1;
              ctx.stroke();
              
              // テキストの描画
              ctx.font = `${fontSize}px Arial`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillStyle = '#FFF';
              
              // テキストフィッティング
              let displayName = name;
              const maxTextWidth = nodeWidth - 16; // パディング考慮
              let textMetrics = ctx.measureText(displayName);
              
              // 長いテキストを処理
              if (textMetrics.width > maxTextWidth) {
                // 2行に分ける場合
                if (name.length > 15 && !isRoot) {
                  const halfIndex = Math.floor(name.length / 2);
                  const firstHalf = name.substring(0, halfIndex);
                  const secondHalf = name.substring(halfIndex);
                  
                  ctx.fillText(firstHalf, x, y - 8);
                  ctx.fillText(secondHalf, x, y + 8);
                } else {
                  // 切り詰める場合
                  let truncatedName = name;
                  while (ctx.measureText(truncatedName + "...").width > maxTextWidth && truncatedName.length > 3) {
                    truncatedName = truncatedName.substring(0, truncatedName.length - 1);
                  }
                  displayName = truncatedName + (truncatedName !== name ? "..." : "");
                  ctx.fillText(displayName, x, y);
                }
              } else {
                ctx.fillText(displayName, x, y);
              }
              
              // ホバー時のツールチップ表示
              if ((node as any).__hover) {
                const tooltipPadding = 8;
                const tooltipWidth = Math.max(ctx.measureText(name).width + tooltipPadding * 2, 100);
                const tooltipHeight = 30;
                
                // ツールチップの背景（角丸長方形）
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.beginPath();
                
                const tooltipX = x - tooltipWidth/2;
                const tooltipY = y - nodeHeight/2 - tooltipHeight - 10;
                const tooltipRadius = 5;
                
                // 角丸長方形の描画
                ctx.moveTo(tooltipX + tooltipRadius, tooltipY);
                ctx.lineTo(tooltipX + tooltipWidth - tooltipRadius, tooltipY);
                ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY, tooltipX + tooltipWidth, tooltipY + tooltipRadius);
                ctx.lineTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight - tooltipRadius);
                ctx.quadraticCurveTo(tooltipX + tooltipWidth, tooltipY + tooltipHeight, tooltipX + tooltipWidth - tooltipRadius, tooltipY + tooltipHeight);
                ctx.lineTo(tooltipX + tooltipRadius, tooltipY + tooltipHeight);
                ctx.quadraticCurveTo(tooltipX, tooltipY + tooltipHeight, tooltipX, tooltipY + tooltipHeight - tooltipRadius);
                ctx.lineTo(tooltipX, tooltipY + tooltipRadius);
                ctx.quadraticCurveTo(tooltipX, tooltipY, tooltipX + tooltipRadius, tooltipY);
                ctx.closePath();
                
                ctx.fill();
                
                // ツールチップの三角形（ポインタ）
                ctx.beginPath();
                ctx.moveTo(x, y - nodeHeight/2 - 2);
                ctx.lineTo(x - 8, y - nodeHeight/2 - 10);
                ctx.lineTo(x + 8, y - nodeHeight/2 - 10);
                ctx.closePath();
                ctx.fill();
                
                // ツールチップのテキスト
                ctx.fillStyle = 'white';
                ctx.font = '12px Arial';
                ctx.fillText(
                  name,
                  x,
                  y - nodeHeight/2 - tooltipHeight/2 - 10
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
            linkDirectionalParticles={0} // パルスを表示しない
            linkWidth={(link) => (link.label === "CONTAINS") ? 2 : 1}
            linkColor={(link) => (link.label === "CONTAINS") ? '#77AADD' : '#BBBBBB'}
            linkCurvature={(link) => (link.label === "CONTAINS") ? 0 : 0.25}
            cooldownTicks={100}
            backgroundColor="#ffffff"
          />
          
          {/* インラインノード追加UI */}
          {editingNode && (
            <div 
              className="absolute z-20 bg-white dark:bg-gray-800 p-2 rounded-md shadow-lg border border-primary/50"
              style={{ 
                left: editingNode.position.x,
                top: editingNode.position.y,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="flex flex-col gap-2 min-w-[200px]">
                <Input
                  autoFocus
                  placeholder="ノード名を入力"
                  value={inlineNodeName}
                  onChange={(e) => setInlineNodeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleInlineNodeCreate();
                    } else if (e.key === 'Escape') {
                      setEditingNode(null);
                    }
                  }}
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setEditingNode(null)}
                  >
                    キャンセル
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleInlineNodeCreate}
                    disabled={!inlineNodeName.trim()}
                  >
                    追加
                  </Button>
                </div>
              </div>
            </div>
          )}
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
            
            <ContextMenuSeparator />
            
            <ContextMenuItem onClick={() => handleAddQuickChildNode(contextMenuNode)}>
              <CornerDownRight className="h-4 w-4 mr-2" />
              子ノードを追加
            </ContextMenuItem>
            
            {contextMenuNode.parentId && (
              <ContextMenuItem onClick={() => handleAddQuickSiblingNode(contextMenuNode)}>
                <ArrowRight className="h-4 w-4 mr-2" />
                兄弟ノードを追加
              </ContextMenuItem>
            )}
            
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <MessageSquarePlus className="h-4 w-4 mr-2" />
                AIで展開
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-56">
                <ContextMenuItem onClick={() => handleExpandNodeWithAI(contextMenuNode)}>
                  <MessageSquarePlus className="h-4 w-4 mr-2" />
                  AIでノード展開
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
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