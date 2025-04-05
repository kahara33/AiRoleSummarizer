# React Flow可視化コンポーネントの強化

## 概要

現在のAIエージェント実装（CrewAI、LangChain、LlamaIndex）とReact Flowを効果的に統合するために、React Flow可視化コンポーネントを強化します。この文書では、カスタムノード、カスタムエッジ、インタラクション、レイアウト、アニメーションなどの側面から、React Flowコンポーネントの強化方法を詳細に説明します。

## 1. カスタムノードコンポーネント

### 1.1 エージェントノード（AgentNode）

エージェントの状態と進捗を視覚的に表現するカスタムノードです。

```jsx
// components/nodes/AgentNode.jsx
import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { FaBrain, FaSearch, FaProjectDiagram, FaNetworkWired } from 'react-icons/fa';

const AgentNode = ({ data, isConnectable }) => {
  const { label, agentType, status, progress, message, thoughts } = data;
  
  // ステータスに基づく色の決定
  const getStatusColor = () => {
    switch(status) {
      case 'completed': return '#4caf50';
      case 'in-progress': return '#2196f3';
      case 'error': return '#f44336';
      case 'waiting': return '#9e9e9e';
      default: return '#9e9e9e';
    }
  };
  
  // エージェントタイプに基づくアイコンの決定
  const getAgentIcon = () => {
    switch(agentType) {
      case 'industry-analysis': return <FaSearch size={24} />;
      case 'keyword-expansion': return <FaBrain size={24} />;
      case 'structuring': return <FaProjectDiagram size={24} />;
      case 'knowledge-graph': return <FaNetworkWired size={24} />;
      default: return <FaBrain size={24} />;
    }
  };
  
  return (
    <div className={`agent-node ${status}`} style={{ borderColor: getStatusColor() }}>
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="agent-handle agent-handle-target"
      />
      
      <div className="agent-header" style={{ backgroundColor: getStatusColor() }}>
        <div className="agent-icon">{getAgentIcon()}</div>
        <div className="agent-label">{label}</div>
      </div>
      
      <div className="agent-content">
        <div className="agent-progress">
          <CircularProgressbar 
            value={progress || 0} 
            text={`${progress || 0}%`}
            styles={buildStyles({
              pathColor: getStatusColor(),
              textColor: getStatusColor(),
              trailColor: '#e0e0e0'
            })}
          />
        </div>
        
        {message && (
          <div className="agent-message">
            {message}
          </div>
        )}
        
        {thoughts && thoughts.length > 0 && (
          <div className="agent-thoughts">
            <small>最新の思考:</small>
            <p className="thought-text">{thoughts[thoughts.length - 1].substring(0, 50)}...</p>
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="agent-handle agent-handle-source"
      />
    </div>
  );
};

export default memo(AgentNode);
```

対応するCSS:

```css
/* styles/nodes/AgentNode.module.css */
.agent-node {
  width: 220px;
  border: 2px solid #9e9e9e;
  border-radius: 8px;
  background-color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  overflow: hidden;
}

.agent-node:hover {
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.agent-node.in-progress {
  animation: pulse 2s infinite;
}

.agent-header {
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #9e9e9e;
  color: white;
}

.agent-icon {
  margin-right: 10px;
}

.agent-label {
  font-weight: bold;
  font-size: 14px;
}

.agent-content {
  padding: 15px;
}

.agent-progress {
  width: 60px;
  height: 60px;
  margin: 0 auto 10px;
}

.agent-message {
  margin-top: 10px;
  font-size: 12px;
  color: #555;
  text-align: center;
}

.agent-thoughts {
  margin-top: 10px;
  border-top: 1px dashed #ddd;
  padding-top: 10px;
}

.agent-thoughts small {
  color: #777;
  font-size: 11px;
}

.thought-text {
  font-size: 12px;
  font-style: italic;
  margin: 5px 0 0;
  color: #555;
}

.agent-handle {
  width: 10px;
  height: 10px;
}

.agent-handle-target {
  background-color: #ff9800;
}

.agent-handle-source {
  background-color: #2196f3;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(33, 150, 243, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
  }
}
```

### 1.2 概念ノード（ConceptNode）

概念（カテゴリ、サブカテゴリ）を表現するカスタムノードです。

```jsx
// components/nodes/ConceptNode.jsx
import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';

const ConceptNode = ({ data, isConnectable }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { label, description, importance, type } = data;
  
  // 重要度に基づくサイズと色の決定
  const getNodeSize = () => {
    const baseSize = 80;
    const importanceFactor = importance || 3;
    return baseSize + (importanceFactor * 10);
  };
  
  const getNodeColor = () => {
    switch(type) {
      case 'category': return '#673ab7'; // 紫
      case 'subcategory': return '#3f51b5'; // 青紫
      default: return '#2196f3'; // 青
    }
  };
  
  const size = getNodeSize();
  const color = getNodeColor();
  
  return (
    <div
      className="concept-node"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="concept-handle concept-handle-target"
      />
      
      <div className="concept-content">
        <div className="concept-label">{label}</div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="concept-handle concept-handle-source"
      />
      
      {/* ホバー時の詳細表示 */}
      {isHovered && description && (
        <div className="concept-tooltip">
          <h4>{label}</h4>
          <p>{description}</p>
          {data.keywords && (
            <div className="concept-keywords">
              <small>関連キーワード:</small>
              <div className="keyword-tags">
                {data.keywords.slice(0, 5).map((keyword, idx) => (
                  <span key={idx} className="keyword-tag">{keyword}</span>
                ))}
                {data.keywords.length > 5 && <span className="keyword-more">+{data.keywords.length - 5}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(ConceptNode);
```

