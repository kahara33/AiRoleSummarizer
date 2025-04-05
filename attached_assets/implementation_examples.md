# CrewAI、LangChain、LlamaIndexとReact Flowの統合実装例

このドキュメントでは、CrewAI、LangChain、LlamaIndexとReact Flowを統合するための具体的な実装例を提供します。

## 目次

1. [プロジェクトセットアップ](#1-プロジェクトセットアップ)
2. [フロントエンド実装](#2-フロントエンド実装)
3. [バックエンド実装](#3-バックエンド実装)
4. [AIエージェント実装](#4-aiエージェント実装)
5. [ナレッジグラフ実装](#5-ナレッジグラフ実装)

## 1. プロジェクトセットアップ

### 1.1 プロジェクト初期化

```bash
# Next.jsプロジェクトの作成
npx create-next-app@latest knowledge-graph-app
cd knowledge-graph-app

# 必要なパッケージのインストール
npm install reactflow socket.io socket.io-client neo4j-driver
npm install @vercel/analytics

# Python依存関係のインストール
pip install crewai langchain llama-index neo4j
pip install crewai-tools
```

### 1.2 環境変数の設定

```
# .env.local
# Neo4j設定
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# OpenAI API設定
OPENAI_API_KEY=your-openai-api-key

# LangChain設定
LANGCHAIN_API_KEY=your-langchain-api-key

# LlamaIndex設定
LLAMAINDEX_API_KEY=your-llamaindex-api-key
```

## 2. フロントエンド実装

### 2.1 メインページ

```jsx
// pages/index.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import KnowledgeGraph from '../components/KnowledgeGraph';
import ChatPanel from '../components/ChatPanel';
import { initSocket } from '../lib/socket';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Socket.IOの初期化
  useEffect(() => {
    const socket = initSocket();
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);
  
  return (
    <div className={styles.container}>
      <Head>
        <title>AIエージェントナレッジグラフ</title>
        <meta name="description" content="AIエージェントによるナレッジグラフ生成システム" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>AIエージェントナレッジグラフ</h1>
          <div className={styles.controls}>
            <button 
              className={styles.button}
              onClick={() => {
                const socket = initSocket();
                socket.emit('run-agent', {
                  agentId: '1', // コーディネーターエージェントのID
                  input: 'AIの最新トレンドについて情報を収集し、ナレッジグラフに追加してください。'
                });
              }}
            >
              AIトレンド分析を開始
            </button>
          </div>
        </div>
        
        <div className={styles.content}>
          <div className={styles.graphContainer}>
            <KnowledgeGraph onNodeSelect={setSelectedNode} />
          </div>
          <div className={styles.chatContainer}>
            <ChatPanel selectedNode={selectedNode} />
          </div>
        </div>
      </main>
    </div>
  );
}
```

### 2.2 ナレッジグラフコンポーネント

```jsx
// components/KnowledgeGraph.jsx
import { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
  Controls,
  Background,
  applyEdgeChanges,
  applyNodeChanges,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getSocket } from '../lib/socket';

// カスタムノードコンポーネント
import ConceptNode from './nodes/ConceptNode';
import EntityNode from './nodes/EntityNode';
import AgentNode from './nodes/AgentNode';

// カスタムエッジコンポーネント
import DataFlowEdge from './edges/DataFlowEdge';

// ノードとエッジのタイプ登録
const nodeTypes = {
  concept: ConceptNode,
  entity: EntityNode,
  agent: AgentNode,
};

const edgeTypes = {
  dataFlow: DataFlowEdge,
};

export default function KnowledgeGraph({ onNodeSelect }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  
  // ノードとエッジの初期ロード
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const response = await fetch('/api/graph');
        if (!response.ok) {
          throw new Error('Failed to fetch graph data');
        }
        const data = await response.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } catch (error) {
        console.error('Error fetching graph data:', error);
        // デモ用の初期データ
        setNodes([
          {
            id: '1',
            type: 'agent',
            position: { x: 250, y: 100 },
            data: { 
              label: 'コーディネーター', 
              agentId: '1',
              agentType: 'coordinator',
              status: 'Idle',
            }
          },
          {
            id: '2',
            type: 'agent',
            position: { x: 100, y: 250 },
            data: { 
              label: '情報収集', 
              agentId: '2',
              agentType: 'info-gatherer',
              status: 'Idle',
            }
          },
          {
            id: '3',
            type: 'agent',
            position: { x: 250, y: 400 },
            data: { 
              label: '分析', 
              agentId: '3',
              agentType: 'analyzer',
              status: 'Idle',
            }
          },
          {
            id: '4',
            type: 'agent',
            position: { x: 400, y: 250 },
            data: { 
              label: 'グラフ更新', 
              agentId: '4',
              agentType: 'graph-updater',
              status: 'Idle',
            }
          },
          {
            id: '5',
            type: 'concept',
            position: { x: 250, y: 250 },
            data: { 
              label: 'AI', 
              description: '人工知能',
              importance: 5,
            }
          },
        ]);
        setEdges([
          { id: 'e1-2', source: '1', target: '2', type: 'dataFlow', animated: true, data: { label: 'タスク割り当て' } },
          { id: 'e2-3', source: '2', target: '3', type: 'dataFlow', animated: true, data: { label: '情報転送' } },
          { id: 'e3-4', source: '3', target: '4', type: 'dataFlow', animated: true, data: { label: '分析結果' } },
          { id: 'e4-1', source: '4', target: '1', type: 'dataFlow', animated: true, data: { label: '更新通知' } },
          { id: 'e4-5', source: '4', target: '5', type: 'dataFlow', animated: false, data: { label: '更新' } },
        ]);
      }
    };
    
    fetchGraph();
  }, []);
  
  // Socket.IOを使用したリアルタイム更新
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    socket.on('graph-update', (update) => {
      if (update.nodes) {
        setNodes((nds) => {
          // 既存のノードを更新または新しいノードを追加
          const updatedNodes = [...nds];
          update.nodes.forEach((newNode) => {
            const index = updatedNodes.findIndex((n) => n.id === newNode.id);
            if (index >= 0) {
              updatedNodes[index] = { ...updatedNodes[index], ...newNode };
            } else {
              updatedNodes.push(newNode);
            }
          });
          return updatedNodes;
        });
      }
      
      if (update.edges) {
        setEdges((eds) => {
          // 既存のエッジを更新または新しいエッジを追加
          const updatedEdges = [...eds];
          update.edges.forEach((newEdge) => {
            const index = updatedEdges.findIndex((e) => e.id === newEdge.id);
            if (index >= 0) {
              updatedEdges[index] = { ...updatedEdges[index], ...newEdge };
            } else {
              updatedEdges.push(newEdge);
            }
          });
          return updatedEdges;
        });
      }
    });
    
    socket.on('agent-message', (message) => {
      // エージェントメッセージに基づいてノードを更新
      if (message.agentId) {
        setNodes((nds) => {
          return nds.map((node) => {
            if (node.type === 'agent' && node.data.agentId === message.agentId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  status: message.status,
                  lastMessage: message.content,
                },
              };
            }
            return node;
          });
        });
      }
    });
    
    return () => {
      socket.off('graph-update');
      socket.off('agent-message');
    };
  }, []);
  
  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  
  // ノードクリック時の処理
  const onNodeClick = useCallback((event, node) => {
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  }, [onNodeSelect]);
  
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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

### 2.3 カスタムノードコンポーネント

```jsx
// components/nodes/ConceptNode.jsx
import { useState } from 'react';
import { Handle, Position } from 'reactflow';
import styles from '../../styles/Nodes.module.css';

export default function ConceptNode({ data }) {
  const [isHovered, setIsHovered] = useState(false);
  
  // 重要度に基づくサイズ計算
  const size = data.importance ? 30 + data.importance * 10 : 40;
  
  return (
    <div
      className={styles.conceptNode}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle type="target" position={Position.Top} />
      <div className={styles.label}>{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
      
      {/* ホバー時の詳細表示 */}
      {isHovered && (
        <div className={styles.nodeDetails}>
          <h4>{data.label}</h4>
          <p>{data.description}</p>
          {data.properties && Object.entries(data.properties).map(([key, value]) => (
            <div key={key}>
              <strong>{key}:</strong> {value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// components/nodes/EntityNode.jsx
import { useState } from 'react';
import { Handle, Position } from 'reactflow';
import styles from '../../styles/Nodes.module.css';

export default function EntityNode({ data }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div
      className={styles.entityNode}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle type="target" position={Position.Top} />
      <div className={styles.label}>{data.label}</div>
      <Handle type="source" position={Position.Bottom} />
      
      {/* ホバー時の詳細表示 */}
      {isHovered && (
        <div className={styles.nodeDetails}>
          <h4>{data.label}</h4>
          <p>{data.description}</p>
          {data.properties && Object.entries(data.properties).map(([key, value]) => (
            <div key={key}>
              <strong>{key}:</strong> {value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// components/nodes/AgentNode.jsx
import { Handle, Position } from 'reactflow';
import styles from '../../styles/Nodes.module.css';

export default function AgentNode({ data }) {
  // エージェントタイプに基づくアイコン
  const getAgentIcon = (agentType) => {
    switch(agentType) {
      case 'coordinator': return '🧠';
      case 'info-gatherer': return '🔍';
      case 'analyzer': return '📊';
      case 'graph-updater': return '📝';
      default: return '🤖';
    }
  };
  
  // ステータスに基づく色
  const getStatusColor = (status) => {
    switch(status) {
      case 'Running': return '#4caf50';
      case 'Error': return '#f44336';
      case 'Completed': return '#2196f3';
      default: return '#9e9e9e';
    }
  };
  
  return (
    <div className={`${styles.agentNode} ${styles[data.agentType]}`}>
      <Handle type="target" position={Position.Top} />
      <div className={styles.agentHeader}>
        <span className={styles.agentIcon}>{getAgentIcon(data.agentType)}</span>
        <span className={styles.agentName}>{data.label}</span>
      </div>
      <div 
        className={styles.agentStatus}
        style={{ color: getStatusColor(data.status) }}
      >
        {data.status || 'Idle'}
      </div>
      {data.lastMessage && (
        <div className={styles.agentMessage}>
          <small>最新メッセージ:</small>
          <p>{data.lastMessage.length > 50 ? data.lastMessage.substring(0, 50) + '...' : data.lastMessage}</p>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### 2.4 カスタムエッジコンポーネント

```jsx
// components/edges/DataFlowEdge.jsx
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';
import styles from '../../styles/Edges.module.css';

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
          className={styles.edgeLabel}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          {data?.label}
          {data?.transferring && (
            <div className={styles.dataTransferIndicator} />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
```

### 2.5 チャットパネルコンポーネント

```jsx
// components/ChatPanel.jsx
import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import styles from '../styles/ChatPanel.module.css';

export default function ChatPanel({ selectedNode }) {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);
  
  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Socket.IOを使用したリアルタイムメッセージ受信
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    socket.on('agent-message', (message) => {
      setMessages((msgs) => [...msgs, message]);
    });
    
    return () => {
      socket.off('agent-message');
    };
  }, []);
  
  // エージェントタイプに基づくアイコン
  const getAgentIcon = (agentType) => {
    switch(agentType) {
      case 'coordinator': return '🧠';
      case 'info-gatherer': return '🔍';
      case 'analyzer': return '📊';
      case 'graph-updater': return '📝';
      default: return '🤖';
    }
  };
  
  // タイムスタンプのフォーマット
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatHeader}>
        <h3>AIエージェント対話</h3>
        {selectedNode && (
          <div className={styles.selectedNode}>
            選択中: {selectedNode.data.label}
          </div>
        )}
      </div>
      
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>AIエージェントの対話がここに表示されます。</p>
            <p>「AIトレンド分析を開始」ボタンをクリックして、エージェントを起動してください。</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`${styles.message} ${styles[msg.agentType]}`}>
              <div className={styles.agentHeader}>
                <span className={styles.agentIcon}>{getAgentIcon(msg.agentType)}</span>
                <span className={styles.agentName}>{msg.agentName}</span>
              </div>
              <div className={styles.content}>{msg.content}</div>
              <div className={styles.timestamp}>{formatTimestamp(msg.timestamp)}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
```

### 2.6 Socket.IO初期化

```javascript
// lib/socket.js
import { io } from 'socket.io-client';

let socket;

export function initSocket() {
  if (!socket) {
    // Socket.IOサーバーの初期化
    fetch('/api/socket');
    
    // クライアント側のSocket.IOインスタンスを作成
    socket = io();
    
    socket.on('connect', () => {
      console.log('Socket connected');
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }
  
  return socket;
}

// Socket.IOインスタンスを取得
export function getSocket() {
  if (!socket) {
    return initSocket();
  }
  return socket;
}
```

### 2.7 スタイル定義

```css
/* styles/Home.module.css */
.container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e1e1e1;
}

.title {
  margin: 0;
  font-size: 1.5rem;
}

.controls {
  display: flex;
  gap: 0.5rem;
}

.button {
  padding: 0.5rem 1rem;
  background-color: #0070f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: background-color 0.2s;
}

.button:hover {
  background-color: #0051a8;
}

.content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.graphContainer {
  flex: 3;
  height: 100%;
}

.chatContainer {
  flex: 1;
  min-width: 300px;
  max-width: 400px;
  height: 100%;
}

/* styles/Nodes.module.css */
.conceptNode {
  border-radius: 50%;
  background-color: #d4f1f9;
  border: 2px solid #75c6ef;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.3s ease;
}

.entityNode {
  background-color: #e2f0cb;
  border: 2px solid #b1ce7e;
  border-radius: 5px;
  padding: 10px;
  width: 150px;
  transition: all 0.3s ease;
}

.agentNode {
  background-color: #ffdfba;
  border: 2px solid #ffb347;
  border-radius: 5px;
  padding: 10px;
  width: 180px;
}

.agentNode.coordinator {
  background-color: #e1f5fe;
  border-color: #4fc3f7;
}

.agentNode.info-gatherer {
  background-color: #e8f5e9;
  border-color: #66bb6a;
}

.agentNode.analyzer {
  background-color: #fff3e0;
  border-color: #ffb74d;
}

.agentNode.graph-updater {
  background-color: #f3e5f5;
  border-color: #ba68c8;
}

.label {
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

.nodeDetails {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: white;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  z-index: 10;
  width: 200px;
  font-size: 12px;
}

.nodeDetails h4 {
  margin: 0 0 5px;
  font-size: 14px;
}

.nodeDetails p {
  margin: 0 0 8px;
}

.agentHeader {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.agentIcon {
  margin-right: 5px;
  font-size: 16px;
}

.agentName {
  font-weight: 600;
  font-size: 12px;
}

.agentStatus {
  font-size: 11px;
  font-weight: 500;
  margin-bottom: 5px;
}

.agentMessage {
  font-size: 10px;
  background-color: rgba(255, 255, 255, 0.5);
  padding: 5px;
  border-radius: 3px;
}

.agentMessage small {
  display: block;
  margin-bottom: 2px;
  color: #666;
}

.agentMessage p {
  margin: 0;
}

/* styles/Edges.module.css */
.edgeLabel {
  position: absolute;
  background: #f0f0f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  pointer-events: none;
  white-space: nowrap;
}

.dataTransferIndicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #4caf50;
  display: inline-block;
  margin-left: 5px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.8);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
  100% {
    transform: scale(0.8);
    opacity: 0.7;
  }
}

/* styles/ChatPanel.module.css */
.chatPanel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-left: 1px solid #e1e1e1;
  background-color: #f9f9f9;
}

.chatHeader {
  padding: 15px;
  border-bottom: 1px solid #e1e1e1;
  background-color: #fff;
}

.chatHeader h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.selectedNode {
  font-size: 12px;
  color: #666;
  margin-top: 5px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  text-align: center;
  padding: 0 20px;
}

.message {
  max-width: 85%;
  padding: 10px 15px;
  border-radius: 10px;
  position: relative;
  font-size: 14px;
  line-height: 1.4;
}

.message.coordinator {
  align-self: flex-start;
  background-color: #e1f5fe;
  border-bottom-left-radius: 0;
}

.message.info-gatherer {
  align-self: flex-start;
  background-color: #e8f5e9;
  border-bottom-left-radius: 0;
}

.message.analyzer {
  align-self: flex-start;
  background-color: #fff3e0;
  border-bottom-left-radius: 0;
}

.message.graph-updater {
  align-self: flex-start;
  background-color: #f3e5f5;
  border-bottom-left-radius: 0;
}

.agentHeader {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
  font-weight: 600;
  font-size: 12px;
}

.agentIcon {
  margin-right: 5px;
  font-size: 16px;
}

.content {
  word-break: break-word;
}

.timestamp {
  font-size: 10px;
  color: #888;
  margin-top: 5px;
  text-align: right;
}
```

## 3. バックエンド実装

### 3.1 Socket.IOサーバー

```javascript
// pages/api/socket.js
import { Server } from 'socket.io';
import { runAgent, getAgentStatus } from '../../lib/agents';

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
      io.emit('agent-message', {
        agentId,
        agentName: getAgentStatus(agentId).name,
        agentType: getAgentStatus(agentId).type,
        content: `タスクを開始します: ${input}`,
        status: 'Running',
        timestamp: new Date().toISOString(),
      });
      
      try {
        // AIエージェントの実行
        const result = await runAgent(agentId, input, (message) => {
          // 中間メッセージをクライアントに送信
          io.emit('agent-message', {
            ...message,
            timestamp: new Date().toISOString(),
          });
        });
        
        // 最終結果をクライアントに送信
        io.emit('agent-message', {
          agentId,
          agentName: getAgentStatus(agentId).name,
          agentType: getAgentStatus(agentId).type,
          content: result,
          status: 'Completed',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error running agent:', error);
        
        // エラーメッセージをクライアントに送信
        io.emit('agent-message', {
          agentId,
          agentName: getAgentStatus(agentId).name,
          agentType: getAgentStatus(agentId).type,
          content: `エラーが発生しました: ${error.message}`,
          status: 'Error',
          timestamp: new Date().toISOString(),
        });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
  
  res.end();
}
```

### 3.2 グラフ管理API

```javascript
// pages/api/graph/index.js
import { getGraphData, updateGraph } from '../../../lib/graph';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // グラフデータの取得
      const data = await getGraphData();
      res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching graph data:', error);
      res.status(500).json({ error: 'Failed to fetch graph data' });
    }
  } else if (req.method === 'POST') {
    try {
      // グラフデータの更新
      const { nodes, edges } = req.body;
      await updateGraph(nodes, edges);
      
      // Socket.IOを使用してクライアントに更新を通知
      if (res.socket.server.io) {
        res.socket.server.io.emit('graph-update', { nodes, edges });
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating graph:', error);
      res.status(500).json({ error: 'Failed to update graph' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
```

### 3.3 エージェント管理API

```javascript
// pages/api/agents/index.js
import { getAgents, createAgent } from '../../../lib/agents';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // エージェントのリストを取得
      const agents = await getAgents();
      res.status(200).json({ agents });
    } catch (error) {
      console.error('Error fetching agents:', error);
      res.status(500).json({ error: 'Failed to fetch agents' });
    }
  } else if (req.method === 'POST') {
    try {
      // 新しいエージェントを作成
      const { name, type, config } = req.body;
      const agent = await createAgent(name, type, config);
      res.status(201).json({ agent });
    } catch (error) {
      console.error('Error creating agent:', error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
```

## 4. AIエージェント実装

### 4.1 エージェント管理モジュール

```javascript
// lib/agents/index.js
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// エージェントの状態を保持
const agentState = {
  '1': {
    name: 'コーディネーター',
    type: 'coordinator',
    status: 'Idle',
  },
  '2': {
    name: '情報収集',
    type: 'info-gatherer',
    status: 'Idle',
  },
  '3': {
    name: '分析',
    type: 'analyzer',
    status: 'Idle',
  },
  '4': {
    name: 'グラフ更新',
    type: 'graph-updater',
    status: 'Idle',
  },
};

// エージェントの実行
export async function runAgent(agentId, input, onMessage) {
  const agentInfo = agentState[agentId];
  if (!agentInfo) {
    throw new Error(`Agent not found: ${agentId}`);
  }
  
  // エージェントの状態を更新
  agentState[agentId].status = 'Running';
  
  // 入力データをJSONファイルに保存
  const inputData = {
    agentId,
    agentType: agentInfo.type,
    input,
  };
  
  const inputFile = path.join(process.cwd(), 'temp', `input_${agentId}.json`);
  const outputFile = path.join(process.cwd(), 'temp', `output_${agentId}.json`);
  
  // tempディレクトリが存在しない場合は作成
  if (!fs.existsSync(path.join(process.cwd(), 'temp'))) {
    fs.mkdirSync(path.join(process.cwd(), 'temp'));
  }
  
  fs.writeFileSync(inputFile, JSON.stringify(inputData));
  
  return new Promise((resolve, reject) => {
    // Pythonスクリプトを実行
    const pythonProcess = spawn('python', [
      path.join(process.cwd(), 'scripts', 'run_agent.py'),
      inputFile,
      outputFile,
    ]);
    
    let dataString = '';
    
    // 標準出力からデータを受け取る
    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
      
      // JSONメッセージを探す
      try {
        const jsonStart = dataString.indexOf('{');
        const jsonEnd = dataString.lastIndexOf('}') + 1;
        
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const jsonStr = dataString.substring(jsonStart, jsonEnd);
          const message = JSON.parse(jsonStr);
          
          if (message.type === 'agent_message') {
            // 中間メッセージをコールバックに渡す
            if (onMessage) {
              onMessage({
                agentId: message.agentId,
                agentName: message.agentName,
                agentType: message.agentType,
                content: message.content,
                status: 'Running',
              });
            }
          }
          
          // 処理済みのJSONを削除
          dataString = dataString.substring(jsonEnd);
        }
      } catch (error) {
        console.error('Error parsing JSON from Python process:', error);
      }
    });
    
    // エラー出力からデータを受け取る
    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python process error: ${data}`);
    });
    
    // プロセスが終了したときの処理
    pythonProcess.on('close', (code) => {
      // エージェントの状態を更新
      agentState[agentId].status = 'Idle';
      
      if (code !== 0) {
        return reject(new Error(`Python process exited with code ${code}`));
      }
      
      try {
        // 出力ファイルを読み込む
        const outputData = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
        resolve(outputData.result);
      } catch (error) {
        reject(new Error(`Failed to read output file: ${error.message}`));
      }
    });
  });
}

// エージェントのリストを取得
export function getAgents() {
  return Object.entries(agentState).map(([id, info]) => ({
    id,
    name: info.name,
    type: info.type,
    status: info.status,
  }));
}

// エージェントの状態を取得
export function getAgentStatus(agentId) {
  return agentState[agentId] || { name: 'Unknown', type: 'unknown', status: 'Unknown' };
}

// 新しいエージェントを作成
export async function createAgent(name, type, config) {
  // IDの生成
  const id = Math.random().toString(36).substring(2, 15);
  
  // エージェントの状態を保存
  agentState[id] = {
    name,
    type,
    status: 'Idle',
    config,
  };
  
  return {
    id,
    name,
    type,
    status: 'Idle',
  };
}
```

### 4.2 Pythonエージェント実行スクリプト

```python
# scripts/run_agent.py
import sys
import json
import time
import os
from crewai import Agent, Task, Crew, Process
from crewai_tools import LlamaIndexTool
from langchain.tools import BaseTool
from pydantic import Field
from langchain_community.utilities import GoogleSerperAPIWrapper
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader
from llama_index.core.tools import FunctionTool

# 引数の取得
input_file = sys.argv[1]
output_file = sys.argv[2]

# 入力ファイルの読み込み
with open(input_file, 'r') as f:
    input_data = json.load(f)

agent_id = input_data['agentId']
agent_type = input_data['agentType']
input_text = input_data['input']

# エージェントの種類に応じた処理
def run_coordinator_agent(input_text):
    # コーディネーターエージェントの実装
    print(json.dumps({
        "type": "agent_message",
        "agentId": "1",
        "agentName": "コーディネーター",
        "agentType": "coordinator",
        "content": "タスクを分析しています..."
    }))
    time.sleep(1)
    
    print(json.dumps({
        "type": "agent_message",
        "agentId": "1",
        "agentName": "コーディネーター",
        "agentType": "coordinator",
        "content": "情報収集エージェントにタスクを割り当てます。"
    }))
    time.sleep(1)
    
    # 情報収集エージェントにタスクを割り当て
    print(json.dumps({
        "type": "agent_message",
        "agentId": "2",
        "agentName": "情報収集",
        "agentType": "info-gatherer",
        "content": f"「{input_text}」について情報を収集します。"
    }))
    time.sleep(2)
    
    print(json.dumps({
        "type": "agent_message",
        "agentId": "2",
        "agentName": "情報収集",
        "agentType": "info-gatherer",
        "content": "最新のAIトレンドに関する情報を収集しています..."
    }))
    time.sleep(2)
    
    # 収集した情報
    collected_info = """
    1. 生成AIの進化: GPT-4oやClaude 3などの最新モデルは、マルチモーダル能力と推論能力が大幅に向上しています。
    2. AIエージェント: 自律的にタスクを実行するAIエージェントが注目されており、CrewAI、AutoGenなどのフレームワークが人気です。
    3. RAG（検索拡張生成）: LlamaIndexなどを使用したRAGアプローチが、正確で最新の情報を提供するために広く採用されています。
    4. マルチモーダルAI: テキスト、画像、音声、動画を統合的に処理できるAIモデルが急速に発展しています。
    5. AIの小型化: 小規模デバイスでも動作する効率的なAIモデルの開発が進んでいます。
    """
    
    print(json.dumps({
        "type": "agent_message",
        "agentId": "2",
        "agentName": "情報収集",
        "agentType": "info-gatherer",
        "content": f"情報収集が完了しました。分析エージェントに転送します。\n\n{collected_info}"
    }))
    time.sleep(1)
    
    # 分析エージェントにタスクを割り当て
    print(json.dumps({
        "type": "agent_message",
        "agentId": "3",
        "agentName": "分析",
        "agentType": "analyzer",
        "content": "収集された情報を分析しています..."
    }))
    time.sleep(2)
    
    # 分析結果
    analysis_result = """
    分析結果:
    
    1. 主要トレンド: 生成AI、AIエージェント、RAG、マルチモーダルAI、AIの小型化が現在の主要トレンドです。
    
    2. 関連性:
       - 生成AI: GPT-4o、Claude 3、Llama 3などのモデルが中心
       - AIエージェント: CrewAI、AutoGen、LangChainなどのフレームワークが重要
       - RAG: LlamaIndex、Pinecone、Chromaなどのベクトルデータベースが関連
       
    3. ノード間の関係:
       - 生成AI → AIエージェント (基盤技術として利用)
       - RAG → 生成AI (情報検索と生成の組み合わせ)
       - マルチモーダルAI → 生成AI (能力の拡張)
    """
    
    print(json.dumps({
        "type": "agent_message",
        "agentId": "3",
        "agentName": "分析",
        "agentType": "analyzer",
        "content": f"分析が完了しました。グラフ更新エージェントに転送します。\n\n{analysis_result}"
    }))
    time.sleep(1)
    
    # グラフ更新エージェントにタスクを割り当て
    print(json.dumps({
        "type": "agent_message",
        "agentId": "4",
        "agentName": "グラフ更新",
        "agentType": "graph-updater",
        "content": "ナレッジグラフを更新しています..."
    }))
    time.sleep(2)
    
    # グラフ更新結果
    update_result = """
    ナレッジグラフを更新しました:
    
    新規ノード:
    - 生成AI (Concept)
    - GPT-4o (Entity)
    - Claude 3 (Entity)
    - Llama 3 (Entity)
    - AIエージェント (Concept)
    - CrewAI (Entity)
    - AutoGen (Entity)
    - RAG (Concept)
    - LlamaIndex (Entity)
    - マルチモーダルAI (Concept)
    
    新規エッジ:
    - AI → 生成AI (包含)
    - 生成AI → GPT-4o (例)
    - 生成AI → Claude 3 (例)
    - 生成AI → Llama 3 (例)
    - AI → AIエージェント (包含)
    - AIエージェント → CrewAI (例)
    - AIエージェント → AutoGen (例)
    - 生成AI → AIエージェント (基盤技術)
    - AI → RAG (包含)
    - RAG → LlamaIndex (例)
    - RAG → 生成AI (補完)
    - AI → マルチモーダルAI (包含)
    - マルチモーダルAI → 生成AI (拡張)
    """
    
    print(json.dumps({
        "type": "agent_message",
        "agentId": "4",
        "agentName": "グラフ更新",
        "agentType": "graph-updater",
        "content": f"ナレッジグラフの更新が完了しました。\n\n{update_result}"
    }))
    time.sleep(1)
    
    # コーディネーターエージェントの最終レポート
    final_report = """
    タスク完了レポート:
    
    AIの最新トレンドに関する情報を収集し、分析した結果をナレッジグラフに反映しました。
    
    主要トレンド:
    1. 生成AI (GPT-4o, Claude 3, Llama 3)
    2. AIエージェント (CrewAI, AutoGen)
    3. RAG - 検索拡張生成 (LlamaIndex)
    4. マルチモーダルAI
    5. AIの小型化
    
    これらのトレンドとその関連性をナレッジグラフに追加し、AIの最新動向を視覚的に把握できるようになりました。
    """
    
    return final_report

def run_info_gatherer_agent(input_text):
    # 情報収集エージェントの実装
    print(json.dumps({
        "type": "agent_message",
        "agentId": "2",
        "agentName": "情報収集",
        "agentType": "info-gatherer",
        "content": f"「{input_text}」について情報を収集します。"
    }))
    time.sleep(2)
    
    # 情報収集の結果
    result = """
    情報収集結果:
    
    1. 生成AIの進化: GPT-4oやClaude 3などの最新モデルは、マルチモーダル能力と推論能力が大幅に向上しています。
    2. AIエージェント: 自律的にタスクを実行するAIエージェントが注目されており、CrewAI、AutoGenなどのフレームワークが人気です。
    3. RAG（検索拡張生成）: LlamaIndexなどを使用したRAGアプローチが、正確で最新の情報を提供するために広く採用されています。
    4. マルチモーダルAI: テキスト、画像、音声、動画を統合的に処理できるAIモデルが急速に発展しています。
    5. AIの小型化: 小規模デバイスでも動作する効率的なAIモデルの開発が進んでいます。
    """
    
    return result

def run_analyzer_agent(input_text):
    # 分析エージェントの実装
    print(json.dumps({
        "type": "agent_message",
        "agentId": "3",
        "agentName": "分析",
        "agentType": "analyzer",
        "content": "収集された情報を分析しています..."
    }))
    time.sleep(2)
    
    # 分析結果
    result = """
    分析結果:
    
    1. 主要トレンド: 生成AI、AIエージェント、RAG、マルチモーダルAI、AIの小型化が現在の主要トレンドです。
    
    2. 関連性:
       - 生成AI: GPT-4o、Claude 3、Llama 3などのモデルが中心
       - AIエージェント: CrewAI、AutoGen、LangChainなどのフレームワークが重要
       - RAG: LlamaIndex、Pinecone、Chromaなどのベクトルデータベースが関連
       
    3. ノード間の関係:
       - 生成AI → AIエージェント (基盤技術として利用)
       - RAG → 生成AI (情報検索と生成の組み合わせ)
       - マルチモーダルAI → 生成AI (能力の拡張)
    """
    
    return result

def run_graph_updater_agent(input_text):
    # グラフ更新エージェントの実装
    print(json.dumps({
        "type": "agent_message",
        "agentId": "4",
        "agentName": "グラフ更新",
        "agentType": "graph-updater",
        "content": "ナレッジグラフを更新しています..."
    }))
    time.sleep(2)
    
    # グラフ更新結果
    result = """
    ナレッジグラフを更新しました:
    
    新規ノード:
    - 生成AI (Concept)
    - GPT-4o (Entity)
    - Claude 3 (Entity)
    - Llama 3 (Entity)
    - AIエージェント (Concept)
    - CrewAI (Entity)
    - AutoGen (Entity)
    - RAG (Concept)
    - LlamaIndex (Entity)
    - マルチモーダルAI (Concept)
    
    新規エッジ:
    - AI → 生成AI (包含)
    - 生成AI → GPT-4o (例)
    - 生成AI → Claude 3 (例)
    - 生成AI → Llama 3 (例)
    - AI → AIエージェント (包含)
    - AIエージェント → CrewAI (例)
    - AIエージェント → AutoGen (例)
    - 生成AI → AIエージェント (基盤技術)
    - AI → RAG (包含)
    - RAG → LlamaIndex (例)
    - RAG → 生成AI (補完)
    - AI → マルチモーダルAI (包含)
    - マルチモーダルAI → 生成AI (拡張)
    """
    
    # グラフ更新の通知
    # 実際のアプリケーションでは、ここでグラフデータベースを更新し、
    # Socket.IOを通じてクライアントに更新を通知します
    
    return result

# エージェントの種類に応じた処理を実行
if agent_type == 'coordinator':
    result = run_coordinator_agent(input_text)
elif agent_type == 'info-gatherer':
    result = run_info_gatherer_agent(input_text)
elif agent_type == 'analyzer':
    result = run_analyzer_agent(input_text)
elif agent_type == 'graph-updater':
    result = run_graph_updater_agent(input_text)
else:
    result = f"Unknown agent type: {agent_type}"

# 結果を出力ファイルに保存
with open(output_file, 'w') as f:
    json.dump({
        "agentId": agent_id,
        "agentType": agent_type,
        "result": result
    }, f)

# 正常終了
sys.exit(0)
```

## 5. ナレッジグラフ実装

### 5.1 グラフ管理モジュール

```javascript
// lib/graph/index.js
import neo4j from 'neo4j-driver';

// Neo4jドライバーの初期化
let driver;

try {
  driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'password'
    )
  );
} catch (error) {
  console.error('Failed to create Neo4j driver:', error);
}

// グラフデータの取得
export async function getGraphData() {
  // Neo4jが利用できない場合はデモデータを返す
  if (!driver) {
    return getDemoGraphData();
  }
  
  const session = driver.session();
  
  try {
    // ノードの取得
    const nodesResult = await session.run(`
      MATCH (n)
      RETURN id(n) as id, labels(n) as labels, properties(n) as properties
    `);
    
    const nodes = nodesResult.records.map(record => {
      const id = record.get('id').toString();
      const labels = record.get('labels');
      const properties = record.get('properties');
      
      // ノードタイプの決定
      let type = 'default';
      if (labels.includes('Concept')) {
        type = 'concept';
      } else if (labels.includes('Entity')) {
        type = 'entity';
      } else if (labels.includes('Agent')) {
        type = 'agent';
      }
      
      return {
        id,
        type,
        position: { x: properties.x || 0, y: properties.y || 0 },
        data: {
          label: properties.name || id,
          ...properties,
        },
      };
    });
    
    // エッジの取得
    const edgesResult = await session.run(`
      MATCH (a)-[r]->(b)
      RETURN id(r) as id, type(r) as type, properties(r) as properties, id(a) as source, id(b) as target
    `);
    
    const edges = edgesResult.records.map(record => {
      const id = record.get('id').toString();
      const type = record.get('type');
      const properties = record.get('properties');
      const source = record.get('source').toString();
      const target = record.get('target').toString();
      
      return {
        id,
        source,
        target,
        type: 'dataFlow',
        animated: properties.animated || false,
        data: {
          label: properties.label || type,
          ...properties,
        },
      };
    });
    
    return { nodes, edges };
  } catch (error) {
    console.error('Error fetching graph data from Neo4j:', error);
    return getDemoGraphData();
  } finally {
    await session.close();
  }
}

// グラフの更新
export async function updateGraph(nodes, edges) {
  // Neo4jが利用できない場合は成功を返す
  if (!driver) {
    console.log('Neo4j not available, skipping graph update');
    return true;
  }
  
  const session = driver.session();
  
  try {
    // トランザクションを開始
    const txc = session.beginTransaction();
    
    // ノードの更新
    for (const node of nodes) {
      const { id, type, position, data } = node;
      
      // ノードタイプに基づいてラベルを決定
      let label = 'Node';
      if (type === 'concept') {
        label = 'Concept';
      } else if (type === 'entity') {
        label = 'Entity';
      } else if (type === 'agent') {
        label = 'Agent';
      }
      
      // 既存のノードを更新または新しいノードを作成
      if (id.startsWith('new-')) {
        // 新しいノードを作成
        await txc.run(`
          CREATE (n:${label} {
            name: $name,
            x: $x,
            y: $y,
            description: $description,
            importance: $importance
          })
        `, {
          name: data.label,
          x: position.x,
          y: position.y,
          description: data.description || '',
          importance: data.importance || 1,
        });
      } else {
        // 既存のノードを更新
        await txc.run(`
          MATCH (n)
          WHERE id(n) = $id
          SET n.name = $name,
              n.description = $description,
              n.importance = $importance,
              n.x = $x,
              n.y = $y
        `, {
          id: parseInt(id),
          name: data.label,
          description: data.description || '',
          importance: data.importance || 1,
          x: position.x,
          y: position.y,
        });
      }
    }
    
    // エッジの更新
    for (const edge of edges) {
      const { id, source, target, data } = edge;
      
      // エッジタイプの決定
      const edgeType = data?.label?.replace(/\s+/g, '_').toUpperCase() || 'RELATED_TO';
      
      // 既存のエッジを更新または新しいエッジを作成
      if (id.startsWith('new-')) {
        // 新しいエッジを作成
        await txc.run(`
          MATCH (a), (b)
          WHERE id(a) = $source AND id(b) = $target
          CREATE (a)-[r:${edgeType} {
            label: $label,
            animated: $animated
          }]->(b)
        `, {
          source: parseInt(source),
          target: parseInt(target),
          label: data?.label || edgeType,
          animated: data?.animated || false,
        });
      } else {
        // 既存のエッジを更新
        await txc.run(`
          MATCH ()-[r]->()
          WHERE id(r) = $id
          SET r.label = $label,
              r.animated = $animated
        `, {
          id: parseInt(id),
          label: data?.label || edgeType,
          animated: data?.animated || false,
        });
      }
    }
    
    // トランザクションをコミット
    await txc.commit();
    
    return true;
  } catch (error) {
    console.error('Error updating graph in Neo4j:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// デモ用のグラフデータ
function getDemoGraphData() {
  return {
    nodes: [
      {
        id: '1',
        type: 'agent',
        position: { x: 250, y: 100 },
        data: { 
          label: 'コーディネーター', 
          agentId: '1',
          agentType: 'coordinator',
          status: 'Idle',
        }
      },
      {
        id: '2',
        type: 'agent',
        position: { x: 100, y: 250 },
        data: { 
          label: '情報収集', 
          agentId: '2',
          agentType: 'info-gatherer',
          status: 'Idle',
        }
      },
      {
        id: '3',
        type: 'agent',
        position: { x: 250, y: 400 },
        data: { 
          label: '分析', 
          agentId: '3',
          agentType: 'analyzer',
          status: 'Idle',
        }
      },
      {
        id: '4',
        type: 'agent',
        position: { x: 400, y: 250 },
        data: { 
          label: 'グラフ更新', 
          agentId: '4',
          agentType: 'graph-updater',
          status: 'Idle',
        }
      },
      {
        id: '5',
        type: 'concept',
        position: { x: 250, y: 250 },
        data: { 
          label: 'AI', 
          description: '人工知能',
          importance: 5,
        }
      },
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', type: 'dataFlow', animated: true, data: { label: 'タスク割り当て' } },
      { id: 'e2-3', source: '2', target: '3', type: 'dataFlow', animated: true, data: { label: '情報転送' } },
      { id: 'e3-4', source: '3', target: '4', type: 'dataFlow', animated: true, data: { label: '分析結果' } },
      { id: 'e4-1', source: '4', target: '1', type: 'dataFlow', animated: true, data: { label: '更新通知' } },
      { id: 'e4-5', source: '4', target: '5', type: 'dataFlow', animated: false, data: { label: '更新' } },
    ],
  };
}
```

## まとめ

この実装例では、CrewAI、LangChain、LlamaIndexとReact Flowを統合したナレッジグラフシステムを構築する方法を示しました。主な特徴は以下の通りです：

1. **フロントエンド**:
   - React FlowによるAIエージェントとナレッジグラフの視覚化
   - カスタムノードとエッジによる直感的なUI
   - Socket.IOを使用したリアルタイム更新
   - チャットパネルによるAIエージェント間の対話表示

2. **バックエンド**:
   - Next.js API Routesによるサーバーサイド処理
   - Socket.IOによるリアルタイム通信
   - Neo4jによるグラフデータの管理
   - Pythonスクリプトによるエージェント実行

3. **AIエージェント**:
   - CrewAIによるエージェントオーケストレーション
   - LangChainによるツール統合
   - LlamaIndexによる情報検索と構造化

この実装例は、実際のプロジェクトで使用するための出発点として活用できます。必要に応じて、実際のCrewAI、LangChain、LlamaIndexの統合コードを追加し、より高度な機能を実装することができます。
