import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { RoleModel, Tag } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/app-layout";
import TagForm from "@/components/tags/tag-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, X, AlertCircle } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";

export default function TagsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch role models
  const {
    data: roleModels = [],
    isLoading: isLoadingModels,
    error: roleModelsError,
  } = useQuery<RoleModel[]>({
    queryKey: ["/api/role-models"],
    enabled: !!user,
  });

  // Fetch tags for selected model
  const {
    data: tags = [],
    isLoading: isLoadingTags,
    error: tagsError,
    refetch: refetchTags,
  } = useQuery<Tag[]>({
    queryKey: ["/api/role-models", selectedModelId, "tags"],
    enabled: !!selectedModelId,
  });

  // Delete tag mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tags/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "タグを削除しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/role-models", selectedModelId, "tags"] });
      setTagToDelete(null);
      setIsDeleteOpen(false);
    },
    onError: (error) => {
      toast({
        title: "タグの削除に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set first role model as selected by default
  if (!selectedModelId && roleModels.length > 0 && !isLoadingModels) {
    setSelectedModelId(roleModels[0].id);
  }

  // Group tags by category
  const groupedTags = tags.reduce<Record<string, Tag[]>>((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = [];
    }
    acc[tag.category].push(tag);
    return acc;
  }, {});

  // Handle role model selection change
  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
  };

  // Handle delete tag click
  const handleDeleteTag = (tag: Tag) => {
    setTagToDelete(tag);
    setIsDeleteOpen(true);
  };

  // Confirm delete tag
  const confirmDelete = () => {
    if (tagToDelete) {
      deleteMutation.mutate(tagToDelete.id);
    }
  };

  // Handle add tag success
  const handleAddTagSuccess = () => {
    setIsAddTagOpen(false);
    refetchTags();
  };

  // Category color mapping
  const categoryColors: Record<string, string> = {
    "Business": "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
    "Technology": "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
    "Trends": "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
    "Career": "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
    "Other": "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
  };

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900 dark:text-gray-100">
            タグ管理
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            ロールモデルごとに情報収集のためのタグを設定します
          </p>
        </div>
      </div>

      {/* Role Model Selector */}
      {isLoadingModels ? (
        <Card className="mb-6">
          <CardContent className="pt-6 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </CardContent>
        </Card>
      ) : roleModelsError ? (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center text-red-500">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p>ロールモデルの読み込みに失敗しました: {roleModelsError.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : roleModels.length === 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>ロールモデルがありません</CardTitle>
            <CardDescription>
              まずはロールモデルを作成して、タグを設定しましょう
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 flex justify-center">
            <Button onClick={() => window.location.href = "/role-models"}>
              <Plus className="mr-2 h-4 w-4" />
              ロールモデルを作成する
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ロールモデルを選択
                </label>
                <Select value={selectedModelId || ""} onValueChange={handleModelChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="ロールモデルを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-end">
                <Button
                  onClick={() => setIsAddTagOpen(true)}
                  disabled={!selectedModelId}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  タグを追加
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tags Display */}
      {!selectedModelId ? (
        <Card>
          <CardContent className="pt-6 text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">
              タグを表示・管理するにはロールモデルを選択してください
            </p>
          </CardContent>
        </Card>
      ) : isLoadingTags ? (
        <Card>
          <CardContent className="pt-6 flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </CardContent>
        </Card>
      ) : tagsError ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center text-red-500">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p>タグの読み込みに失敗しました: {tagsError.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : tags.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-10">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              このロールモデルにはまだタグがありません
            </p>
            <Button onClick={() => setIsAddTagOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              タグを追加する
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>タグ一覧</CardTitle>
            <CardDescription>
              情報収集の精度を高めるために、関連するタグを追加しましょう
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.entries(groupedTags).map(([category, categoryTags]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  {category === "Business" ? "ビジネス" :
                   category === "Technology" ? "テクノロジー" :
                   category === "Trends" ? "トレンド" :
                   category === "Career" ? "キャリア" : category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {categoryTags.map((tag) => (
                    <div
                      key={tag.id}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${
                        categoryColors[tag.category] || "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {tag.name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-1 p-0 hover:bg-transparent"
                        onClick={() => handleDeleteTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
            <div className="mt-6 flex justify-center">
              <Button onClick={() => setIsAddTagOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                タグを追加
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Tag Dialog */}
      {selectedModelId && isAddTagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">タグを追加</h2>
            <TagForm roleModelId={selectedModelId} onSuccess={handleAddTagSuccess} />
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setIsAddTagOpen(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>タグを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              タグ「{tagToDelete?.name}」を削除すると、情報収集の精度に影響する可能性があります。
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
