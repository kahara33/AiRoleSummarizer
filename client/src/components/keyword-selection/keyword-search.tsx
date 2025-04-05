import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Keyword } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Plus, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [filteredKeywords, setFilteredKeywords] = useState<Keyword[]>([]);

  // キーワードの取得
  const { data: keywords = [], isLoading } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords"],
    staleTime: 0, // キャッシュを無効化
  });

  // 検索語が変更されたときにキーワードをフィルタリング
  useEffect(() => {
    if (searchTerm.trim() === "") {
      // 検索語がない場合は、選択されていないすべてのキーワードを表示
      setFilteredKeywords(
        keywords.filter((keyword) => !selectedKeywords.includes(keyword.id))
      );
    } else {
      // 検索語がある場合は、検索にマッチするキーワードをフィルタリング
      setFilteredKeywords(
        keywords.filter(
          (keyword) =>
            keyword.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !selectedKeywords.includes(keyword.id)
        )
      );
    }
  }, [searchTerm, keywords, selectedKeywords]);

  // キーワードの追加（存在しなければ新規作成）
  const addKeyword = async () => {
    if (!searchTerm.trim()) return;
    
    // 既存のキーワードを検索
    const existingKeyword = keywords.find((k) => 
      k.name.toLowerCase() === searchTerm.toLowerCase()
    );
    
    if (existingKeyword) {
      // 既に選択されていなければ追加
      if (!selectedKeywords.includes(existingKeyword.id)) {
        onSelectKeyword(existingKeyword.id, true);
      }
    } else {
      try {
        // 新しいキーワードを作成
        const res = await apiRequest("POST", "/api/keywords", { name: searchTerm });
        const newKeyword = await res.json();
        
        // 選択済みリストに追加
        onSelectKeyword(newKeyword.id, true);
        
        // キャッシュを更新するためにキーワードリストを再取得する
        queryClient.invalidateQueries({ queryKey: ["/api/keywords"] });
      } catch (error) {
        console.error("キーワードの作成に失敗しました", error);
      }
    }
    
    // 入力をクリア
    setSearchTerm("");
  };

  // Enterキーでキーワード追加
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  };

  // キーワードアイテムのクリック
  const handleKeywordClick = (keywordId: string) => {
    onSelectKeyword(keywordId, true);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="キーワードを検索..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <Button onClick={addKeyword} disabled={!searchTerm.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            新規追加
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          キーワードリストから選択するか、新しいキーワードを作成できます
        </p>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        ) : filteredKeywords.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {searchTerm.trim() ? "検索条件に一致するキーワードがありません" : "選択可能なキーワードがありません"}
          </p>
        ) : (
          <ScrollArea style={{ height: maxHeight }} className="pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 py-2">
              {filteredKeywords.map((keyword) => (
                <Badge
                  key={keyword.id}
                  variant="outline"
                  className="flex justify-between items-center cursor-pointer px-3 py-2 hover:bg-accent/50"
                  onClick={() => handleKeywordClick(keyword.id)}
                >
                  <span className="truncate mr-2">{keyword.name}</span>
                  <Plus className="h-3 w-3 flex-shrink-0" />
                </Badge>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}