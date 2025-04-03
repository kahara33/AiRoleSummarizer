import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { RoleModel, Tag } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Loader2, 
  Tag as TagIcon, 
  Trash, 
  AlertTriangle 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import AppLayout from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";

export default function RoleModelDetailPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isRoleModelRoute, roleModelParams] = useRoute("/role-model/:id");
  const [isRoleModelsRoute, roleModelsParams] = useRoute("/role-models/:id");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // どちらかのルートからIDを取得
  const roleModelId = (isRoleModelRoute ? roleModelParams?.id : 
                        isRoleModelsRoute ? roleModelsParams?.id : "") || "";
  
  // デバッグログの追加
  useEffect(() => {
    console.log("RoleModelDetailPage - パラメータID:", roleModelId);
    console.log("パスの種類:", isRoleModelRoute ? "/role-model/:id" : 
                       isRoleModelsRoute ? "/role-models/:id" : "未マッチ");
  }, [roleModelId, isRoleModelRoute, isRoleModelsRoute]);
  
  // ロールモデル削除のミューテーション
  const deleteRoleModelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/role-models/${roleModelId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "削除に失敗しました");
      }
    },
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: () => {
      toast({
        title: "削除完了",
        description: "ロールモデルを削除しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/role-models"] });
      navigate("/role-models");
    },
    onError: (error) => {
      toast({
        title: "削除エラー",
        description: error instanceof Error ? error.message : "削除に失敗しました",
        variant: "destructive",
      });
      setIsDeleting(false);
    },
    onSettled: () => {
      setShowDeleteDialog(false);
    }
  });

  // Fetch role model with tags
  const { data: roleModel, isLoading, error } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/with-tags`],
    queryFn: async () => {
      console.log("APIリクエスト開始:", `/api/role-models/${roleModelId}/with-tags`);
      try {
        const res = await apiRequest("GET", `/api/role-models/${roleModelId}/with-tags`);
        const data = await res.json() as RoleModel & { tags: Tag[] };
        console.log("APIレスポンス:", data);
        return data;
      } catch (err) {
        console.error("APIリクエストエラー:", err);
        toast({
          title: "データ取得エラー",
          description: err instanceof Error ? err.message : "不明なエラーが発生しました",
          variant: "destructive"
        });
        throw err;
      }
    },
    enabled: !!roleModelId
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !roleModel) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p>ロールモデルが見つかりませんでした。</p>
          <Link href="/role-models">
            <Button>ロールモデル一覧に戻る</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/role-models">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">{roleModel.name}</h1>
            </div>
            <p className="text-muted-foreground">
              {roleModel.description}
            </p>
          </div>
          <div className="flex space-x-2">
            <Link href={`/role-model/${roleModelId}/knowledge-graph`}>
              <Button>
                知識グラフを表示
              </Button>
            </Link>
            <Link href={`/role-model/${roleModelId}/summaries`}>
              <Button variant="outline">
                サマリー一覧
              </Button>
            </Link>
            <Button 
              variant="destructive" 
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ロールモデル情報</CardTitle>
            <CardDescription>
              このロールモデルの基本情報と関連するタグ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2">基本情報</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">名前:</span>
                    <p>{roleModel.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">説明:</span>
                    <p>{roleModel.description}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">共有設定:</span>
                    <p>{roleModel.isShared ? "組織内で共有" : "非共有"}</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">タグ</h3>
                <div className="flex flex-wrap gap-2">
                  {roleModel.tags && roleModel.tags.length > 0 ? (
                    roleModel.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
                        <TagIcon className="h-3 w-3" />
                        {tag.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">タグはありません</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              ロールモデルを削除
            </AlertDialogTitle>
            <AlertDialogDescription>
              「{roleModel.name}」を削除しますか？この操作は元に戻せません。関連するすべての知識グラフとサマリーも削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteRoleModelMutation.mutate();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  削除中...
                </>
              ) : (
                "削除する"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}