import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KnowledgeNode, KnowledgeEdge, insertKnowledgeEdgeSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface KnowledgeEdgeFormProps {
  roleModelId: string;
  sourceNode?: KnowledgeNode;
  edge?: KnowledgeEdge;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const formSchema = insertKnowledgeEdgeSchema.extend({
  sourceId: z.string().min(1, "ソースノードを選択してください"),
  targetId: z.string().min(1, "ターゲットノードを選択してください"),
  label: z.string().optional(),
  strength: z.number().min(1).max(10).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function KnowledgeEdgeForm({
  roleModelId,
  sourceNode,
  edge,
  onSuccess,
  onCancel,
}: KnowledgeEdgeFormProps) {
  const { toast } = useToast();
  const isEditing = !!edge;
  const [strength, setStrength] = useState<number>(edge?.strength || 1);

  // Fetch all knowledge nodes for the role model
  const { data: nodes = [], isLoading: isLoadingNodes } = useQuery({
    queryKey: [`/api/role-models/${roleModelId}/knowledge-nodes`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/role-models/${roleModelId}/knowledge-nodes`);
      return await res.json() as KnowledgeNode[];
    }
  });

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceId: edge?.sourceId || sourceNode?.id || "",
      targetId: edge?.targetId || "",
      label: edge?.label || "RELATED_TO",
      strength: edge?.strength || 1,
      roleModelId,
    },
  });

  // Watch source and target IDs to prevent self-connections
  const sourceId = form.watch("sourceId");
  
  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await apiRequest(
        "POST",
        `/api/role-models/${roleModelId}/knowledge-edges`,
        values
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/role-models/${roleModelId}/knowledge-edges`] });
      toast({
        title: "成功",
        description: "知識エッジが作成されました",
      });
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      console.error("Error creating knowledge edge:", error);
      toast({
        title: "エラー",
        description: "知識エッジの作成に失敗しました",
        variant: "destructive",
      });
    },
  });

  // Update form values when sourceNode changes
  useEffect(() => {
    if (sourceNode && !isEditing) {
      form.setValue("sourceId", sourceNode.id);
    }
  }, [sourceNode, form, isEditing]);

  const onSubmit = (values: FormValues) => {
    // Include strength value from state
    const dataToSubmit = {
      ...values,
      strength,
    };
    
    createMutation.mutate(dataToSubmit);
  };

  if (isLoadingNodes) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const availableSourceNodes = nodes;
  const availableTargetNodes = nodes.filter(node => node.id !== sourceId);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="sourceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ソースノード</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={!!sourceNode || isEditing}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="ソースノードを選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableSourceNodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name} ({node.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="targetId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ターゲットノード</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isEditing}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="ターゲットノードを選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableTargetNodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      {node.name} ({node.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>関係ラベル</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value || "RELATED_TO"}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="関係の種類を選択" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="RELATED_TO">関連あり</SelectItem>
                  <SelectItem value="DEPENDS_ON">依存関係</SelectItem>
                  <SelectItem value="USED_BY">利用される</SelectItem>
                  <SelectItem value="SIMILAR_TO">類似</SelectItem>
                  <SelectItem value="OPPOSITE_OF">対照的</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>関係の強さ (1-10): {strength}</FormLabel>
          <Slider
            defaultValue={[edge?.strength || 1]}
            max={10}
            min={1}
            step={1}
            value={[strength]}
            onValueChange={(values) => setStrength(values[0])}
          />
        </FormItem>

        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={createMutation.isPending}
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            作成
          </Button>
        </div>
      </form>
    </Form>
  );
}