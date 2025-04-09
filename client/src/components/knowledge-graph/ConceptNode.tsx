import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Pencil, Trash2, Plus, PlusCircle, ArrowRightCircle, Copy, ChevronRight } from 'lucide-react';

// カスタムコンセプトノードコンポーネント
const ConceptNode = memo(({ data, selected }: NodeProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // ノードの基本スタイル
  const nodeStyle: React.CSSProperties = {
    padding: '10px',
    borderRadius: '8px',
    border: `2px solid ${data.color || '#1a192b'}`,
    boxShadow: selected ? '0 0 0 2px #ff0072' : 'none',
    width: '160px', // より小さいサイズに
    minHeight: '60px',
    fontSize: '11px', // より小さいフォントに
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    backgroundColor: data.color || '#fff',
    color: getContrastColor(data.color || '#1a192b'),
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
  
  // ノード拡張（AI）
  const handleExpand = useCallback(() => {
    setIsMenuOpen(false);
    if (data.onExpand) {
      data.onExpand(data.id);
    }
  }, [data]);

  // ノードレベルに基づくアイコンの選択
  const getNodeIcon = () => {
    const level = data.level || 0;
    
    if (level === 0) return '🔍'; // ルートノード
    if (level === 1) return '🌐'; // 主要カテゴリ
    if (level === 2) return '📚'; // サブカテゴリ
    return '📝'; // その他
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
          <DropdownMenuItem onClick={handleExpand} className="cursor-pointer">
            <ChevronRight className="mr-2 h-4 w-4" />
            <span>AI拡張</span>
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
        style={{ background: data.color || '#1a192b', width: '8px', height: '8px' }}
      />
      
      {/* ノードのコンテンツ */}
      <div style={{ marginBottom: '3px', fontSize: '16px' }}>
        {getNodeIcon()}
      </div>
      
      <div style={{ fontWeight: 'bold', marginBottom: '3px', fontSize: '13px' }}>
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
          maxWidth: '140px'
        }}>
          {data.description}
        </div>
      )}

      {/* タイプ表示 */}
      <div style={{ 
        marginTop: '3px', 
        backgroundColor: 'rgba(255, 255, 255, 0.2)', 
        padding: '1px 4px', 
        borderRadius: '3px', 
        fontSize: '9px'
      }}>
        {data.type || 'concept'}
      </div>
      
      {/* 下部ハンドル - 接続ポイント */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: data.color || '#1a192b', width: '8px', height: '8px' }}
      />
    </div>
  );
});

// テキスト色のコントラスト計算（背景色に基づいて白または黒を選択）
function getContrastColor(hexColor: string): string {
  // カラーコードからRGB値を取得
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  
  // YIQ方式で明るさを計算
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  // 明るさに基づいて白または黒を返す
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

export default ConceptNode;