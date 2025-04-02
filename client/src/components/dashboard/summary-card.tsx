import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Summary, Tag } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface SummaryCardProps {
  summary: Summary;
  roleModelName: string;
  tags: Tag[];
}

export default function SummaryCard({ summary, roleModelName, tags }: SummaryCardProps) {
  const [activeFeedback, setActiveFeedback] = useState(summary.feedback);

  // Categories color mapping
  const categoryColors: Record<string, string> = {
    "ビジネス": "blue",
    "Business": "blue",
    "テクノロジー": "green",
    "Technology": "green",
    "トレンド": "purple",
    "Trends": "purple",
    "キャリア": "yellow",
    "Career": "yellow",
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

  // Mutation for updating summary feedback
  const feedbackMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: number }) => {
      await apiRequest("POST", `/api/summaries/${id}/feedback`, { feedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-models", summary.roleModelId, "summaries"] });
    },
  });

  const handleFeedback = (value: number) => {
    // If already selected, deselect (set to 0)
    const newValue = activeFeedback === value ? 0 : value;
    setActiveFeedback(newValue);
    feedbackMutation.mutate({ id: summary.id, feedback: newValue });
  };

  // Format date for display
  const formattedDate = summary.createdAt 
    ? format(new Date(summary.createdAt), "yyyy/MM/dd", { locale: ja }) 
    : "";

  // Determine which tags to show for this summary (limit to 3 for space)
  const summaryTags = tags.slice(0, 3);

  return (
    <Card className="overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
      <CardContent className="p-5">
        <div className="flex justify-between">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {roleModelName}
          </div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {formattedDate}
          </div>
        </div>
        
        <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {summary.title}
        </h3>
        
        <div className="mt-3 flex flex-wrap gap-1.5">
          {summaryTags.map((tag) => (
            <span
              key={tag.id}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTagColorClasses(tag.category)}`}
            >
              {tag.name}
            </span>
          ))}
        </div>
        
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          {summary.content}
        </p>
        
        <div className="mt-4 flex justify-between items-center">
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                activeFeedback === 1
                  ? "bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-primary-200"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
              }`}
              onClick={() => handleFeedback(1)}
              disabled={feedbackMutation.isPending}
            >
              <ThumbsUp className="mr-1 h-4 w-4" />
              役立つ
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${
                activeFeedback === -1
                  ? "bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-primary-200"
                  : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700"
              }`}
              onClick={() => handleFeedback(-1)}
              disabled={feedbackMutation.isPending}
            >
              <ThumbsDown className="mr-1 h-4 w-4" />
              改善が必要
            </Button>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 h-auto"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>共有</DropdownMenuItem>
              <DropdownMenuItem>詳細を見る</DropdownMenuItem>
              {summary.sources && summary.sources.length > 0 && (
                <DropdownMenuItem>
                  <a
                    href={summary.sources[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    ソースを見る
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
