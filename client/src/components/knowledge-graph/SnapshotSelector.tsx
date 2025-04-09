import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bookmark, History, Clock, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface SnapshotSelectorProps {
  roleModelId: string;
  onRestore?: () => void;
}

interface Snapshot {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  isActive: boolean;
}

export function SnapshotSelector({ roleModelId, onRestore }: SnapshotSelectorProps) {
  const [open, setOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [saveSnapshotName, setSaveSnapshotName] = useState('');
  const [saveSnapshotDesc, setSaveSnapshotDesc] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // スナップショット一覧を取得
  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/knowledge-graph/snapshots/${roleModelId}`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/knowledge-graph/snapshots/${roleModelId}`);
      return await res.json();
    }
  });

  // 現在のグラフをスナップショットとして保存するミューテーション
  const saveSnapshotMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string, description: string }) => {
      const res = await apiRequest('POST', `/api/knowledge-graph/snapshots/${roleModelId}`, {
        name,
        description
      });
      return await res.json();
    },
    onSuccess: () => {
      // スナップショット一覧を再取得
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-graph/snapshots/${roleModelId}`] });
      setOpen(false);
      toast({
        title: "保存完了",
        description: "現在のグラフ状態をスナップショットとして保存しました",
      });
      setSaveSnapshotName('');
      setSaveSnapshotDesc('');
    },
    onError: (error) => {
      console.error('スナップショット保存エラー:', error);
      toast({
        title: "エラー",
        description: "スナップショットの保存に失敗しました",
        variant: "destructive",
      });
    }
  });

  // スナップショットを復元するミューテーション
  const restoreSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      const res = await apiRequest('POST', `/api/knowledge-graph/snapshots/${roleModelId}/restore/${snapshotId}`);
      return await res.json();
    },
    onSuccess: () => {
      // グラフデータを再取得
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-graph/${roleModelId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/knowledge-graph/snapshots/${roleModelId}`] });
      setRestoreDialogOpen(false);
      toast({
        title: "復元完了",
        description: "選択したスナップショットからグラフを復元しました",
      });
      if (onRestore) {
        onRestore();
      }
    },
    onError: (error) => {
      console.error('スナップショット復元エラー:', error);
      toast({
        title: "エラー",
        description: "スナップショットの復元に失敗しました",
        variant: "destructive",
      });
    }
  });

  // アクティブなスナップショットを探す
  const activeSnapshot = data?.find((s: Snapshot) => s.isActive);

  return (
    <>
      <div className="flex items-center gap-2">
        {/* スナップショット保存ボタン */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Save className="h-4 w-4" />
              <span>保存</span>
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>現在のグラフをスナップショットとして保存</DialogTitle>
              <DialogDescription>
                現在のナレッジグラフの状態を名前を付けて保存します。
                後で復元することができます。
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="snapshot-name">スナップショット名</Label>
                <Input
                  id="snapshot-name"
                  placeholder="マイスナップショット"
                  value={saveSnapshotName}
                  onChange={(e) => setSaveSnapshotName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="snapshot-desc">説明 (任意)</Label>
                <Input
                  id="snapshot-desc"
                  placeholder="このスナップショットの内容や目的"
                  value={saveSnapshotDesc}
                  onChange={(e) => setSaveSnapshotDesc(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>キャンセル</Button>
              <Button 
                onClick={() => {
                  saveSnapshotMutation.mutate({
                    name: saveSnapshotName || `スナップショット ${new Date().toLocaleString('ja-JP')}`,
                    description: saveSnapshotDesc
                  });
                }}
                disabled={saveSnapshotMutation.isPending}
              >
                {saveSnapshotMutation.isPending ? "保存中..." : "保存する"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* スナップショット選択・復元 */}
        <div className="flex items-center gap-2">
          <Select 
            value={selectedSnapshot || ''} 
            onValueChange={(value) => {
              setSelectedSnapshot(value);
              if (value) {
                setRestoreDialogOpen(true);
              }
            }}
          >
            <SelectTrigger className="w-auto min-w-[200px]">
              <SelectValue placeholder="履歴から復元" />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <SelectItem value="loading" disabled>読み込み中...</SelectItem>
              ) : error ? (
                <SelectItem value="error" disabled>エラーが発生しました</SelectItem>
              ) : data?.length === 0 ? (
                <SelectItem value="empty" disabled>スナップショットがありません</SelectItem>
              ) : (
                data?.map((snapshot: Snapshot) => (
                  <SelectItem key={snapshot.id} value={snapshot.id} className="flex items-center">
                    <div className="flex items-center gap-1">
                      {snapshot.isActive ? (
                        <Bookmark className="h-4 w-4 text-primary" />
                      ) : (
                        <History className="h-4 w-4" />
                      )}
                      <span>{snapshot.name}</span>
                      <span className="text-xs text-gray-500 ml-1">
                        {new Date(snapshot.createdAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 復元確認ダイアログ */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>スナップショットを復元しますか？</DialogTitle>
            <DialogDescription>
              選択したスナップショットの状態にグラフを復元します。
              現在の状態は失われますが、現在の状態を先に保存することもできます。
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {selectedSnapshot && data?.find((s: Snapshot) => s.id === selectedSnapshot) && (
              <div className="border p-3 rounded bg-secondary/20">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  <h4 className="font-medium">
                    {data.find((s: Snapshot) => s.id === selectedSnapshot).name}
                  </h4>
                </div>
                <div className="flex items-center text-xs text-gray-500 mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>
                    {new Date(data.find((s: Snapshot) => s.id === selectedSnapshot).createdAt).toLocaleString('ja-JP')}
                  </span>
                </div>
                {data.find((s: Snapshot) => s.id === selectedSnapshot).description && (
                  <p className="mt-2 text-sm">
                    {data.find((s: Snapshot) => s.id === selectedSnapshot).description}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={() => {
                if (selectedSnapshot) {
                  restoreSnapshotMutation.mutate(selectedSnapshot);
                }
              }}
              disabled={restoreSnapshotMutation.isPending}
              variant="default"
            >
              {restoreSnapshotMutation.isPending ? "復元中..." : "復元する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}