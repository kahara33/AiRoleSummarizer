import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { KnowledgeNode, KnowledgeEdge } from '@shared/schema';

interface KnowledgeGraphProps {
  roleModelId: string;
  width?: number;
  height?: number;
  onNodeClick?: (node: KnowledgeNode) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  roleModelId,
  width = 800,
  height = 600,
  onNodeClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeEdge[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // データのフェッチ
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // ノードの取得
        const nodesResponse = await fetch(`/api/role-models/${roleModelId}/knowledge-nodes`);
        if (!nodesResponse.ok) {
          throw new Error(`Failed to fetch nodes: ${nodesResponse.status}`);
        }
        const nodesData = await nodesResponse.json() as KnowledgeNode[];
        
        // エッジの取得
        const edgesResponse = await fetch(`/api/role-models/${roleModelId}/knowledge-edges`);
        if (!edgesResponse.ok) {
          throw new Error(`Failed to fetch edges: ${edgesResponse.status}`);
        }
        const edgesData = await edgesResponse.json() as KnowledgeEdge[];
        
        setNodes(nodesData);
        setEdges(edgesData);
        setError(null);
      } catch (err) {
        console.error('Error fetching graph data:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    
    if (roleModelId) {
      fetchData();
    }
  }, [roleModelId]);

  // D3グラフの描画
  useEffect(() => {
    if (loading || error || !nodes.length || !svgRef.current) return;

    // SVGコンテナのサイズ設定
    const svg = d3.select(svgRef.current);
    svg.attr('width', width).attr('height', height);
    
    // グループ要素をクリア
    svg.selectAll('*').remove();
    
    // 中心座標とズーム設定
    const centerX = width / 2;
    const centerY = height / 2;
    
    // ズーム機能
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    
    svg.call(zoom as any);
    
    // メインのグループ要素
    const g = svg.append('g');
    
    // ズームをリセット
    svg.call(zoom.transform as any, d3.zoomIdentity);
    
    // ノードの半径と色の設定
    const getNodeRadius = (node: KnowledgeNode) => {
      switch (node.level) {
        case 0: return 50; // ルートノード
        case 1: return 40; // カテゴリ
        case 2: return 30; // サブカテゴリ
        case 3: return 20; // スキル
        default: return 15;
      }
    };
    
    const getNodeColor = (node: KnowledgeNode) => {
      // 色指定がある場合はそれを使用
      if (node.color) return node.color;
      
      // レベルに基づくデフォルト色
      switch (node.level) {
        case 0: return '#3b82f6'; // blue-500
        case 1: return '#8b5cf6'; // purple-500
        case 2: return '#10b981'; // emerald-500
        case 3: return '#f59e0b'; // amber-500
        default: return '#6b7280'; // gray-500
      }
    };
    
    // シミュレーションの設定
    const simulation = d3.forceSimulation()
      .force('link', d3.forceLink().id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-1000))
      .force('center', d3.forceCenter(centerX, centerY))
      .force('collision', d3.forceCollide().radius((d: any) => getNodeRadius(d) + 10));
    
    // エッジの描画
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke-width', 2)
      .attr('stroke', '#aaa');
    
    // エッジのラベル
    const edgeLabels = g.append('g')
      .attr('class', 'edge-labels')
      .selectAll('text')
      .data(edges)
      .enter()
      .append('text')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .attr('text-anchor', 'middle')
      .text(d => d.label || '');
    
    // ノードのグループ
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);
    
    // ノードの円
    node.append('circle')
      .attr('r', getNodeRadius)
      .attr('fill', (d) => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
    
    // ノードのテキスト
    node.append('text')
      .attr('dy', 4)
      .attr('font-size', (d) => {
        const size = 14 - d.level * 2;
        return `${Math.max(8, size)}px`;
      })
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')
      .text(d => d.name);
    
    // クリックイベント
    node.on('click', function(event, d) {
      if (onNodeClick) {
        onNodeClick(d);
      }
      
      // ノードをハイライト
      d3.select(this).select('circle')
        .transition()
        .duration(300)
        .attr('stroke', '#ff0')
        .attr('stroke-width', 4);
      
      // 他のノードは元に戻す
      d3.selectAll('.node').filter(function() { return this !== event.currentTarget; })
        .select('circle')
        .transition()
        .duration(300)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
    });
    
    // シミュレーションの更新
    simulation
      .nodes(nodes as any[])
      .on('tick', ticked);
    
    (simulation.force('link') as d3.ForceLink<any, any>)
      .links(edges);
    
    // ポジション更新関数
    function ticked() {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
        
      edgeLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);
        
      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    }
    
    // ドラッグ関数
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    // ズームをリセット（全体が見えるように）
    svg.call(zoom.transform as any, d3.zoomIdentity
      .translate(centerX, centerY)
      .scale(0.5));
    
    // クリーンアップ
    return () => {
      simulation.stop();
    };
  }, [nodes, edges, width, height, loading, error, onNodeClick]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ width, height }}>
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p>知識グラフデータを読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ width, height }}>
        <p className="text-red-500">データの読み込みに失敗しました</p>
        <p className="text-sm text-gray-500">{error}</p>
        <button 
          className="px-4 py-2 bg-primary text-white rounded"
          onClick={() => window.location.reload()}
        >
          再試行
        </button>
      </div>
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
      <svg 
        ref={svgRef} 
        width={width} 
        height={height} 
        className="bg-white rounded-md shadow-sm"
      ></svg>
      <div className="absolute top-4 right-4">
        <div className="bg-white p-2 rounded-md shadow-sm text-xs">
          <div className="mb-1 font-semibold">ノード数: {nodes.length}</div>
          <div className="text-gray-600">
            接続数: {edges.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraph;