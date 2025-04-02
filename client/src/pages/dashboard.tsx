import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { RoleModel, Tag, Summary } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/app-layout";
import RoleModelSelector from "@/components/dashboard/role-model-selector";
import TagSection from "@/components/dashboard/tag-section";
import SummaryCard from "@/components/dashboard/summary-card";
import SystemStatus from "@/components/dashboard/system-status";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  
  // Fetch role models
  const { 
    data: roleModels = [], 
    isLoading: isLoadingModels,
    error: roleModelsError
  } = useQuery<RoleModel[]>({
    queryKey: ["/api/role-models"],
    enabled: !!user,
  });

  // Set first role model as selected by default
  useEffect(() => {
    if (!selectedModelId && roleModels.length > 0) {
      setSelectedModelId(roleModels[0].id);
    }
  }, [roleModels, selectedModelId]);

  // Get selected model data
  const selectedModel = roleModels.find((model) => model.id === selectedModelId);

  // Fetch tags for selected model
  const { 
    data: tags = [], 
    isLoading: isLoadingTags,
    error: tagsError
  } = useQuery<Tag[]>({
    queryKey: ["/api/role-models", selectedModelId, "tags"],
    enabled: !!selectedModelId,
  });

  // Fetch summaries for selected model
  const { 
    data: summaries = [], 
    isLoading: isLoadingSummaries,
    error: summariesError
  } = useQuery<Summary[]>({
    queryKey: ["/api/role-models", selectedModelId, "summaries"],
    enabled: !!selectedModelId,
  });

  // Mutation to collect new information
  const collectMutation = useMutation({
    mutationFn: async (roleModelId: string) => {
      await apiRequest("POST", "/api/collect-information", { roleModelId });
    },
    onSuccess: () => {
      toast({
        title: "情報収集を開始しました",
        description: "新しい情報が利用可能になるとお知らせします",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/role-models", selectedModelId, "summaries"] });
    },
    onError: (error) => {
      toast({
        title: "情報収集に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCollectInformation = () => {
    if (selectedModelId) {
      collectMutation.mutate(selectedModelId);
    } else {
      toast({
        title: "ロールモデルが選択されていません",
        description: "情報収集を行うにはロールモデルを選択してください",
        variant: "destructive",
      });
    }
  };

  // Format the last updated date
  const lastUpdated = summaries.length > 0 && summaries[0].createdAt
    ? format(new Date(summaries[0].createdAt), "yyyy/MM/dd", { locale: ja })
    : "---";

  return (
    <AppLayout>
      {/* Dashboard Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-heading text-gray-900 dark:text-gray-100">
          ダッシュボード
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          あなたのロールモデルに基づいた最新の情報要約を確認できます
        </p>
      </div>

      {/* Role Model Selector */}
      <RoleModelSelector
        selectedModelId={selectedModelId}
        onSelectModel={setSelectedModelId}
      />

      {/* Tag Section */}
      <TagSection selectedModelId={selectedModelId} />

      {/* Summaries Section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100">
            最新の情報要約
          </h2>
          <div className="flex items-center text-sm">
            <span className="text-gray-500 dark:text-gray-400 mr-2">
              最終更新: {lastUpdated}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="inline-flex items-center"
              onClick={handleCollectInformation}
              disabled={collectMutation.isPending || !selectedModelId}
            >
              {collectMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              更新
            </Button>
          </div>
        </div>

        {/* Summaries Grid */}
        {isLoadingSummaries ? (
          <div className="text-center py-10">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary-600" />
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              要約を読み込み中...
            </p>
          </div>
        ) : summariesError ? (
          <div className="text-center py-10">
            <p className="text-red-500">
              要約の読み込みに失敗しました: {summariesError.message}
            </p>
          </div>
        ) : !selectedModelId ? (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">
              要約を表示するにはロールモデルを選択してください
            </p>
          </div>
        ) : summaries.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              まだ要約がありません
            </p>
            <Button
              onClick={handleCollectInformation}
              disabled={collectMutation.isPending}
            >
              {collectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              情報収集を開始する
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {summaries.map((summary) => (
                <SummaryCard
                  key={summary.id}
                  summary={summary}
                  roleModelName={selectedModel?.name || ""}
                  tags={tags}
                />
              ))}
            </div>

            {summaries.length >= 3 && (
              <div className="mt-6 flex justify-center">
                <Button variant="outline">もっと見る</Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* System Status */}
      <SystemStatus selectedModelId={selectedModelId} />
    </AppLayout>
  );
}