対応するCSS:

```css
/* styles/nodes/ConceptNode.module.css */
.concept-node {
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  position: relative;
}

.concept-content {
  text-align: center;
  padding: 10px;
}

.concept-label {
  font-weight: bold;
  font-size: 14px;
  word-break: break-word;
  max-height: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.concept-handle {
  width: 8px;
  height: 8px;
}

.concept-handle-target {
  background-color: rgba(255, 255, 255, 0.8);
}

.concept-handle-source {
  background-color: rgba(255, 255, 255, 0.8);
}

.concept-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: white;
  color: #333;
  border-radius: 4px;
  padding: 10px;
  width: 220px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
  margin-top: 10px;
}

.concept-tooltip h4 {
  margin: 0 0 5px;
  color: #333;
  font-size: 14px;
}

.concept-tooltip p {
  margin: 0 0 8px;
  font-size: 12px;
  color: #555;
}

.concept-keywords {
  margin-top: 8px;
}

.concept-keywords small {
  font-size: 11px;
  color: #777;
  display: block;
  margin-bottom: 4px;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.keyword-tag {
  background-color: #e0e0e0;
  color: #555;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
}

.keyword-more {
  font-size: 10px;
  color: #777;
  padding: 2px 6px;
}
```

### 1.3 エンティティノード（EntityNode）

具体的な項目（エンティティ）を表現するカスタムノードです。

```jsx
// components/nodes/EntityNode.jsx
import { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';

const EntityNode = ({ data, isConnectable }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { label, description, importance, properties } = data;
  
  // 重要度に基づくサイズの決定
  const getNodeSize = () => {
    const baseSize = 60;
    const importanceFactor = importance || 1;
    return baseSize + (importanceFactor * 5);
  };
  
  const size = getNodeSize();
  
  return (
    <div
      className="entity-node"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="entity-handle entity-handle-target"
      />
      
      <div className="entity-content">
        <div className="entity-label">{label}</div>
      </div>
      
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="entity-handle entity-handle-source"
      />
      
      {/* ホバー時の詳細表示 */}
      {isHovered && (
        <div className="entity-tooltip">
          <h4>{label}</h4>
          {description && <p>{description}</p>}
          
          {properties && Object.keys(properties).length > 0 && (
            <div className="entity-properties">
              <small>プロパティ:</small>
              <ul className="property-list">
                {Object.entries(properties).map(([key, value]) => (
                  <li key={key} className="property-item">
                    <span className="property-key">{key}:</span>
                    <span className="property-value">{value.toString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(EntityNode);
```

対応するCSS:

```css
/* styles/nodes/EntityNode.module.css */
.entity-node {
  border-radius: 4px;
  background-color: #ff9800;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  position: relative;
}

.entity-content {
  text-align: center;
  padding: 8px;
}

.entity-label {
  font-weight: bold;
  font-size: 12px;
  word-break: break-word;
  max-height: 100%;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.entity-handle {
  width: 6px;
  height: 6px;
}

.entity-handle-target {
  background-color: rgba(255, 255, 255, 0.8);
}

.entity-handle-source {
  background-color: rgba(255, 255, 255, 0.8);
}

.entity-tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background-color: white;
  color: #333;
  border-radius: 4px;
  padding: 10px;
  width: 200px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  z-index: 10;
  margin-top: 10px;
}

.entity-tooltip h4 {
  margin: 0 0 5px;
  color: #333;
  font-size: 14px;
}

.entity-tooltip p {
  margin: 0 0 8px;
  font-size: 12px;
  color: #555;
}

.entity-properties {
  margin-top: 8px;
}

.entity-properties small {
  font-size: 11px;
  color: #777;
  display: block;
  margin-bottom: 4px;
}

.property-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.property-item {
  font-size: 11px;
  margin-bottom: 2px;
  display: flex;
}

.property-key {
  font-weight: bold;
  color: #555;
  margin-right: 4px;
}

.property-value {
  color: #777;
  word-break: break-all;
}
```

## 2. カスタムエッジコンポーネント

### 2.1 データフローエッジ（DataFlowEdge）

エージェント間のデータフローを表現するカスタムエッジです。

```jsx
// components/edges/DataFlowEdge.jsx
import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';

const DataFlowEdge = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style = {}, markerEnd, animated }) => {
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
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 2,
          stroke: '#2196f3',
        }}
        animated={animated}
      />
      
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="data-flow-edge-label"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              pointerEvents: 'all',
              border: '1px solid #2196f3',
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(DataFlowEdge);
```

### 2.2 知識エッジ（KnowledgeEdge）

概念/エンティティ間の関係を表現するカスタムエッジです。

