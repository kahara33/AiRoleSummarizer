import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Building2 } from 'lucide-react';

// 組織設定フォームのスキーマ
const organizationFormSchema = z.object({
  name: z.string().min(2, '組織名は2文字以上で入力してください'),
  description: z.string().optional(),
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

const OrganizationSettings: React.FC = () => {
  const { toast } = useToast();

  // 組織情報を取得
  const { data: organization, isLoading } = useQuery({
    queryKey: ['/api/organization'],
    queryFn: async () => {
      const response = await fetch('/api/organization');
      if (!response.ok) {
        throw new Error('組織情報の取得に失敗しました');
      }
      return response.json();
    },
  });

  // 組織設定フォーム
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // 組織データを取得したらフォームに設定
  React.useEffect(() => {
    if (organization) {
      form.reset({
        name: organization.name || '',
        description: organization.description || '',
      });
    }
  }, [organization, form]);

  // 組織情報更新ミューテーション
  const updateOrgMutation = useMutation({
    mutationFn: async (data: OrganizationFormValues) => {
      const response = await apiRequest('PATCH', '/api/organization', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '組織情報の更新に失敗しました');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organization'] });
      toast({
        title: '更新完了',
        description: '組織情報が正常に更新されました',
      });
    },
    onError: (error) => {
      toast({
        title: '更新エラー',
        description: error instanceof Error ? error.message : '不明なエラーが発生しました',
        variant: 'destructive',
      });
    },
  });

  // 組織新規作成ミューテーション
  const createOrgMutation = useMutation({
    mutationFn: async (data: OrganizationFormValues) => {
      const response = await apiRequest('POST', '/api/organization', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '組織の作成に失敗しました');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organization'] });
      toast({
        title: '作成完了',
        description: '組織が正常に作成されました',
      });
    },
    onError: (error) => {
      toast({
        title: '作成エラー',
        description: error instanceof Error ? error.message : '不明なエラーが発生しました',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: OrganizationFormValues) => {
    if (organization) {
      updateOrgMutation.mutate(data);
    } else {
      createOrgMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            <span>組織情報</span>
          </CardTitle>
          <CardDescription>
            組織の基本情報を設定します
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>組織名</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                        {...field}
                        rows={3}
                        placeholder="組織の説明を入力してください（任意）"
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={updateOrgMutation.isPending || createOrgMutation.isPending}
              >
                {(updateOrgMutation.isPending || createOrgMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {organization ? '更新中...' : '作成中...'}
                  </>
                ) : (
                  organization ? '変更を保存' : '組織を作成'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrganizationSettings;