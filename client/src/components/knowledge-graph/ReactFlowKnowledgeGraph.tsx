import React from 'react';
import ReactFlow, {
  Background, 
  Controls,
  MiniMap,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { KnowledgeNode } from '@shared/schema';

// これは最もシンプルなグラフ表示の実装です
// カスタムノードやエッジをすべて取り除き、純粋なReactFlowの動作確認を行います

interface ReactFlowKnowledgeGraphProps {
  roleModelId: string;
  onNodeClick?: (node: KnowledgeNode) => void;
  width?: number;
  height?: number;
}

// 極めてシンプルなデモデータ
const initialNodes = [
  {
    id: '1',
    type: 'default',
    data: { label: 'AIエンジニア' },
    position: { x: 250, y: 5 },
  },
  {
    id: '2',
    type: 'default',
    data: { label: 'データ分析' },
    position: { x: 100, y: 100 },
  },
  {
    id: '3',
    type: 'default',
    data: { label: 'モデル開発' },
    position: { x: 400, y: 100 },
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e1-3', source: '1', target: '3' },
];

// 実装コンポーネント（シンプル版）
const SimpleFlowGraph = ({ width = 800, height = 600 }) => {
  console.log('SimpleFlowGraphをレンダリングします。ノード数:', initialNodes.length);
  
  return (
    <div style={{ width, height, border: '1px solid #ddd' }}>
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

// 常にReactFlowProviderでラップする
const ReactFlowKnowledgeGraph: React.FC<ReactFlowKnowledgeGraphProps> = (props) => {
  const { width = 800, height = 600 } = props;
  
  return (
    <div style={{ width, height }} className="border rounded-md overflow-hidden">
      <ReactFlowProvider>
        <SimpleFlowGraph width={width} height={height} />
      </ReactFlowProvider>
    </div>
  );
};

export default ReactFlowKnowledgeGraph;