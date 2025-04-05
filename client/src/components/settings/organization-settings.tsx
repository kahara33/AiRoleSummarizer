import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, PlusCircle, Pencil } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

// 組織フォームのスキーマ定義
const organizationFormSchema = z.object({
  name: z.string().min(2, { message: '組織名は2文字以上で入力してください' }),
  description: z.string().optional(),
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

type Company = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  users?: { id: string; name: string; email: string; role: string }[];
};

const OrganizationSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // フォーム定義
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // 組織一覧取得クエリ
  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/companies');
      if (!res.ok) {
        throw new Error('組織情報の取得に失敗しました');
      }
      return res.json();
    },
  });

  // 組織作成/更新ミューテーション
  const organizationMutation = useMutation({
    mutationFn: async (data: OrganizationFormValues) => {
      let res;
      
      if (editingCompany) {
        // 更新
        res = await apiRequest('PUT', `/api/companies/${editingCompany.id}`, data);
      } else {
        // 新規作成
        res = await apiRequest('POST', '/api/companies', data);
      }
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '組織の保存に失敗しました');
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setIsDialogOpen(false);
      setEditingCompany(null);
      form.reset();
      
      toast({
        title: '保存完了',
        description: `組織情報を${editingCompany ? '更新' : '作成'}しました`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: '保存エラー',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 編集ダイアログを開く
  const openEditDialog = (company: Company) => {
    setEditingCompany(company);
    form.reset({
      name: company.name,
      description: company.description || '',
    });
    setIsDialogOpen(true);
  };

  // 新規作成ダイアログを開く
  const openCreateDialog = () => {
    setEditingCompany(null);
    form.reset({
      name: '',
      description: '',
    });
    setIsDialogOpen(true);
  };

  // フォーム送信
  const onSubmit = (data: OrganizationFormValues) => {
    organizationMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold mb-4">組織一覧</h2>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              新規組織
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCompany ? '組織情報編集' : '新規組織作成'}</DialogTitle>
              <DialogDescription>
                {editingCompany 
                  ? '組織情報を編集します。' 
                  : '新しい組織を作成します。組織ごとにユーザーとロールモデルを管理できます。'}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>組織名</FormLabel>
                      <FormControl>
                        <Input placeholder="組織名" {...field} />
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
                        <Input placeholder="組織の説明" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit" disabled={organizationMutation.isPending}>
                    {organizationMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingCompany ? '更新' : '作成'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !companies || companies.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          組織が登録されていません
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>組織名</TableHead>
              <TableHead>説明</TableHead>
              <TableHead>作成日</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell>{company.description || '-'}</TableCell>
                <TableCell>{new Date(company.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openEditDialog(company)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">編集</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default OrganizationSettings;