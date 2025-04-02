import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { RoleModel, Tag, Summary } from "@shared/schema";
import AppLayout from "@/components/layout/app-layout";
import SummaryCard from "@/components/dashboard/summary-card";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function SummariesPage() {
  const { user } = useAuth();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Fetch role models
  const {
    data: roleModels = [],
    isLoading: isLoadingModels,
    error: roleModelsError,
  } = useQuery<RoleModel[]>({
    queryKey: ["/api/role-models"],
    enabled: !!user,
  });

  // Set first role model as selected by default
  if (!selectedModelId && roleModels.length > 0 && !isLoadingModels) {
    setSelectedModelId(roleModels[0].id);
  }

  // Fetch tags for selected model
  const {
    data: tags = [],
    isLoading: isLoadingTags,
  } = useQuery<Tag[]>({
    queryKey: ["/api/role-models", selectedModelId, "tags"],
    enabled: !!selectedModelId,
  });

  // Fetch summaries for selected model
  const {
    data: summaries = [],
    isLoading: isLoadingSummaries,
    error: summariesError,
  } = useQuery<Summary[]>({
    queryKey: ["/api/role-models", selectedModelId, "summaries"],
    enabled: !!selectedModelId,
  });

  // Get selected model data
  const selectedModel = roleModels.find((model) => model.id === selectedModelId);

  // Filter summaries by date if selected
  const filteredSummaries = date
    ? summaries.filter((summary) => {
        const summaryDate = new Date(summary.createdAt);
        return (
          summaryDate.getDate() === date.getDate() &&
          summaryDate.getMonth() === date.getMonth() &&
          summaryDate.getFullYear() === date.getFullYear()
        );
      })
    : summaries;

  // Pagination
  const totalPages = Math.ceil(filteredSummaries.length / itemsPerPage);
  const paginatedSummaries = filteredSummaries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle role model selection change
  const handleModelChange = (modelId: string) => {
    setSelectedModelId(modelId);
    setCurrentPage(1);
  };

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    setDate(date);
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Clear filters
  const clearFilters = () => {
    setDate(undefined);
    setCurrentPage(1);
  };

  return (
    <AppLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-gray-900 dark:text-gray-100">
            要約一覧
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            AIが収集・生成した情報要約の一覧を表示します
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ロールモデル
              </label>
              <Select
                value={selectedModelId || ""}
                onValueChange={handleModelChange}
                disabled={isLoadingModels || roleModels.length === 0}
              >
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                日付
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    disabled={!selectedModelId}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? (
                      format(date, "yyyy/MM/dd", { locale: ja })
                    ) : (
                      <span>日付を選択</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                disabled={!date}
                className="mr-2"
              >
                フィルターをクリア
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summaries */}
      {!selectedModelId ? (
        <Card>
          <CardContent className="pt-6 text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">
              要約を表示するにはロールモデルを選択してください
            </p>
          </CardContent>
        </Card>
      ) : isLoadingSummaries || isLoadingTags ? (
        <Card>
          <CardContent className="pt-6 flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </CardContent>
        </Card>
      ) : summariesError ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center text-red-500">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p>要約の読み込みに失敗しました: {summariesError.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredSummaries.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>要約がありません</CardTitle>
            <CardDescription>
              {date
                ? `${format(date, "yyyy年MM月dd日", { locale: ja })}の要約データはありません`
                : "このロールモデルにはまだ要約がありません"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-center pb-10">
            {date && (
              <Button variant="outline" onClick={clearFilters} className="mt-4">
                フィルターをクリア
              </Button>
            )}
            {!date && (
              <p className="text-gray-500 dark:text-gray-400 mt-4">
                ダッシュボードから情報収集を開始できます
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100 mb-4">
              {selectedModel?.name}の要約
              {date && (
                <span className="text-base font-normal ml-2">
                  ({format(date, "yyyy年MM月dd日", { locale: ja })})
                </span>
              )}
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedSummaries.map((summary) => (
                <SummaryCard
                  key={summary.id}
                  summary={summary}
                  roleModelName={selectedModel?.name || ""}
                  tags={tags}
                />
              ))}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 mb-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        isActive={page === currentPage}
                        onClick={() => handlePageChange(page)}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
