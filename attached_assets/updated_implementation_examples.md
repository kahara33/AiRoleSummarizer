# 現在のアプローチに合わせた実装例の更新

## 概要

CrewAI、LangChain、LlamaIndexを使用した現在のAIエージェント実装と、React Flowを効果的に統合するための実装例を更新します。この文書では、現在のアプローチに合わせた具体的な実装方法と、コード例を提供します。

## 1. バックエンド実装

### 1.1 CrewAI、LangChain、LlamaIndexの統合

現在のAIエージェント実装を活用したバックエンドの実装例です。

```python
# backend/agents/setup.py
import os
from typing import Dict, List, Any
from crewai import Agent, Task, Crew, Process
from langchain.tools import Tool
from langchain.agents import AgentExecutor
from langchain.chat_models import ChatOpenAI
from llama_index import VectorStoreIndex, Document, ServiceContext
from llama_index.llms import OpenAI

# OpenAI API設定
os.environ["OPENAI_API_KEY"] = "your-api-key"

# LlamaIndexのセットアップ
def setup_llama_index():
    llm = OpenAI(model="gpt-4", temperature=0.1)
    service_context = ServiceContext.from_defaults(llm=llm)
    return service_context

# インデックスの作成
def create_index(documents: List[Document], service_context):
    index = VectorStoreIndex.from_documents(
        documents, service_context=service_context
    )
    return index

# LlamaIndexツールの作成
def create_llama_index_tools(index):
    query_engine = index.as_query_engine()
    
    def query_index(query_text: str) -> str:
        response = query_engine.query(query_text)
        return str(response)
    
    return Tool(
        name="KnowledgeBase",
        func=query_index,
        description="Useful for querying the knowledge base for information."
    )

# CrewAIエージェントの設定
def setup_agents(llama_index_tool):
    # 業界分析エージェント
    industry_analyst = Agent(
        role="Industry Analyst",
        goal="Analyze industry trends and provide comprehensive insights",
        backstory="You are an expert in industry analysis with years of experience in market research.",
        verbose=True,
        allow_delegation=True,
        tools=[llama_index_tool],
        llm=ChatOpenAI(model_name="gpt-4", temperature=0.7)
    )
    
    # キーワード拡張エージェント
    keyword_expander = Agent(
        role="Keyword Expander",
        goal="Expand keywords and identify related concepts",
        backstory="You are a specialist in semantic analysis and keyword research.",
        verbose=True,
        allow_delegation=True,
        tools=[llama_index_tool],
        llm=ChatOpenAI(model_name="gpt-4", temperature=0.8)
    )
    
    # 知識構造化エージェント
    knowledge_structurer = Agent(
        role="Knowledge Structurer",
        goal="Organize information into structured knowledge",
        backstory="You are an expert in knowledge organization and taxonomy creation.",
        verbose=True,
        allow_delegation=True,
        tools=[llama_index_tool],
        llm=ChatOpenAI(model_name="gpt-4", temperature=0.5)
    )
    
    # 知識グラフ生成エージェント
    graph_generator = Agent(
        role="Knowledge Graph Generator",
        goal="Generate comprehensive knowledge graphs from structured information",
        backstory="You are specialized in creating visual representations of complex information.",
        verbose=True,
        allow_delegation=True,
        tools=[llama_index_tool],
        llm=ChatOpenAI(model_name="gpt-4", temperature=0.3)
    )
    
    return {
        "industry_analyst": industry_analyst,
        "keyword_expander": keyword_expander,
        "knowledge_structurer": knowledge_structurer,
        "graph_generator": graph_generator
    }

# タスクの設定
def setup_tasks(agents: Dict[str, Agent], input_data: Dict[str, Any]):
    industry_analysis_task = Task(
        description=f"Analyze the industry: {input_data['industry']}. Focus on trends, key players, and market dynamics.",
        agent=agents["industry_analyst"],
        expected_output="A comprehensive analysis of the industry with key insights."
    )
    
    keyword_expansion_task = Task(
        description="Expand on the keywords and identify related concepts based on the industry analysis.",
        agent=agents["keyword_expander"],
        expected_output="An expanded list of keywords and related concepts.",
        context=[industry_analysis_task]
    )
    
    knowledge_structuring_task = Task(
        description="Organize the expanded keywords and concepts into a structured knowledge framework.",
        agent=agents["knowledge_structurer"],
        expected_output="A structured knowledge framework with categories and relationships.",
        context=[keyword_expansion_task]
    )
    
    graph_generation_task = Task(
        description="Generate a knowledge graph based on the structured knowledge framework.",
        agent=agents["graph_generator"],
        expected_output="A knowledge graph representation with nodes and edges.",
        context=[knowledge_structuring_task]
    )
    
    return [
        industry_analysis_task,
        keyword_expansion_task,
        knowledge_structuring_task,
        graph_generation_task
    ]

# Crewの設定と実行
def run_crew(agents: Dict[str, Agent], tasks: List[Task], process_type: Process = Process.sequential):
    crew = Crew(
        agents=list(agents.values()),
        tasks=tasks,
        verbose=2,
        process=process_type
    )
    
    result = crew.kickoff()
    return result

# メイン実行関数
def main(input_data: Dict[str, Any]):
    # LlamaIndexのセットアップ
    service_context = setup_llama_index()
    
    # 初期ドキュメントの準備
    documents = [Document(text=input_data.get("initial_text", ""))]
    
    # インデックスの作成
    index = create_index(documents, service_context)
    
    # LlamaIndexツールの作成
    llama_index_tool = create_llama_index_tools(index)
    
    # エージェントのセットアップ
    agents = setup_agents(llama_index_tool)
    
    # タスクのセットアップ
    tasks = setup_tasks(agents, input_data)
    
    # Crewの実行
    result = run_crew(agents, tasks, Process.sequential)
    
    return result
```

