# エージェント通信の視覚化の改善

## 概要

AIエージェント間の通信を効果的に視覚化することは、マルチエージェントシステムの理解と監視において重要です。この文書では、CrewAI、LangChain、LlamaIndexを使用した現在のAIエージェント実装における通信の視覚化を改善するための方法を詳細に説明します。

## 1. チャットパネルの強化

### 1.1 高度なチャットパネルコンポーネント

エージェント間の対話をリアルタイムで表示する強化されたチャットパネルです。

```jsx
// components/EnhancedChatPanel.jsx
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaRobot, FaSearch, FaProjectDiagram, FaNetworkWired, FaBrain, FaUser } from 'react-icons/fa';
import { getSocket } from '../lib/socket';

const EnhancedChatPanel = ({ selectedNode, onMessageClick }) => {
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expandedMessage, setExpandedMessage] = useState(null);
  const messagesEndRef = useRef(null);
  
  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    if (!expandedMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, expandedMessage]);
  
  // Socket.IOを使用したリアルタイムメッセージ受信
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    // エージェントの思考プロセス
    socket.on('agent-thoughts', (data) => {
      const { agentId, agentName, agentType, thoughts } = data;
      
      setMessages((msgs) => [...msgs, {
        id: `thought-${Date.now()}`,
        type: 'thought',
        agentId,
        agentName,
        agentType,
        content: thoughts,
        timestamp: new Date().toISOString(),
        relatedNodes: [agentId]
      }]);
    });
    
    // エージェント間の通信
    socket.on('agent-communication', (data) => {
      const { sourceAgentId, sourceAgentName, sourceAgentType, 
              targetAgentId, targetAgentName, targetAgentType, 
              message, timestamp } = data;
      
      setMessages((msgs) => [...msgs, {
        id: `comm-${Date.now()}`,
        type: 'communication',
        sourceAgentId,
        sourceAgentName,
        sourceAgentType,
        targetAgentId,
        targetAgentName,
        targetAgentType,
        content: message,
        timestamp,
        relatedNodes: [sourceAgentId, targetAgentId]
      }]);
    });
    
    // 処理ステージの変更
    socket.on('progress-update', (data) => {
      const { stage, progress, details } = data;
      
      if (progress === 0 || progress === 100) {
        const stageNames = {
          'industry_analysis': '業界分析',
          'keyword_expansion': 'キーワード拡張',
          'structuring': '知識の構造化',
          'knowledge_graph': '知識グラフ生成'
        };
        
        const stageName = stageNames[stage] || stage;
        const status = progress === 0 ? '開始' : '完了';
        
        setMessages((msgs) => [...msgs, {
          id: `progress-${Date.now()}`,
          type: 'progress',
          stage,
          status,
          content: `${stageName}が${status}しました: ${details.message}`,
          timestamp: new Date().toISOString(),
          relatedNodes: [stage]
        }]);
      }
    });
    
    // グラフ更新イベント
    socket.on('knowledge-graph-update', (data) => {
      setMessages((msgs) => [...msgs, {
        id: `graph-${Date.now()}`,
        type: 'graph-update',
        content: `ナレッジグラフが更新されました: ${data.nodes.length}ノード, ${data.edges.length}エッジ`,
        timestamp: new Date().toISOString(),
        nodeCount: data.nodes.length,
        edgeCount: data.edges.length,
        relatedNodes: ['knowledge-graph']
      }]);
    });
    
    return () => {
      socket.off('agent-thoughts');
      socket.off('agent-communication');
      socket.off('progress-update');
      socket.off('knowledge-graph-update');
    };
  }, []);
  
  // フィルタリングされたメッセージ
  const filteredMessages = messages.filter((msg) => {
    if (filter === 'all') return true;
    
    if (selectedNode) {
      // 選択されたノードに関連するメッセージのみ表示
      return msg.relatedNodes?.includes(selectedNode.id) ||
             msg.relatedNodes?.includes(selectedNode.data?.agentId) ||
             msg.relatedNodes?.includes(selectedNode.data?.stage);
    }
    
    return msg.type === filter;
  });
  
  // エージェントタイプに基づくアイコン
  const getAgentIcon = (agentType) => {
    switch(agentType) {
      case 'industry-analysis': return <FaSearch />;
      case 'keyword-expansion': return <FaBrain />;
      case 'structuring': return <FaProjectDiagram />;
      case 'knowledge-graph': return <FaNetworkWired />;
      case 'user': return <FaUser />;
      default: return <FaRobot />;
    }
  };
  
  // メッセージタイプに基づく背景色
  const getMessageBackground = (type, agentType) => {
    switch(type) {
      case 'thought':
        switch(agentType) {
          case 'industry-analysis': return 'bg-blue-50 border-blue-200';
          case 'keyword-expansion': return 'bg-purple-50 border-purple-200';
          case 'structuring': return 'bg-green-50 border-green-200';
          case 'knowledge-graph': return 'bg-orange-50 border-orange-200';
          default: return 'bg-gray-50 border-gray-200';
        }
      case 'communication': return 'bg-indigo-50 border-indigo-200';
      case 'progress': return 'bg-teal-50 border-teal-200';
      case 'graph-update': return 'bg-amber-50 border-amber-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };
  
  // タイムスタンプのフォーマット
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  // メッセージの展開/折りたたみ
  const toggleMessageExpand = (messageId) => {
    if (expandedMessage === messageId) {
      setExpandedMessage(null);
    } else {
      setExpandedMessage(messageId);
    }
  };
  
  // メッセージクリックハンドラ
  const handleMessageClick = (message) => {
    if (onMessageClick) {
      onMessageClick(message);
    }
    toggleMessageExpand(message.id);
  };
  
  return (
    <div className="enhanced-chat-panel">
      <div className="chat-header">
        <h3>AIエージェント対話</h3>
        <div className="filter-controls">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">すべて</option>
            <option value="thought">思考プロセス</option>
            <option value="communication">エージェント間通信</option>
            <option value="progress">進捗状況</option>
            <option value="graph-update">グラフ更新</option>
          </select>
          {selectedNode && (
            <div className="selected-node-filter">
              <span className="filter-label">フィルター:</span>
              <span className="filter-value">{selectedNode.data?.label || selectedNode.id}</span>
              <button 
                className="clear-filter-btn"
                onClick={() => setFilter('all')}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="messages-container">
        <AnimatePresence>
          {filteredMessages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`message-item ${getMessageBackground(message.type, message.agentType || message.sourceAgentType)}`}
              onClick={() => handleMessageClick(message)}
            >
              {message.type === 'thought' && (
                <div className="message-content">
                  <div className="message-header">
                    <div className="agent-info">
                      <span className="agent-icon">{getAgentIcon(message.agentType)}</span>
                      <span className="agent-name">{message.agentName}</span>
                    </div>
                    <span className="message-timestamp">{formatTimestamp(message.timestamp)}</span>
                  </div>
                  <div className={`message-body ${expandedMessage === message.id ? 'expanded' : ''}`}>
                    {expandedMessage === message.id ? message.content : `${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`}
                  </div>
                </div>
              )}
              
              {message.type === 'communication' && (
                <div className="message-content">
                  <div className="message-header">
                    <div className="communication-agents">
                      <div className="source-agent">
                        <span className="agent-icon">{getAgentIcon(message.sourceAgentType)}</span>
                        <span className="agent-name">{message.sourceAgentName}</span>
                      </div>
                      <span className="communication-arrow">→</span>
                      <div className="target-agent">
                        <span className="agent-icon">{getAgentIcon(message.targetAgentType)}</span>
                        <span className="agent-name">{message.targetAgentName}</span>
                      </div>
                    </div>
                    <span className="message-timestamp">{formatTimestamp(message.timestamp)}</span>
                  </div>
                  <div className={`message-body ${expandedMessage === message.id ? 'expanded' : ''}`}>
                    {expandedMessage === message.id ? message.content : `${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`}
                  </div>
                </div>
              )}
              
              {message.type === 'progress' && (
                <div className="message-content">
                  <div className="message-header">
                    <div className="progress-info">
                      <span className={`progress-status ${message.status === '開始' ? 'starting' : 'completed'}`}>
                        {message.status}
                      </span>
                    </div>
                    <span className="message-timestamp">{formatTimestamp(message.timestamp)}</span>
                  </div>
                  <div className="message-body">
                    {message.content}
                  </div>
                </div>
              )}
              
              {message.type === 'graph-update' && (
                <div className="message-content">
                  <div className="message-header">
                    <div className="graph-update-info">
                      <span className="graph-icon">{getAgentIcon('knowledge-graph')}</span>
                      <span className="update-label">グラフ更新</span>
                    </div>
                    <span className="message-timestamp">{formatTimestamp(message.timestamp)}</span>
                  </div>
                  <div className="message-body">
                    <div className="graph-stats">
                      <span className="node-count">ノード: {message.nodeCount}</span>
                      <span className="edge-count">エッジ: {message.edgeCount}</span>
                    </div>
                    {message.content}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default EnhancedChatPanel;
```

対応するCSS:

```css
/* styles/EnhancedChatPanel.module.css */
.enhanced-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-left: 1px solid #e0e0e0;
  background-color: #f9f9f9;
}

.chat-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background-color: white;
}

.chat-header h3 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
}

.selected-node-filter {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background-color: #e3f2fd;
  border-radius: 4px;
  font-size: 12px;
}

.filter-label {
  color: #666;
}

.filter-value {
  font-weight: 500;
  color: #1976d2;
}

.clear-filter-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-item {
  padding: 12px;
  border-radius: 8px;
  border-left: 4px solid;
  cursor: pointer;
  transition: all 0.2s ease;
}

.message-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.agent-info, .communication-agents, .progress-info, .graph-update-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.agent-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #f0f0f0;
  color: #555;
}

.agent-name {
  font-weight: 500;
  font-size: 13px;
  color: #333;
}

.communication-arrow {
  color: #666;
  margin: 0 4px;
}

.message-timestamp {
  font-size: 11px;
  color: #888;
}

.message-body {
  font-size: 13px;
  color: #444;
  line-height: 1.4;
  overflow: hidden;
  transition: max-height 0.3s ease;
  max-height: 80px;
}

.message-body.expanded {
  max-height: 1000px;
}

.progress-status {
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.progress-status.starting {
  background-color: #bbdefb;
  color: #1565c0;
}

.progress-status.completed {
  background-color: #c8e6c9;
  color: #2e7d32;
}

.graph-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
}

.node-count, .edge-count {
  font-size: 12px;
  font-weight: 500;
  color: #555;
}
```

### 1.2 エージェント対話の時系列表示

エージェント間の対話を時系列で表示するタイムラインコンポーネントです。

```jsx
// components/AgentTimeline.jsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaSearch, FaBrain, FaProjectDiagram, FaNetworkWired } from 'react-icons/fa';
import { getSocket } from '../lib/socket';

const AgentTimeline = ({ onEventClick }) => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  // Socket.IOを使用したリアルタイムイベント受信
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    // 各種イベントをタイムラインに追加
    const handleEvent = (data, type) => {
      const newEvent = {
        id: `${type}-${Date.now()}`,
        type,
        data,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      setEvents((prevEvents) => {
        // 時系列順にソート
        const updatedEvents = [...prevEvents, newEvent].sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
        return updatedEvents;
      });
    };
    
    socket.on('agent-thoughts', (data) => handleEvent(data, 'thought'));
    socket.on('agent-communication', (data) => handleEvent(data, 'communication'));
    socket.on('progress-update', (data) => handleEvent(data, 'progress'));
    socket.on('knowledge-graph-update', (data) => handleEvent(data, 'graph-update'));
    
    return () => {
      socket.off('agent-thoughts');
      socket.off('agent-communication');
      socket.off('progress-update');
      socket.off('knowledge-graph-update');
    };
  }, []);
  
  // エージェントタイプに基づくアイコン
  const getAgentIcon = (agentType) => {
    switch(agentType) {
      case 'industry-analysis': return <FaSearch />;
      case 'keyword-expansion': return <FaBrain />;
      case 'structuring': return <FaProjectDiagram />;
      case 'knowledge-graph': return <FaNetworkWired />;
      default: return <FaBrain />;
    }
  };
  
  // イベントタイプに基づく色
  const getEventColor = (type) => {
    switch(type) {
      case 'thought': return '#2196f3';
      case 'communication': return '#673ab7';
      case 'progress': return '#4caf50';
      case 'graph-update': return '#ff9800';
      default: return '#9e9e9e';
    }
  };
  
  // イベントクリックハンドラ
  const handleEventClick = (event) => {
    setSelectedEvent(event.id === selectedEvent ? null : event.id);
    if (onEventClick) {
      onEventClick(event);
    }
  };
  
  // タイムスタンプのフォーマット
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  return (
    <div className="agent-timeline">
      <div className="timeline-header">
        <h3>エージェントタイムライン</h3>
      </div>
      
      <div className="timeline-container">
        <div className="timeline-line"></div>
        
        {events.map((event) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className={`timeline-event ${selectedEvent === event.id ? 'selected' : ''}`}
            onClick={() => handleEventClick(event)}
          >
            <div 
              className="timeline-dot"
              style={{ backgroundColor: getEventColor(event.type) }}
            ></div>
            
            <div className="timeline-content">
              <div className="event-header">
                <div className="event-type">
                  {event.type === 'thought' && (
                    <div className="agent-info">
                      <span className="agent-icon">{getAgentIcon(event.data.agentType)}</span>
                      <span className="agent-name">{event.data.agentName}</span>
                      <span className="event-label">の思考</span>
                    </div>
                  )}
                  
                  {event.type === 'communication' && (
                    <div className="communication-info">
                      <span className="agent-icon">{getAgentIcon(event.data.sourceAgentType)}</span>
                      <span className="agent-name">{event.data.sourceAgentName}</span>
                      <span className="event-label">から</span>
                      <span className="agent-icon">{getAgentIcon(event.data.targetAgentType)}</span>
                      <span className="agent-name">{event.data.targetAgentName}</span>
                      <span className="event-label">へ</span>
                    </div>
                  )}
                  
                  {event.type === 'progress' && (
                    <div className="progress-info">
                      <span className="event-label">
                        {event.data.stage} {event.data.progress === 0 ? '開始' : '完了'}
                      </span>
                    </div>
                  )}
                  
                  {event.type === 'graph-update' && (
                    <div className="graph-update-info">
                      <span className="agent-icon">{getAgentIcon('knowledge-graph')}</span>
                      <span className="event-label">グラフ更新</span>
                    </div>
                  )}
                </div>
                
                <span className="event-timestamp">{formatTimestamp(event.timestamp)}</span>
              </div>
              
              {selectedEvent === event.id && (
                <div className="event-details">
                  {event.type === 'thought' && (
                    <div className="thought-content">{event.data.thoughts}</div>
                  )}
                  
                  {event.type === 'communication' && (
                    <div className="communication-content">{event.data.message}</div>
                  )}
                  
                  {event.type === 'progress' && (
                    <div className="progress-content">{event.data.details.message}</div>
                  )}
                  
                  {event.type === 'graph-update' && (
                    <div className="graph-update-content">
                      <div className="graph-stats">
                        <span className="node-count">ノード: {event.data.nodes.length}</span>
                        <span className="edge-count">エッジ: {event.data.edges.length}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AgentTimeline;
```

対応するCSS:

```css
/* styles/AgentTimeline.module.css */
.agent-timeline {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-left: 1px solid #e0e0e0;
  background-color: #f9f9f9;
}

.timeline-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  background-color: white;
}

.timeline-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.timeline-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0 20px 20px;
  position: relative;
}

.timeline-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 30px;
  width: 2px;
  background-color: #e0e0e0;
}

.timeline-event {
  position: relative;
  margin-bottom: 16px;
  padding-left: 30px;
  cursor: pointer;
}

.timeline-event.selected .timeline-content {
  background-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.timeline-dot {
  position: absolute;
  left: 26px;
  top: 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  z-index: 1;
}

.timeline-content {
  padding: 10px 12px;
  background-color: white;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s ease;
}

.timeline-content:hover {
  transform: translateX(4px);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.event-type {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.agent-info, .communication-info, .progress-info, .graph-update-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.agent-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #f0f0f0;
  color: #555;
}

.agent-name {
  font-weight: 500;
  color: #333;
}

.event-label {
  color: #666;
}

.event-timestamp {
  font-size: 11px;
  color: #888;
}

.event-details {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e0e0e0;
  font-size: 13px;
  color: #444;
  line-height: 1.4;
}

.thought-content, .communication-content, .progress-content, .graph-update-content {
  white-space: pre-wrap;
}

.graph-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 4px;
}

.node-count, .edge-count {
  font-size: 12px;
  font-weight: 500;
  color: #555;
}
```

## 2. エージェント間の通信の視覚化

### 2.1 エージェント通信フローの視覚化

エージェント間の通信フローを視覚的に表現するコンポーネントです。

```jsx
// components/AgentCommunicationFlow.jsx
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
import AgentNode from './nodes/AgentNode';
import CommunicationEdge from './edges/CommunicationEdge';

// WebSocketクライアントのインポート
import { getSocket } from '../lib/socket';

// ノードタイプの登録
const nodeTypes = {
  agentNode: AgentNode,
};

// エッジタイプの登録
const edgeTypes = {
  communicationEdge: CommunicationEdge,
};

// 初期ノードの定義
const initialNodes = [
  {
    id: 'coordinator',
    type: 'agentNode',
    position: { x: 400, y: 100 },
    data: {
      label: 'コーディネーター',
      agentId: 'coordinator',
      agentType: 'coordinator',
      status: 'idle',
      thoughts: []
    }
  },
  {
    id: 'industry-analysis',
    type: 'agentNode',
    position: { x: 200, y: 300 },
    data: {
      label: '業界分析',
      agentId: 'industry-analysis',
      agentType: 'industry-analysis',
      status: 'idle',
      thoughts: []
    }
  },
  {
    id: 'keyword-expansion',
    type: 'agentNode',
    position: { x: 400, y: 300 },
    data: {
      label: 'キーワード拡張',
      agentId: 'keyword-expansion',
      agentType: 'keyword-expansion',
      status: 'idle',
      thoughts: []
    }
  },
  {
    id: 'structuring',
    type: 'agentNode',
    position: { x: 600, y: 300 },
    data: {
      label: '知識の構造化',
      agentId: 'structuring',
      agentType: 'structuring',
      status: 'idle',
      thoughts: []
    }
  },
  {
    id: 'knowledge-graph',
    type: 'agentNode',
    position: { x: 400, y: 500 },
    data: {
      label: '知識グラフ生成',
      agentId: 'knowledge-graph',
      agentType: 'knowledge-graph',
      status: 'idle',
      thoughts: []
    }
  }
];

// 初期エッジの定義
const initialEdges = [
  {
    id: 'e-coord-industry',
    source: 'coordinator',
    target: 'industry-analysis',
    type: 'communicationEdge',
    animated: false,
    data: {
      messages: []
    }
  },
  {
    id: 'e-coord-keyword',
    source: 'coordinator',
    target: 'keyword-expansion',
    type: 'communicationEdge',
    animated: false,
    data: {
      messages: []
    }
  },
  {
    id: 'e-coord-structuring',
    source: 'coordinator',
    target: 'structuring',
    type: 'communicationEdge',
    animated: false,
    data: {
      messages: []
    }
  },
  {
    id: 'e-coord-graph',
    source: 'coordinator',
    target: 'knowledge-graph',
    type: 'communicationEdge',
    animated: false,
    data: {
      messages: []
    }
  },
  {
    id: 'e-industry-keyword',
    source: 'industry-analysis',
    target: 'keyword-expansion',
    type: 'communicationEdge',
    animated: false,
    data: {
      messages: []
    }
  },
  {
    id: 'e-keyword-structuring',
    source: 'keyword-expansion',
    target: 'structuring',
    type: 'communicationEdge',
    animated: false,
    data: {
      messages: []
    }
  },
  {
    id: 'e-structuring-graph',
    source: 'structuring',
    target: 'knowledge-graph',
    type: 'communicationEdge',
    animated: false,
    data: {
      messages: []
    }
  }
];

const AgentCommunicationFlow = ({ onNodeClick }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [communicationHistory, setCommunicationHistory] = useState([]);
  
  // WebSocketイベントの処理
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    // エージェントの思考プロセス
    socket.on('agent-thoughts', (data) => {
      const { agentId, thoughts } = data;
      
      // エージェントの思考をノードに反映
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.data.agentId === agentId) {
            const updatedThoughts = [...(node.data.thoughts || []), thoughts];
            
            return {
              ...node,
              data: {
                ...node.data,
                status: 'thinking',
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
      const { sourceAgentId, targetAgentId, message, timestamp } = data;
      
      // 通信履歴に追加
      setCommunicationHistory((history) => [
        ...history,
        { sourceAgentId, targetAgentId, message, timestamp }
      ]);
      
      // 対応するエッジを更新
      setEdges((eds) => {
        return eds.map((edge) => {
          const sourceNode = nodes.find(n => n.data.agentId === sourceAgentId);
          const targetNode = nodes.find(n => n.data.agentId === targetAgentId);
          
          if (sourceNode && targetNode && edge.source === sourceNode.id && edge.target === targetNode.id) {
            // メッセージを追加
            const updatedMessages = [...(edge.data?.messages || []), { message, timestamp }];
            
            return {
              ...edge,
              animated: true,
              data: {
                ...edge.data,
                messages: updatedMessages,
                latestMessage: message
              }
            };
          }
          return edge;
        });
      });
      
      // 送信元エージェントのステータスを更新
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.data.agentId === sourceAgentId) {
            return {
              ...node,
              data: {
                ...node.data,
                status: 'sending'
              }
            };
          }
          return node;
        });
      });
      
      // 送信先エージェントのステータスを更新
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.data.agentId === targetAgentId) {
            return {
              ...node,
              data: {
                ...node.data,
                status: 'receiving'
              }
            };
          }
          return node;
        });
      });
      
      // 3秒後にアニメーションとステータスをリセット
      setTimeout(() => {
        setEdges((eds) => {
          return eds.map((edge) => {
            const sourceNode = nodes.find(n => n.data.agentId === sourceAgentId);
            const targetNode = nodes.find(n => n.data.agentId === targetAgentId);
            
            if (sourceNode && targetNode && edge.source === sourceNode.id && edge.target === targetNode.id) {
              return {
                ...edge,
                animated: false
              };
            }
            return edge;
          });
        });
        
        setNodes((nds) => {
          return nds.map((node) => {
            if (node.data.agentId === sourceAgentId || node.data.agentId === targetAgentId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  status: 'idle'
                }
              };
            }
            return node;
          });
        });
      }, 3000);
    });
    
    // 処理ステージの変更
    socket.on('progress-update', (data) => {
      const { stage, progress } = data;
      
      // ステージに対応するエージェントのステータスを更新
      const stageToAgentMap = {
        'industry_analysis': 'industry-analysis',
        'keyword_expansion': 'keyword-expansion',
        'structuring': 'structuring',
        'knowledge_graph': 'knowledge-graph'
      };
      
      const agentId = stageToAgentMap[stage];
      if (!agentId) return;
      
      setNodes((nds) => {
        return nds.map((node) => {
          if (node.data.agentId === agentId) {
            return {
              ...node,
              data: {
                ...node.data,
                status: progress === 0 ? 'starting' : progress === 100 ? 'completed' : 'in-progress',
                progress
              }
            };
          }
          return node;
        });
      });
    });
    
    return () => {
      socket.off('agent-thoughts');
      socket.off('agent-communication');
      socket.off('progress-update');
    };
  }, [setNodes, setEdges, nodes]);
  
  // ノードクリックハンドラ
  const handleNodeClick = (event, node) => {
    if (onNodeClick) {
      onNodeClick(node);
    }
  };
  
  // エッジクリックハンドラ
  const handleEdgeClick = (event, edge) => {
    // エッジに関連する通信履歴をフィルタリング
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (sourceNode && targetNode) {
      const filteredHistory = communicationHistory.filter(
        comm => (comm.sourceAgentId === sourceNode.data.agentId && comm.targetAgentId === targetNode.data.agentId) ||
                (comm.sourceAgentId === targetNode.data.agentId && comm.targetAgentId === sourceNode.data.agentId)
      );
      
      console.log('Communication history for this edge:', filteredHistory);
    }
  };
  
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Controls />
        <MiniMap 
          nodeStrokeColor={(n) => {
            if (n.data?.status === 'completed') return '#4caf50';
            if (n.data?.status === 'in-progress') return '#2196f3';
            if (n.data?.status === 'error') return '#f44336';
            return '#aaa';
          }}
          nodeColor={(n) => {
            if (n.data?.status === 'completed') return '#4caf50';
            if (n.data?.status === 'in-progress') return '#2196f3';
            if (n.data?.status === 'error') return '#f44336';
            return '#fff';
          }}
        />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export default AgentCommunicationFlow;
```

### 2.2 通信エッジコンポーネント

エージェント間の通信を表現するカスタムエッジコンポーネントです。

```jsx
// components/edges/CommunicationEdge.jsx
import { memo, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';

const CommunicationEdge = ({ 
  id, 
  source, 
  target, 
  sourceX, 
  sourceY, 
  targetX, 
  targetY, 
  sourcePosition, 
  targetPosition, 
  data, 
  style = {}, 
  markerEnd, 
  animated 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  
  // メッセージ数に基づくエッジの太さ
  const getEdgeThickness = () => {
    if (!data || !data.messages) return 1;
    const messageCount = data.messages.length;
    return Math.min(Math.max(1, messageCount * 0.5), 5);
  };
  
  const edgeThickness = getEdgeThickness();
  
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: edgeThickness,
          stroke: animated ? '#ff4081' : '#aaa',
          opacity: isHovered ? 1 : 0.6,
          transition: 'stroke 0.3s, opacity 0.3s',
        }}
        animated={animated}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      
      {data?.latestMessage && (isHovered || animated) && (
        <EdgeLabelRenderer>
          <div
            className="communication-edge-label"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: animated ? '#fff0f7' : 'white',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 500,
              pointerEvents: 'all',
              border: `1px solid ${animated ? '#ff4081' : '#aaa'}`,
              maxWidth: '150px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {data.latestMessage.substring(0, 50)}{data.latestMessage.length > 50 ? '...' : ''}
          </div>
        </EdgeLabelRenderer>
      )}
      
      {data?.messages && data.messages.length > 0 && isHovered && (
        <EdgeLabelRenderer>
          <div
            className="communication-edge-tooltip"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 30}px)`,
              background: 'white',
              padding: '8px',
              borderRadius: 4,
              fontSize: 11,
              pointerEvents: 'all',
              border: '1px solid #ddd',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              zIndex: 10,
              maxWidth: '200px',
              maxHeight: '150px',
              overflow: 'auto',
            }}
          >
            <div className="tooltip-header" style={{ marginBottom: '4px', fontWeight: 'bold' }}>
              通信履歴 ({data.messages.length})
            </div>
            {data.messages.slice(-5).map((msg, idx) => (
              <div key={idx} className="message-item" style={{ marginBottom: '4px', borderBottom: '1px dashed #eee', paddingBottom: '4px' }}>
                <div className="message-content" style={{ fontSize: '10px' }}>
                  {msg.message.substring(0, 50)}{msg.message.length > 50 ? '...' : ''}
                </div>
                <div className="message-timestamp" style={{ fontSize: '9px', color: '#888' }}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
            {data.messages.length > 5 && (
              <div style={{ fontSize: '9px', color: '#888', textAlign: 'center' }}>
                他 {data.messages.length - 5} 件の通信
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default memo(CommunicationEdge);
```

## 3. エージェント思考プロセスの視覚化

### 3.1 思考バブルコンポーネント

エージェントの思考プロセスを「思考バブル」として視覚化するコンポーネントです。

```jsx
// components/ThoughtBubble.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ThoughtBubble = ({ thought, position, onClose, maxWidth = 300 }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  // 一定時間後に自動的に閉じる
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 10000); // 10秒後に閉じる
    
    return () => clearTimeout(timer);
  }, []);
  
  // 閉じるアニメーション後にコールバックを呼び出す
  const handleAnimationComplete = () => {
    if (!isVisible && onClose) {
      onClose();
    }
  };
  
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="thought-bubble"
          style={{
            position: 'absolute',
            left: position.x,
            top: position.y,
            maxWidth: `${maxWidth}px`,
            zIndex: 1000,
          }}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ duration: 0.3 }}
          onAnimationComplete={handleAnimationComplete}
        >
          <div className="bubble-content">
            <div className="bubble-text">{thought}</div>
            <button className="bubble-close" onClick={() => setIsVisible(false)}>×</button>
          </div>
          <div className="bubble-tail"></div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ThoughtBubble;
