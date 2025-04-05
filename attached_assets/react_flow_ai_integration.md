# React FlowとAIフレームワークの統合

## 概要

React Flowは、ノードベースのユーザーインターフェースを構築するためのReactライブラリで、AIエージェントワークフローの視覚化に最適です。このドキュメントでは、React FlowとCrewAI、LangChain、LlamaIndexなどのAIフレームワークを統合する方法について説明します。

## React Flowの特徴

React Flowは以下の特徴を持っています：

- **カスタマイズ可能なノードとエッジ**: 特定のユースケースに合わせたデザインが可能
- **組み込みのインタラクティブ機能**: ドラッグ＆ドロップ、ズーム、パン、マルチ選択などが標準で利用可能
- **パフォーマンス最適化**: 表示されているノードや更新されたノードのみをレンダリング
- **プラグイン**: ミニマップ、コントロール、ノードツールバー、背景などの機能を提供
- **TypeScriptサポート**: 開発時の型安全性を確保
- **リアクティブなフロー**: 接続されたノード間の動的なデータフローを管理するためのフック

## AIエージェントインターフェースのユースケース

React Flowは以下のようなAIエージェントインターフェースのユースケースに適しています：

1. **エージェントワークフローの視覚化**: 個々のAIエージェントやタスクをノードとして表現し、エッジでコミュニケーションやデータフローを定義
2. **決定木**: 入力データに基づいて選択を行うAIシステムの決定木を構築
3. **マルチエージェントシステム**: 各ノードが自律エージェントを表す、マルチエージェントセットアップでの相互作用を視覚化
4. **リアルタイムモニタリング**: React Flowのリアクティブフックを使用して、エージェントの進行状況をリアルタイムで追跡

## React FlowとAIフレームワークの統合方法

### 基本的なセットアップ

```jsx
import { useState, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  applyEdgeChanges,
  applyNodeChanges,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';

// AIエージェントノードコンポーネント
const AgentNode = ({ data }) => (
  <div className="agent-node">
    <div className="agent-header">
      <strong>{data.label}</strong>
      <span className="agent-type">{data.agentType}</span>
    </div>
    <div className="agent-status">
      Status: {data.status || 'Idle'}
    </div>
    {data.output && (
      <div className="agent-output">
        <small>Latest output:</small>
        <p>{data.output}</p>
      </div>
    )}
  </div>
);

// ノードタイプの登録
const nodeTypes = {
  agent: AgentNode,
};

// AIワークフローコンポーネント
export default function AIWorkflow() {
  // CrewAI、LangChain、LlamaIndexのエージェントをノードとして表現
  const initialNodes = [
    {
      id: '1',
      type: 'agent',
      position: { x: 100, y: 100 },
      data: { 
        label: 'Coordinator Agent', 
        agentType: 'CrewAI',
        status: 'Active',
      }
    },
    {
      id: '2',
      type: 'agent',
      position: { x: 300, y: 200 },
      data: { 
        label: 'Research Agent', 
        agentType: 'LangChain',
        status: 'Waiting',
      }
    },
    {
      id: '3',
      type: 'agent',
      position: { x: 500, y: 100 },
      data: { 
        label: 'Information Retrieval', 
        agentType: 'LlamaIndex',
        status: 'Idle',
      }
    },
  ];

  // エージェント間の関係をエッジとして表現
  const initialEdges = [
    { id: 'e1-2', source: '1', target: '2', animated: true, label: 'Assigns tasks' },
    { id: 'e2-3', source: '2', target: '3', animated: true, label: 'Requests info' },
    { id: 'e3-1', source: '3', target: '1', animated: true, label: 'Returns results' },
  ];

  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

### AIエージェントの状態更新

React FlowとAIフレームワークを統合する際の重要な側面は、AIエージェントの状態をリアルタイムで更新することです。以下は、WebSocketを使用してAIエージェントの状態を更新する例です：

```jsx
import { useState, useCallback, useEffect } from 'react';
import ReactFlow, { /* ... */ } from 'reactflow';
import io from 'socket.io-client';