```jsx
// components/edges/KnowledgeEdge.jsx
import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';

const KnowledgeEdge = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style = {}, markerEnd, animated }) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // エッジタイプに基づく色の決定
  const getEdgeColor = () => {
    if (!data || !data.label) return '#aaa';
    
    switch(data.label) {
      case '包含': return '#4caf50';
      case '関連': return '#ff9800';
      case '依存': return '#f44336';
      case '影響': return '#9c27b0';
      default: return '#2196f3';
    }
  };

  const edgeColor = getEdgeColor();

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 1.5,
          stroke: edgeColor,
        }}
        animated={animated}
      />
      
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="knowledge-edge-label"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: 'white',
              padding: '2px 6px',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 500,
              pointerEvents: 'all',
              border: `1px solid ${edgeColor}`,
              color: edgeColor,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(KnowledgeEdge);
```

## 3. メインコンポーネント

### 3.1 処理フローグラフ（ProcessFlowGraph）

AIエージェントの処理フローを視覚化するコンポーネントです。

```jsx
// components/ProcessFlowGraph.jsx
import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';

// カスタムノードとエッジのインポート
import AgentNode from './nodes/AgentNode';
import DataFlowEdge from './edges/DataFlowEdge';

// WebSocketクライアントのインポート
import { getSocket } from '../lib/socket';

// ノードタイプの登録
const nodeTypes = {
  agentNode: AgentNode,
};

// エッジタイプの登録
const edgeTypes = {
  dataFlowEdge: DataFlowEdge,
};

// 初期ノードの定義
const initialNodes = [
  {
    id: 'industry-analysis',
    type: 'agentNode',
    position: { x: 100, y: 200 },
    data: {
      label: '業界分析',
      agentId: '1',
      agentType: 'industry-analysis',
      stage: 'industry_analysis',
      status: 'waiting',
      progress: 0,
      thoughts: []
    }
  },
  {
    id: 'keyword-expansion',
    type: 'agentNode',
    position: { x: 400, y: 200 },
    data: {
      label: 'キーワード拡張',
      agentId: '2',
      agentType: 'keyword-expansion',
      stage: 'keyword_expansion',
      status: 'waiting',
      progress: 0,
      thoughts: []
    }
  },
  {
    id: 'structuring',
    type: 'agentNode',
    position: { x: 700, y: 200 },
    data: {
      label: '知識の構造化',
      agentId: '3',
      agentType: 'structuring',
      stage: 'structuring',
      status: 'waiting',
      progress: 0,
      thoughts: []
    }
  },
  {
    id: 'knowledge-graph',
    type: 'agentNode',
    position: { x: 1000, y: 200 },
    data: {
      label: '知識グラフ生成',
      agentId: '4',
      agentType: 'knowledge-graph',
      stage: 'knowledge_graph',
      status: 'waiting',
      progress: 0,
      thoughts: []
    }
  }
];

// 初期エッジの定義
const initialEdges = [
  {
    id: 'e1-2',
    source: 'industry-analysis',
    target: 'keyword-expansion',
    type: 'dataFlowEdge',
    animated: false,
    data: {
      label: '業界データ',
      sourceStage: 'industry_analysis'
    }
  },
  {
    id: 'e2-3',
    source: 'keyword-expansion',
    target: 'structuring',
    type: 'dataFlowEdge',
    animated: false,
    data: {
      label: 'キーワードデータ',
      sourceStage: 'keyword_expansion'
    }
  },
  {
    id: 'e3-4',
    source: 'structuring',
    target: 'knowledge-graph',
    type: 'dataFlowEdge',
    animated: false,
    data: {
      label: '構造化データ',
      sourceStage: 'structuring'
    }
  }
];

const ProcessFlowGraph = ({ onNodeClick, onAgentMessage }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // エッジの接続ハンドラ
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'dataFlowEdge' }, eds)),
    [setEdges]
  );

  // WebSocketイベントの処理
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    // 進捗状況の更新
    socket.on('progress-update', (data) => {
      const { stage, progress, details } = data;
      
      // ステージに応じてノードの状態を更新
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.data.stage === stage) {
            return {
              ...node,
              data: {
                ...node.data,
                progress,
                status: progress === 100 ? 'completed' : 'in-progress',
                message: details.message
              }
            };
          }
          return node;
        });
      });
      
      // 進捗状況に応じてエッジのアニメーションを制御
      if (progress === 100) {
        setEdges((eds) => {
          return eds.map((edge) => {
            if (edge.data?.sourceStage === stage) {
              return {
                ...edge,
                animated: true
              };
            }
            return edge;
          });
        });
      }
    });
    
    // エージェントの思考プロセス
    socket.on('agent-thoughts', (data) => {
      const { agentId, thoughts } = data;
      
      // エージェントの思考をノードに反映
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.data.agentId === agentId) {
            const updatedThoughts = [...(node.data.thoughts || []), thoughts];
            
            // エージェントメッセージをコールバックで通知
            if (onAgentMessage) {
              onAgentMessage({
                agentId,
                agentName: node.data.label,
                agentType: node.data.agentType,
                content: thoughts,
                timestamp: new Date().toISOString()
              });
            }
            
            return {
              ...node,
              data: {
                ...node.data,
                thoughts: updatedThoughts
              }
            };
          }
          return node;
        });
      });
    });
    
    // エージェント間の通信
    socket.on('agent-communication', (data) => {
      const { sourceAgentId, targetAgentId, message } = data;
      
      // 対応するエッジを一時的にハイライト
      setEdges((eds) => {
        return eds.map((edge) => {
          const sourceNode = nodes.find(n => n.data.agentId === sourceAgentId);
          const targetNode = nodes.find(n => n.data.agentId === targetAgentId);
          
          if (sourceNode && targetNode && edge.source === sourceNode.id && edge.target === targetNode.id) {
            // エッジを一時的にハイライト
            return {
              ...edge,
              style: { ...edge.style, strokeWidth: 3, stroke: '#ff4081' },
              data: {
                ...edge.data,
                tempMessage: message
              }
            };
          }
          return edge;
        });
      });
      
      // 3秒後にハイライトを解除
      setTimeout(() => {
        setEdges((eds) => {
          return eds.map((edge) => {
            if (edge.data?.tempMessage) {
              const { tempMessage, ...restData } = edge.data;
              return {
                ...edge,
                style: { ...edge.style, strokeWidth: 2, stroke: '#2196f3' },
                data: restData
              };
            }
            return edge;
          });
        });
      }, 3000);
    });
    
    return () => {
      socket.off('progress-update');
      socket.off('agent-thoughts');
      socket.off('agent-communication');
    };
  }, [setNodes, setEdges, nodes, onAgentMessage]);

  // ノードクリックハンドラ
  const handleNodeClick = (event, node) => {
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export default ProcessFlowGraph;
```

