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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import IndustrySelectionContainer from "@/components/industry-selection/industry-selection-container";
import KeywordSelectionContainer from "@/components/keyword-selection/keyword-selection-container";

const formSchema = insertRoleModelSchema.extend({
  name: z.string().min(1, "ロールモデル名を入力してください").max(50, "50文字以内で入力してください"),
  description: z.string().max(500, "500文字以内で入力してください").optional(),
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
  const [basicFormData, setBasicFormData] = useState<z.infer<typeof formSchema> | null>(null);
  
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

  // 基本情報のフォーム送信処理
  const onBasicFormSubmit = (values: z.infer<typeof formSchema>) => {
    setBasicFormData(values);
    setActiveTab("industries");
  };

  // 業界カテゴリーの送信処理
  const handleIndustriesSubmit = () => {
    if (selectedIndustries.length === 0) {
      toast({
        title: "業界カテゴリーを選択してください",
        variant: "destructive",
      });
      return;
    }
    
    setActiveTab("keywords");
  };

  // すべての情報を使ってロールモデルを保存
  const handleSaveEverything = () => {
    if (!basicFormData || selectedIndustries.length === 0 || selectedKeywords.length === 0) {
      toast({
        title: "すべての必要情報を入力してください",
        variant: "destructive",
      });
      return;
    }

    createRoleModelMutation.mutate({
      formData: basicFormData,
      industries: selectedIndustries,
      keywords: selectedKeywords
    });
  };

  // ロールモデル作成ミューテーション
  const createRoleModelMutation = useMutation({
    mutationFn: async (params: { 
      formData: z.infer<typeof formSchema>, 
      industries: string[], 
      keywords: string[] 
    }) => {
      // 1. ロールモデルを作成
      const res = await apiRequest("POST", "/api/role-models", params.formData);
      const roleModel = await res.json();
      
      // 2. 業界カテゴリを関連付け
      for (const industryId of params.industries) {
        await apiRequest("POST", "/api/role-model-industries", {
          roleModelId: roleModel.id,
          industrySubcategoryId: industryId
        });
      }
      
      // 3. キーワードを関連付け
      for (const keywordId of params.keywords) {
        await apiRequest("POST", "/api/role-model-keywords", {
          roleModelId: roleModel.id,
          keywordId: keywordId
        });
      }
      
      return roleModel;
    },
    onSuccess: () => {
      toast({
        title: "ロールモデルを作成しました",
        description: "すべての情報が保存されました"
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/role-models"] });
      
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "ロールモデルの作成に失敗しました",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // 編集モード用更新ミューテーション
  const updateRoleModelMutation = useMutation({
    mutationFn: async (values: Partial<z.infer<typeof formSchema>>) => {
      if (!roleModel) throw new Error("編集するロールモデルがありません");
      
      const res = await apiRequest("PUT", `/api/role-models/${roleModel.id}`, values);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "ロールモデルを更新しました"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/role-models"] });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "ロールモデルの更新に失敗しました",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  return (
    <Card className="w-[800px]">
      <CardHeader>
        <CardTitle>{isEditMode ? "ロールモデルを編集" : "新しいロールモデルを作成"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full mb-6">
            <TabsTrigger value="basic">基本情報</TabsTrigger>
            <TabsTrigger value="industries" disabled={!basicFormData && !isEditMode}>業界カテゴリ</TabsTrigger>
            <TabsTrigger value="keywords" disabled={!basicFormData || activeTab === "basic"}>キーワード</TabsTrigger>
          </TabsList>
          
          {/* 基本情報タブ */}
          <TabsContent value="basic">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onBasicFormSubmit)} className="space-y-4">
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
                
                <div className="flex justify-end mt-6">
                  <Button 
                    type="submit" 
                    disabled={isEditMode ? updateRoleModelMutation.isPending : form.formState.isSubmitting}
                  >
                    {(form.formState.isSubmitting) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    次へ: 業界カテゴリ選択
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          {/* 業界カテゴリ選択タブ */}
          <TabsContent value="industries">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                このロールモデルに関連する業界カテゴリを選択してください。
                選択した業界カテゴリに基づいて情報を収集します。
              </p>
              
              <IndustrySelectionContainer
                initialSelectedIndustries={selectedIndustries}
                onIndustriesChange={setSelectedIndustries}
                maxSelections={10}
              />
              
              <div className="flex justify-between mt-4 sticky bottom-0 bg-card pb-4 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab("basic")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  戻る
                </Button>
                <Button 
                  onClick={handleIndustriesSubmit}
                  disabled={selectedIndustries.length === 0}
                >
                  次へ: キーワード選択
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>
          
          {/* キーワード選択タブ */}
          <TabsContent value="keywords">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                このロールモデルに関連するキーワードを入力または選択してください。
                入力したキーワードに基づいて情報を収集します。
              </p>
              
              <KeywordSelectionContainer
                initialSelectedKeywords={selectedKeywords}
                onKeywordsChange={setSelectedKeywords}
                maxSelections={20}
              />
              
              <div className="flex justify-between mt-4 sticky bottom-0 bg-card pb-4 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab("industries")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  戻る
                </Button>
                <Button 
                  onClick={handleSaveEverything}
                  disabled={selectedKeywords.length === 0 || createRoleModelMutation.isPending}
                >
                  {createRoleModelMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  完了
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}