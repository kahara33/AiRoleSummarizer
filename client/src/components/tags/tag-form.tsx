import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertTagSchema } from "@shared/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const formSchema = insertTagSchema.extend({
  name: z.string().min(1, "タグ名を入力してください").max(30, "30文字以内で入力してください"),
  category: z.string().min(1, "カテゴリーを選択してください"),
});

interface TagFormProps {
  roleModelId: string;
  onSuccess?: () => void;
}

export default function TagForm({ roleModelId, onSuccess }: TagFormProps) {
  const { toast } = useToast();
  
  // Form setup
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
      roleModelId,
    },
  });

  // Create tag mutation
  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", `/api/role-models/${roleModelId}/tags`, values);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "タグを追加しました",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/role-models", roleModelId, "tags"] });
      form.reset({ name: "", category: form.getValues().category, roleModelId });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast({
        title: "タグの追加に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate(values);
  };

  // Predefined categories
  const categories = [
    { value: "Business", label: "ビジネス" },
    { value: "Technology", label: "テクノロジー" },
    { value: "Trends", label: "トレンド" },
    { value: "Career", label: "キャリア" },
    { value: "Other", label: "その他" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>新しいタグを追加</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>タグ名</FormLabel>
                  <FormControl>
                    <Input placeholder="例: データ分析" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>カテゴリー</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="カテゴリーを選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          
          <CardFooter className="flex justify-end">
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              追加する
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