### 3.2 ナレッジグラフ（KnowledgeGraph）

生成されたナレッジグラフを表示するコンポーネントです。

```jsx
// components/KnowledgeGraph.jsx
import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

// カスタムノードとエッジのインポート
import ConceptNode from './nodes/ConceptNode';
import EntityNode from './nodes/EntityNode';
import KnowledgeEdge from './edges/KnowledgeEdge';

// WebSocketクライアントのインポート
import { getSocket } from '../lib/socket';

// ノードタイプの登録
const nodeTypes = {
  conceptNode: ConceptNode,
  entityNode: EntityNode,
};

// エッジタイプの登録
const edgeTypes = {
  knowledgeEdge: KnowledgeEdge,
};

const KnowledgeGraph = ({ onNodeClick, selectedVersion }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);

  // エッジの接続ハンドラ
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'knowledgeEdge' }, eds)),
    [setEdges]
  );

  // グラフデータの初期ロード
  useEffect(() => {
    const fetchGraphData = async () => {
      setLoading(true);
      try {
        const url = selectedVersion 
          ? `/api/knowledge-graph/versions/${selectedVersion}` 
          : '/api/knowledge-graph';
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch graph data');
        }
        
        const data = await response.json();
        
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
        }
      } catch (error) {
        console.error('Error fetching graph data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGraphData();
  }, [selectedVersion]);

  // WebSocketイベントの処理
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    // 知識グラフの更新
    socket.on('knowledge-graph-update', (data) => {
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
      }
    });
    
    // ノードの追加
    socket.on('node-added', (node) => {
      setNodes((nds) => [...nds, node]);
    });
    
    // エッジの追加
    socket.on('edge-added', (edge) => {
      setEdges((eds) => [...eds, edge]);
    });
    
    return () => {
      socket.off('knowledge-graph-update');
      socket.off('node-added');
      socket.off('edge-added');
    };
  }, [setNodes, setEdges]);

  // ノードクリックハンドラ
  const handleNodeClick = (event, node) => {
    if (onNodeClick) {
      onNodeClick(node);
    }
  };

  // ノードタイプによるフィルタリング
  const [nodeTypeFilter, setNodeTypeFilter] = useState({
    concept: true,
    entity: true,
  });

  // フィルタリングされたノードとエッジ
  const filteredNodes = nodes.filter((node) => {
    if (node.type === 'conceptNode' && !nodeTypeFilter.concept) return false;
    if (node.type === 'entityNode' && !nodeTypeFilter.entity) return false;
    return true;
  });

  const filteredEdges = edges.filter((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return false;
    
    if (sourceNode.type === 'conceptNode' && !nodeTypeFilter.concept) return false;
    if (sourceNode.type === 'entityNode' && !nodeTypeFilter.entity) return false;
    if (targetNode.type === 'conceptNode' && !nodeTypeFilter.concept) return false;
    if (targetNode.type === 'entityNode' && !nodeTypeFilter.entity) return false;
    
    return true;
  });

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {loading ? (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <div className="loading-text">ナレッジグラフを読み込み中...</div>
        </div>
      ) : (
        <ReactFlow
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        >
          <Controls />
          <MiniMap 
            nodeStrokeColor={(n) => {
              if (n.type === 'conceptNode') return '#673ab7';
              if (n.type === 'entityNode') return '#ff9800';
              return '#eee';
            }}
            nodeColor={(n) => {
              if (n.type === 'conceptNode') return '#673ab7';
              if (n.type === 'entityNode') return '#ff9800';
              return '#fff';
            }}
          />
          <Background variant="dots" gap={12} size={1} />
          
          <Panel position="top-right">
            <div className="filter-panel">
              <div className="filter-title">ノードフィルター</div>
              <div className="filter-options">
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={nodeTypeFilter.concept}
                    onChange={(e) => setNodeTypeFilter({ ...nodeTypeFilter, concept: e.target.checked })}
                  />
                  <span className="filter-label">概念</span>
                </label>
                <label className="filter-option">
                  <input
                    type="checkbox"
                    checked={nodeTypeFilter.entity}
                    onChange={(e) => setNodeTypeFilter({ ...nodeTypeFilter, entity: e.target.checked })}
                  />
                  <span className="filter-label">エンティティ</span>
                </label>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      )}
    </div>
  );
};

export default KnowledgeGraph;
```

