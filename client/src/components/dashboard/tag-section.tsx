import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Tag } from "@shared/schema";
import { Link } from "wouter";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface TagSectionProps {
  selectedModelId: string | null;
}

export default function TagSection({ selectedModelId }: TagSectionProps) {
  const { user } = useAuth();

  const { data: tags = [], error, isLoading } = useQuery<Tag[]>({
    queryKey: ["/api/role-models", selectedModelId, "tags"],
    enabled: !!user && !!selectedModelId,
  });

  // Group tags by category
  const groupedTags = tags.reduce<Record<string, Tag[]>>((acc, tag) => {
    if (!acc[tag.category]) {
      acc[tag.category] = [];
    }
    acc[tag.category].push(tag);
    return acc;
  }, {});

  const categoryColors: Record<string, string> = {
    "ビジネス": "blue",
    "Business": "blue",
    "テクノロジー": "green",
    "Technology": "green",
    "トレンド": "purple",
    "Trends": "purple",
    "キャリア": "yellow",
    "Career": "yellow",
    // Default to primary color for other categories
  };

  const getTagColorClasses = (category: string) => {
    const color = categoryColors[category] || "primary";
    switch (color) {
      case "blue":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "green":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "purple":
        return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200";
      case "yellow":
        return "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200";
      default:
        return "bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200";
    }
  };

  if (!selectedModelId) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              アクティブなタグ
            </h2>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-center py-6">
            ロールモデルを選択してタグを表示
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-4">
          <p className="text-red-500">
            タグの読み込みに失敗しました: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="pt-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            アクティブなタグ
          </h2>
          <Link href="/tags">
            <Button variant="link" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
              編集する
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div>
              <Skeleton className="h-5 w-24 mb-2" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>
            <div>
              <Skeleton className="h-5 w-32 mb-2" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ) : Object.keys(groupedTags).length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400 mb-3">
              タグが設定されていません
            </p>
            <Link href="/tags">
              <Button className="bg-primary-50 dark:bg-gray-700 text-primary-600 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-gray-600">
                <Plus className="h-4 w-4 mr-1" />
                タグを追加
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {Object.entries(groupedTags).map(([category, categoryTags]) => (
              <div key={category} className="mb-4 last:mb-0">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {categoryTags.map((tag) => (
                    <span
                      key={tag.id}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTagColorClasses(
                        tag.category
                      )}`}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-4">
              <Link href="/tags">
                <Button variant="ghost" className="text-sm flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 p-0">
                  <Plus className="mr-1 h-4 w-4" />
                  タグを追加
                </Button>
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
