import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { RoleModel, Keyword, RoleModelWithIndustriesAndKeywords } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRoute, useLocation, Link } from "wouter";

import { useToast } from "@/hooks/use-toast";

import RoleModelForm from "@/components/role-models/role-model-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Pencil, Trash } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function RoleModelsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(location === "/role-models/new");
  const [editingModel, setEditingModel] = useState<RoleModel | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<RoleModel | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  // ルートの変更を検出して新規作成ダイアログの状態を同期
  useEffect(() => {
    setIsCreateOpen(location === "/role-models/new");
  }, [location]);

  // Fetch role models
  const {
    data: roleModels = [],
    isLoading: isLoadingModels,
    error: roleModelsError,
    refetch: refetchModels,
  } = useQuery<RoleModelWithIndustriesAndKeywords[]>({
    queryKey: ["/api/role-models"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string);
      if (!res.ok) {
        throw new Error(`Error fetching role models: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!user,
  });
  
  // Fetch shared role models
  const {
    data: sharedRoleModels = [],
    isLoading: isLoadingShared,
    error: sharedModelsError,
    refetch: refetchShared,
  } = useQuery<RoleModelWithIndustriesAndKeywords[]>({
    queryKey: ["/api/role-models/shared"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string);
      if (!res.ok) {
        throw new Error(`Error fetching shared role models: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!user && !!user.companyId,
  });

  // Delete role model mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/role-models/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "ロールモデルを削除しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/role-models"] });
      setModelToDelete(null);
      setIsDeleteOpen(false);
    },
    onError: (error) => {
      toast({
        title: "ロールモデルの削除に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 全てのクエリを再取得する関数
  const refetch = () => {
    refetchModels();
    refetchShared();
  };

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    refetch();
    // 新規作成ページからロールモデル一覧に戻る
    if (location === "/role-models/new") {
      setLocation("/role-models");
    }
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    setEditingModel(null);
    refetch();
  };

  const handleEditClick = (model: RoleModel) => {
    // RoleModelFormコンポーネントが必要とするプロパティだけを渡す
    const formModel = {
      id: model.id,
      name: model.name,
      description: model.description,
      isShared: model.isShared || 0,
      industries: model.industries || [],
      keywords: model.keywords || []
    };
    setEditingModel(formModel);
    setIsEditOpen(true);
  };

  const handleDeleteClick = (model: RoleModel) => {
    setModelToDelete(model);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (modelToDelete) {
      deleteMutation.mutate(modelToDelete.id);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900 dark:text-gray-100">
            ロールモデル管理
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            情報収集のためのロールモデルを作成・管理します
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            // ダイアログが閉じられた時、新規作成ページからロールモデル一覧に戻る
            if (!open && location === "/role-models/new") {
              setLocation("/role-models");
            }
          }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>新規ロールモデル作成</DialogTitle>
            </DialogHeader>
            <RoleModelForm onSuccess={handleCreateSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoadingModels || isLoadingShared ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : roleModelsError || sharedModelsError ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">
              ロールモデルの読み込みに失敗しました: {roleModelsError?.message || sharedModelsError?.message}
            </p>
          </CardContent>
        </Card>
      ) : roleModels.length === 0 && sharedRoleModels.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>ロールモデルがありません</CardTitle>
            <CardDescription>
              まずはロールモデルを作成して、AIによる情報収集をカスタマイズしましょう
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              ロールモデルを作成する
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ロールモデル名</TableHead>
                  <TableHead>説明</TableHead>
                  <TableHead>業界カテゴリ</TableHead>
                  <TableHead>キーワード</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 自分が所有するロールモデル */}
                {roleModels.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">
                      <Link href={`/role-model/${model.id}`} className="hover:underline">
                        {model.name}
                        {model.isShared === 1 && (
                          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            共有中
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {model.description && model.description.length > 100
                        ? `${model.description.substring(0, 100)}...`
                        : model.description || ""}
                    </TableCell>
                    <TableCell>
                      {model.industries && model.industries.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {model.industries.slice(0, 3).map((industry) => (
                            <span key={industry.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                              {industry.name}
                            </span>
                          ))}
                          {model.industries.length > 3 && (
                            <span className="text-xs text-gray-500">+{model.industries.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">未設定</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {model.keywords && model.keywords.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {model.keywords.slice(0, 3).map((keyword) => (
                            <span key={keyword.id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                              {keyword.name}
                            </span>
                          ))}
                          {model.keywords.length > 3 && (
                            <span className="text-xs text-gray-500">+{model.keywords.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">未設定</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Link href={`/role-model/${model.id}/knowledge-graph`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="知識グラフを表示"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                              <circle cx="18" cy="5" r="3" />
                              <circle cx="6" cy="12" r="3" />
                              <circle cx="18" cy="19" r="3" />
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(model)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeleteClick(model)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* 組織の共有ロールモデル */}
                {sharedRoleModels
                  .filter(shared => !roleModels.some(own => own.id === shared.id)) // 自分のモデルと重複しないもの
                  .map((model) => (
                    <TableRow key={model.id} className="bg-gray-50 dark:bg-gray-900">
                      <TableCell className="font-medium">
                        <Link href={`/role-model/${model.id}`} className="hover:underline">
                          {model.name}
                          <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
                            組織共有
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        {model.description && model.description.length > 100
                          ? `${model.description.substring(0, 100)}...`
                          : model.description || ""}
                      </TableCell>
                      <TableCell>
                        {model.industries && model.industries.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {model.industries.slice(0, 3).map((industry) => (
                              <span key={industry.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                                {industry.name}
                              </span>
                            ))}
                            {model.industries.length > 3 && (
                              <span className="text-xs text-gray-500">+{model.industries.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">未設定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {model.keywords && model.keywords.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {model.keywords.slice(0, 3).map((keyword) => (
                              <span key={keyword.id} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                                {keyword.name}
                              </span>
                            ))}
                            {model.keywords.length > 3 && (
                              <span className="text-xs text-gray-500">+{model.keywords.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">未設定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Link href={`/role-model/${model.id}/knowledge-graph`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="知識グラフを表示"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                              </svg>
                            </Button>
                          </Link>
                          <span className="text-xs text-gray-500 my-auto">閲覧のみ</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ロールモデルを編集</DialogTitle>
          </DialogHeader>
          {editingModel && (
            <RoleModelForm
              roleModel={editingModel}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ロールモデルを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{modelToDelete?.name}」を削除すると、このロールモデルに関連するすべてのタグと要約情報も失われます。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
