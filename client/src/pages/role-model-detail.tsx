import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { RoleModel, Keyword } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Loader2, 
  Tag as TagIcon, 
  Trash, 
  AlertTriangle,
  Pencil,
  Building2,
  KeyRound
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import RoleModelForm from "@/components/role-models/role-model-form";
import { useToast } from "@/hooks/use-toast";

// カスタムインターフェース
interface Tag {
  id: string;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

interface IndustrySubcategoryWithCategory {
  id: number;
  name: string;
  category?: Category;
}

interface RoleModelDetailPageProps {
  id?: string;
}

interface RoleModelWithRelations extends RoleModel {
  tags: Tag[];
  industries: (IndustrySubcategoryWithCategory & { id: string })[];
  keywords: Keyword[];
}

export default function RoleModelDetailPage({ id }: RoleModelDetailPageProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // URLパラメータからIDを取得
  const roleModelId = id || "";
  
  // デバッグログの追加
  useEffect(() => {
    console.log("RoleModelDetailPage - パラメータID:", roleModelId);
  }, [roleModelId]);
  
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

  // Fetch role model with tags, industries and keywords
  const { data: roleModel, isLoading, error, refetch } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}`],
    queryFn: async () => {
      console.log("APIリクエスト開始:", `/api/role-models/${roleModelId}`);
      try {
        // タイムスタンプをクエリパラメータに追加してキャッシュを回避
        const timestamp = new Date().getTime();
        const res = await apiRequest("GET", `/api/role-models/${roleModelId}?t=${timestamp}`);
        const data = await res.json() as RoleModelWithRelations;
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
    enabled: !!roleModelId,
    staleTime: 0, // 常に最新データを取得
    refetchOnMount: true, // コンポーネントマウント時に常に再取得
    gcTime: 0 // キャッシュしない（v5ではcacheTimeからgcTimeに変更された）
  });
  
  // 編集完了後のコールバック
  const handleEditSuccess = () => {
    setShowEditDialog(false);
    refetch();
    toast({
      title: "更新完了",
      description: "ロールモデル情報を更新しました",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !roleModel) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p>ロールモデルが見つかりませんでした。</p>
        <Link href="/role-models">
          <Button>ロールモデル一覧に戻る</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
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
            <Link to={`/information-dashboard/${roleModelId}`}>
              <Button variant="default">
                情報整理ダッシュボード
              </Button>
            </Link>
            <Link to={`/notebook/${roleModelId}`}>
              <Button variant="outline">
                ノートブックを表示
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
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>ロールモデル情報</CardTitle>
              <CardDescription>
                このロールモデルの基本情報と関連データ
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto flex items-center gap-1"
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="h-4 w-4" />
              編集
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6">
              {/* 基本情報 */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <span>基本情報</span>
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">名前:</span>
                    <p>{roleModel.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">説明:</span>
                    <p>{roleModel.description || "説明はありません"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">共有設定:</span>
                    <p>{roleModel.isShared ? "組織内で共有" : "非共有"}</p>
                  </div>
                </div>
              </div>
              
              {/* 業界カテゴリ */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>業界カテゴリ</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {roleModel.industries && roleModel.industries.length > 0 ? (
                    roleModel.industries.map((industry) => (
                      <Badge key={industry.id} variant="outline" className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800">
                        {industry.category?.name} &gt; {industry.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">業界カテゴリは設定されていません</p>
                  )}
                </div>
              </div>
              
              {/* キーワード */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>キーワード</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {roleModel.keywords && roleModel.keywords.length > 0 ? (
                    roleModel.keywords.map((keyword) => (
                      <Badge key={keyword.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-200 border-blue-100 dark:border-blue-800">
                        {keyword.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">キーワードは設定されていません</p>
                  )}
                </div>
              </div>
              
              {/* タグ */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <TagIcon className="h-3.5 w-3.5" />
                  <span>タグ</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {roleModel.tags && roleModel.tags.length > 0 ? (
                    roleModel.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
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
      
      {/* 編集ダイアログ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>ロールモデルを編集</DialogTitle>
          </DialogHeader>
          <RoleModelForm
            roleModel={{
              id: roleModel.id,
              name: roleModel.name,
              description: roleModel.description,
              isShared: roleModel.isShared || 0,
              industries: roleModel.industries.map(industry => ({
                ...industry,
                id: String(industry.id)
              })),
              keywords: roleModel.keywords
            }}
            onSuccess={handleEditSuccess}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}