import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { KnowledgeNode } from '@shared/schema';

interface NodeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'edit' | 'add-child' | 'add-sibling';
  node: KnowledgeNode | null;
  onSave: (data: { name: string; description: string; color?: string }) => void;
}

export const NodeEditDialog: React.FC<NodeEditDialogProps> = ({
  open,
  onOpenChange,
  type,
  node,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');

  useEffect(() => {
    if (type === 'edit' && node) {
      setName(node.name);
      setDescription(node.description || '');
      setColor(node.color || '');
    } else {
      // 子ノードと兄弟ノードの場合は新規作成なので、初期値をクリア
      setName('');
      setDescription('');
      setColor('');
    }
  }, [type, node, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name,
      description,
      color: color || undefined,
    });
    
    onOpenChange(false);
  };

  const getTitleByType = () => {
    switch (type) {
      case 'edit':
        return 'ノードを編集';
      case 'add-child':
        return '子ノードを追加';
      case 'add-sibling':
        return '兄弟ノードを追加';
      default:
        return 'ノードを編集';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitleByType()}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              名前
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              説明
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="color" className="text-right">
              色
            </Label>
            <div className="col-span-3 flex items-center gap-2">
              <Input
                id="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#RRGGBB"
              />
              <div
                className="w-8 h-8 rounded-full border"
                style={{ backgroundColor: color || 'transparent' }}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};