### 1.2 WebSocketを使用したリアルタイム通信

フロントエンドとのリアルタイム通信を実現するためのWebSocketサーバーの実装例です。

```python
# backend/websocket_server.py
import asyncio
import json
import logging
from typing import Dict, List, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ロギングの設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切に制限すること
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 接続クライアント管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending message: {e}")

manager = ConnectionManager()

# エージェントの思考プロセスを送信
async def send_agent_thoughts(agent_id: str, agent_name: str, agent_type: str, thoughts: str):
    await manager.broadcast({
        "type": "agent-thoughts",
        "agentId": agent_id,
        "agentName": agent_name,
        "agentType": agent_type,
        "thoughts": thoughts,
        "timestamp": str(datetime.now())
    })

# エージェント間の通信を送信
async def send_agent_communication(source_agent_id: str, source_agent_name: str, source_agent_type: str,
                                  target_agent_id: str, target_agent_name: str, target_agent_type: str,
                                  message: str):
    await manager.broadcast({
        "type": "agent-communication",
        "sourceAgentId": source_agent_id,
        "sourceAgentName": source_agent_name,
        "sourceAgentType": source_agent_type,
        "targetAgentId": target_agent_id,
        "targetAgentName": target_agent_name,
        "targetAgentType": target_agent_type,
        "message": message,
        "timestamp": str(datetime.now())
    })

# 進捗状況を送信
async def send_progress_update(stage: str, progress: int, details: Dict[str, Any]):
    await manager.broadcast({
        "type": "progress-update",
        "stage": stage,
        "progress": progress,
        "details": details,
        "timestamp": str(datetime.now())
    })

# ナレッジグラフの更新を送信
async def send_knowledge_graph_update(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]):
    await manager.broadcast({
        "type": "knowledge-graph-update",
        "nodes": nodes,
        "edges": edges,
        "timestamp": str(datetime.now())
    })

# ノードの追加を送信
async def send_node_added(node: Dict[str, Any]):
    await manager.broadcast({
        "type": "node-added",
        "node": node,
        "timestamp": str(datetime.now())
    })

# エッジの追加を送信
async def send_edge_added(edge: Dict[str, Any]):
    await manager.broadcast({
        "type": "edge-added",
        "edge": edge,
        "timestamp": str(datetime.now())
    })

# WebSocket接続エンドポイント
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                # クライアントからのメッセージ処理
                if message.get("type") == "client-message":
                    logger.info(f"Received client message: {message}")
                    # 必要に応じて処理を追加
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# CrewAIのカスタムコールバック
class WebSocketCallback:
    def __init__(self):
        self.loop = asyncio.get_event_loop()
    
    def on_agent_start(self, agent):
        agent_id = agent.role.lower().replace(" ", "-")
        agent_name = agent.role
        agent_type = agent.role.lower().replace(" ", "-")
        
        # ステージマッピング
        stage_mapping = {
            "Industry Analyst": "industry_analysis",
            "Keyword Expander": "keyword_expansion",
            "Knowledge Structurer": "structuring",
            "Knowledge Graph Generator": "knowledge_graph"
        }
        
        stage = stage_mapping.get(agent.role, "unknown")
        
        # 進捗状況の送信
        self.loop.create_task(send_progress_update(
            stage=stage,
            progress=0,
            details={"message": f"{agent_name}が処理を開始しました"}
        ))
    
    def on_agent_finish(self, agent, result):
        agent_id = agent.role.lower().replace(" ", "-")
        agent_name = agent.role
        agent_type = agent.role.lower().replace(" ", "-")
        
        # ステージマッピング
        stage_mapping = {
            "Industry Analyst": "industry_analysis",
            "Keyword Expander": "keyword_expansion",
            "Knowledge Structurer": "structuring",
            "Knowledge Graph Generator": "knowledge_graph"
        }
        
        stage = stage_mapping.get(agent.role, "unknown")
        
        # 進捗状況の送信
        self.loop.create_task(send_progress_update(
            stage=stage,
            progress=100,
            details={"message": f"{agent_name}が処理を完了しました"}
        ))
    
    def on_agent_thinking(self, agent, thinking):
        agent_id = agent.role.lower().replace(" ", "-")
        agent_name = agent.role
        agent_type = agent.role.lower().replace(" ", "-")
        
        # 思考プロセスの送信
        self.loop.create_task(send_agent_thoughts(
            agent_id=agent_id,
            agent_name=agent_name,
            agent_type=agent_type,
            thoughts=thinking
        ))
    
    def on_agent_communication(self, source_agent, target_agent, message):
        source_agent_id = source_agent.role.lower().replace(" ", "-")
        source_agent_name = source_agent.role
        source_agent_type = source_agent.role.lower().replace(" ", "-")
        
        target_agent_id = target_agent.role.lower().replace(" ", "-")
        target_agent_name = target_agent.role
        target_agent_type = target_agent.role.lower().replace(" ", "-")
        
        # エージェント間通信の送信
        self.loop.create_task(send_agent_communication(
            source_agent_id=source_agent_id,
            source_agent_name=source_agent_name,
            source_agent_type=source_agent_type,
            target_agent_id=target_agent_id,
            target_agent_name=target_agent_name,
            target_agent_type=target_agent_type,
            message=message
        ))
```

