import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { RoleModel, Tag } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";

export default function RoleModelDetailPage() {
  const { toast } = useToast();
  const [, params] = useRoute("/role-model/:id");
  const roleModelId = params?.id || "";
  
  // デバッグログの追加
  useEffect(() => {
    console.log("RoleModelDetailPage - パラメータID:", roleModelId);
  }, [roleModelId]);

  // Fetch role model with tags
  const { data: roleModel, isLoading, error } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/with-tags`],
    queryFn: async () => {
      console.log("APIリクエスト開始:", `/api/role-models/${roleModelId}/with-tags`);
      try {
        const res = await apiRequest("GET", `/api/role-models/${roleModelId}/with-tags`);
        const data = await res.json() as RoleModel & { tags: Tag[] };
        console.log("APIレスポンス:", data);
        return data;
      } catch (err) {
        console.error("APIリクエストエラー:", err);
        toast({
          title: "データ取得エラー",
          description: err instanceof Error ? err.message : "不明なエラーが発生しました",
          variant: "destructive"
        });
        throw err;
      }
    },
    enabled: !!roleModelId
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error || !roleModel) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p>ロールモデルが見つかりませんでした。</p>
          <Link href="/role-models">
            <Button>ロールモデル一覧に戻る</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/role-models">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">{roleModel.name}</h1>
            </div>
            <p className="text-muted-foreground">
              {roleModel.description}
            </p>
          </div>
          <div className="flex space-x-2">
            <Link href={`/role-model/${roleModelId}/knowledge-graph`}>
              <Button>
                知識グラフを表示
              </Button>
            </Link>
            <Link href={`/role-model/${roleModelId}/summaries`}>
              <Button variant="outline">
                サマリー一覧
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ロールモデル情報</CardTitle>
            <CardDescription>
              このロールモデルの基本情報と関連するタグ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2">基本情報</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">名前:</span>
                    <p>{roleModel.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">説明:</span>
                    <p>{roleModel.description}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">共有設定:</span>
                    <p>{roleModel.isShared ? "組織内で共有" : "非共有"}</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">タグ</h3>
                <div className="flex flex-wrap gap-2">
                  {roleModel.tags && roleModel.tags.length > 0 ? (
                    roleModel.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
                        <TagIcon className="h-3 w-3" />
                        {tag.name}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">タグはありません</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}