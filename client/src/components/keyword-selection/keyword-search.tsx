import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Keyword } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface KeywordSearchProps {
  selectedKeywords: string[];
  onSelectKeyword: (keywordId: string, selected: boolean) => void;
  maxHeight?: string;
  title?: string;
}

export default function KeywordSearch({
  selectedKeywords,
  onSelectKeyword,
  maxHeight = "400px",
  title = "キーワード検索"
}: KeywordSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTab, setCurrentTab] = useState("all");

  // キーワードの取得
  const { data: keywords = [], isLoading } = useQuery({
    queryKey: ["/api/keywords"],
    staleTime: 60 * 60 * 1000, // 1時間キャッシュ
  });

  // 検索条件とタブに基づいてフィルタリングされたキーワードリスト
  const filteredKeywords = keywords.filter((keyword: Keyword) => {
    const matchesSearch = searchTerm 
      ? keyword.name.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
    
    // タブに基づくフィルタリング
    if (currentTab === "all") {
      return matchesSearch;
    } else if (currentTab === "selected") {
      return matchesSearch && selectedKeywords.includes(keyword.id);
    }
    
    return matchesSearch;
  });

  // 各カテゴリー（タブ）のカウントを計算
  const counts = {
    all: keywords.length,
    selected: selectedKeywords.length
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="キーワードを検索..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="all" value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="all">
              すべて
              <Badge variant="outline" className="ml-2">
                {counts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="selected">
              選択済み
              <Badge variant="outline" className="ml-2">
                {counts.selected}
              </Badge>
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className={`h-[${maxHeight}]`}>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <p>読み込み中...</p>
              </div>
            ) : filteredKeywords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                該当するキーワードがありません
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {filteredKeywords.map((keyword: Keyword) => (
                  <div
                    key={keyword.id}
                    className="flex items-center space-x-2 p-2 hover:bg-accent/50 rounded-md transition-colors"
                  >
                    <Checkbox
                      id={`keyword-${keyword.id}`}
                      checked={selectedKeywords.includes(keyword.id)}
                      onCheckedChange={(checked) => {
                        onSelectKeyword(keyword.id, checked === true);
                      }}
                    />
                    <label
                      htmlFor={`keyword-${keyword.id}`}
                      className="text-sm cursor-pointer flex-grow"
                    >
                      {keyword.name}
                    </label>
                    {keyword.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {keyword.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}