export default function AIWorkflow() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [socket, setSocket] = useState(null);

  // WebSocket接続の初期化
  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // AIエージェントの状態更新をリッスン
  useEffect(() => {
    if (!socket) return;

    // エージェントの状態更新
    socket.on('agent-status-update', (data) => {
      const { agentId, status, output } = data;
      
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === agentId) {
            return {
              ...node,
              data: {
                ...node.data,
                status,
                output,
              },
            };
          }
          return node;
        })
      );
    });

    // 新しいエージェントの追加
    socket.on('new-agent', (agent) => {
      const newNode = {
        id: agent.id,
        type: 'agent',
        position: agent.position,
        data: {
          label: agent.name,
          agentType: agent.type,
          status: 'Idle',
        },
      };
      
      setNodes((nds) => [...nds, newNode]);
    });

    // エージェント間の新しい接続
    socket.on('new-connection', (connection) => {
      const newEdge = {
        id: `e${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        animated: true,
        label: connection.label,
      };
      
      setEdges((eds) => [...eds, newEdge]);
    });

    return () => {
      socket.off('agent-status-update');
      socket.off('new-agent');
      socket.off('new-connection');
    };
  }, [socket]);

  // その他のコード...

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow /* ... */ >
        {/* ... */}
      </ReactFlow>
    </div>
  );
}
```

### バックエンドとの統合

React FlowをCrewAI、LangChain、LlamaIndexと統合するためには、バックエンドAPIが必要です。以下は、Next.jsのAPI Routesを使用した例です：

```javascript
// pages/api/agents/index.js
import { CrewAI, Agent, Task } from 'crewai';
import { LangChain } from 'langchain';
import { LlamaIndex } from 'llama_index';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // エージェントのリストを取得
    const agents = [
      {
        id: '1',
        name: 'Coordinator Agent',
        type: 'CrewAI',
        status: 'Active',
      },
      // その他のエージェント...
    ];
    
    res.status(200).json({ agents });
  } else if (req.method === 'POST') {
    // 新しいエージェントを作成
    const { name, type, role, goal, backstory, tools } = req.body;
    
    try {
      let agent;
      
      if (type === 'CrewAI') {
        agent = new Agent({
          role,
          goal,
          backstory,
          tools,
        });
      } else if (type === 'LangChain') {
        // LangChainエージェントの作成
      } else if (type === 'LlamaIndex') {
        // LlamaIndexエージェントの作成
      }
      
      // エージェントをデータベースに保存
      
      res.status(201).json({ agent });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
```

### WebSocketサーバーの実装

AIエージェントの状態をリアルタイムで更新するためのWebSocketサーバーの実装例：

```javascript
// pages/api/socket.js
import { Server } from 'socket.io';

export default function handler(req, res) {
  if (res.socket.server.io) {
    console.log('Socket is already running');
    res.end();
    return;
  }
  
  console.log('Setting up socket');
  const io = new Server(res.socket.server);
  res.socket.server.io = io;
  
  io.on('connection', (socket) => {
    console.log('New client connected');
    
    // AIエージェントの実行
    socket.on('run-agent', async (data) => {
      const { agentId, input } = data;
      
      // エージェントの状態を「実行中」に更新
      io.emit('agent-status-update', {
        agentId,
        status: 'Running',
      });
      
      try {
        // AIエージェントの実行（CrewAI、LangChain、LlamaIndexのいずれか）
        const result = await runAgent(agentId, input);
        
        // エージェントの状態を「完了」に更新
        io.emit('agent-status-update', {
          agentId,
          status: 'Completed',
          output: result,
        });
      } catch (error) {
        // エージェントの状態を「エラー」に更新
        io.emit('agent-status-update', {
          agentId,
          status: 'Error',
          output: error.message,
        });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
  
  res.end();
}

// AIエージェントを実行する関数
async function runAgent(agentId, input) {
  // エージェントの種類に応じて適切なフレームワークを使用
  // CrewAI、LangChain、LlamaIndexのいずれかを使用
  
  // 例：CrewAIエージェントの実行
  if (agentId === '1') {
    const agent = new Agent({
      role: 'Coordinator',
      goal: 'Coordinate tasks between agents',
      backstory: 'An expert coordinator with years of experience.',
      tools: [],
    });
    
    const task = new Task({
      description: input,
      agent,
    });
    
    const crew = new Crew({
      agents: [agent],
      tasks: [task],
    });
    
    return await crew.kickoff();
  }
  
  // その他のエージェントの実行...
}
```

## カスタムノードの作成

AIエージェントの種類に応じたカスタムノードを作成することで、より直感的なインターフェースを構築できます：

```jsx
// components/nodes/CrewAINode.js
import { Handle, Position } from 'reactflow';

export default function CrewAINode({ data }) {
  return (
    <div className="crewai-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-header crewai">
        <strong>{data.label}</strong>
        <span className="badge">CrewAI</span>
      </div>
      <div className="node-content">
        <div className="node-status">
          Status: {data.status || 'Idle'}
        </div>
        <div className="node-details">
          <div>Role: {data.role}</div>
          <div>Goal: {data.goal}</div>
        </div>
        {data.output && (
          <div className="node-output">
            <small>Output:</small>
            <p>{data.output}</p>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// components/nodes/LangChainNode.js
import { Handle, Position } from 'reactflow';

export default function LangChainNode({ data }) {
  return (
    <div className="langchain-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-header langchain">
        <strong>{data.label}</strong>
        <span className="badge">LangChain</span>
      </div>
      <div className="node-content">
        {/* LangChain固有の内容 */}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// components/nodes/LlamaIndexNode.js
import { Handle, Position } from 'reactflow';

export default function LlamaIndexNode({ data }) {
  return (
    <div className="llamaindex-node">
      <Handle type="target" position={Position.Top} />
      <div className="node-header llamaindex">
        <strong>{data.label}</strong>
        <span className="badge">LlamaIndex</span>
      </div>
      <div className="node-content">
        {/* LlamaIndex固有の内容 */}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

## ノード間のデータフロー

AIエージェント間のデータフローを視覚化するためのカスタムエッジを作成できます：

```jsx
// components/edges/DataFlowEdge.js
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';

export default function DataFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style = {},
  markerEnd,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: '#f0f0f0',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 500,
          }}
          className="nodrag nopan"
        >
          {data?.label}
          {data?.transferring && (
            <div className="data-transfer-indicator" />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
```

## まとめ

React FlowはAIエージェントワークフローの視覚化に最適なライブラリであり、CrewAI、LangChain、LlamaIndexなどのAIフレームワークと統合することで、以下のような利点があります：

1. **直感的なワークフロー設計**: ドラッグ＆ドロップでAIエージェントワークフローを設計
2. **リアルタイム状態更新**: AIエージェントの状態をリアルタイムで視覚化
3. **インタラクティブな操作**: ユーザーがワークフローを操作し、AIエージェントを制御
4. **カスタマイズ可能なUI**: AIフレームワークの特性に合わせたカスタムノードとエッジ

次のセクションでは、これらの技術を組み合わせた具体的なアーキテクチャと実装例を提供します。
