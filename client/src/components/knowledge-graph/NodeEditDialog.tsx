import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KnowledgeNode } from '@shared/schema';

interface NodeEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'edit' | 'add-child' | 'add-sibling';
  node: KnowledgeNode | null;
  onSave: (data: { name: string; description: string; nodeType: string }) => void;
}

// 利用可能なノードタイプ
const NODE_TYPES = [
  { id: 'concept', label: '概念' },
  { id: 'keyword', label: 'キーワード' },
  { id: 'task', label: 'タスク' },
  { id: 'question', label: '質問' },
  { id: 'info', label: '情報' },
];

export const NodeEditDialog: React.FC<NodeEditDialogProps> = ({
  open,
  onOpenChange,
  type,
  node,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodeType, setNodeType] = useState('concept');

  useEffect(() => {
    if (type === 'edit' && node) {
      setName(node.name);
      setDescription(node.description || '');
      setNodeType(node.type || 'concept');
    } else {
      // 子ノードと兄弟ノードの場合は新規作成なので、初期値をクリア
      setName('');
      setDescription('');
      setNodeType('concept');
    }
  }, [type, node, open]);

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name,
      description,
      nodeType
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
            <Label htmlFor="nodeType" className="text-right">
              ノードタイプ
            </Label>
            <div className="col-span-3">
              <Select value={nodeType} onValueChange={setNodeType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="ノードタイプを選択" />
                </SelectTrigger>
                <SelectContent>
                  {NODE_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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