### 1.3 ナレッジグラフのバージョン管理

Neo4jを使用したナレッジグラフのバージョン管理の実装例です。

```python
# backend/graph/knowledge_graph.py
from typing import Dict, List, Any, Optional
from datetime import datetime
from neo4j import GraphDatabase
import uuid

class KnowledgeGraphManager:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def close(self):
        self.driver.close()
    
    def _run_query(self, query: str, parameters: Dict[str, Any] = None):
        with self.driver.session() as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]
    
    # バージョン作成
    def create_version(self, name: str, description: str = None) -> str:
        version_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        query = """
        CREATE (v:Version {
            id: $id,
            name: $name,
            description: $description,
            timestamp: $timestamp
        })
        RETURN v
        """
        
        self._run_query(query, {
            "id": version_id,
            "name": name,
            "description": description,
            "timestamp": timestamp
        })
        
        return version_id
    
    # バージョン一覧取得
    def get_versions(self) -> List[Dict[str, Any]]:
        query = """
        MATCH (v:Version)
        RETURN v.id as id, v.name as name, v.description as description, v.timestamp as timestamp
        ORDER BY v.timestamp DESC
        """
        
        return self._run_query(query)
    
    # ノード追加
    def add_node(self, version_id: str, node_data: Dict[str, Any]) -> str:
        node_id = node_data.get("id", str(uuid.uuid4()))
        timestamp = datetime.now().isoformat()
        
        # ノードタイプに基づくラベル
        node_type = node_data.get("type", "Entity")
        label = "Concept" if node_type == "conceptNode" else "Entity"
        
        query = f"""
        MATCH (v:Version {{id: $version_id}})
        CREATE (n:{label} {{
            id: $id,
            label: $label,
            type: $type,
            description: $description,
            importance: $importance,
            timestamp: $timestamp,
            properties: $properties
        }})-[:BELONGS_TO]->(v)
        RETURN n
        """
        
        self._run_query(query, {
            "version_id": version_id,
            "id": node_id,
            "label": node_data.get("data", {}).get("label", ""),
            "type": node_type,
            "description": node_data.get("data", {}).get("description", ""),
            "importance": node_data.get("data", {}).get("importance", 1),
            "timestamp": timestamp,
            "properties": node_data.get("data", {}).get("properties", {})
        })
        
        return node_id
    
    # エッジ追加
    def add_edge(self, version_id: str, edge_data: Dict[str, Any]) -> str:
        edge_id = edge_data.get("id", str(uuid.uuid4()))
        timestamp = datetime.now().isoformat()
        
        # エッジタイプに基づく関係タイプ
        edge_type = edge_data.get("type", "RELATED_TO")
        relationship_type = edge_data.get("data", {}).get("label", "RELATED_TO")
        
        query = """
        MATCH (v:Version {id: $version_id})
        MATCH (source {id: $source_id})
        MATCH (target {id: $target_id})
        CREATE (source)-[r:`RELATED_TO` {
            id: $id,
            type: $type,
            label: $label,
            timestamp: $timestamp,
            properties: $properties
        }]->(target)
        CREATE (r)-[:BELONGS_TO]->(v)
        RETURN r
        """
        
        self._run_query(query, {
            "version_id": version_id,
            "id": edge_id,
            "source_id": edge_data.get("source", ""),
            "target_id": edge_data.get("target", ""),
            "type": edge_type,
            "label": relationship_type,
            "timestamp": timestamp,
            "properties": edge_data.get("data", {}).get("properties", {})
        })
        
        return edge_id
    
    # 特定バージョンのグラフ取得
    def get_graph(self, version_id: Optional[str] = None) -> Dict[str, Any]:
        if version_id:
            # 特定バージョンのグラフを取得
            nodes_query = """
            MATCH (n)-[:BELONGS_TO]->(v:Version {id: $version_id})
            RETURN n.id as id, labels(n)[0] as type, n.label as label, n.description as description,
                   n.importance as importance, n.properties as properties
            """
            
            edges_query = """
            MATCH (source)-[r]->(target)
            MATCH (r)-[:BELONGS_TO]->(v:Version {id: $version_id})
            RETURN r.id as id, r.type as type, r.label as label, source.id as source, target.id as target,
                   r.properties as properties
            """
            
            nodes = self._run_query(nodes_query, {"version_id": version_id})
            edges = self._run_query(edges_query, {"version_id": version_id})
        else:
            # 最新バージョンのグラフを取得
            latest_version_query = """
            MATCH (v:Version)
            RETURN v.id as id
            ORDER BY v.timestamp DESC
            LIMIT 1
            """
            
            latest_versions = self._run_query(latest_version_query)
            if not latest_versions:
                return {"nodes": [], "edges": []}
            
            latest_version_id = latest_versions[0]["id"]
            return self.get_graph(latest_version_id)
        
        # React Flow形式に変換
        react_flow_nodes = []
        for node in nodes:
            node_type = "conceptNode" if node["type"] == "Concept" else "entityNode"
            react_flow_nodes.append({
                "id": node["id"],
                "type": node_type,
                "position": {"x": 0, "y": 0},  # フロントエンドで配置
                "data": {
                    "label": node["label"],
                    "description": node["description"],
                    "importance": node["importance"],
                    "properties": node["properties"]
                }
            })
        
        react_flow_edges = []
        for edge in edges:
            react_flow_edges.append({
                "id": edge["id"],
                "source": edge["source"],
                "target": edge["target"],
                "type": "knowledgeEdge",
                "data": {
                    "label": edge["label"],
                    "properties": edge["properties"]
                }
            })
        
        return {
            "nodes": react_flow_nodes,
            "edges": react_flow_edges
        }
    
    # ノード更新
    def update_node(self, version_id: str, node_id: str, node_data: Dict[str, Any]) -> bool:
        # 新しいバージョンのノードを作成
        timestamp = datetime.now().isoformat()
        
        # ノードタイプに基づくラベル
        node_type = node_data.get("type", "Entity")
        label = "Concept" if node_type == "conceptNode" else "Entity"
        
        # 古いノードを取得
        old_node_query = """
        MATCH (n {id: $node_id})-[:BELONGS_TO]->(v:Version {id: $version_id})
        RETURN n
        """
        
        old_nodes = self._run_query(old_node_query, {
            "node_id": node_id,
            "version_id": version_id
        })
        
        if not old_nodes:
            return False
        
        # 新しいノードを作成
        new_node_query = f"""
        MATCH (v:Version {{id: $version_id}})
        CREATE (n:{label} {{
            id: $id,
            label: $label,
            type: $type,
            description: $description,
            importance: $importance,
            timestamp: $timestamp,
            properties: $properties,
            previous_version: $node_id
        }})-[:BELONGS_TO]->(v)
        RETURN n
        """
        
        self._run_query(new_node_query, {
            "version_id": version_id,
            "id": str(uuid.uuid4()),
            "label": node_data.get("data", {}).get("label", ""),
            "type": node_type,
            "description": node_data.get("data", {}).get("description", ""),
            "importance": node_data.get("data", {}).get("importance", 1),
            "timestamp": timestamp,
            "properties": node_data.get("data", {}).get("properties", {}),
            "node_id": node_id
        })
        
        return True
    
    # ノード削除
    def delete_node(self, version_id: str, node_id: str) -> bool:
        # 論理削除（削除フラグを設定）
        query = """
        MATCH (n {id: $node_id})-[:BELONGS_TO]->(v:Version {id: $version_id})
        SET n.deleted = true, n.deleted_at = $timestamp
        RETURN n
        """
        
        result = self._run_query(query, {
            "node_id": node_id,
            "version_id": version_id,
            "timestamp": datetime.now().isoformat()
        })
        
        return len(result) > 0
```

