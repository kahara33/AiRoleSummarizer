import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { insertRoleModelSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import IndustrySelectionContainer from "@/components/industry-selection/industry-selection-container";
import KeywordSelectionContainer from "@/components/keyword-selection/keyword-selection-container";

const formSchema = insertRoleModelSchema.extend({
  name: z.string().min(1, "ロールモデル名を入力してください").max(50, "50文字以内で入力してください"),
  description: z.string().min(10, "説明は10文字以上入力してください").max(500, "500文字以内で入力してください"),
});

interface RoleModelFormProps {
  onSuccess?: () => void;
  roleModel?: {
    id: string;
    name: string;
    description: string;
    isShared?: number;
  };
}

export default function RoleModelForm({ onSuccess, roleModel }: RoleModelFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const isEditMode = !!roleModel;
  const [activeTab, setActiveTab] = useState("basic");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [createdRoleModelId, setCreatedRoleModelId] = useState<string | null>(null);

  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: roleModel?.name || "",
      description: roleModel?.description || "",
      userId: user?.id || "",
      companyId: user?.companyId || null,
      isShared: roleModel?.isShared || 0,
    },
  });

  // Create role model mutation
  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/role-models", values);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "基本情報を保存しました",
        description: "次に関連する業界カテゴリを選択しましょう",
      });
      
      // 作成されたロールモデルのIDを保存
      setCreatedRoleModelId(data.id);
      
      // 業界選択タブに移動
      setActiveTab("industries");
      
      queryClient.invalidateQueries({ queryKey: ["/api/role-models"] });
      
      // 編集モードの場合は即座に完了
      if (isEditMode && onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: "ロールモデルの作成に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update role model mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<z.infer<typeof formSchema>> }) => {
      const res = await apiRequest("PUT", `/api/role-models/${id}`, values);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "ロールモデルを更新しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/role-models"] });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "ロールモデルの更新に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ロールモデルと業界を関連付けるミューテーション
  const saveIndustriesMutation = useMutation({
    mutationFn: async (params: { roleModelId: string, industryIds: string[] }) => {
      // まず既存の関連をクリア（APIがあれば）
      // 次に新しい関連を作成
      for (const industryId of params.industryIds) {
        await apiRequest("POST", "/api/role-model-industries", {
          roleModelId: params.roleModelId,
          industrySubcategoryId: industryId
        });
      }
      return params.industryIds;
    },
    onSuccess: () => {
      toast({
        title: "業界カテゴリを保存しました",
        description: "次に関連するキーワードを選択しましょう"
      });
      
      // キーワード選択タブに移動
      setActiveTab("keywords");
      
      queryClient.invalidateQueries({ queryKey: ["/api/role-models"] });
    },
    onError: (error) => {
      toast({
        title: "業界カテゴリの保存に失敗しました",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // ロールモデルとキーワードを関連付けるミューテーション
  const saveKeywordsMutation = useMutation({
    mutationFn: async (params: { roleModelId: string, keywordIds: string[] }) => {
      // まず既存の関連をクリア（APIがあれば）
      // 次に新しい関連を作成
      for (const keywordId of params.keywordIds) {
        await apiRequest("POST", "/api/role-model-keywords", {
          roleModelId: params.roleModelId,
          keywordId: keywordId
        });
      }
      return params.keywordIds;
    },
    onSuccess: () => {
      toast({
        title: "キーワードを保存しました",
        description: "ロールモデルの設定が完了しました"
      });
      
      // 設定完了を通知
      if (onSuccess) onSuccess();
      
      queryClient.invalidateQueries({ queryKey: ["/api/role-models"] });
    },
    onError: (error) => {
      toast({
        title: "キーワードの保存に失敗しました",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // 基本情報の送信
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isEditMode && roleModel) {
      updateMutation.mutate({ id: roleModel.id, values });
    } else {
      createMutation.mutate(values);
    }
  };
  
  // 業界カテゴリの保存
  const handleSaveIndustries = () => {
    if (!createdRoleModelId || selectedIndustries.length === 0) return;
    
    saveIndustriesMutation.mutate({
      roleModelId: createdRoleModelId,
      industryIds: selectedIndustries
    });
  };
  
  // キーワードの保存
  const handleSaveKeywords = () => {
    if (!createdRoleModelId || selectedKeywords.length === 0) return;
    
    saveKeywordsMutation.mutate({
      roleModelId: createdRoleModelId,
      keywordIds: selectedKeywords
    });
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditMode ? "ロールモデルを編集" : "新しいロールモデルを作成"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full mb-6">
            <TabsTrigger value="basic" disabled={isEditMode || createdRoleModelId !== null}>基本情報</TabsTrigger>
            <TabsTrigger value="industries" disabled={!isEditMode && createdRoleModelId === null}>業界カテゴリ</TabsTrigger>
            <TabsTrigger value="keywords" disabled={!isEditMode && (createdRoleModelId === null || activeTab !== "keywords")}>キーワード</TabsTrigger>
          </TabsList>
          
          {/* 基本情報 */}
          <TabsContent value="basic">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ロールモデル名</FormLabel>
                        <FormControl>
                          <Input placeholder="例: ビジネスアナリスト" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>説明</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="このロールモデルの目的や特徴を説明してください" 
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {/* 会社に所属しているユーザーのみ共有設定を表示 */}
                  {user?.companyId && (
                    <FormField
                      control={form.control}
                      name="isShared"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                          <FormControl>
                            <Checkbox
                              checked={field.value === 1}
                              onCheckedChange={(checked) => {
                                field.onChange(checked ? 1 : 0);
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>組織内で共有する</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              このロールモデルを同じ組織のメンバーと共有します
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                
                <div className="flex justify-end mt-6">
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    次へ: 業界カテゴリ選択
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          {/* 業界カテゴリ選択 */}
          <TabsContent value="industries">
            {isEditMode || createdRoleModelId ? (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  このロールモデルに関連する業界カテゴリを選択してください。
                  選択した業界カテゴリに基づいて情報を収集します。
                </p>
                
                <IndustrySelectionContainer
                  initialSelectedIndustries={selectedIndustries}
                  onIndustriesChange={setSelectedIndustries}
                  maxSelections={10}
                />
                
                <div className="flex justify-between mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => isEditMode ? onSuccess?.() : setActiveTab("basic")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {isEditMode ? "キャンセル" : "戻る"}
                  </Button>
                  <Button 
                    onClick={handleSaveIndustries}
                    disabled={selectedIndustries.length === 0 || saveIndustriesMutation.isPending}
                  >
                    {saveIndustriesMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    次へ: キーワード選択
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center p-8">
                <p>先に基本情報を入力してください</p>
              </div>
            )}
          </TabsContent>
          
          {/* キーワード選択 */}
          <TabsContent value="keywords">
            {isEditMode || (createdRoleModelId && activeTab === "keywords") ? (
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  このロールモデルに関連するキーワードを選択してください。
                  選択したキーワードに基づいて情報を収集します。
                </p>
                
                <KeywordSelectionContainer
                  initialSelectedKeywords={selectedKeywords}
                  onKeywordsChange={setSelectedKeywords}
                  maxSelections={20}
                />
                
                <div className="flex justify-between mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("industries")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    戻る
                  </Button>
                  <Button 
                    onClick={handleSaveKeywords}
                    disabled={selectedKeywords.length === 0 || saveKeywordsMutation.isPending}
                  >
                    {saveKeywordsMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    完了
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center p-8">
                <p>先に業界カテゴリを選択してください</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
