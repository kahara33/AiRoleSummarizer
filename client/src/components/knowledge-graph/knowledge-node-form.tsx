import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KnowledgeNode, insertKnowledgeNodeSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { HexColorInput, HexColorPicker } from "react-colorful";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface KnowledgeNodeFormProps {
  roleModelId: string;
  node?: KnowledgeNode;
  parentNode?: KnowledgeNode;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const formSchema = insertKnowledgeNodeSchema.extend({
  name: z.string().min(1, "名前を入力してください"),
  type: z.string(),
  color: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function KnowledgeNodeForm({
  roleModelId,
  node,
  parentNode,
  onSuccess,
  onCancel,
}: KnowledgeNodeFormProps) {
  const { toast } = useToast();
  const isEditing = !!node;
  const [color, setColor] = useState<string>(node?.color || "#AAAAAA");

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: node?.name || "",
      description: node?.description || "",
      type: node?.type || (parentNode ? "keyword" : "root"),
      color: node?.color || "#AAAAAA",
      level: node?.level || (parentNode ? parentNode.level + 1 : 0),
      parentId: node?.parentId || parentNode?.id || null,
      roleModelId,
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest(
        "POST",
        `/api/role-models/${roleModelId}/knowledge-nodes`,
        values
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`] });
      toast({
        title: "成功",
        description: "知識ノードが作成されました",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      console.error("Error creating knowledge node:", error);
      toast({
        title: "エラー",
        description: "知識ノードの作成に失敗しました",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest(
        "PUT",
        `/api/knowledge-nodes/${node!.id}`,
        values
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`] });
      toast({
        title: "成功",
        description: "知識ノードが更新されました",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      console.error("Error updating knowledge node:", error);
      toast({
        title: "エラー",
        description: "知識ノードの更新に失敗しました",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    // Include color from state
    const dataToSubmit = {
      ...values,
      color,
    };
    
    if (isEditing) {
      updateMutation.mutate(dataToSubmit);
    } else {
      createMutation.mutate(dataToSubmit);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>名前</FormLabel>
              <FormControl>
                <Input placeholder="ノードの名前" {...field} />
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
                  placeholder="ノードの説明（オプション）"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>タイプ</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isEditing && field.value === "root"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="ノードのタイプを選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {!parentNode && (
                    <SelectItem value="root">ルート</SelectItem>
                  )}
                  <SelectItem value="concept">概念</SelectItem>
                  <SelectItem value="keyword">キーワード</SelectItem>
                  <SelectItem value="tool">ツール</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>色</FormLabel>
          <div className="flex flex-col space-y-2">
            <HexColorPicker color={color} onChange={setColor} />
            <HexColorInput
              color={color}
              onChange={setColor}
              className="border p-2 rounded-md"
              prefixed
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEditing ? "更新" : "作成"}
          </Button>
        </div>
      </form>
    </Form>
  );
}