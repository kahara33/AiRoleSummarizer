import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SaveIcon, Loader2 } from "lucide-react";
import { IndustrySubcategory } from "@shared/schema";

interface SaveIndustryCombinationProps {
  selectedIndustryIds: string[];
  disabled?: boolean;
}

export default function SaveIndustryCombination({ 
  selectedIndustryIds,
  disabled = false
}: SaveIndustryCombinationProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 業界サブカテゴリの取得
  const { data: subcategories = [] } = useQuery({
    queryKey: ["/api/industry-subcategories"],
    staleTime: 60 * 60 * 1000, // 1時間キャッシュ
  });

  // 選択された業界名を取得
  const getSelectedIndustryNames = () => {
    return subcategories
      .filter((sub: IndustrySubcategory) => selectedIndustryIds.includes(sub.id))
      .map((sub: IndustrySubcategory) => sub.name);
  };

  // 業界組み合わせ保存のミューテーション
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/industry-combinations", {
        name,
        industryIds: selectedIndustryIds
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "保存しました",
        description: "業界組み合わせを保存しました。",
      });
      setOpen(false);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/api/industry-combinations"] });
    },
    onError: (error) => {
      toast({
        title: "エラーが発生しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!name.trim()) {
      toast({
        title: "名前を入力してください",
        variant: "destructive",
      });
      return;
    }
    
    saveMutation.mutate();
  };

  // 選択された業界の名前リスト
  const selectedIndustryNames = getSelectedIndustryNames();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          disabled={disabled || selectedIndustryIds.length === 0}
          className="gap-2"
        >
          <SaveIcon className="h-4 w-4" />
          <span>よく使う組み合わせとして保存</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>業界組み合わせを保存</DialogTitle>
          <DialogDescription>
            この業界の組み合わせに名前をつけて保存します。
            後で簡単に同じ組み合わせを選択できるようになります。
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">組み合わせ名</p>
            <Input
              placeholder="例: 自動車・エレクトロニクス業界"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium">選択されている業界 ({selectedIndustryIds.length}件)</p>
            <div className="text-sm max-h-[200px] overflow-y-auto p-2 border rounded-md">
              {selectedIndustryNames.length > 0 ? (
                <ul className="list-disc list-inside space-y-1">
                  {selectedIndustryNames.map((name, index) => (
                    <li key={index}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">業界が選択されていません</p>
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}