## 4. インタラクションの強化

### 4.1 ノードの詳細表示

ノードをクリックしたときに詳細情報を表示するコンポーネントです。

```jsx
// components/NodeDetails.jsx
import { useState } from 'react';
import { FaTimes, FaEdit, FaTrash } from 'react-icons/fa';

const NodeDetails = ({ node, onClose, onEdit, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(node?.data || {});
  
  if (!node) return null;
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleSave = () => {
    if (onEdit) {
      onEdit(node.id, editedData);
    }
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditedData(node.data);
    setIsEditing(false);
  };
  
  const handleDelete = () => {
    if (onDelete && window.confirm('このノードを削除してもよろしいですか？')) {
      onDelete(node.id);
      onClose();
    }
  };
  
  const renderNodeTypeSpecificDetails = () => {
    switch(node.type) {
      case 'agentNode':
        return (
          <div className="agent-specific-details">
            <div className="detail-item">
              <span className="detail-label">エージェントタイプ:</span>
              <span className="detail-value">{node.data.agentType}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">ステータス:</span>
              <span className={`detail-value status-${node.data.status}`}>{node.data.status}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">進捗:</span>
              <span className="detail-value">{node.data.progress || 0}%</span>
            </div>
            {node.data.thoughts && node.data.thoughts.length > 0 && (
              <div className="thoughts-container">
                <h4>思考プロセス:</h4>
                <div className="thoughts-list">
                  {node.data.thoughts.map((thought, index) => (
                    <div key={index} className="thought-item">
                      <div className="thought-content">{thought}</div>
                      <div className="thought-timestamp">
                        {new Date(node.data.thoughtTimestamps?.[index] || Date.now()).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      
      case 'conceptNode':
      case 'entityNode':
        return (
          <div className="knowledge-node-details">
            {!isEditing ? (
              <>
                <div className="detail-item">
                  <span className="detail-label">タイプ:</span>
                  <span className="detail-value">{node.type === 'conceptNode' ? '概念' : 'エンティティ'}</span>
                </div>
                {node.data.type && (
                  <div className="detail-item">
                    <span className="detail-label">サブタイプ:</span>
                    <span className="detail-value">{node.data.type}</span>
                  </div>
                )}
                <div className="detail-item">
                  <span className="detail-label">重要度:</span>
                  <span className="detail-value">{node.data.importance || 1}</span>
                </div>
                {node.data.description && (
                  <div className="detail-item">
                    <span className="detail-label">説明:</span>
                    <div className="detail-value description">{node.data.description}</div>
                  </div>
                )}
                {node.data.keywords && node.data.keywords.length > 0 && (
                  <div className="detail-item">
                    <span className="detail-label">キーワード:</span>
                    <div className="keywords-container">
                      {node.data.keywords.map((keyword, index) => (
                        <span key={index} className="keyword-tag">{keyword}</span>
                      ))}
                    </div>
                  </div>
                )}
                {node.data.properties && Object.keys(node.data.properties).length > 0 && (
                  <div className="detail-item">
                    <span className="detail-label">プロパティ:</span>
                    <div className="properties-container">
                      {Object.entries(node.data.properties).map(([key, value]) => (
                        <div key={key} className="property-item">
                          <span className="property-key">{key}:</span>
                          <span className="property-value">{value.toString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="edit-form">
                <div className="form-group">
                  <label>ラベル:</label>
                  <input
                    type="text"
                    value={editedData.label || ''}
                    onChange={(e) => setEditedData({ ...editedData, label: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>説明:</label>
                  <textarea
                    value={editedData.description || ''}
                    onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>重要度 (1-5):</label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={editedData.importance || 1}
                    onChange={(e) => setEditedData({ ...editedData, importance: parseInt(e.target.value) })}
                  />
                  <span>{editedData.importance || 1}</span>
                </div>
                <div className="form-actions">
                  <button className="btn-save" onClick={handleSave}>保存</button>
                  <button className="btn-cancel" onClick={handleCancel}>キャンセル</button>
                </div>
              </div>
            )}
          </div>
        );
      
      default:
        return (
          <div className="generic-node-details">
            <div className="detail-item">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{node.id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">タイプ:</span>
              <span className="detail-value">{node.type || 'default'}</span>
            </div>
          </div>
        );
    }
  };
  
  return (
    <div className="node-details-panel">
      <div className="panel-header">
        <h3>{node.data.label || 'ノード詳細'}</h3>
        <div className="panel-actions">
          {!isEditing && node.type !== 'agentNode' && (
            <>
              <button className="btn-icon" onClick={handleEdit} title="編集">
                <FaEdit />
              </button>
              <button className="btn-icon" onClick={handleDelete} title="削除">
                <FaTrash />
              </button>
            </>
          )}
          <button className="btn-icon" onClick={onClose} title="閉じる">
            <FaTimes />
          </button>
        </div>
      </div>
      <div className="panel-content">
        {renderNodeTypeSpecificDetails()}
      </div>
    </div>
  );
};

export default NodeDetails;
```

