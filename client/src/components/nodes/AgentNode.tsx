import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Bot, Network, Activity, Database, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AgentNodeData {
  label: string;
  agentType: string;
  status: string;
  progress: number;
  message?: string;
  thoughts?: string[];
}

function getAgentIcon(agentType: string) {
  switch (agentType.toLowerCase()) {
    case 'orchestrator':
      return <Network className="w-4 h-4 mr-1" />;
    case 'analyzer':
      return <Activity className="w-4 h-4 mr-1" />;
    case 'data':
      return <Database className="w-4 h-4 mr-1" />;
    default:
      return <Bot className="w-4 h-4 mr-1" />;
  }
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'running':
      return '#3b82f6'; // ブルー
    case 'completed':
      return '#10b981'; // グリーン
    case 'waiting':
      return '#f59e0b'; // アンバー
    case 'error':
      return '#ef4444'; // レッド
    default:
      return '#6b7280'; // グレー
  }
}

function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case 'running':
      return <Activity className="w-4 h-4" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'error':
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return null;
  }
}

const AgentNode = ({ data }: NodeProps<AgentNodeData>) => {
  const statusColor = getStatusColor(data.status);
  const agentIcon = getAgentIcon(data.agentType);
  const statusIcon = getStatusIcon(data.status);
  
  return (
    <>
      {/* インプットハンドル（上部） */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: statusColor, width: 8, height: 8 }}
      />
      
      {/* ノード本体 */}
      <div className="flex items-center bg-background border-2 border-border rounded-md p-2 shadow-md"
           style={{ width: '180px', minHeight: '80px' }}>
        <div className="flex flex-col w-full">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center font-bold text-sm">
              {agentIcon}
              <span className="truncate max-w-[100px]">{data.label}</span>
            </div>
            <div className="flex items-center">
              <div className="text-xs font-medium px-1.5 py-0.5 rounded-full" 
                   style={{ backgroundColor: statusColor, color: 'white' }}>
                {data.status}
              </div>
            </div>
          </div>
          
          {/* 進捗状況 */}
          <div className="flex items-center mt-1">
            <div className="w-10 h-10 mr-2">
              <CircularProgressbar
                value={data.progress}
                text={`${data.progress}%`}
                styles={buildStyles({
                  textSize: '30px',
                  pathColor: statusColor,
                  textColor: statusColor,
                  trailColor: '#d6d6d6',
                })}
              />
            </div>
            <div className="flex-1 ml-2">
              <p className="text-xs text-muted-foreground truncate max-w-[110px]">
                {data.message || `${data.agentType} ${data.status}`}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* アウトプットハンドル（下部） */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: statusColor, width: 8, height: 8 }}
      />
    </>
  );
};

export default memo(AgentNode);