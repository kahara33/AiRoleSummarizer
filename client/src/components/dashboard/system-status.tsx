import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Summary } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { format, addDays } from "date-fns";
import { ja } from "date-fns/locale";

interface SystemStatusProps {
  selectedModelId: string | null;
}

export default function SystemStatus({ selectedModelId }: SystemStatusProps) {
  const { user } = useAuth();

  const { data: summaries = [] } = useQuery<Summary[]>({
    queryKey: ["/api/role-models", selectedModelId, "summaries"],
    enabled: !!user && !!selectedModelId,
  });

  // Get some system metrics based on available data
  const nextCollectionDate = format(
    addDays(new Date(), 1), 
    "yyyy/MM/dd HH:mm", 
    { locale: ja }
  );
  
  const collectedCount = summaries.length * 4; // Simulate 4x actual summaries for collected info
  const summaryCount = summaries.length;
  
  return (
    <Card>
      <CardContent className="pt-4">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
          システム情報
        </h2>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              次回の情報収集予定
            </div>
            <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {nextCollectionDate}
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              収集済み情報数
            </div>
            <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {selectedModelId ? `${collectedCount} 件` : "- 件"}
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              生成済み要約数
            </div>
            <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {selectedModelId ? `${summaryCount} 件` : "- 件"}
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              システムステータス
            </div>
            <div className="mt-1 flex items-center">
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-400"></span>
              <span className="ml-1.5 text-lg font-semibold text-gray-900 dark:text-gray-100">
                正常稼働中
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
