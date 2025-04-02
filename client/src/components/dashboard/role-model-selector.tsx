import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { RoleModel } from "@shared/schema";
import { Link } from "wouter";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface RoleModelSelectorProps {
  selectedModelId: string | null;
  onSelectModel: (modelId: string) => void;
}

export default function RoleModelSelector({
  selectedModelId,
  onSelectModel,
}: RoleModelSelectorProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const { data: roleModels = [], error, isLoading: isLoadingModels } = useQuery<RoleModel[]>({
    queryKey: ["/api/role-models"],
    enabled: !!user,
  });

  const handleModelClick = (modelId: string) => {
    setIsLoading(true);
    onSelectModel(modelId);
    setTimeout(() => setIsLoading(false), 500); // Simulate loading state
  };

  if (error) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-4">
          <p className="text-red-500">
            ロールモデルの読み込みに失敗しました: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="pt-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
          アクティブなロールモデル
        </h2>

        {isLoadingModels ? (
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-9 w-40 rounded-full" />
            <Skeleton className="h-9 w-48 rounded-full" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
        ) : roleModels.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400 mb-3">
              ロールモデルが設定されていません
            </p>
            <Link href="/role-models">
              <Button className="bg-primary-50 dark:bg-gray-700 text-primary-600 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-gray-600">
                <Plus className="h-4 w-4 mr-1" />
                ロールモデルを作成
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {roleModels.map((model) => (
              <Button
                key={model.id}
                variant="outline"
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                  selectedModelId === model.id
                    ? "bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 border-2 border-primary-400"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                onClick={() => handleModelClick(model.id)}
                disabled={isLoading}
              >
                <span>{model.name}</span>
                {selectedModelId === model.id && (
                  <Check className="ml-1.5 h-4 w-4" />
                )}
              </Button>
            ))}
            <Link href="/role-models">
              <Button variant="outline" className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-primary-50 dark:bg-gray-600 text-primary-600 dark:text-primary-300 border border-dashed border-primary-400 dark:border-primary-500">
                <Plus className="mr-1 h-4 w-4" />
                新規作成
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