```

対応するCSS:

```css
/* styles/ThoughtBubble.module.css */
.thought-bubble {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 12px;
  position: relative;
}

.bubble-content {
  position: relative;
}

.bubble-text {
  font-size: 13px;
  color: #333;
  line-height: 1.4;
  white-space: pre-wrap;
}

.bubble-close {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #f44336;
  color: white;
  border: none;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.thought-bubble:hover .bubble-close {
  opacity: 1;
}

.bubble-tail {
  position: absolute;
  bottom: -10px;
  left: 20px;
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid white;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.1));
}
```

### 3.2 思考プロセスオーバーレイ

エージェントの思考プロセスをオーバーレイとして表示するコンポーネントです。

```jsx
// components/ThoughtProcessOverlay.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ThoughtBubble from './ThoughtBubble';
import { getSocket } from '../lib/socket';

const ThoughtProcessOverlay = () => {
  const [thoughts, setThoughts] = useState([]);
  
  // Socket.IOを使用したリアルタイム思考プロセス受信
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    socket.on('agent-thoughts', (data) => {
      const { agentId, agentName, agentType, thoughts: thoughtText } = data;
      
      // 新しい思考を追加
      setThoughts((prevThoughts) => [
        ...prevThoughts,
        {
          id: `thought-${Date.now()}`,
          agentId,
          agentName,
          agentType,
          text: thoughtText,
          timestamp: new Date().toISOString(),
          position: {
            x: Math.random() * (window.innerWidth - 350) + 50,
            y: Math.random() * (window.innerHeight - 200) + 50
          }
        }
      ]);
    });
    
    return () => {
      socket.off('agent-thoughts');
    };
  }, []);
  
  // 思考バブルを閉じる
  const handleCloseThought = (thoughtId) => {
    setThoughts((prevThoughts) => prevThoughts.filter(thought => thought.id !== thoughtId));
  };
  
  // 最大5つの思考バブルのみ表示
  const visibleThoughts = thoughts.slice(-5);
  
  // ポータルを使用してオーバーレイをレンダリング
  return createPortal(
    <div className="thought-process-overlay">
      <AnimatePresence>
        {visibleThoughts.map((thought) => (
          <ThoughtBubble
            key={thought.id}
            thought={thought.text}
            position={thought.position}
            onClose={() => handleCloseThought(thought.id)}
          />
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
};

export default ThoughtProcessOverlay;
```

## 4. リアルタイム進捗表示

### 4.1 進捗ステータスバー

処理の進捗状況をリアルタイムで表示するステータスバーコンポーネントです。

```jsx
// components/ProgressStatusBar.jsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FaSearch, FaBrain, FaProjectDiagram, FaNetworkWired } from 'react-icons/fa';
import { getSocket } from '../lib/socket';

const ProgressStatusBar = () => {
  const [stages, setStages] = useState([
    { id: 'industry_analysis', label: '業界分析', progress: 0, status: 'waiting', icon: FaSearch },
    { id: 'keyword_expansion', label: 'キーワード拡張', progress: 0, status: 'waiting', icon: FaBrain },
    { id: 'structuring', label: '知識の構造化', progress: 0, status: 'waiting', icon: FaProjectDiagram },
    { id: 'knowledge_graph', label: '知識グラフ生成', progress: 0, status: 'waiting', icon: FaNetworkWired }
  ]);
  
  const [currentStage, setCurrentStage] = useState(null);
  const [overallProgress, setOverallProgress] = useState(0);
  
  // Socket.IOを使用したリアルタイム進捗状況受信
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    socket.on('progress-update', (data) => {
      const { stage, progress, details } = data;
      
      // ステージの進捗状況を更新
      setStages((prevStages) => {
        return prevStages.map((s) => {
          if (s.id === stage) {
            return {
              ...s,
              progress,
              status: progress === 0 ? 'starting' : progress === 100 ? 'completed' : 'in-progress',
              message: details.message
            };
          }
          return s;
        });
      });
      
      // 現在のステージを設定
      if (progress < 100) {
        setCurrentStage(stage);
      } else if (stage === currentStage) {
        // 次のステージを探す
        const stageIndex = stages.findIndex(s => s.id === stage);
        if (stageIndex < stages.length - 1) {
          setCurrentStage(stages[stageIndex + 1].id);
        } else {
          setCurrentStage(null); // すべてのステージが完了
        }
      }
      
      // 全体の進捗状況を計算
      setOverallProgress(() => {
        const totalProgress = stages.reduce((sum, s) => {
          if (s.id === stage) {
            return sum + progress;
          }
          return sum + s.progress;
        }, 0);
        return Math.round(totalProgress / stages.length);
      });
    });
    
    return () => {
      socket.off('progress-update');
    };
  }, [stages, currentStage]);
  
  // ステージのステータスに基づく色
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return '#4caf50';
      case 'in-progress': return '#2196f3';
      case 'starting': return '#ff9800';
      case 'waiting': return '#9e9e9e';
      default: return '#9e9e9e';
    }
  };
  
  return (
    <div className="progress-status-bar">
      <div className="overall-progress">
        <div className="progress-label">全体の進捗: {overallProgress}%</div>
        <div className="progress-track">
          <motion.div
            className="progress-fill"
            initial={{ width: '0%' }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
      
      <div className="stages-container">
        {stages.map((stage, index) => (
          <div 
            key={stage.id}
            className={`stage-item ${stage.status} ${currentStage === stage.id ? 'current' : ''}`}
          >
            <div className="stage-connector">
              {index > 0 && (
                <div 
                  className={`connector-line ${stages[index - 1].status === 'completed' ? 'completed' : ''}`}
                />
              )}
              <div 
                className="stage-dot"
                style={{ backgroundColor: getStatusColor(stage.status) }}
              >
                <stage.icon className="stage-icon" />
              </div>
            </div>
            
            <div className="stage-details">
              <div className="stage-header">
                <div className="stage-name">{stage.label}</div>
                <div className="stage-progress">{stage.progress}%</div>
              </div>
              
              <div className="stage-progress-track">
                <motion.div
                  className="stage-progress-fill"
                  style={{ backgroundColor: getStatusColor(stage.status) }}
                  initial={{ width: '0%' }}
                  animate={{ width: `${stage.progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              
              {stage.message && (
                <div className="stage-message">{stage.message}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressStatusBar;
```

対応するCSS:

```css
/* styles/ProgressStatusBar.module.css */
.progress-status-bar {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
  margin-bottom: 20px;
}

.overall-progress {
  margin-bottom: 20px;
}

.progress-label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.progress-track {
  height: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #4caf50;
  border-radius: 4px;
}

.stages-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stage-item {
  display: flex;
  gap: 12px;
}

.stage-item.current .stage-details {
  background-color: #f5f5f5;
}

.stage-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 30px;
}

.connector-line {
  width: 2px;
  height: 100%;
  background-color: #e0e0e0;
  flex: 1;
}

.connector-line.completed {
  background-color: #4caf50;
}

.stage-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin: 4px 0;
}

.stage-icon {
  font-size: 14px;
}

.stage-details {
  flex: 1;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  transition: background-color 0.3s;
}

.stage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.stage-name {
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.stage-progress {
  font-size: 12px;
  color: #666;
}

.stage-progress-track {
  height: 6px;
  background-color: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.stage-progress-fill {
  height: 100%;
  border-radius: 3px;
}

.stage-message {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.stage-item.waiting .stage-details {
  opacity: 0.7;
}

.stage-item.completed .stage-name {
  color: #4caf50;
}
```

### 4.2 アクティビティログ

システム全体のアクティビティをログとして表示するコンポーネントです。

```jsx
// components/ActivityLog.jsx
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '../lib/socket';

const ActivityLog = ({ maxItems = 50 }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const logEndRef = useRef(null);
  
  // 新しいログが追加されたら自動スクロール
  useEffect(() => {
    if (expanded) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, expanded]);
  
  // Socket.IOを使用したリアルタイムイベント受信
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    // 各種イベントをログに追加
    const addLog = (data, type, message) => {
      const newLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type,
        message,
        data,
        timestamp: new Date().toISOString()
      };
      
      setLogs((prevLogs) => {
        const updatedLogs = [newLog, ...prevLogs];
        // 最大数を超えたら古いログを削除
        if (updatedLogs.length > maxItems) {
          return updatedLogs.slice(0, maxItems);
        }
        return updatedLogs;
      });
    };
    
    socket.on('agent-thoughts', (data) => {
      addLog(data, 'thought', `${data.agentName}の思考: ${data.thoughts.substring(0, 50)}...`);
    });
    
    socket.on('agent-communication', (data) => {
      addLog(data, 'communication', `${data.sourceAgentName}から${data.targetAgentName}へ: ${data.message.substring(0, 50)}...`);
    });
    
    socket.on('progress-update', (data) => {
      if (data.progress === 0) {
        addLog(data, 'progress', `${data.stage}が開始されました: ${data.details.message}`);
      } else if (data.progress === 100) {
        addLog(data, 'progress', `${data.stage}が完了しました: ${data.details.message}`);
      } else if (data.progress % 25 === 0) {
        addLog(data, 'progress', `${data.stage}の進捗: ${data.progress}%`);
      }
    });
    
    socket.on('knowledge-graph-update', (data) => {
      addLog(data, 'graph-update', `ナレッジグラフが更新されました: ${data.nodes.length}ノード, ${data.edges.length}エッジ`);
    });
    
    socket.on('node-added', (data) => {
      addLog(data, 'node-added', `新しいノードが追加されました: ${data.data.label}`);
    });
    
    socket.on('edge-added', (data) => {
      addLog(data, 'edge-added', `新しいエッジが追加されました: ${data.id}`);
    });
    
    return () => {
      socket.off('agent-thoughts');
      socket.off('agent-communication');
      socket.off('progress-update');
      socket.off('knowledge-graph-update');
      socket.off('node-added');
      socket.off('edge-added');
    };
  }, [maxItems]);
  
  // フィルタリングされたログ
  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.type === filter;
  });
  
  // ログタイプに基づく色
  const getLogTypeColor = (type) => {
    switch(type) {
      case 'thought': return '#2196f3';
      case 'communication': return '#673ab7';
      case 'progress': return '#4caf50';
      case 'graph-update': return '#ff9800';
      case 'node-added': return '#009688';
      case 'edge-added': return '#3f51b5';
      default: return '#9e9e9e';
    }
  };
  
  // タイムスタンプのフォーマット
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };
  
  return (
    <div className={`activity-log ${expanded ? 'expanded' : 'collapsed'}`}>
      <div className="log-header" onClick={() => setExpanded(!expanded)}>
        <h3>アクティビティログ</h3>
        <div className="log-controls">
          {expanded && (
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="log-filter"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="all">すべて</option>
              <option value="thought">思考プロセス</option>
              <option value="communication">エージェント通信</option>
              <option value="progress">進捗状況</option>
              <option value="graph-update">グラフ更新</option>
              <option value="node-added">ノード追加</option>
              <option value="edge-added">エッジ追加</option>
            </select>
          )}
          <span className="expand-icon">{expanded ? '▼' : '▲'}</span>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            className="log-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="log-items">
              {filteredLogs.map((log) => (
                <div key={log.id} className="log-item">
                  <div 
                    className="log-type-indicator"
                    style={{ backgroundColor: getLogTypeColor(log.type) }}
                  />
                  <div className="log-timestamp">{formatTimestamp(log.timestamp)}</div>
                  <div className="log-message">{log.message}</div>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActivityLog;
```

対応するCSS:

```css
/* styles/ActivityLog.module.css */
.activity-log {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  overflow: hidden;
}

.log-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e0e0e0;
  cursor: pointer;
}

.log-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.log-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.log-filter {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
}

.expand-icon {
  color: #666;
  font-size: 12px;
}

.log-content {
  overflow: hidden;
}

.log-items {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px 0;
}

.log-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.log-item:last-child {
  border-bottom: none;
}

.log-type-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}

.log-timestamp {
  font-size: 11px;
  color: #888;
  width: 80px;
  flex-shrink: 0;
}

.log-message {
  font-size: 13px;
  color: #333;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-log.collapsed .log-content {
  display: none;
}
```

## 5. 統合例

上記のコンポーネントを統合したエージェント通信可視化ページの例です。

```jsx
// pages/agent-communication.jsx
import { useState, useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import AgentCommunicationFlow from '../components/AgentCommunicationFlow';
import EnhancedChatPanel from '../components/EnhancedChatPanel';
import AgentTimeline from '../components/AgentTimeline';
import ProgressStatusBar from '../components/ProgressStatusBar';
import ActivityLog from '../components/ActivityLog';
import ThoughtProcessOverlay from '../components/ThoughtProcessOverlay';
import NodeDetails from '../components/NodeDetails';
import { initSocket } from '../lib/socket';

const AgentCommunicationPage = () => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [showThoughtOverlay, setShowThoughtOverlay] = useState(true);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'timeline'
  
  // WebSocketの初期化
  useEffect(() => {
    initSocket();
  }, []);
  
  // ノードクリックハンドラ
  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };
  
  // メッセージクリックハンドラ
  const handleMessageClick = (message) => {
    console.log('Message clicked:', message);
    // 必要に応じて処理を追加
  };
  
  // イベントクリックハンドラ
  const handleEventClick = (event) => {
    console.log('Event clicked:', event);
    // 必要に応じて処理を追加
  };
  
  return (
    <div className="agent-communication-page">
      <div className="header">
        <h1>AIエージェント通信可視化</h1>
        <div className="header-controls">
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={showThoughtOverlay}
              onChange={() => setShowThoughtOverlay(!showThoughtOverlay)}
            />
            <span className="toggle-label">思考バブルを表示</span>
          </label>
        </div>
      </div>
      
      <ProgressStatusBar />
      
      <div className="main-content">
        <div className="graph-container">
          <ReactFlowProvider>
            <AgentCommunicationFlow onNodeClick={handleNodeClick} />
          </ReactFlowProvider>
        </div>
        
        <div className="side-panel">
          {selectedNode ? (
            <NodeDetails
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          ) : (
            <div className="tabs-container">
              <div className="tabs-header">
                <button
                  className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  チャット
                </button>
                <button
                  className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
                  onClick={() => setActiveTab('timeline')}
                >
                  タイムライン
                </button>
              </div>
              
              <div className="tabs-content">
                {activeTab === 'chat' ? (
                  <EnhancedChatPanel onMessageClick={handleMessageClick} />
                ) : (
                  <AgentTimeline onEventClick={handleEventClick} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <ActivityLog />
      
      {showThoughtOverlay && <ThoughtProcessOverlay />}
    </div>
  );
};

export default AgentCommunicationPage;
```

対応するCSS:

```css
/* styles/AgentCommunicationPage.module.css */
.agent-communication-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 20px;
  background-color: #f9f9f9;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h1 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.header-controls {
  display: flex;
  gap: 16px;
}

.toggle-control {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-label {
  font-size: 14px;
  color: #555;
}

.main-content {
  display: flex;
  flex: 1;
  gap: 20px;
  margin-bottom: 20px;
  min-height: 0;
}

.graph-container {
  flex: 2;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.side-panel {
  flex: 1;
  min-width: 300px;
  max-width: 400px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tabs-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tabs-header {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
}

.tab {
  flex: 1;
  padding: 12px;
  text-align: center;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tab.active {
  color: #2196f3;
  border-bottom: 2px solid #2196f3;
}

.tabs-content {
  flex: 1;
  overflow: hidden;
}
```

## まとめ

この文書では、CrewAI、LangChain、LlamaIndexを使用した現在のAIエージェント実装における通信の視覚化を改善するための方法を詳細に説明しました。

主な改善ポイントは以下の通りです：

1. **チャットパネルの強化**：エージェント間の対話をリアルタイムで表示する高度なチャットパネルと時系列表示のタイムラインコンポーネント
2. **エージェント間の通信の視覚化**：エージェント通信フローの視覚化と通信エッジコンポーネントによる対話の表現
3. **エージェント思考プロセスの視覚化**：思考バブルコンポーネントと思考プロセスオーバーレイによる思考の表現
4. **リアルタイム進捗表示**：進捗ステータスバーとアクティビティログによる処理状況の監視
5. **統合例**：上記のコンポーネントを統合したエージェント通信可視化ページの実装例

これらの改善により、AIエージェント間の対話をより直感的に理解し、処理の進捗状況をリアルタイムで監視することができます。ユーザーはエージェントの思考プロセスや通信内容を視覚的に把握し、システム全体の動作を効果的に理解することができます。

次のステップでは、これらの改善点を実際の実装例に統合し、現在のアプローチに合わせた具体的な実装方法を提案します。
