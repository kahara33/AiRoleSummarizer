import React, { useState, useEffect } from 'react';
import { KnowledgeNode, KnowledgeEdge } from '@shared/schema';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [edges, setEdges] = useState<KnowledgeEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'structure' | 'debug'>('summary');

  // データ取得関数
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // ノードの取得
      const nodesResponse = await fetch(`/api/role-models/${roleModelId}/knowledge-nodes`);
      if (!nodesResponse.ok) {
        throw new Error(`ノードデータの取得に失敗しました: ${nodesResponse.status}`);
      }
      const nodesData = await nodesResponse.json();
      
      // エッジの取得
      const edgesResponse = await fetch(`/api/role-models/${roleModelId}/knowledge-edges`);
      if (!edgesResponse.ok) {
        throw new Error(`エッジデータの取得に失敗しました: ${edgesResponse.status}`);
      }
      const edgesData = await edgesResponse.json();
      
      setNodes(nodesData);
      setEdges(edgesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // コンポーネントマウント時にデータ取得
  useEffect(() => {
    if (roleModelId) {
      fetchData();
    }
  }, [roleModelId]);

  // ローディング中
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ width, height }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>知識グラフデータを読み込み中...</p>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ width, height }}>
        <p className="text-red-500">データの読み込みに失敗しました</p>
        <p className="text-sm text-gray-500">詳細: {error.message}</p>
        <Button onClick={fetchData} variant="outline">再試行</Button>
      </div>
    );
  }

  // ノードとエッジのカウント
  const rootNodes = nodes.filter(node => node.level === 0);
  const level1Nodes = nodes.filter(node => node.level === 1);
  const level2Nodes = nodes.filter(node => node.level === 2);
  const level3Nodes = nodes.filter(node => node.level === 3);

  // ノードの色に基づくスタイルを取得
  const getNodeColorClass = (color: string | null) => {
    switch (color) {
      case 'blue': return 'text-blue-600';
      case 'green': return 'text-green-600';
      case 'purple': return 'text-purple-600';
      case 'orange': return 'text-orange-600';
      case 'red': return 'text-red-600';
      case 'pink': return 'text-pink-600';
      case 'teal': return 'text-teal-600';
      case 'indigo': return 'text-indigo-600';
      default: return '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* タブナビゲーション */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 ${activeTab === 'summary' ? 'border-b-2 border-primary font-medium' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          サマリー
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'structure' ? 'border-b-2 border-primary font-medium' : ''}`}
          onClick={() => setActiveTab('structure')}
        >
          構造詳細
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'debug' ? 'border-b-2 border-primary font-medium' : ''}`}
          onClick={() => setActiveTab('debug')}
        >
          デバッグ
        </button>
      </div>

      <div className="overflow-auto p-4 border-t border-x border-b rounded-b-md bg-white flex-1">
        {/* サマリータブ */}
        {activeTab === 'summary' && (
          <div>
            <h2 className="text-xl font-bold mb-4">知識グラフの概要</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">ノード統計</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>ルートノード: {rootNodes.length}個</li>
                  <li>レベル1ノード: {level1Nodes.length}個</li>
                  <li>レベル2ノード: {level2Nodes.length}個</li>
                  <li>レベル3ノード: {level3Nodes.length}個</li>
                  <li className="font-semibold">合計ノード数: {nodes.length}個</li>
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

            <div className="mt-6 border p-4 rounded-md bg-gray-50">
              <h3 className="text-lg font-semibold mb-2">マップの概要</h3>
              {rootNodes.length > 0 && (
                <div className="flex flex-col items-center">
                  <div className="bg-blue-600 text-white rounded-lg p-3 max-w-xs mb-2 text-center">
                    <strong>{rootNodes[0].name}</strong>
                  </div>
                  
                  {level1Nodes.length > 0 && (
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                  )}
                  
                  <div className="flex flex-wrap justify-center gap-4 mt-2">
                    {level1Nodes.slice(0, 4).map(node => (
                      <div key={node.id} className="border rounded-lg p-2 max-w-xs text-center" 
                           style={{ 
                             backgroundColor: node.color ? `var(--${node.color}-50, #f8fafc)` : '#f8fafc',
                             borderColor: node.color ? `var(--${node.color}-200, #e2e8f0)` : '#e2e8f0' 
                           }}>
                        <span className={getNodeColorClass(node.color)}>{node.name}</span>
                      </div>
                    ))}
                    {level1Nodes.length > 4 && (
                      <div className="bg-gray-100 border border-gray-300 rounded-lg p-2 max-w-xs text-center">
                        <span className="text-gray-600">...他 {level1Nodes.length - 4} 件</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 構造詳細タブ */}
        {activeTab === 'structure' && (
          <div>
            <h2 className="text-xl font-bold mb-4">知識グラフの構造詳細</h2>
            
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">ルートノード</h3>
              <ul className="list-disc pl-5 space-y-1">
                {rootNodes.map(node => (
                  <li key={node.id} className="font-medium">
                    {node.name}
                    {node.description && (
                      <span className="text-gray-600 ml-2 text-sm">（{node.description}）</span>
                    )}
                  </li>
                ))}
                {rootNodes.length === 0 && <li className="text-gray-500">ルートノードが見つかりません</li>}
              </ul>
            </div>
            
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">主要カテゴリ（レベル1）</h3>
              <ul className="list-disc pl-5 space-y-1">
                {level1Nodes.map(node => (
                  <li key={node.id} className={getNodeColorClass(node.color)}>
                    {node.name}
                    {node.description && (
                      <span className="text-gray-600 ml-2 text-sm">（{node.description}）</span>
                    )}
                  </li>
                ))}
                {level1Nodes.length === 0 && <li className="text-gray-500">レベル1のノードが見つかりません</li>}
              </ul>
            </div>
            
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">サブカテゴリ（レベル2）</h3>
              <ul className="list-disc pl-5 space-y-1">
                {level2Nodes.map(node => (
                  <li key={node.id} className={getNodeColorClass(node.color)}>
                    {node.name}
                    {node.description && (
                      <span className="text-gray-600 ml-2 text-sm">（{node.description}）</span>
                    )}
                    {node.parentId && (
                      <span className="text-gray-500 ml-2 text-xs">
                        親: {nodes.find(n => n.id === node.parentId)?.name || 'Unknown'}
                      </span>
                    )}
                  </li>
                ))}
                {level2Nodes.length === 0 && <li className="text-gray-500">レベル2のノードが見つかりません</li>}
              </ul>
            </div>
            
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">スキル/コンセプト（レベル3）</h3>
              <div className="grid grid-cols-2 gap-2">
                {level3Nodes.map(node => (
                  <div key={node.id} className="border p-2 rounded">
                    <div className={`font-medium ${getNodeColorClass(node.color)}`}>{node.name}</div>
                    {node.description && (
                      <div className="text-gray-600 text-sm">{node.description}</div>
                    )}
                    {node.parentId && (
                      <div className="text-gray-500 text-xs">
                        親: {nodes.find(n => n.id === node.parentId)?.name || 'Unknown'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {level3Nodes.length === 0 && <div className="text-gray-500">レベル3のノードが見つかりません</div>}
            </div>
          </div>
        )}
        
        {/* デバッグタブ */}
        {activeTab === 'debug' && (
          <div>
            <h2 className="text-xl font-bold mb-4">デバッグ情報</h2>
            
            <div className="mb-4">
              <Button onClick={fetchData} variant="outline" size="sm">データ再取得</Button>
            </div>
            
            <div className="mt-2 overflow-auto max-h-96">
              <h4 className="font-semibold">ノードデータ（全{nodes.length}件）:</h4>
              <pre className="bg-gray-100 p-2 rounded text-xs whitespace-pre-wrap">
                {JSON.stringify(nodes, null, 2)}
              </pre>
              
              <h4 className="font-semibold mt-4">エッジデータ（全{edges.length}件）:</h4>
              <pre className="bg-gray-100 p-2 rounded text-xs whitespace-pre-wrap">
                {JSON.stringify(edges, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}