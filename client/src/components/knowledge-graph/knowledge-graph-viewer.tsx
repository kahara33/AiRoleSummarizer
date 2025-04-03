import { useCallback, useEffect, useState } from "react";
import { KnowledgeNode, KnowledgeEdge } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface KnowledgeGraphViewerProps {
  roleModelId: string;
  onNodeClick?: (node: KnowledgeNode) => void;
  onNodeCreate?: (parentNode?: KnowledgeNode) => void;
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
}

interface GraphLink {
  id: string;
  source: string;
  target: string;
  label?: string;
  strength?: number;
}

export default function KnowledgeGraphViewer({
  roleModelId,
  onNodeClick,
  onNodeCreate,
  width = 800,
  height = 600
}: KnowledgeGraphViewerProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        parentId: node.parentId || null
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

  // ノードクリックハンドラ
  const handleNodeClick = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !onNodeClick) return;
    
    // KnowledgeNode型に変換してコールバックを呼び出す
    const knowledgeNode: KnowledgeNode = {
      id: node.id,
      name: node.name,
      type: node.type,
      level: node.level,
      color: node.color || null,
      parentId: node.parentId || null,
      roleModelId,
      description: null,
      createdAt: new Date()
    };
    onNodeClick(knowledgeNode);
  }, [nodes, onNodeClick, roleModelId]);

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

  // グラフビジュアライゼーションの代わりにツリービューを表示
  return (
    <div className="relative border rounded-lg p-4">
      <div className="absolute top-4 right-4 flex space-x-2">
        <Button size="sm" onClick={handleCreateNodeClick}>ノード追加</Button>
        <Button size="sm" variant="outline" onClick={fetchGraphData}>更新</Button>
      </div>
      
      <h3 className="text-lg font-medium mb-4">知識グラフノード</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            style={{ borderLeft: `4px solid ${node.color || "#AAAAAA"}` }}
            onClick={() => handleNodeClick(node.id)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{node.name}</h3>
                <span className="text-xs px-2 py-1 bg-muted rounded-full">
                  {node.type}
                </span>
                {node.level > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    レベル: {node.level}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {links.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">関連付け</h3>
          <div className="space-y-2">
            {links.map((link) => {
              const sourceNode = nodes.find(n => n.id === link.source);
              const targetNode = nodes.find(n => n.id === link.target);
              
              if (!sourceNode || !targetNode) return null;
              
              return (
                <div key={link.id} className="border rounded-lg p-2 text-sm">
                  <span style={{ color: sourceNode.color ? sourceNode.color : "#AAAAAA" }}>{sourceNode.name}</span>
                  {" → "}
                  <span className="text-xs px-1 py-0.5 bg-muted rounded-full">
                    {link.label}
                  </span>
                  {" → "}
                  <span style={{ color: targetNode.color ? targetNode.color : "#AAAAAA" }}>{targetNode.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}