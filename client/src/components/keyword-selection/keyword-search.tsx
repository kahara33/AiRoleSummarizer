import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Keyword } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

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
  const [suggestions, setSuggestions] = useState<Keyword[]>([]);

  // キーワードの取得
  const { data: keywords = [], isLoading } = useQuery<Keyword[]>({
    queryKey: ["/api/keywords"],
    staleTime: 60 * 60 * 1000, // 1時間キャッシュ
  });

  // 検索語が変更されたときにサジェスト表示
  useEffect(() => {
    if (searchTerm.trim().length > 0) {
      // 既存のキーワードから検索
      const matchedKeywords = keywords.filter((keyword) => 
        keyword.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !selectedKeywords.includes(keyword.id)
      ).slice(0, 5); // 最大5件表示
      setSuggestions(matchedKeywords);
    } else {
      setSuggestions([]);
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

  // サジェストアイテムのクリック
  const handleSuggestionClick = (keywordId: string) => {
    onSelectKeyword(keywordId, true);
    setSearchTerm("");
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="キーワードを入力または検索..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full bg-background border rounded-md mt-1 shadow-lg">
                {suggestions.map((keyword) => (
                  <div
                    key={keyword.id}
                    className="p-2 hover:bg-accent/50 cursor-pointer"
                    onClick={() => handleSuggestionClick(keyword.id)}
                  >
                    {keyword.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button onClick={addKeyword} disabled={!searchTerm.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          キーワードを入力して追加するか、サジェストから選択してください
        </p>
      </CardHeader>
    </Card>
  );
}