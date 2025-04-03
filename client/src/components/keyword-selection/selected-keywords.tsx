import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Keyword } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SelectedKeywordsProps {
  selectedKeywordIds: string[];
  onRemoveKeyword: (keywordId: string) => void;
  maxHeight?: string;
  title?: string;
}

export default function SelectedKeywords({
  selectedKeywordIds,
  onRemoveKeyword,
  maxHeight = "200px",
  title = "選択したキーワード"
}: SelectedKeywordsProps) {
  // 全キーワードを取得
  const { data: allKeywords = [], isLoading } = useQuery({
    queryKey: ["/api/keywords"],
    staleTime: 60 * 60 * 1000, // 1時間キャッシュ
  });

  // 選択されたキーワードを取得
  const selectedKeywords = allKeywords.filter(
    (keyword: Keyword) => selectedKeywordIds.includes(keyword.id)
  );

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-md font-bold flex items-center justify-between">
          {title}
          <Badge variant="outline" className="ml-2">
            {selectedKeywordIds.length}件
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : selectedKeywordIds.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">
            キーワードが選択されていません
          </p>
        ) : (
          <ScrollArea style={{ height: maxHeight }} className="pr-2">
            <div className="flex flex-wrap gap-1 p-1">
              {selectedKeywords.map((keyword) => (
                <Badge
                  key={keyword.id}
                  variant="secondary"
                  className="flex items-center gap-1 px-2 py-0.5 text-xs"
                >
                  <span className="truncate max-w-[100px]">{keyword.name}</span>
                  <X
                    className="h-3 w-3 cursor-pointer flex-shrink-0"
                    onClick={() => onRemoveKeyword(keyword.id)}
                  />
                </Badge>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}