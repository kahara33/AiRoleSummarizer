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
import { Loader2 } from "lucide-react";

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
  };
}

export default function RoleModelForm({ onSuccess, roleModel }: RoleModelFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  
  const isEditMode = !!roleModel;

  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: roleModel?.name || "",
      description: roleModel?.description || "",
      userId: user?.id || "",
    },
  });

  // Create role model mutation
  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/role-models", values);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "ロールモデルを作成しました",
        description: "タグを追加して情報収集の精度を高めましょう",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/role-models"] });
      form.reset();
      if (onSuccess) onSuccess();
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isEditMode && roleModel) {
      updateMutation.mutate({ id: roleModel.id, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleSuggestTags = async () => {
    const { name, description } = form.getValues();
    if (!name || !description) {
      toast({
        title: "情報が不足しています",
        description: "名前と説明を入力してからタグを提案してください",
        variant: "destructive",
      });
      return;
    }

    setIsLoadingTags(true);
    try {
      // This would normally call the API to suggest tags based on the role model
      // We'll just simulate it with a delay for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "タグの提案",
        description: "ロールモデルの作成後、タグ管理画面でタグを追加できます",
      });
    } catch (error) {
      toast({
        title: "タグの提案に失敗しました",
        description: error instanceof Error ? error.message : "不明なエラーが発生しました",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTags(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditMode ? "ロールモデルを編集" : "新しいロールモデルを作成"}</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
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
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleSuggestTags}
              disabled={isLoadingTags || createMutation.isPending || updateMutation.isPending}
            >
              {isLoadingTags && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              AIにタグを提案してもらう
            </Button>
            
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditMode ? "更新する" : "作成する"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
