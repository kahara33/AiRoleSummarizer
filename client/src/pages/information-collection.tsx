import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import IndustrySelectionContainer from "@/components/industry-selection/industry-selection-container";
import SaveIndustryCombination from "@/components/industry-selection/save-industry-combination";
import IndustryCombinations from "@/components/industry-selection/industry-combinations";
import KeywordSelectionContainer from "@/components/keyword-selection/keyword-selection-container";
import { Loader2, Send, Save } from "lucide-react";

export default function InformationCollectionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("industries");

  // ロールモデル一覧の取得
  const { data: roleModels = [], isLoading: isLoadingRoleModels } = useQuery({
    queryKey: ["/api/role-models"],
  });

  // 情報収集プランの生成ミューテーション
  const generatePlanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/information-collection/plan", {
        industryIds: selectedIndustries,
        keywordIds: selectedKeywords,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "情報収集プランを生成しました",
        description: "選択された業界とキーワードに基づく情報収集プランを生成しました。",
      });
      // TODO: プラン詳細表示画面へのナビゲーション
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 情報収集プランの生成実行
  const handleGeneratePlan = () => {
    if (selectedIndustries.length === 0) {
      toast({
        title: "業界を選択してください",
        description: "少なくとも1つの業界を選択してください。",
        variant: "destructive",
      });
      return;
    }
    
    generatePlanMutation.mutate();
  };

  // 業界組み合わせの選択
  const handleSelectCombination = (industryIds: string[]) => {
    setSelectedIndustries(industryIds);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">情報収集設定</h1>
        <p className="text-muted-foreground">
          業界とキーワードを選択して、AIによる効率的な情報収集を設定します。
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md mb-6">
          <TabsTrigger value="industries">業界カテゴリ</TabsTrigger>
          <TabsTrigger value="keywords">キーワード</TabsTrigger>
        </TabsList>

        <TabsContent value="industries" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <IndustrySelectionContainer 
                initialSelectedIndustries={selectedIndustries}
                onIndustriesChange={setSelectedIndustries}
                maxSelections={10}
              />
            </div>
            
            <div className="space-y-6">
              <IndustryCombinations onSelectCombination={handleSelectCombination} />
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-bold">組み合わせを保存</CardTitle>
                  <CardDescription>
                    現在選択中の業界組み合わせを保存して、後で再利用できます。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SaveIndustryCombination 
                    selectedIndustryIds={selectedIndustries}
                    disabled={selectedIndustries.length === 0}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={() => setActiveTab("keywords")}
              className="gap-2"
            >
              次へ: キーワード選択
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="keywords" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <KeywordSelectionContainer 
                initialSelectedKeywords={selectedKeywords}
                onKeywordsChange={setSelectedKeywords}
                maxSelections={20}
              />
            </div>
            
            <div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-bold">選択状況</CardTitle>
                  <CardDescription>
                    業界とキーワードの選択状況を確認できます。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">選択した業界</h3>
                    <div className="p-3 rounded-md bg-muted">
                      {selectedIndustries.length > 0 ? (
                        <span className="text-sm">{selectedIndustries.length}件の業界を選択中</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">業界が選択されていません</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">選択したキーワード</h3>
                    <div className="p-3 rounded-md bg-muted">
                      {selectedKeywords.length > 0 ? (
                        <span className="text-sm">{selectedKeywords.length}件のキーワードを選択中</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">キーワードが選択されていません</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <Button
                      className="w-full gap-2"
                      disabled={selectedIndustries.length === 0 || generatePlanMutation.isPending}
                      onClick={handleGeneratePlan}
                    >
                      {generatePlanMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      情報収集プランを生成
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setActiveTab("industries")}
            >
              戻る: 業界選択
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}