### 4.2 ズームとパン制御

ズームとパンの制御を強化するカスタムコントロールパネルです。

```jsx
// components/CustomControls.jsx
import { useCallback } from 'react';
import { useReactFlow, Panel } from 'reactflow';
import { FaSearchPlus, FaSearchMinus, FaExpand, FaCompress, FaRedo } from 'react-icons/fa';

const CustomControls = () => {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  
  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 300 });
  }, [zoomIn]);
  
  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 300 });
  }, [zoomOut]);
  
  const handleFitView = useCallback(() => {
    fitView({ duration: 500, padding: 0.1 });
  }, [fitView]);
  
  const handleReset = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 500 });
  }, [setViewport]);
  
  return (
    <Panel position="top-left" className="custom-controls">
      <button className="control-button" onClick={handleZoomIn} title="ズームイン">
        <FaSearchPlus />
      </button>
      <button className="control-button" onClick={handleZoomOut} title="ズームアウト">
        <FaSearchMinus />
      </button>
      <button className="control-button" onClick={handleFitView} title="全体表示">
        <FaExpand />
      </button>
      <button className="control-button" onClick={handleReset} title="リセット">
        <FaRedo />
      </button>
    </Panel>
  );
};

export default CustomControls;
```

## 5. レイアウトとアニメーション

### 5.1 自動レイアウト

ノードの自動レイアウトを実装するユーティリティ関数です。

```jsx
// utils/graphLayout.js
import dagre from 'dagre';

// ノードの自動レイアウト
export const getLayoutedElements = (nodes, edges, direction = 'LR', nodeWidth = 150, nodeHeight = 100) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // 方向の設定
  dagreGraph.setGraph({ rankdir: direction });
  
  // ノードの追加
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });
  
  // エッジの追加
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  
  // レイアウトの実行
  dagre.layout(dagreGraph);
  
  // 新しい位置を適用したノード
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });
  
  return { nodes: layoutedNodes, edges };
};

// 階層的レイアウト（カテゴリ、サブカテゴリ、アイテムの階層構造用）
export const getHierarchicalLayout = (nodes, edges) => {
  // ノードのタイプとレベルを特定
  const nodeTypes = {};
  nodes.forEach((node) => {
    if (node.data.type === 'category') {
      nodeTypes[node.id] = { level: 0, type: 'category' };
    } else if (node.data.type === 'subcategory') {
      nodeTypes[node.id] = { level: 1, type: 'subcategory' };
    } else {
      nodeTypes[node.id] = { level: 2, type: 'item' };
    }
  });
  
  // レベルごとにノードをグループ化
  const levelGroups = [[], [], []];
  nodes.forEach((node) => {
    const level = nodeTypes[node.id]?.level || 0;
    levelGroups[level].push(node);
  });
  
  // 各レベルのノードを配置
  const levelSpacing = 300;
  const nodeSpacing = 150;
  
  const layoutedNodes = [];
  
  levelGroups.forEach((group, level) => {
    const levelX = level * levelSpacing;
    
    group.forEach((node, index) => {
      const nodeCount = group.length;
      const totalHeight = nodeCount * nodeSpacing;
      const startY = -totalHeight / 2;
      const nodeY = startY + index * nodeSpacing;
      
      layoutedNodes.push({
        ...node,
        position: {
          x: levelX,
          y: nodeY,
        },
      });
    });
  });
  
  return { nodes: layoutedNodes, edges };
};
```

### 5.2 アニメーション効果

ノードとエッジのアニメーション効果を強化するCSSです。

```css
/* styles/animations.css */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(33, 150, 243, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes highlight {
  0% {
    filter: brightness(1);
  }
  50% {
    filter: brightness(1.3);
  }
  100% {
    filter: brightness(1);
  }
}

/* ノードのアニメーション */
.react-flow__node {
  transition: all 0.3s ease;
}

.react-flow__node--selected {
  animation: highlight 1s ease;
}

/* 新しく追加されたノード */
.react-flow__node.new-node {
  animation: fadeIn 0.5s ease;
}

/* エッジのアニメーション */
.react-flow__edge {
  transition: all 0.3s ease;
}

.react-flow__edge.highlighted {
  animation: highlight 1s infinite;
}

/* エッジラベルのアニメーション */
.edge-label-enter {
  opacity: 0;
  transform: translateY(-10px);
}

.edge-label-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 300ms, transform 300ms;
}

.edge-label-exit {
  opacity: 1;
}

.edge-label-exit-active {
  opacity: 0;
  transition: opacity 300ms;
}
```

## 6. 統合例

上記のコンポーネントを統合したメインページの例です。

