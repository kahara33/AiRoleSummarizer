import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Play, Power, PenLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { CollectionPlan } from '@shared/schema';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { CollectionPlanDialog } from './collection-plan-dialog';
import { useToast } from '@/hooks/use-toast';

interface CollectionPlanPanelProps {
  onSelectPlan: (planId: string | null) => void;
  selectedPlanId: string | null;
}

export function CollectionPlanPanel({
  onSelectPlan,
  selectedPlanId
}: CollectionPlanPanelProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { data: plans, isLoading } = useQuery({
    queryKey: ['/api/collection-plans'],
    enabled: true,
  });
  
  const activateMutation = useMutation({
    mutationFn: async (planId: string) => {
      await apiRequest('PATCH', `/api/collection-plans/${planId}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collection-plans'] });
      toast({
        title: 'プランを有効化しました',
        description: '情報収集プランが有効化されました。',
      });
    },
    onError: (error) => {
      toast({
        title: 'エラー',
        description: 'プランの有効化に失敗しました。',
        variant: 'destructive',
      });
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: async (planId: string) => {
      await apiRequest('PATCH', `/api/collection-plans/${planId}/deactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collection-plans'] });
      toast({
        title: 'プランを無効化しました',
        description: '情報収集プランが無効化されました。',
      });
    },
    onError: (error) => {
      toast({
        title: 'エラー',
        description: 'プランの無効化に失敗しました。',
        variant: 'destructive',
      });
    }
  });
  
  const executeMutation = useMutation({
    mutationFn: async (planId: string) => {
      await apiRequest('POST', `/api/collection-plans/${planId}/execute`);
    },
    onSuccess: () => {
      toast({
        title: '実行開始',
        description: '情報収集プランの実行を開始しました。',
      });
    },
    onError: (error) => {
      toast({
        title: 'エラー',
        description: 'プランの実行に失敗しました。',
        variant: 'destructive',
      });
    }
  });
  
  const handleCreatePlan = () => {
    setEditingPlanId(null);
    setIsDialogOpen(true);
  };
  
  const handleEditPlan = (planId: string) => {
    setEditingPlanId(planId);
    setIsDialogOpen(true);
  };

  const handleToggleActivation = (plan: CollectionPlan) => {
    if (plan.isActive) {
      deactivateMutation.mutate(plan.id);
    } else {
      activateMutation.mutate(plan.id);
    }
  };
  
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">情報収集プラン</h2>
        <Button onClick={handleCreatePlan} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          新規プラン作成
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-20">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : plans?.length === 0 ? (
        <div className="text-center p-6 bg-muted/50 rounded-lg">
          <p className="text-muted-foreground">情報収集プランがありません。新しいプランを作成してください。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-x-auto pb-2">
          {plans?.map((plan: CollectionPlan) => (
            <Card 
              key={plan.id}
              className={`w-full cursor-pointer hover:border-primary/50 transition-colors ${
                plan.id === selectedPlanId ? 'border-primary' : ''
              }`}
              onClick={() => onSelectPlan(plan.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base truncate">{plan.title}</CardTitle>
                  <Badge variant={plan.isActive ? "default" : "outline"}>
                    {plan.isActive ? "アクティブ" : "非アクティブ"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-2 text-sm">
                <div className="mb-2">
                  <div className="text-muted-foreground text-xs">頻度:</div>
                  <div>{plan.frequency === 'daily' ? '1日1回' : plan.frequency}</div>
                </div>
                <div className="mb-2">
                  <div className="text-muted-foreground text-xs">ツール:</div>
                  <div className="flex flex-wrap gap-1">
                    {plan.toolsConfig?.enabledTools?.map((tool: string) => (
                      <Badge key={tool} variant="secondary" className="text-xs">
                        {tool === 'google_search' ? 'Google検索' : 
                         tool === 'rss_feed' ? 'RSSフィード' : tool}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <div className="flex justify-between w-full">
                  <div className="flex items-center gap-0.5">
                    <Switch 
                      checked={plan.isActive}
                      onCheckedChange={() => handleToggleActivation(plan)}
                      aria-label={plan.isActive ? "無効化" : "有効化"}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleEditPlan(plan.id); 
                      }}
                    >
                      <PenLine className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        executeMutation.mutate(plan.id); 
                      }}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      <CollectionPlanDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        planId={editingPlanId}
      />
    </div>
  );
}