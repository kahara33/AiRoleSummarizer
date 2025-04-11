import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Clock, File, ExternalLink, Tag, Trash2, Edit, Plus, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { addSocketListener, removeSocketListener, requestInformationPlans, saveInformationPlan, deleteInformationPlan } from '@/lib/socket';
import { apiRequest } from '@/lib/queryClient';

// 情報収集プランの型定義
interface InformationPlan {
  id: string;
  roleModelId: string;
  title: string;
  description?: string;
  content: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  order?: number;
  tags?: string[];
  status?: string;
  priority?: string;
  metaData?: Record<string, any>;
}

interface InformationPlanListProps {
  roleModelId: string;
  onPlanSelect?: (plan: InformationPlan) => void;
}

export default function InformationPlanList({ roleModelId, onPlanSelect }: InformationPlanListProps) {
  const [plans, setPlans] = useState<InformationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<InformationPlan | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    content: '',
    tags: ''
  });
  const { toast } = useToast();

  // プランデータの取得
  const fetchPlans = async () => {
    setLoading(true);
    try {
      const response = await apiRequest('GET', `/api/role-models/${roleModelId}/information-collection-plans`);
      if (response.ok) {
        const data = await response.json();
        console.log('情報収集プラン取得成功:', data);
        setPlans(data);
      } else {
        console.error('情報収集プラン取得エラー:', response.statusText);
        toast({
          title: 'エラー',
          description: '情報収集プランの取得に失敗しました',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('情報収集プラン取得例外:', error);
      toast({
        title: 'エラー',
        description: '情報収集プランの取得に失敗しました',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // WebSocketリスナー設定とプラン取得
  useEffect(() => {
    if (!roleModelId) return;

    // 情報収集プランのリスナー
    const handlePlanUpdate = (data: any) => {
      console.log('情報収集プラン更新を受信:', data);
      
      // プランの全体更新
      if (data.plans && Array.isArray(data.plans)) {
        setPlans(data.plans);
        return;
      }
      
      // 単一プランの更新
      if (data.plan) {
        const updateType = data.updateType || 'update';
        
        if (updateType === 'delete') {
          // 削除更新
          setPlans(prev => prev.filter(p => p.id !== data.plan.id));
        } else if (updateType === 'create' || updateType === 'update') {
          // 作成または更新
          setPlans(prev => {
            const exists = prev.some(p => p.id === data.plan.id);
            if (exists) {
              // 既存プランの更新
              return prev.map(p => p.id === data.plan.id ? data.plan : p);
            } else {
              // 新規プランの追加
              return [...prev, data.plan];
            }
          });
        }
      }
    };

    // WebSocketリスナーの登録
    addSocketListener('information_plans', handlePlanUpdate);
    addSocketListener('information_plan_update', handlePlanUpdate);
    
    // サーバーからプラン取得リクエスト
    requestInformationPlans(roleModelId);
    
    // APIからもプラン取得
    fetchPlans();

    return () => {
      // クリーンアップ
      removeSocketListener('information_plans', handlePlanUpdate);
      removeSocketListener('information_plan_update', handlePlanUpdate);
    };
  }, [roleModelId]);

  // プラン選択処理
  const handleSelectPlan = (plan: InformationPlan) => {
    setSelectedPlan(plan);
    if (onPlanSelect) {
      onPlanSelect(plan);
    }
  };

  // プラン編集ダイアログを開く
  const handleEditPlan = (plan: InformationPlan) => {
    setSelectedPlan(plan);
    setEditForm({
      title: plan.title,
      description: plan.description || '',
      content: plan.content || '',
      tags: plan.tags ? plan.tags.join(', ') : ''
    });
    setIsEditDialogOpen(true);
  };

  // プラン保存処理
  const handleSavePlan = async () => {
    if (!selectedPlan) return;
    
    try {
      const tagArray = editForm.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag);
      
      const updatedPlan = {
        ...selectedPlan,
        title: editForm.title,
        description: editForm.description,
        content: editForm.content,
        tags: tagArray
      };
      
      // WebSocket経由で保存
      saveInformationPlan(roleModelId, updatedPlan);
      
      // APIでも保存
      const response = await apiRequest(
        'PUT', 
        `/api/role-models/${roleModelId}/information-collection-plans/${selectedPlan.id}`,
        updatedPlan
      );
      
      if (response.ok) {
        toast({
          title: '保存完了',
          description: '情報収集プランを保存しました',
        });
        setIsEditDialogOpen(false);
        
        // 最新データの取得
        fetchPlans();
      } else {
        throw new Error('API保存に失敗しました');
      }
    } catch (error) {
      console.error('プラン保存エラー:', error);
      toast({
        title: 'エラー',
        description: 'プランの保存に失敗しました',
        variant: 'destructive',
      });
    }
  };

  // プラン削除処理
  const handleDeletePlan = async (plan: InformationPlan) => {
    if (!confirm(`「${plan.title}」を削除してもよろしいですか？`)) return;
    
    try {
      // WebSocket経由で削除
      deleteInformationPlan(roleModelId, plan.id);
      
      // APIでも削除
      const response = await apiRequest(
        'DELETE', 
        `/api/role-models/${roleModelId}/information-collection-plans/${plan.id}`
      );
      
      if (response.ok) {
        toast({
          title: '削除完了',
          description: '情報収集プランを削除しました',
        });
        
        // 状態から削除
        setPlans(prev => prev.filter(p => p.id !== plan.id));
        
        // 選択中だった場合は選択解除
        if (selectedPlan?.id === plan.id) {
          setSelectedPlan(null);
        }
      } else {
        throw new Error('API削除に失敗しました');
      }
    } catch (error) {
      console.error('プラン削除エラー:', error);
      toast({
        title: 'エラー',
        description: 'プランの削除に失敗しました',
        variant: 'destructive',
      });
    }
  };

  // 日付フォーマット
  const formatDate = (dateString: string | Date) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '日付なし';
    }
  };

  // 優先度に応じたバッジの色
  const getPriorityColor = (priority: string = 'medium') => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 hover:bg-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 hover:bg-green-200';
      default: return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    }
  };

  // ローディング表示
  if (loading && plans.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-gray-500">情報収集プランを読み込み中...</p>
      </div>
    );
  }

  // プランがない場合
  if (!loading && plans.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-full p-4">
        <p className="text-gray-500 mb-4">情報収集プランがありません</p>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          新規プラン作成
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 px-2">
        <h3 className="text-lg font-semibold">情報収集プラン</h3>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          新規作成
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-2">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`cursor-pointer hover:shadow-md transition-shadow ${selectedPlan?.id === plan.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => handleSelectPlan(plan)}
            >
              <CardHeader className="p-3 pb-1">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base font-medium">{plan.title}</CardTitle>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEditPlan(plan); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-xs line-clamp-2">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="flex items-center text-xs text-gray-500 mb-1">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>{formatDate(plan.createdAt)}</span>
                </div>
                {plan.tags && plan.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {plan.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs py-0 h-5">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {plan.priority && (
                  <Badge variant="outline" className={`mt-1 text-xs ${getPriorityColor(plan.priority)}`}>
                    {plan.priority === 'high' ? '優先度: 高' : 
                     plan.priority === 'medium' ? '優先度: 中' : 
                     plan.priority === 'low' ? '優先度: 低' : plan.priority}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {/* 編集ダイアログ */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>情報収集プランの編集</DialogTitle>
            <DialogDescription>
              情報収集プランの詳細を編集してください
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="title" className="text-right">タイトル</Label>
              <Input
                id="title"
                value={editForm.title}
                onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="description" className="text-right">説明</Label>
              <Textarea
                id="description"
                value={editForm.description}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                className="col-span-3"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-4 items-start gap-2">
              <Label htmlFor="content" className="text-right mt-2">内容</Label>
              <Textarea
                id="content"
                value={editForm.content}
                onChange={(e) => setEditForm({...editForm, content: e.target.value})}
                className="col-span-3"
                rows={6}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="tags" className="text-right">タグ</Label>
              <Input
                id="tags"
                value={editForm.tags}
                onChange={(e) => setEditForm({...editForm, tags: e.target.value})}
                className="col-span-3"
                placeholder="カンマ区切りでタグを入力"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSavePlan}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}