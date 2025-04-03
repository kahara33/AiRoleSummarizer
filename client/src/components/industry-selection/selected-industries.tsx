import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IndustrySubcategory, IndustryCategory } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SelectedIndustriesProps {
  selectedIndustryIds: string[];
  onRemoveIndustry: (industryId: string) => void;
  maxHeight?: string;
  title?: string;
}

export default function SelectedIndustries({
  selectedIndustryIds,
  onRemoveIndustry,
  maxHeight = "150px",
  title = "選択した業界"
}: SelectedIndustriesProps) {
  const [categoryGroups, setCategoryGroups] = useState<Record<string, IndustrySubcategory[]>>({});

  // 全業界サブカテゴリを取得
  const { data: allSubcategories = [], isLoading: isLoadingSubcategories } = useQuery<IndustrySubcategory[]>({
    queryKey: ["/api/industry-subcategories"],
    staleTime: 60 * 60 * 1000, // 1時間キャッシュ
  });

  // 業界カテゴリの取得
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<IndustryCategory[]>({
    queryKey: ["/api/industry-categories"],
    staleTime: 60 * 60 * 1000, // 1時間キャッシュ
  });

  // 選択されたサブカテゴリを取得
  const selectedSubcategories = allSubcategories.filter(
    (sub: IndustrySubcategory) => selectedIndustryIds.includes(sub.id)
  );

  // カテゴリIDからカテゴリ名を取得する関数
  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c: IndustryCategory) => c.id === categoryId);
    return category ? category.name : "その他";
  };

  // 選択されたサブカテゴリをカテゴリごとにグループ化
  useEffect(() => {
    if (selectedSubcategories.length > 0 && categories.length > 0) {
      const groups: Record<string, IndustrySubcategory[]> = {};
      
      selectedSubcategories.forEach((sub: IndustrySubcategory) => {
        if (!groups[sub.categoryId]) {
          groups[sub.categoryId] = [];
        }
        groups[sub.categoryId].push(sub);
      });
      
      setCategoryGroups(groups);
    } else {
      setCategoryGroups({});
    }
  }, [selectedSubcategories, categories]);

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-bold flex items-center justify-between">
          {title}
          <Badge variant="outline" className="ml-2">
            {selectedIndustryIds.length}件
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoadingSubcategories || isLoadingCategories ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : selectedIndustryIds.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            業界が選択されていません
          </p>
        ) : (
          <ScrollArea style={{ height: maxHeight }} className="pr-2">
            <div className="space-y-2">
              {Object.entries(categoryGroups).map(([categoryId, subcategories]) => (
                <div key={categoryId} className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">{getCategoryName(categoryId)}</h4>
                  <div className="flex flex-wrap gap-1">
                    {subcategories.map((sub) => (
                      <Badge
                        key={sub.id}
                        variant="secondary"
                        className="flex items-center gap-1 px-2 py-0.5 text-xs"
                      >
                        <span className="truncate max-w-[100px]">{sub.name}</span>
                        <X
                          className="h-3 w-3 cursor-pointer flex-shrink-0"
                          onClick={() => onRemoveIndustry(sub.id)}
                        />
                      </Badge>
                    ))}
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