```jsx
// pages/knowledge-graph.jsx
import { useState, useCallback, useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import ProcessFlowGraph from '../components/ProcessFlowGraph';
import KnowledgeGraph from '../components/KnowledgeGraph';
import ChatPanel from '../components/ChatPanel';
import NodeDetails from '../components/NodeDetails';
import VersionControl from '../components/VersionControl';
import NodeEditor from '../components/NodeEditor';
import { initSocket } from '../lib/socket';

const KnowledgeGraphPage = () => {
  // 状態管理
  const [selectedNode, setSelectedNode] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [activeTab, setActiveTab] = useState('process'); // 'process' or 'knowledge'
  
  // WebSocketの初期化
  useEffect(() => {
    initSocket();
  }, []);
  
  // ノードクリックハンドラ
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
  }, []);
  
  // ノード編集ハンドラ
  const handleNodeEdit = useCallback(async (nodeId, data) => {
    try {
      const response = await fetch(`/api/knowledge-graph/nodes/${nodeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update node');
      }
    } catch (error) {
      console.error('Error updating node:', error);
    }
  }, []);
  
  // ノード削除ハンドラ
  const handleNodeDelete = useCallback(async (nodeId) => {
    try {
      const response = await fetch(`/api/knowledge-graph/nodes/${nodeId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete node');
      }
      
      setSelectedNode(null);
    } catch (error) {
      console.error('Error deleting node:', error);
    }
  }, []);
  
  // エージェントメッセージハンドラ
  const handleAgentMessage = useCallback((message) => {
    setMessages((msgs) => [...msgs, message]);
  }, []);
  
  // バージョン選択ハンドラ
  const handleVersionSelect = useCallback((version) => {
    setSelectedVersion(version.id);
  }, []);
  
  // ノード追加ハンドラ
  const handleAddNode = useCallback(async (node) => {
    try {
      const response = await fetch('/api/knowledge-graph/nodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(node),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add node');
      }
    } catch (error) {
      console.error('Error adding node:', error);
    }
  }, []);
  
  // エッジ追加ハンドラ
  const handleAddEdge = useCallback(async (edge) => {
    try {
      const response = await fetch('/api/knowledge-graph/edges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(edge),
      });
      
      if (!response.ok) {
        throw new Error('Failed to add edge');
      }
    } catch (error) {
      console.error('Error adding edge:', error);
    }
  }, []);
  
  return (
    <div className="knowledge-graph-page">
      <div className="header">
        <h1>AIエージェントナレッジグラフ</h1>
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'process' ? 'active' : ''}`}
            onClick={() => setActiveTab('process')}
          >
            処理フロー
          </button>
          <button
            className={`tab ${activeTab === 'knowledge' ? 'active' : ''}`}
            onClick={() => setActiveTab('knowledge')}
          >
            ナレッジグラフ
          </button>
        </div>
      </div>
      
      <div className="main-content">
        <div className="graph-container">
          <ReactFlowProvider>
            {activeTab === 'process' ? (
              <ProcessFlowGraph
                onNodeClick={handleNodeClick}
                onAgentMessage={handleAgentMessage}
              />
            ) : (
              <KnowledgeGraph
                onNodeClick={handleNodeClick}
                selectedVersion={selectedVersion}
              />
            )}
          </ReactFlowProvider>
        </div>
        
        <div className="side-panel">
          {selectedNode ? (
            <NodeDetails
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onEdit={handleNodeEdit}
              onDelete={handleNodeDelete}
            />
          ) : (
            <ChatPanel messages={messages} />
          )}
          
          {activeTab === 'knowledge' && (
            <div className="tools-panel">
              <VersionControl onVersionSelect={handleVersionSelect} />
              <NodeEditor
                onAddNode={handleAddNode}
                onAddEdge={handleAddEdge}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphPage;
```

## 7. パフォーマンス最適化

### 7.1 メモ化

コンポーネントのメモ化によるパフォーマンス最適化です。

```jsx
// utils/optimization.js
import { memo, useCallback, useMemo } from 'react';

// ノードのメモ化ラッパー
export const memoizedNode = (NodeComponent) => {
  return memo(NodeComponent, (prevProps, nextProps) => {
    // データが変更されていない場合は再レンダリングしない
    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
    );
  });
};

// エッジのメモ化ラッパー
export const memoizedEdge = (EdgeComponent) => {
  return memo(EdgeComponent, (prevProps, nextProps) => {
    // データが変更されていない場合は再レンダリングしない
    return (
      prevProps.id === nextProps.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.animated === nextProps.animated &&
      JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
    );
  });
};
```

### 7.2 仮想化

大規模グラフのための仮想化対応です。

```jsx
// components/VirtualizedKnowledgeGraph.jsx
import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

// カスタムノードとエッジのインポート
import ConceptNode from './nodes/ConceptNode';
import EntityNode from './nodes/EntityNode';
import KnowledgeEdge from './edges/KnowledgeEdge';

// ノードタイプの登録
const nodeTypes = {
  conceptNode: ConceptNode,
  entityNode: EntityNode,
};

// エッジタイプの登録
const edgeTypes = {
  knowledgeEdge: KnowledgeEdge,
};

const VirtualizedKnowledgeGraph = ({ onNodeClick }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [visibleNodes, setVisibleNodes] = useState([]);
  const [visibleEdges, setVisibleEdges] = useState([]);
  
  // ビューポート変更時の処理
  const onViewportChange = useCallback(({ x, y, zoom }) => {
    // ビューポートの範囲を計算
    const viewportWidth = window.innerWidth / zoom;
    const viewportHeight = window.innerHeight / zoom;
    const viewportLeft = -x / zoom;
    const viewportTop = -y / zoom;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    
    // マージンを追加
    const margin = 200;
    const extendedLeft = viewportLeft - margin;
    const extendedTop = viewportTop - margin;
    const extendedRight = viewportRight + margin;
    const extendedBottom = viewportBottom + margin;
    
    // 可視範囲内のノードをフィルタリング
    const filteredNodes = nodes.filter((node) => {
      const { x: nodeX, y: nodeY } = node.position;
      return (
        nodeX >= extendedLeft &&
        nodeX <= extendedRight &&
        nodeY >= extendedTop &&
        nodeY <= extendedBottom
      );
    });
    
    // 可視ノードに接続されているエッジをフィルタリング
    const visibleNodeIds = new Set(filteredNodes.map((node) => node.id));
    const filteredEdges = edges.filter((edge) => {
      return visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
    });
    
    setVisibleNodes(filteredNodes);
    setVisibleEdges(filteredEdges);
  }, [nodes, edges]);
  
  // グラフデータの初期ロード
  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        const response = await fetch('/api/knowledge-graph');
        if (!response.ok) {
          throw new Error('Failed to fetch graph data');
        }
        
        const data = await response.json();
        
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
          
          // 初期表示用に全ノードを設定
          setVisibleNodes(data.nodes);
          setVisibleEdges(data.edges);
        }
      } catch (error) {
        console.error('Error fetching graph data:', error);
      }
    };
    
    fetchGraphData();
  }, []);
  
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onViewportChange={onViewportChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export default VirtualizedKnowledgeGraph;
```

## 8. アクセシビリティ対応

アクセシビリティを向上させるための対応です。

```jsx
// components/AccessibleReactFlow.jsx
import { useCallback, useRef } from 'react';
import { ReactFlowProvider, useReactFlow } from 'reactflow';

const AccessibleReactFlow = ({ children }) => {
  const reactFlowWrapper = useRef(null);
  const { fitView } = useReactFlow();
  
  // キーボードナビゲーション
  const handleKeyDown = useCallback((event) => {
    const { key, ctrlKey } = event;
    
    // Ctrl + Plus: ズームイン
    if (ctrlKey && key === '+') {
      event.preventDefault();
      const { zoomIn } = useReactFlow();
      zoomIn({ duration: 300 });
    }
    
    // Ctrl + Minus: ズームアウト
    if (ctrlKey && key === '-') {
      event.preventDefault();
      const { zoomOut } = useReactFlow();
      zoomOut({ duration: 300 });
    }
    
    // Ctrl + 0: フィットビュー
    if (ctrlKey && key === '0') {
      event.preventDefault();
      fitView({ duration: 500 });
    }
    
    // 矢印キーによるパン
    const panAmount = 20;
    switch (key) {
      case 'ArrowUp':
        event.preventDefault();
        const { setViewport } = useReactFlow();
        setViewport((viewport) => ({ ...viewport, y: viewport.y + panAmount }));
        break;
      case 'ArrowDown':
        event.preventDefault();
        setViewport((viewport) => ({ ...viewport, y: viewport.y - panAmount }));
        break;
      case 'ArrowLeft':
        event.preventDefault();
        setViewport((viewport) => ({ ...viewport, x: viewport.x + panAmount }));
        break;
      case 'ArrowRight':
        event.preventDefault();
        setViewport((viewport) => ({ ...viewport, x: viewport.x - panAmount }));
        break;
    }
  }, [fitView]);
  
  return (
    <div
      ref={reactFlowWrapper}
      style={{ width: '100%', height: '100%' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="application"
      aria-label="インタラクティブなグラフ表示"
    >
      {children}
      <div className="screen-reader-instructions" aria-live="polite">
        キーボードナビゲーション: 矢印キーでパン、Ctrl++でズームイン、Ctrl+-でズームアウト、Ctrl+0で全体表示
      </div>
    </div>
  );
};

export default AccessibleReactFlow;
```

## まとめ

この文書では、現在のAIエージェント実装（CrewAI、LangChain、LlamaIndex）とReact Flowを効果的に統合するための、React Flow可視化コンポーネントの強化方法を詳細に説明しました。

主な強化ポイントは以下の通りです：

1. **カスタムノードコンポーネント**：エージェントノード、概念ノード、エンティティノードなど、目的に応じたカスタムノードの実装
2. **カスタムエッジコンポーネント**：データフローエッジ、知識エッジなど、関係性を視覚的に表現するカスタムエッジの実装
3. **メインコンポーネント**：処理フローグラフとナレッジグラフの2つの主要コンポーネントの実装
4. **インタラクションの強化**：ノードの詳細表示、ズームとパン制御などのインタラクション機能の強化
5. **レイアウトとアニメーション**：自動レイアウトとアニメーション効果による視覚的な魅力の向上
6. **統合例**：各コンポーネントを統合したメインページの実装例
7. **パフォーマンス最適化**：メモ化と仮想化によるパフォーマンスの最適化
8. **アクセシビリティ対応**：キーボードナビゲーションなどのアクセシビリティ機能の実装

これらの強化により、AIエージェント間の対話をリアルタイムで視覚化し、ナレッジグラフを動的に更新・表示するシステムを実現できます。ユーザーは直感的なインターフェースを通じて、AIエージェントの処理状況を監視し、生成されたナレッジグラフを探索・編集することができます。
