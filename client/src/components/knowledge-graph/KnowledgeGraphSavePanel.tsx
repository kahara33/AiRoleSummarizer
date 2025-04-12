import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Save, X, Check, List, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { useKnowledgeGraph } from '@/hooks/use-knowledge-graph-websocket';

interface KnowledgeGraphSavePanelProps {
  roleModelId: string;
  onSaveSuccess?: () => void;
  className?: string;
}

interface GraphSnapshot {
  id: string;
  roleModelId: string;
  name: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  createdBy: string;
}

export default function KnowledgeGraphSavePanel({ roleModelId, onSaveSuccess, className }: KnowledgeGraphSavePanelProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<GraphSnapshot[]>([]);
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: ''
  });
  const { toast } = useToast();

  // スナップショットの取得
  const fetchSnapshots = useCallback(async () => {
    if (!roleModelId) return;

    setLoading(true);
    try {
      const response = await apiRequest('GET', `/api/knowledge-graph/${roleModelId}/snapshots`);
      if (response.ok) {
        const data = await response.json();
        setSnapshots(data);
      } else {
        console.error('スナップショット取得エラー:', response.statusText);
        toast({
          title: 'エラー',
          description: 'グラフスナップショットの取得に失敗しました',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('スナップショット取得例外:', error);
      toast({
        title: 'エラー',
        description: 'グラフスナップショットの取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [roleModelId, toast]);

  // ダイアログを開いたときにスナップショットを取得
  const handleOpenLoadDialog = useCallback(() => {
    fetchSnapshots();
    setLoadDialogOpen(true);
  }, [fetchSnapshots]);

  // グラフの保存
  const handleSaveGraph = useCallback(async () => {
    if (!roleModelId) {
      toast({
        title: '保存エラー',
        description: 'ロールモデルIDが指定されていません',
        variant: 'destructive',
      });
      return;
    }

    if (!saveForm.name.trim()) {
      toast({
        title: '入力エラー',
        description: 'スナップショット名を入力してください',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('POST', `/api/knowledge-graph/${roleModelId}/snapshots`, {
        name: saveForm.name,
        description: saveForm.description
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: '保存成功',
          description: 'ナレッジグラフが保存されました',
        });
        setSaveDialogOpen(false);
        
        // フォームをクリア
        setSaveForm({
          name: '',
          description: ''
        });
        
        // 成功コールバック
        if (onSaveSuccess) {
          onSaveSuccess();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('グラフ保存エラー:', error);
      toast({
        title: '保存エラー',
        description: `グラフの保存に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [roleModelId, saveForm, toast, onSaveSuccess]);

  // スナップショットの復元
  const handleRestoreSnapshot = useCallback(async (snapshotId: string, snapshotName: string) => {
    if (!confirm(`スナップショット "${snapshotName}" を復元しますか？現在のグラフは上書きされます。`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('POST', `/api/knowledge-graph/${roleModelId}/snapshots/${snapshotId}/restore`);
      
      if (response.ok) {
        toast({
          title: '復元成功',
          description: 'グラフスナップショットが復元されました',
        });
        setLoadDialogOpen(false);
        
        // 成功コールバック
        if (onSaveSuccess) {
          onSaveSuccess();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '復元に失敗しました');
      }
    } catch (error) {
      console.error('スナップショット復元エラー:', error);
      toast({
        title: '復元エラー',
        description: `スナップショットの復元に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [roleModelId, toast, onSaveSuccess]);

  // 日付フォーマット
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className={`flex space-x-2 ${className}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSaveDialogOpen(true)}
              disabled={!roleModelId || roleModelId === 'default'}
            >
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>現在のグラフを保存</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleOpenLoadDialog}
              disabled={!roleModelId || roleModelId === 'default'}
            >
              <List className="h-4 w-4 mr-1" />
              保存済み
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>保存済みグラフを表示</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* グラフ保存ダイアログ */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>ナレッジグラフの保存</DialogTitle>
            <DialogDescription>
              現在のナレッジグラフをスナップショットとして保存します
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="snapshot-name" className="text-right">
                名前
              </Label>
              <Input
                id="snapshot-name"
                value={saveForm.name}
                onChange={(e) => setSaveForm({...saveForm, name: e.target.value})}
                placeholder="スナップショット名"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="snapshot-description" className="text-right">
                説明
              </Label>
              <Input
                id="snapshot-description"
                value={saveForm.description}
                onChange={(e) => setSaveForm({...saveForm, description: e.target.value})}
                placeholder="簡単な説明（任意）"
                className="col-span-3"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={loading}>
              キャンセル
            </Button>
            <Button onClick={handleSaveGraph} disabled={loading || !saveForm.name.trim()}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* グラフスナップショット一覧ダイアログ */}
      <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>保存済みナレッジグラフ</DialogTitle>
            <DialogDescription>
              保存したグラフスナップショットを表示・復元できます
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 h-[400px]">
            <ScrollArea className="h-full pr-4">
              {loading ? (
                <div className="flex justify-center items-center h-full">
                  <p className="text-gray-500">読み込み中...</p>
                </div>
              ) : snapshots.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-full">
                  <p className="text-gray-500">保存されたグラフはありません</p>
                  <p className="text-gray-400 text-sm mt-2">新しいグラフを保存してください</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshots.map((snapshot) => (
                    <Card key={snapshot.id} className="overflow-hidden">
                      <CardHeader className="p-3 pb-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base font-medium">{snapshot.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {formatDate(snapshot.createdAt)}
                            </CardDescription>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Badge variant="outline" className="text-xs">
                              {snapshot.nodeCount} ノード
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {snapshot.edgeCount} エッジ
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      
                      {snapshot.description && (
                        <CardContent className="p-3 pt-1 pb-1">
                          <p className="text-sm text-gray-600">{snapshot.description}</p>
                        </CardContent>
                      )}
                      
                      <CardFooter className="p-2 flex justify-end border-t">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleRestoreSnapshot(snapshot.id, snapshot.name)}
                          disabled={loading}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          復元
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadDialogOpen(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}