## 2. フロントエンド実装

### 2.1 Socket.IOクライアント

WebSocketサーバーと通信するためのSocket.IOクライアントの実装例です。

```typescript
// lib/socket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8000');
    
    socket.on('connect', () => {
      console.log('WebSocket connected');
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
    
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }
  
  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const closeSocket = (): void => {
  if (socket) {
    socket.close();
    socket = null;
  }
};

// イベントリスナーの登録ヘルパー
export const onAgentThoughts = (callback: (data: any) => void): void => {
  if (socket) {
    socket.on('agent-thoughts', callback);
  }
};

export const onAgentCommunication = (callback: (data: any) => void): void => {
  if (socket) {
    socket.on('agent-communication', callback);
  }
};

export const onProgressUpdate = (callback: (data: any) => void): void => {
  if (socket) {
    socket.on('progress-update', callback);
  }
};

export const onKnowledgeGraphUpdate = (callback: (data: any) => void): void => {
  if (socket) {
    socket.on('knowledge-graph-update', callback);
  }
};

export const onNodeAdded = (callback: (data: any) => void): void => {
  if (socket) {
    socket.on('node-added', callback);
  }
};

export const onEdgeAdded = (callback: (data: any) => void): void => {
  if (socket) {
    socket.on('edge-added', callback);
  }
};

// イベントリスナーの削除ヘルパー
export const offAgentThoughts = (callback: (data: any) => void): void => {
  if (socket) {
    socket.off('agent-thoughts', callback);
  }
};

export const offAgentCommunication = (callback: (data: any) => void): void => {
  if (socket) {
    socket.off('agent-communication', callback);
  }
};

export const offProgressUpdate = (callback: (data: any) => void): void => {
  if (socket) {
    socket.off('progress-update', callback);
  }
};

export const offKnowledgeGraphUpdate = (callback: (data: any) => void): void => {
  if (socket) {
    socket.off('knowledge-graph-update', callback);
  }
};

export const offNodeAdded = (callback: (data: any) => void): void => {
  if (socket) {
    socket.off('node-added', callback);
  }
};

export const offEdgeAdded = (callback: (data: any) => void): void => {
  if (socket) {
    socket.off('edge-added', callback);
  }
};
```

### 2.2 React Flowとの統合

React Flowとの統合を実現するためのカスタムフックの実装例です。

