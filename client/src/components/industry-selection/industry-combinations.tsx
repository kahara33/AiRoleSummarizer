import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { IndustryCombination, IndustrySubcategory } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save, Trash2, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface IndustryCombinationsProps {
  onSelectCombination: (industryIds: string[]) => void;
}

export default function IndustryCombinations({
  onSelectCombination,
}: IndustryCombinationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCombinationId, setSelectedCombinationId] = useState<string | null>(null);
  const [combinationToDelete, setCombinationToDelete] = useState<string | null>(null);

  // 業界組み合わせの取得
  const { 
    data: combinations = [], 
    isLoading: isLoadingCombinations 
  } = useQuery({
    queryKey: ["/api/industry-combinations"],
    staleTime: 60 * 60 * 1000, // 1時間キャッシュ
  });

  // 業界サブカテゴリの取得
  const { 
    data: subcategories = [], 
    isLoading: isLoadingSubcategories 
  } = useQuery({
    queryKey: ["/api/industry-subcategories"],
    staleTime: 60 * 60 * 1000, // 1時間キャッシュ
  });

  // 組み合わせの詳細情報を取得
  const getCombinationDetails = (combinationId: string) => {
    return useQuery({
      queryKey: ["/api/industry-combinations", combinationId],
      staleTime: 60 * 60 * 1000,
    });
  };

  // 業界組み合わせの削除ミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/industry-combinations/${id}`);
      return id;
    },
    onSuccess: (id) => {
      toast({
        title: "削除しました",
        description: "業界組み合わせを削除しました。",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/industry-combinations"] });
      if (selectedCombinationId === id) {
        setSelectedCombinationId(null);
      }
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 業界組み合わせを選択する
  const handleSelectCombination = async (combinationId: string) => {
    try {
      setSelectedCombinationId(combinationId);
      
      // 組み合わせの詳細情報を取得
      const res = await fetch(`/api/industry-combinations/${combinationId}`);
      if (!res.ok) {
        throw new Error("組み合わせの詳細を取得できませんでした");
      }
      
      const data = await res.json();
      const industryIds = data.details.map((detail: any) => detail.industrySubcategoryId);
      
      // 親コンポーネントに選択された業界IDを通知
      onSelectCombination(industryIds);
      
      toast({
        title: "業界組み合わせを適用しました",
        description: `${data.name}の業界を選択しました。`,
      });
    } catch (error) {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // 組み合わせ削除確認ダイアログの表示
  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // クリックイベントの伝播を停止
    setCombinationToDelete(id);
  };

  // 組み合わせの削除を実行
  const confirmDelete = () => {
    if (combinationToDelete) {
      deleteMutation.mutate(combinationToDelete);
    }
    setCombinationToDelete(null);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold">よく使う業界組み合わせ</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoadingCombinations ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : combinations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            保存された業界組み合わせがありません
          </p>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {combinations.map((combination: IndustryCombination) => (
                <div
                  key={combination.id}
                  className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                    selectedCombinationId === combination.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-accent border border-accent"
                  }`}
                  onClick={() => handleSelectCombination(combination.id)}
                >
                  <div className="flex items-center space-x-2">
                    {selectedCombinationId === combination.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                    <span className="font-medium">{combination.name}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialog 
                            open={combinationToDelete === combination.id} 
                            onOpenChange={(open) => !open && setCombinationToDelete(null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => handleDeleteClick(combination.id, e)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>削除の確認</AlertDialogTitle>
                                <AlertDialogDescription>
                                  この業界組み合わせを削除しますか？この操作は元に戻せません。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={confirmDelete}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  削除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>削除</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}