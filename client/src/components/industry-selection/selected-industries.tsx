import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { IndustrySubcategory, IndustryCategory } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// クライアント側のカテゴリーとDBのカテゴリーをマッピングするための型
type IndustrySubCategory = {
  id: string;
  name: string;
  parentCategory: string;
};

type IndustryCategory = {
  id: string;
  name: string;
  subCategories: IndustrySubCategory[];
};

// フロントエンドで使用する固定の業界カテゴリーとサブカテゴリー
const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  {
    id: "auto-machine",
    name: "自動車・機械",
    subCategories: [
      { id: "auto-domestic", name: "自動車(国内)", parentCategory: "auto-machine" },
      { id: "auto-overseas", name: "自動車(海外)", parentCategory: "auto-machine" },
      { id: "next-gen-auto", name: "次世代自動車", parentCategory: "auto-machine" },
      { id: "auto-parts", name: "自動車部品", parentCategory: "auto-machine" },
      { id: "motorcycle", name: "2輪車", parentCategory: "auto-machine" },
      { id: "truck", name: "トラック", parentCategory: "auto-machine" },
      { id: "tire", name: "タイヤ", parentCategory: "auto-machine" },
      { id: "maas", name: "MaaS・ライドシェア", parentCategory: "auto-machine" },
      { id: "used-car", name: "中古車", parentCategory: "auto-machine" },
      { id: "aircraft", name: "航空機", parentCategory: "auto-machine" },
      { id: "construction-machine", name: "建設機械", parentCategory: "auto-machine" },
      { id: "machine-tool", name: "工作機械", parentCategory: "auto-machine" },
      { id: "robot", name: "ロボット", parentCategory: "auto-machine" },
      { id: "shipbuilding", name: "造船", parentCategory: "auto-machine" },
      { id: "car-parts", name: "カー用品", parentCategory: "auto-machine" },
      { id: "bicycle", name: "自転車", parentCategory: "auto-machine" },
      { id: "map-navi", name: "地図・ナビ", parentCategory: "auto-machine" },
      { id: "industrial-machine", name: "産業機械", parentCategory: "auto-machine" },
      { id: "air-cooling", name: "空調・冷却", parentCategory: "auto-machine" },
      { id: "battery", name: "電池", parentCategory: "auto-machine" }
    ]
  },
  {
    id: "electronics",
    name: "エレクトロニクス機器",
    subCategories: [
      { id: "appliance", name: "白物・家電製品", parentCategory: "electronics" },
      { id: "tv", name: "テレビ", parentCategory: "electronics" },
      { id: "pc-tablet", name: "パソコン・タブレット", parentCategory: "electronics" },
      { id: "smartphone", name: "スマートフォン", parentCategory: "electronics" },
      { id: "digital-camera", name: "デジタルカメラ", parentCategory: "electronics" },
      { id: "ac", name: "エアコン", parentCategory: "electronics" },
      { id: "printer", name: "複合機・プリンター", parentCategory: "electronics" },
      { id: "medical-device", name: "医療機器・用品", parentCategory: "electronics" },
      { id: "electronic-parts", name: "電子部品", parentCategory: "electronics" },
      { id: "semiconductor", name: "半導体", parentCategory: "electronics" },
      { id: "lithium-battery", name: "リチウムイオン・全固体電池", parentCategory: "electronics" },
      { id: "semiconductor-equipment", name: "半導体製造装置", parentCategory: "electronics" },
      { id: "semiconductor-material", name: "半導体材", parentCategory: "electronics" },
      { id: "semiconductor-material2", name: "半導体材料", parentCategory: "electronics" },
      { id: "power-semiconductor", name: "パワー半導体", parentCategory: "electronics" }
    ]
  },
  {
    id: "it-internet",
    name: "情報通信・インターネット",
    subCategories: [
      { id: "ai", name: "AI", parentCategory: "it-internet" },
      { id: "cloud", name: "クラウド", parentCategory: "it-internet" },
      { id: "ecommerce", name: "eコマース", parentCategory: "it-internet" },
      { id: "system-dev", name: "システム開発", parentCategory: "it-internet" },
      { id: "saas", name: "ソフトウェア(SaaS)", parentCategory: "it-internet" },
      { id: "mobile-carrier", name: "携帯電話事業者", parentCategory: "it-internet" },
      { id: "internet-line", name: "インターネット回線", parentCategory: "it-internet" },
      { id: "cybersecurity", name: "サイバーセキュリティー", parentCategory: "it-internet" }
    ]
  }
];

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
  const [categoryGroups, setCategoryGroups] = useState<Record<string, IndustrySubCategory[]>>({});

  // 選択されたサブカテゴリーをカテゴリーごとにグループ化
  useEffect(() => {
    if (selectedIndustryIds.length === 0) {
      setCategoryGroups({});
      return;
    }

    // 選択されたIDに基づいて、カテゴリーごとにサブカテゴリーをグループ化
    const groups: Record<string, IndustrySubCategory[]> = {};
    
    // すべてのカテゴリーに対して処理
    INDUSTRY_CATEGORIES.forEach(category => {
      // そのカテゴリーに属する選択済みのサブカテゴリーを抽出
      const selectedSubcategories = category.subCategories.filter(
        subCategory => selectedIndustryIds.includes(subCategory.id)
      );
      
      // 選択されたサブカテゴリーがある場合のみグループに追加
      if (selectedSubcategories.length > 0) {
        groups[category.id] = selectedSubcategories;
      }
    });
    
    setCategoryGroups(groups);
  }, [selectedIndustryIds]);

  // カテゴリーIDから名前を取得
  const getCategoryName = (categoryId: string): string => {
    const category = INDUSTRY_CATEGORIES.find(cat => cat.id === categoryId);
    return category ? category.name : "その他";
  };

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
        {selectedIndustryIds.length === 0 ? (
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