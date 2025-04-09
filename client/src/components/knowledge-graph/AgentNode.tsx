import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Brain, Pencil, Trash2, Plus, ArrowRightCircle } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

// エージェントノードコンポーネント
const AgentNode = memo(({ data, selected }: NodeProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // ノードの基本スタイル
  const nodeStyle: React.CSSProperties = {
    padding: '10px',
    borderRadius: '10px',
    border: `2px solid #7b2cbf`,
    boxShadow: selected ? '0 0 0 2px #ff0072' : '0 3px 8px rgba(0, 0, 0, 0.15)',
    width: '160px', // より小さいサイズに
    height: 'auto',
    minHeight: '60px',
    fontSize: '11px', // より小さいフォントに
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    background: 'linear-gradient(135deg, #5a189a 0%, #7b2cbf 100%)',
    color: '#ffffff',
    transition: 'all 0.3s ease',
    transform: selected ? 'scale(1.05)' : 'scale(1)',
    zIndex: selected ? 10 : 0,
    position: 'relative',
  };
  
  // コンテキストメニューを開く処理（マウス位置に表示）
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    // マウスカーソルの位置を保存
    setMenuPosition({ x: event.clientX, y: event.clientY });
    setIsMenuOpen(true);
  }, []);
  
  // 子ノード追加
  const handleAddChild = useCallback(() => {
    setIsMenuOpen(false);
    if (data.onAddChild) {
      data.onAddChild(data.id);
    }
  }, [data]);
  
  // 兄弟ノード追加
  const handleAddSibling = useCallback(() => {
    setIsMenuOpen(false);
    if (data.onAddSibling) {
      data.onAddSibling(data.id);
    }
  }, [data]);
  
  // ノード編集
  const handleEdit = useCallback(() => {
    setIsMenuOpen(false);
    if (data.onEdit) {
      data.onEdit(data.id);
    }
  }, [data]);
  
  // ノード削除
  const handleDelete = useCallback(() => {
    setIsMenuOpen(false);
    if (data.onDelete) {
      data.onDelete(data.id);
    }
  }, [data]);

  // エージェントタイプに基づくアイコンの選択
  const getAgentIcon = () => {
    const type = data.agentType || '';
    
    if (type.includes('industry')) return '🏭';
    if (type.includes('keyword')) return '🔑';
    if (type.includes('structure')) return '🏗️';
    return '🤖';
  };

  return (
    <div 
      style={nodeStyle}
      onContextMenu={handleContextMenu}
    >
      {/* コンテキストメニュー (右クリックメニュー) */}
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <div style={{ display: 'none' }}></div>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-40 z-50"
          style={{ 
            position: 'fixed', 
            left: `${menuPosition.x}px`, 
            top: `${menuPosition.y}px` 
          }}>
          <DropdownMenuItem onClick={handleEdit} className="cursor-pointer">
            <Pencil className="mr-2 h-4 w-4" />
            <span>編集</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleAddChild} className="cursor-pointer">
            <Plus className="mr-2 h-4 w-4" />
            <span>子ノード追加</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleAddSibling} className="cursor-pointer">
            <ArrowRightCircle className="mr-2 h-4 w-4" />
            <span>兄弟ノード追加</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-red-600 hover:text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            <span>削除</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* 上部ハンドル - 接続ポイント */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#9d4edd', width: '8px', height: '8px' }}
      />
      
      {/* ノードのコンテンツ */}
      <div style={{ 
        marginBottom: '3px', 
        fontSize: '18px', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '50%',
        width: '32px',
        height: '32px'
      }}>
        {getAgentIcon()}
      </div>
      
      <div style={{ 
        fontWeight: 'bold', 
        marginBottom: '3px', 
        fontSize: '12px',
        background: 'rgba(0, 0, 0, 0.2)',
        padding: '2px 6px',
        borderRadius: '10px',
        width: '100%'
      }}>
        {data.label || data.name}
      </div>
      
      {data.description && (
        <div style={{ 
          fontSize: '10px', 
          opacity: 0.9, 
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          maxWidth: '140px',
          margin: '3px 0'
        }}>
          {data.description}
        </div>
      )}

      {/* ステータス表示 */}
      <div style={{ 
        marginTop: '3px', 
        backgroundColor: 'rgba(255, 255, 255, 0.3)', 
        padding: '1px 6px', 
        borderRadius: '8px', 
        fontSize: '9px',
        fontWeight: 'bold',
        letterSpacing: '0.5px'
      }}>
        {data.status || 'アクティブ'}
      </div>
      
      {/* 下部ハンドル - 接続ポイント */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#9d4edd', width: '8px', height: '8px' }}
      />
    </div>
  );
});

export default AgentNode;