```typescript
// hooks/useKnowledgeGraph.ts
import { useState, useEffect, useCallback } from 'react';
import { useNodesState, useEdgesState, Node, Edge, addEdge } from 'reactflow';
import { getSocket, onKnowledgeGraphUpdate, onNodeAdded, onEdgeAdded, offKnowledgeGraphUpdate, offNodeAdded, offEdgeAdded } from '../lib/socket';

interface UseKnowledgeGraphProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  selectedVersion?: string;
}

interface UseKnowledgeGraphResult {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: any;
  loading: boolean;
  error: string | null;
  refreshGraph: (versionId?: string) => Promise<void>;
  addNode: (node: Omit<Node, 'id'>) => Promise<string | null>;
  updateNode: (nodeId: string, data: any) => Promise<boolean>;
  deleteNode: (nodeId: string) => Promise<boolean>;
  addEdge: (params: any) => Promise<string | null>;
}

export const useKnowledgeGraph = ({
  initialNodes = [],
  initialEdges = [],
  selectedVersion
}: UseKnowledgeGraphProps): UseKnowledgeGraphResult => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // グラフデータの取得
  const fetchGraphData = useCallback(async (versionId?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const url = versionId 
        ? `/api/knowledge-graph/versions/${versionId}` 
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching graph data:', err);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);
  
  // 初期データの読み込み
  useEffect(() => {
    fetchGraphData(selectedVersion);
  }, [fetchGraphData, selectedVersion]);
  
  // WebSocketイベントの処理
  useEffect(() => {
    const handleGraphUpdate = (data: any) => {
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
      }
    };
    
    const handleNodeAdded = (data: any) => {
      if (data.node) {
        setNodes((nds) => [...nds, data.node]);
      }
    };
    
    const handleEdgeAdded = (data: any) => {
      if (data.edge) {
        setEdges((eds) => [...eds, data.edge]);
      }
    };
    
    onKnowledgeGraphUpdate(handleGraphUpdate);
    onNodeAdded(handleNodeAdded);
    onEdgeAdded(handleEdgeAdded);
    
    return () => {
      offKnowledgeGraphUpdate(handleGraphUpdate);
      offNodeAdded(handleNodeAdded);
      offEdgeAdded(handleEdgeAdded);
    };
  }, [setNodes, setEdges]);
  
  // エッジの接続ハンドラ
  const onConnect = useCallback((params: any) => {
    setEdges((eds) => addEdge({ ...params, type: 'knowledgeEdge' }, eds));
  }, [setEdges]);
  
  // ノードの追加
  const addNode = useCallback(async (node: Omit<Node, 'id'>): Promise<string | null> => {
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
      
      const data = await response.json();
      return data.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error adding node:', err);
      return null;
    }
  }, []);
  
  // ノードの更新
  const updateNode = useCallback(async (nodeId: string, data: any): Promise<boolean> => {
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
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error updating node:', err);
      return false;
    }
  }, []);
  
  // ノードの削除
  const deleteNode = useCallback(async (nodeId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/knowledge-graph/nodes/${nodeId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete node');
      }
      
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error deleting node:', err);
      return false;
    }
  }, [setNodes, setEdges]);
  
  // エッジの追加
  const addCustomEdge = useCallback(async (params: any): Promise<string | null> => {
    try {
      const edge = {
        source: params.source,
        target: params.target,
        type: params.type || 'knowledgeEdge',
        data: params.data || { label: 'related' }
      };
      
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
      
      const data = await response.json();
      return data.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error adding edge:', err);
      return null;
    }
  }, []);
  
  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    loading,
    error,
    refreshGraph: fetchGraphData,
    addNode,
    updateNode,
    deleteNode,
    addEdge: addCustomEdge
  };
};
```

### 2.3 エージェント通信の監視

エージェント間の通信を監視するためのカスタムフックの実装例です。

```typescript
// hooks/useAgentCommunication.ts
import { useState, useEffect, useCallback } from 'react';
import { onAgentThoughts, onAgentCommunication, onProgressUpdate, offAgentThoughts, offAgentCommunication, offProgressUpdate } from '../lib/socket';

interface AgentThought {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  content: string;
  timestamp: string;
}

interface AgentCommunication {
  id: string;
  sourceAgentId: string;
  sourceAgentName: string;
  sourceAgentType: string;
  targetAgentId: string;
  targetAgentName: string;
  targetAgentType: string;
  content: string;
  timestamp: string;
}

interface ProgressUpdate {
  id: string;
  stage: string;
  progress: number;
  details: {
    message: string;
    [key: string]: any;
  };
  timestamp: string;
}

interface UseAgentCommunicationResult {
  thoughts: AgentThought[];
  communications: AgentCommunication[];
  progressUpdates: ProgressUpdate[];
  clearThoughts: () => void;
  clearCommunications: () => void;
  clearProgressUpdates: () => void;
  clearAll: () => void;
}

export const useAgentCommunication = (): UseAgentCommunicationResult => {
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [communications, setCommunications] = useState<AgentCommunication[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  
  // エージェントの思考プロセスの処理
  useEffect(() => {
    const handleAgentThoughts = (data: any) => {
      const thought: AgentThought = {
        id: `thought-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        agentId: data.agentId,
        agentName: data.agentName,
        agentType: data.agentType,
        content: data.thoughts,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      setThoughts((prev) => [...prev, thought]);
    };
    
    onAgentThoughts(handleAgentThoughts);
    
    return () => {
      offAgentThoughts(handleAgentThoughts);
    };
  }, []);
  
  // エージェント間の通信の処理
  useEffect(() => {
    const handleAgentCommunication = (data: any) => {
      const communication: AgentCommunication = {
        id: `comm-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        sourceAgentId: data.sourceAgentId,
        sourceAgentName: data.sourceAgentName,
        sourceAgentType: data.sourceAgentType,
        targetAgentId: data.targetAgentId,
        targetAgentName: data.targetAgentName,
        targetAgentType: data.targetAgentType,
        content: data.message,
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      setCommunications((prev) => [...prev, communication]);
    };
    
    onAgentCommunication(handleAgentCommunication);
    
    return () => {
      offAgentCommunication(handleAgentCommunication);
    };
  }, []);
  
  // 進捗状況の処理
  useEffect(() => {
    const handleProgressUpdate = (data: any) => {
      const progressUpdate: ProgressUpdate = {
        id: `progress-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        stage: data.stage,
        progress: data.progress,
        details: data.details || { message: '' },
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      setProgressUpdates((prev) => [...prev, progressUpdate]);
    };
    
    onProgressUpdate(handleProgressUpdate);
    
    return () => {
      offProgressUpdate(handleProgressUpdate);
    };
  }, []);
  
  // クリア関数
  const clearThoughts = useCallback(() => {
    setThoughts([]);
  }, []);
  
  const clearCommunications = useCallback(() => {
    setCommunications([]);
  }, []);
  
  const clearProgressUpdates = useCallback(() => {
    setProgressUpdates([]);
  }, []);
  
  const clearAll = useCallback(() => {
    clearThoughts();
    clearCommunications();
    clearProgressUpdates();
  }, [clearThoughts, clearCommunications, clearProgressUpdates]);
  
  return {
    thoughts,
    communications,
    progressUpdates,
    clearThoughts,
    clearCommunications,
    clearProgressUpdates,
    clearAll
  };
};
```

### 2.4 メインページの実装

上記のコンポーネントとフックを統合したメインページの実装例です。

```tsx
// pages/knowledge-graph.tsx
import { useState, useEffect, useCallback } from 'react';
import { ReactFlowProvider } from 'reactflow';
import KnowledgeGraph from '../components/KnowledgeGraph';
import EnhancedChatPanel from '../components/EnhancedChatPanel';
import AgentCommunicationFlow from '../components/AgentCommunicationFlow';
import ProgressStatusBar from '../components/ProgressStatusBar';
import ActivityLog from '../components/ActivityLog';
import NodeDetails from '../components/NodeDetails';
import VersionControl from '../components/VersionControl';
import NodeEditor from '../components/NodeEditor';
import ThoughtProcessOverlay from '../components/ThoughtProcessOverlay';
import { initSocket } from '../lib/socket';
import { useKnowledgeGraph } from '../hooks/useKnowledgeGraph';
import { useAgentCommunication } from '../hooks/useAgentCommunication';

