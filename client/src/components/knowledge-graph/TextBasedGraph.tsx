import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { KnowledgeNode, KnowledgeEdge } from '@shared/schema';
import { Loader2 } from 'lucide-react';

interface TextBasedGraphProps {
  roleModelId: string;
  width?: number;
  height?: number;
}

/**
 * グラフ情報をテキストベースで表示するシンプルなコンポーネント
 * グラフの描画がうまくいかない場合の代替手段
 */
export default function TextBasedGraph({ roleModelId, width = 800, height = 600 }: TextBasedGraphProps) {
  // ノードデータの取得
  const { data: nodes = [], isLoading: nodesLoading, error: nodesError } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-nodes`);
      return await res.json() as KnowledgeNode[];
    },
    enabled: !!roleModelId
  });
  
  // エッジデータの取得
  const { data: edges = [], isLoading: edgesLoading, error: edgesError } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/knowledge-edges`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-edges`);
      return await res.json() as KnowledgeEdge[];
    },
    enabled: !!roleModelId
  });

  // ローディング中
  if (nodesLoading || edgesLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ width, height }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>知識グラフデータを読み込み中...</p>
      </div>
    );
  }

  // エラー表示
  if (nodesError || edgesError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ width, height }}>
        <p className="text-red-500">データの読み込みに失敗しました</p>
        <p className="text-sm text-gray-500">詳細: {(nodesError || edgesError)?.toString()}</p>
      </div>
    );
  }

  // ノードとエッジのカウント
  const rootNodes = nodes.filter(node => node.level === 0);
  const level1Nodes = nodes.filter(node => node.level === 1);
  const level2Nodes = nodes.filter(node => node.level === 2);
  const level3Nodes = nodes.filter(node => node.level === 3);

  return (
    <div className="overflow-auto p-4 border rounded-md bg-white" style={{ width, height }}>
      <h2 className="text-xl font-bold mb-4">知識グラフの構造（テキスト形式）</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">ノード統計</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>ルートノード: {rootNodes.length}個</li>
            <li>レベル1ノード: {level1Nodes.length}個</li>
            <li>レベル2ノード: {level2Nodes.length}個</li>
            <li>レベル3ノード: {level3Nodes.length}個</li>
            <li>合計ノード数: {nodes.length}個</li>
          </ul>
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-2">エッジ統計</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>合計エッジ数: {edges.length}個</li>
            <li>CONTAINS関係: {edges.filter(e => e.label === 'CONTAINS').length}個</li>
            <li>RELATED_TO関係: {edges.filter(e => e.label === 'RELATED_TO').length}個</li>
          </ul>
        </div>
      </div>
      
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">ルートノード</h3>
        <ul className="list-disc pl-5 space-y-1">
          {rootNodes.map(node => (
            <li key={node.id} className="font-medium">{node.name}</li>
          ))}
        </ul>
      </div>
      
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">主要カテゴリ（レベル1）</h3>
        <ul className="list-disc pl-5 space-y-1">
          {level1Nodes.map(node => (
            <li key={node.id}>{node.name}</li>
          ))}
        </ul>
      </div>
      
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">サブカテゴリ（レベル2）</h3>
        <ul className="list-disc pl-5 space-y-1">
          {level2Nodes.slice(0, 10).map(node => (
            <li key={node.id}>{node.name}</li>
          ))}
          {level2Nodes.length > 10 && <li>...他 {level2Nodes.length - 10} 件</li>}
        </ul>
      </div>

      {/* JSONデータ表示（デバッグ用） */}
      <div className="mt-8 border-t pt-4">
        <details>
          <summary className="cursor-pointer font-semibold text-blue-600">データの詳細を表示（デバッグ用）</summary>
          <div className="mt-2 overflow-auto max-h-96">
            <h4 className="font-semibold">ノードデータ（最初の5件）:</h4>
            <pre className="bg-gray-100 p-2 rounded text-xs">
              {JSON.stringify(nodes.slice(0, 5), null, 2)}
            </pre>
            
            <h4 className="font-semibold mt-4">エッジデータ（最初の5件）:</h4>
            <pre className="bg-gray-100 p-2 rounded text-xs">
              {JSON.stringify(edges.slice(0, 5), null, 2)}
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
}