import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ExternalLink, Search, Filter } from 'lucide-react';
import { CollectionSource } from '@shared/schema';

interface SourcesListProps {
  planId: string | null;
  executionId?: string;
  compact?: boolean; // 左パネルでの表示用コンパクトモード
}

export function SourcesList({ planId, executionId, compact = false }: SourcesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [toolFilter, setToolFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'relevance'>('date');
  const [showFilters, setShowFilters] = useState(!compact);

  const { data: sources, isLoading } = useQuery({
    queryKey: ['/api/collection-sources', planId, executionId],
    queryFn: async () => {
      if (!planId) return [];
      
      let url = `/api/collection-sources?planId=${planId}`;
      if (executionId) {
        url = `/api/collection-sources?executionId=${executionId}`;
      }
      
      const res = await apiRequest('GET', url);
      return await res.json();
    },
    enabled: !!planId,
  });

  // カテゴリと使用ツールの一覧を取得
  const categories = sources ? [...new Set(sources.map((source: CollectionSource) => source.category))] : [];
  const tools = sources ? [...new Set(sources.map((source: CollectionSource) => source.toolUsed))] : [];

  // フィルタリングと並べ替え
  const filteredSources = sources ? sources
    .filter((source: CollectionSource) => {
      const matchesSearch = !searchTerm || 
        source.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        source.url.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = !categoryFilter || source.category === categoryFilter;
      const matchesTool = !toolFilter || source.toolUsed === toolFilter;
      
      return matchesSearch && matchesCategory && matchesTool;
    })
    .sort((a: CollectionSource, b: CollectionSource) => {
      if (sortBy === 'date') {
        return new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime();
      } else {
        return (b.relevanceScore || 0) - (a.relevanceScore || 0);
      }
    }) : [];

  // ツール名の表示用マッピング
  const toolDisplayNames: Record<string, string> = {
    'google_search': 'Google検索',
    'rss_feed': 'RSSフィード',
    'web_scraper': 'Webスクレイピング',
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCategoryFilter(null);
    setToolFilter(null);
  };

  // コンパクトモード用のカードレンダリング
  const renderCompactSourceCard = (source: CollectionSource) => (
    <Card key={source.id} className="mb-2">
      <CardContent className="p-3">
        <div className="font-medium text-sm line-clamp-1 mb-1" title={source.title}>
          {source.title}
        </div>
        <div className="flex flex-wrap gap-1 mb-1">
          {source.toolUsed && (
            <Badge variant="secondary" className="text-xs">
              {toolDisplayNames[source.toolUsed] || source.toolUsed}
            </Badge>
          )}
          {source.relevanceScore && source.relevanceScore > 3 && (
            <Badge variant="default" className="text-xs">
              関連度: {source.relevanceScore.toFixed(1)}
            </Badge>
          )}
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            {new Date(source.collectedAt).toLocaleDateString('ja-JP')}
          </p>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0"
            onClick={() => window.open(source.url, '_blank')}
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // 通常モード用のカードレンダリング
  const renderFullSourceCard = (source: CollectionSource) => (
    <Card key={source.id} className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between">
          <CardTitle className="text-base line-clamp-1" title={source.title}>
            {source.title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-2 flex-grow">
        <div className="flex flex-wrap gap-2 mb-2">
          {source.category && (
            <Badge variant="outline">{source.category}</Badge>
          )}
          {source.toolUsed && (
            <Badge variant="secondary">
              {toolDisplayNames[source.toolUsed] || source.toolUsed}
            </Badge>
          )}
          {source.relevanceScore && (
            <Badge variant={source.relevanceScore > 3 ? "default" : "outline"}>
              関連度: {source.relevanceScore.toFixed(1)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mb-1" title={source.url}>
          {source.url}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(source.collectedAt).toLocaleString('ja-JP')}
        </p>
      </CardContent>
      <CardFooter className="pt-0">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => window.open(source.url, '_blank')}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          ソースを開く
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <div className={`space-y-4 ${compact ? 'text-sm' : ''}`}>
      {/* ヘッダー部分 - コンパクトモードでは簡略化 */}
      <div className="flex items-center justify-between mb-4">
        {!compact && (
          <h2 className="text-xl font-semibold">情報ソース一覧</h2>
        )}
        
        <div className="flex items-center space-x-2 ml-auto">
          {compact ? (
            <Button 
              variant="ghost" 
              size="sm"
              className="p-1 h-7"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleResetFilters}
              >
                フィルターをリセット
              </Button>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as 'date' | 'relevance')}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="並び替え" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">日付 (新しい順)</SelectItem>
                  <SelectItem value="relevance">関連度 (高い順)</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      {/* フィルター部分 - コンパクトモードでは折りたたみ可能 */}
      {showFilters && (
        <div className={`grid grid-cols-1 ${compact ? '' : 'md:grid-cols-4'} gap-4 pb-4`}>
          <div className={`col-span-1 ${compact ? '' : 'md:col-span-3'}`}>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="タイトルまたはURLで検索..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className={`col-span-1 grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-2'}`}>
            <Select 
              value={categoryFilter || ''} 
              onValueChange={(value) => setCategoryFilter(value || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="カテゴリ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">すべてのカテゴリ</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select 
              value={toolFilter || ''} 
              onValueChange={(value) => setToolFilter(value || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="ツール" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">すべてのツール</SelectItem>
                {tools.map((tool) => (
                  <SelectItem key={tool} value={tool}>
                    {toolDisplayNames[tool] || tool}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* コンテンツ部分 - ローディング、エラー、空状態、リスト表示 */}
      {isLoading ? (
        <div className={`flex items-center justify-center ${compact ? 'h-32' : 'h-64'}`}>
          <Loader2 className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} animate-spin text-primary`} />
        </div>
      ) : !planId ? (
        <div className={`flex flex-col items-center justify-center ${compact ? 'h-32' : 'h-64'} text-center`}>
          <div className="text-muted-foreground mb-2">
            情報収集プランを選択してください
          </div>
        </div>
      ) : filteredSources.length === 0 ? (
        <div className={`flex flex-col items-center justify-center ${compact ? 'h-32' : 'h-64'} text-center`}>
          <div className="text-muted-foreground mb-2">
            {searchTerm || categoryFilter || toolFilter ? 
              'フィルター条件に一致する情報ソースがありません' : 
              '情報ソースがありません'}
          </div>
          {(searchTerm || categoryFilter || toolFilter) && (
            <Button 
              variant="outline" 
              size={compact ? "sm" : "default"}
              onClick={handleResetFilters}
            >
              フィルターをリセット
            </Button>
          )}
        </div>
      ) : compact ? (
        // コンパクトモードではリスト表示
        <div className="space-y-2">
          {filteredSources.slice(0, 10).map(renderCompactSourceCard)}
          {filteredSources.length > 10 && (
            <div className="text-center text-xs text-muted-foreground mt-2">
              他 {filteredSources.length - 10} 件のソースがあります
            </div>
          )}
        </div>
      ) : (
        // 通常モードではグリッド表示
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSources.map(renderFullSourceCard)}
        </div>
      )}
    </div>
  );
}