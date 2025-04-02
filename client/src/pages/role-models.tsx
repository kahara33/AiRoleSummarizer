import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { RoleModel } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/app-layout";
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<RoleModel | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<RoleModel | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch role models
  const {
    data: roleModels = [],
    isLoading,
    error,
    refetch,
  } = useQuery<RoleModel[]>({
    queryKey: ["/api/role-models"],
    enabled: !!user,
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

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    setEditingModel(null);
    refetch();
  };

  const handleEditClick = (model: RoleModel) => {
    setEditingModel(model);
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
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900 dark:text-gray-100">
            ロールモデル管理
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            情報収集のためのロールモデルを作成・管理します
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新規作成
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>新規ロールモデル作成</DialogTitle>
            </DialogHeader>
            <RoleModelForm onSuccess={handleCreateSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">
              ロールモデルの読み込みに失敗しました: {error.message}
            </p>
          </CardContent>
        </Card>
      ) : roleModels.length === 0 ? (
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
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleModels.map((model) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">{model.name}</TableCell>
                    <TableCell>
                      {model.description.length > 100
                        ? `${model.description.substring(0, 100)}...`
                        : model.description}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
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
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
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
    </AppLayout>
  );
}