const KnowledgeGraphPage = () => {
  // 状態管理
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [activeTab, setActiveTab] = useState('knowledge'); // 'knowledge' or 'process'
  const [showThoughtOverlay, setShowThoughtOverlay] = useState(true);
  const [sidebarTab, setSidebarTab] = useState('chat'); // 'chat' or 'details'
  
  // WebSocketの初期化
  useEffect(() => {
    initSocket();
  }, []);
  
  // ナレッジグラフフック
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    loading,
    error,
    refreshGraph,
    addNode,
    updateNode,
    deleteNode,
    addEdge
  } = useKnowledgeGraph({
    selectedVersion
  });
  
  // エージェント通信フック
  const {
    thoughts,
    communications,
    progressUpdates
  } = useAgentCommunication();
  
  // ノードクリックハンドラ
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    setSidebarTab('details');
  }, []);
  
  // ノード編集ハンドラ
  const handleNodeEdit = useCallback(async (nodeId, data) => {
    const success = await updateNode(nodeId, data);
    if (success) {
      // ノードの状態を更新
      setSelectedNode((prev) => {
        if (prev && prev.id === nodeId) {
          return {
            ...prev,
            data: {
              ...prev.data,
              ...data
            }
          };
        }
        return prev;
      });
    }
    return success;
  }, [updateNode]);
  
  // ノード削除ハンドラ
  const handleNodeDelete = useCallback(async (nodeId) => {
    const success = await deleteNode(nodeId);
    if (success) {
      setSelectedNode(null);
      setSidebarTab('chat');
    }
    return success;
  }, [deleteNode]);
  
  // バージョン選択ハンドラ
  const handleVersionSelect = useCallback((version) => {
    setSelectedVersion(version.id);
    refreshGraph(version.id);
  }, [refreshGraph]);
  
  // ノード追加ハンドラ
  const handleAddNode = useCallback(async (nodeData) => {
    const nodeId = await addNode(nodeData);
    return nodeId;
  }, [addNode]);
  
  // エッジ追加ハンドラ
  const handleAddEdge = useCallback(async (edgeData) => {
    const edgeId = await addEdge(edgeData);
    return edgeId;
  }, [addEdge]);
  
  // メッセージクリックハンドラ
  const handleMessageClick = useCallback((message) => {
    // 関連するノードを選択
    if (message.agentId) {
      const node = nodes.find(n => n.data.agentId === message.agentId);
      if (node) {
        handleNodeClick(node);
      }
    }
  }, [nodes, handleNodeClick]);
  
  return (
    <div className="knowledge-graph-page">
      <div className="header">
        <h1>AIエージェントナレッジグラフ</h1>
        <div className="header-controls">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveTab('knowledge')}
            >
              ナレッジグラフ
            </button>
            <button
              className={`tab ${activeTab === 'process' ? 'active' : ''}`}
              onClick={() => setActiveTab('process')}
            >
              処理フロー
            </button>
          </div>
          
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
      
      <ProgressStatusBar progressUpdates={progressUpdates} />
      
      <div className="main-content">
        <div className="graph-container">
          <ReactFlowProvider>
            {activeTab === 'knowledge' ? (
              <KnowledgeGraph
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                loading={loading}
              />
            ) : (
              <AgentCommunicationFlow
                onNodeClick={handleNodeClick}
                communications={communications}
                thoughts={thoughts}
                progressUpdates={progressUpdates}
              />
            )}
          </ReactFlowProvider>
        </div>
        
        <div className="side-panel">
          {sidebarTab === 'details' && selectedNode ? (
            <NodeDetails
              node={selectedNode}
              onClose={() => {
                setSelectedNode(null);
                setSidebarTab('chat');
              }}
              onEdit={handleNodeEdit}
              onDelete={handleNodeDelete}
            />
          ) : (
            <div className="tabs-container">
              <div className="tabs-header">
                <button
                  className={`tab ${sidebarTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('chat')}
                >
                  チャット
                </button>
                <button
                  className={`tab ${sidebarTab === 'editor' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('editor')}
                >
                  エディタ
                </button>
              </div>
              
              <div className="tabs-content">
                {sidebarTab === 'chat' ? (
                  <EnhancedChatPanel
                    thoughts={thoughts}
                    communications={communications}
                    progressUpdates={progressUpdates}
                    onMessageClick={handleMessageClick}
                    selectedNode={selectedNode}
                  />
                ) : (
                  <NodeEditor
                    onAddNode={handleAddNode}
                    onAddEdge={handleAddEdge}
                    existingNodes={nodes}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="bottom-panel">
        {activeTab === 'knowledge' && (
          <VersionControl
            onVersionSelect={handleVersionSelect}
            selectedVersion={selectedVersion}
          />
        )}
        
        <ActivityLog
          thoughts={thoughts}
          communications={communications}
          progressUpdates={progressUpdates}
        />
      </div>
      
      {showThoughtOverlay && <ThoughtProcessOverlay thoughts={thoughts} />}
    </div>
  );
};

export default KnowledgeGraphPage;
```

## 3. API実装

### 3.1 Next.js API Routes

Next.jsのAPI Routesを使用したバックエンドAPIの実装例です。

```typescript
// pages/api/knowledge-graph/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { KnowledgeGraphManager } from '../../../backend/graph/knowledge_graph';

// Neo4j接続情報
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

// KnowledgeGraphManagerのインスタンス
let graphManager: KnowledgeGraphManager | null = null;

// シングルトンパターンでインスタンスを取得
const getGraphManager = (): KnowledgeGraphManager => {
  if (!graphManager) {
    graphManager = new KnowledgeGraphManager(neo4jUri, neo4jUser, neo4jPassword);
  }
  return graphManager;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const manager = getGraphManager();
  
  switch (req.method) {
    case 'GET':
      try {
        const graph = await manager.getGraph();
        res.status(200).json(graph);
      } catch (error) {
        console.error('Error fetching graph:', error);
        res.status(500).json({ error: 'Failed to fetch graph data' });
      }
      break;
    
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
```

```typescript
// pages/api/knowledge-graph/versions/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { KnowledgeGraphManager } from '../../../../backend/graph/knowledge_graph';

// Neo4j接続情報
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

// KnowledgeGraphManagerのインスタンス
let graphManager: KnowledgeGraphManager | null = null;

// シングルトンパターンでインスタンスを取得
const getGraphManager = (): KnowledgeGraphManager => {
  if (!graphManager) {
    graphManager = new KnowledgeGraphManager(neo4jUri, neo4jUser, neo4jPassword);
  }
  return graphManager;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const manager = getGraphManager();
  
  switch (req.method) {
    case 'GET':
      try {
        const versions = await manager.getVersions();
        res.status(200).json(versions);
      } catch (error) {
        console.error('Error fetching versions:', error);
        res.status(500).json({ error: 'Failed to fetch versions' });
      }
      break;
    
    case 'POST':
      try {
        const { name, description } = req.body;
        
        if (!name) {
          return res.status(400).json({ error: 'Name is required' });
        }
        
        const versionId = await manager.createVersion(name, description);
        res.status(201).json({ id: versionId });
      } catch (error) {
        console.error('Error creating version:', error);
        res.status(500).json({ error: 'Failed to create version' });
      }
      break;
    
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
```

```typescript
// pages/api/knowledge-graph/versions/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { KnowledgeGraphManager } from '../../../../backend/graph/knowledge_graph';

// Neo4j接続情報
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

// KnowledgeGraphManagerのインスタンス
let graphManager: KnowledgeGraphManager | null = null;

// シングルトンパターンでインスタンスを取得
const getGraphManager = (): KnowledgeGraphManager => {
  if (!graphManager) {
    graphManager = new KnowledgeGraphManager(neo4jUri, neo4jUser, neo4jPassword);
  }
  return graphManager;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid version ID' });
  }
  
  const manager = getGraphManager();
  
  switch (req.method) {
    case 'GET':
      try {
        const graph = await manager.getGraph(id);
        res.status(200).json(graph);
      } catch (error) {
        console.error('Error fetching graph for version:', error);
        res.status(500).json({ error: 'Failed to fetch graph data for version' });
      }
      break;
    
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
```

```typescript
// pages/api/knowledge-graph/nodes/index.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { KnowledgeGraphManager } from '../../../../backend/graph/knowledge_graph';
import { getSocket } from '../../../../lib/socket';

// Neo4j接続情報
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

// KnowledgeGraphManagerのインスタンス
let graphManager: KnowledgeGraphManager | null = null;

// シングルトンパターンでインスタンスを取得
const getGraphManager = (): KnowledgeGraphManager => {
  if (!graphManager) {
    graphManager = new KnowledgeGraphManager(neo4jUri, neo4jUser, neo4jPassword);
  }
  return graphManager;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const manager = getGraphManager();
  
  switch (req.method) {
    case 'POST':
      try {
        const nodeData = req.body;
        
        if (!nodeData || !nodeData.data || !nodeData.data.label) {
          return res.status(400).json({ error: 'Invalid node data' });
        }
        
        // 最新バージョンを取得
        const versions = await manager.getVersions();
        if (!versions || versions.length === 0) {
          return res.status(400).json({ error: 'No versions available' });
        }
        
        const latestVersion = versions[0];
        
        // ノードを追加
        const nodeId = await manager.addNode(latestVersion.id, nodeData);
        
        // 追加されたノードをWebSocketで通知
        const socket = getSocket();
        if (socket) {
          socket.emit('node-added', {
            node: {
              ...nodeData,
              id: nodeId
            }
          });
        }
        
        res.status(201).json({ id: nodeId });
      } catch (error) {
        console.error('Error adding node:', error);
        res.status(500).json({ error: 'Failed to add node' });
      }
      break;
    
    default:
      res.setHeader('Allow', ['POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
```

## 4. 統合と実装ステップ

### 4.1 プロジェクト構成

プロジェクト全体の構成例です。

```
project/
├── backend/
│   ├── agents/
│   │   ├── setup.py
│   │   └── callbacks.py
│   ├── graph/
│   │   └── knowledge_graph.py
│   └── websocket_server.py
├── components/
│   ├── nodes/
│   │   ├── AgentNode.jsx
│   │   ├── ConceptNode.jsx
│   │   └── EntityNode.jsx
│   ├── edges/
│   │   ├── CommunicationEdge.jsx
│   │   └── KnowledgeEdge.jsx
│   ├── AgentCommunicationFlow.jsx
│   ├── EnhancedChatPanel.jsx
│   ├── KnowledgeGraph.jsx
│   ├── NodeDetails.jsx
│   ├── NodeEditor.jsx
│   ├── ProgressStatusBar.jsx
│   ├── ThoughtBubble.jsx
│   ├── ThoughtProcessOverlay.jsx
│   ├── VersionControl.jsx
│   └── ActivityLog.jsx
├── hooks/
│   ├── useKnowledgeGraph.ts
│   └── useAgentCommunication.ts
├── lib/
│   └── socket.ts
├── pages/
│   ├── api/
│   │   └── knowledge-graph/
│   │       ├── index.ts
│   │       ├── nodes/
│   │       │   ├── index.ts
│   │       │   └── [id].ts
│   │       ├── edges/
│   │       │   ├── index.ts
│   │       │   └── [id].ts
│   │       └── versions/
│   │           ├── index.ts
│   │           └── [id].ts
│   ├── _app.tsx
│   ├── index.tsx
│   └── knowledge-graph.tsx
├── public/
│   └── ...
├── styles/
│   ├── globals.css
│   └── ...
├── .env
├── .env.local
├── next.config.js
├── package.json
└── tsconfig.json
```

### 4.2 実装ステップ

プロジェクトの実装ステップの例です。

1. **環境設定**
   - Next.jsプロジェクトのセットアップ
   - 必要なパッケージのインストール（React Flow, Socket.IO, CrewAI, LangChain, LlamaIndex, Neo4j）
   - 環境変数の設定（.envファイル）

2. **バックエンド実装**
   - Neo4jデータベースのセットアップ
   - KnowledgeGraphManagerの実装
   - CrewAI、LangChain、LlamaIndexの統合
   - WebSocketサーバーの実装

3. **フロントエンド実装**
   - カスタムノードとエッジコンポーネントの実装
   - React Flowを使用したグラフコンポーネントの実装
   - Socket.IOクライアントの実装
   - カスタムフックの実装

4. **API実装**
   - Next.js API Routesの実装
   - WebSocketとの連携

5. **統合とテスト**
   - コンポーネントの統合
   - エンドツーエンドのテスト
   - パフォーマンス最適化

### 4.3 デプロイ

デプロイの手順例です。

1. **開発環境**
   ```bash
   # 開発サーバーの起動
   npm run dev
   
   # WebSocketサーバーの起動
   python backend/websocket_server.py
   ```

2. **本番環境**
   ```bash
   # ビルド
   npm run build
   
   # 本番サーバーの起動
   npm start
   
   # WebSocketサーバーの起動（本番環境用の設定）
   python backend/websocket_server.py --production
   ```

3. **コンテナ化（オプション）**
   - Dockerfileの作成
   - docker-composeの設定
   - コンテナのビルドとデプロイ

## まとめ

この文書では、CrewAI、LangChain、LlamaIndexを使用した現在のAIエージェント実装と、React Flowを効果的に統合するための実装例を提供しました。

主なポイントは以下の通りです：

1. **バックエンド実装**：CrewAI、LangChain、LlamaIndexを統合したAIエージェントシステムと、WebSocketを使用したリアルタイム通信、Neo4jを使用したナレッジグラフのバージョン管理の実装例を提供しました。

2. **フロントエンド実装**：React Flowとの統合を実現するためのカスタムフックと、Socket.IOクライアントの実装例を提供しました。また、エージェント通信の監視とナレッジグラフの操作のためのカスタムフックも提供しました。

3. **API実装**：Next.jsのAPI Routesを使用したバックエンドAPIの実装例を提供しました。

4. **統合と実装ステップ**：プロジェクト全体の構成と実装ステップ、デプロイ手順の例を提供しました。

これらの実装例を参考に、CrewAI、LangChain、LlamaIndexを使用した現在のAIエージェント実装と、React Flowを効果的に統合したシステムを構築することができます。このシステムにより、AIエージェント間の対話をリアルタイムで視覚化し、ナレッジグラフを動的に更新・表示することが可能になります。
