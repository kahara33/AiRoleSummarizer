import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { IndustryCategory, IndustrySubcategory } from "@shared/schema";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IndustrySelectorProps {
  selectedIndustries: string[];
  onSelectIndustry: (industryId: string, selected: boolean) => void;
  maxHeight?: string;
  title?: string;
}

export default function IndustrySelector({
  selectedIndustries,
  onSelectIndustry,
  maxHeight = "400px",
  title = "業界カテゴリー選択"
}: IndustrySelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // 業界カテゴリーの取得
  const { data: categories = [], isLoading: isLoadingCategories } = useQuery<IndustryCategory[]>({
    queryKey: ["/api/industry-categories"],
    staleTime: 0, // キャッシュを無効化
  });

  // 業界サブカテゴリーの取得（すべて）
  const { data: subcategories = [], isLoading: isLoadingSubcategories } = useQuery<IndustrySubcategory[]>({
    queryKey: ["/api/industry-subcategories"],
    staleTime: 0, // キャッシュを無効化
  });

  // カテゴリーに含まれるサブカテゴリーを取得する関数
  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter(
      (sub: IndustrySubcategory) => sub.categoryId === categoryId
    );
  };

  // 検索条件に一致するサブカテゴリーがあるカテゴリーIDを返す関数
  const getCategoriesWithMatchingSubcategories = () => {
    if (!searchTerm) return [];
    
    const lowercaseSearchTerm = searchTerm.toLowerCase();
    return subcategories
      .filter((sub: IndustrySubcategory) => 
        sub.name.toLowerCase().includes(lowercaseSearchTerm))
      .map((sub: IndustrySubcategory) => sub.categoryId);
  };

  // 検索時に該当するカテゴリーを展開する
  useEffect(() => {
    if (searchTerm) {
      const matchingCategoryIds = getCategoriesWithMatchingSubcategories();
      setExpandedCategories(matchingCategoryIds);
    } else {
      setExpandedCategories([]);
    }
  }, [searchTerm]);

  // カテゴリーの展開状態をトグルする
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // サブカテゴリーが検索条件に一致するかどうかを判定
  const matchesSearchTerm = (subcategory: IndustrySubcategory) => {
    if (!searchTerm) return true;
    
    return subcategory.name.toLowerCase().includes(searchTerm.toLowerCase());
  };

  // 選択済みの業界数
  const selectedCount = selectedIndustries.length;

  // 除外する大カテゴリーの名前
  const excludedCategoryNames = ["製造業", "情報通信業", "金融業", "小売業", "サービス業"];

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="業界を検索..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {selectedCount > 0 && (
          <div className="flex items-center mt-2">
            <Badge variant="outline" className="mr-2">
              {selectedCount}件選択中
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {isLoadingCategories || isLoadingSubcategories ? (
          <div className="flex justify-center py-4">
            <p>読み込み中...</p>
          </div>
        ) : (
          <ScrollArea style={{ height: maxHeight }}>
            <Accordion
              type="multiple"
              value={expandedCategories}
              className="w-full"
            >
              {categories
                .filter((category: IndustryCategory) => !excludedCategoryNames.includes(category.name))
                .map((category: IndustryCategory) => {
                  const categorySubcategories = getSubcategoriesForCategory(category.id);
                  // 検索時、一致するサブカテゴリーがない場合はカテゴリーを表示しない
                  if (searchTerm && !categorySubcategories.some(matchesSearchTerm)) {
                    return null;
                  }
                  
                  return (
                    <AccordionItem 
                      key={category.id} 
                      value={category.id}
                      className="border-b"
                    >
                      <AccordionTrigger 
                        onClick={() => toggleCategory(category.id)}
                        className="hover:no-underline py-2 px-1"
                      >
                        <span className="font-medium">{category.name}</span>
                        <Badge variant="outline" className="ml-2 font-normal">
                          {categorySubcategories.length}
                        </Badge>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 gap-2 py-2">
                          {categorySubcategories
                            .filter(matchesSearchTerm)
                            .map((subcategory: IndustrySubcategory) => (
                            <div 
                              key={subcategory.id}
                              className="flex items-center space-x-2 px-2 py-1 rounded-md hover:bg-accent/50 transition-colors"
                            >
                              <Checkbox
                                id={`industry-${subcategory.id}`}
                                checked={selectedIndustries.includes(subcategory.id)}
                                onCheckedChange={(checked) => {
                                  onSelectIndustry(subcategory.id, checked === true);
                                }}
                              />
                              <label
                                htmlFor={`industry-${subcategory.id}`}
                                className="text-sm cursor-pointer flex-grow"
                              >
                                {subcategory.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
            </Accordion>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}