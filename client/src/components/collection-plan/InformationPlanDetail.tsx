import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Edit, ExternalLink, Download, Link, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { saveInformationPlan } from '@/lib/socket';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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

interface InformationPlanDetailProps {
  plan: InformationPlan | null;
  roleModelId: string;
  onPlanUpdate?: (plan: InformationPlan) => void;
}

export default function InformationPlanDetail({ plan, roleModelId, onPlanUpdate }: InformationPlanDetailProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: plan?.title || '',
    description: plan?.description || '',
    content: plan?.content || '',
    tags: plan?.tags ? plan?.tags.join(', ') : ''
  });
  const { toast } = useToast();

  // 編集ダイアログを開く
  const handleOpenEditDialog = () => {
    if (!plan) return;
    
    setEditForm({
      title: plan.title,
      description: plan.description || '',
      content: plan.content,
      tags: plan.tags ? plan.tags.join(', ') : '',
    });
    
    setIsEditDialogOpen(true);
  };

  // プラン保存処理
  const handleSavePlan = async () => {
    if (!plan) return;
    
    try {
      const tagArray = editForm.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag);
      
      const updatedPlan = {
        ...plan,
        title: editForm.title,
        description: editForm.description,
        content: editForm.content,
        tags: tagArray,
        updatedAt: new Date().toISOString()
      };
      
      // WebSocket経由で保存
      saveInformationPlan(roleModelId, updatedPlan);
      
      // APIでも保存
      const response = await apiRequest(
        'PUT', 
        `/api/role-models/${roleModelId}/information-collection-plans/${plan.id}`,
        updatedPlan
      );
      
      if (response.ok) {
        toast({
          title: '保存完了',
          description: '情報収集プランを保存しました',
        });
        setIsEditDialogOpen(false);
        
        // 親コンポーネントに更新を通知
        if (onPlanUpdate) {
          onPlanUpdate(updatedPlan);
        }
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

  // プランをエクスポート
  const handleExportPlan = () => {
    if (!plan) return;
    
    try {
      // JSONとして整形
      const planJson = JSON.stringify(plan, null, 2);
      
      // Blobを作成
      const blob = new Blob([planJson], { type: 'application/json' });
      
      // ダウンロードリンクを作成
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plan.title.replace(/\s+/g, '_')}_plan.json`;
      document.body.appendChild(a);
      a.click();
      
      // クリーンアップ
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      
      toast({
        title: 'エクスポート完了',
        description: 'プランをJSONファイルとしてダウンロードしました',
      });
    } catch (error) {
      console.error('エクスポートエラー:', error);
      toast({
        title: 'エラー',
        description: 'プランのエクスポートに失敗しました',
        variant: 'destructive',
      });
    }
  };

  // マークダウンを簡易レンダリング（改行やリンク変換）
  const renderMarkdown = (text: string) => {
    // URLを検出してリンクに変換
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const withLinks = text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">${url}</a>`;
    });
    
    // 改行を<br>タグに変換
    const withLineBreaks = withLinks.replace(/\n/g, '<br>');
    
    return { __html: withLineBreaks };
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

  // プランがない場合の表示
  if (!plan) {
    return (
      <div className="flex flex-col justify-center items-center h-full p-4">
        <p className="text-gray-500">情報収集プランが選択されていません</p>
        <p className="text-gray-400 text-sm mt-2">左側のリストからプランを選択してください</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex justify-between items-center p-3 border-b">
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{plan.title}</h2>
          <div className="flex items-center text-sm text-gray-500">
            <Calendar className="h-4 w-4 mr-1" />
            <span>{formatDate(plan.updatedAt || plan.createdAt)}</span>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={handleExportPlan}>
            <Download className="h-4 w-4 mr-1" />
            エクスポート
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
            <Edit className="h-4 w-4 mr-1" />
            編集
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="content" className="flex-1 flex flex-col">
        <TabsList className="px-3 pt-2">
          <TabsTrigger value="content">内容</TabsTrigger>
          <TabsTrigger value="meta">詳細情報</TabsTrigger>
        </TabsList>
        
        <TabsContent value="content" className="flex-1 flex flex-col m-0 p-0">
          <ScrollArea className="flex-1">
            <div className="p-4">
              {plan.description && (
                <div className="mb-4 bg-gray-50 rounded-md p-3 text-sm text-gray-700">
                  {plan.description}
                </div>
              )}
              
              <div className="text-sm">
                {plan.content ? (
                  <div dangerouslySetInnerHTML={renderMarkdown(plan.content)} />
                ) : (
                  <p className="text-gray-500 italic">コンテンツがありません</p>
                )}
              </div>
              
              {plan.tags && plan.tags.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium mb-2">タグ</h4>
                  <div className="flex flex-wrap gap-1">
                    {plan.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="meta" className="flex-1 m-0 p-0">
          <ScrollArea className="flex-1">
            <div className="p-4">
              <h4 className="text-sm font-medium mb-2">メタデータ</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-1 text-sm">
                  <div className="text-gray-500">ID:</div>
                  <div className="col-span-2 break-all">{plan.id}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-1 text-sm">
                  <div className="text-gray-500">ロールモデルID:</div>
                  <div className="col-span-2 break-all">{plan.roleModelId}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-1 text-sm">
                  <div className="text-gray-500">作成日時:</div>
                  <div className="col-span-2">{formatDate(plan.createdAt)}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-1 text-sm">
                  <div className="text-gray-500">更新日時:</div>
                  <div className="col-span-2">{formatDate(plan.updatedAt)}</div>
                </div>
                
                <div className="grid grid-cols-3 gap-1 text-sm">
                  <div className="text-gray-500">優先度:</div>
                  <div className="col-span-2">
                    {plan.priority === 'high' ? '高' : 
                     plan.priority === 'medium' ? '中' : 
                     plan.priority === 'low' ? '低' : plan.priority || '未設定'}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-1 text-sm">
                  <div className="text-gray-500">ステータス:</div>
                  <div className="col-span-2">
                    {plan.status === 'active' ? 'アクティブ' : 
                     plan.status === 'completed' ? '完了' : 
                     plan.status === 'archived' ? 'アーカイブ' : plan.status || '未設定'}
                  </div>
                </div>
                
                {plan.metaData && Object.keys(plan.metaData).length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">追加情報</h4>
                    <pre className="bg-gray-50 rounded-md p-3 text-xs overflow-x-auto">
                      {JSON.stringify(plan.metaData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

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