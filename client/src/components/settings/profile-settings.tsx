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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Loader2, User } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

// プロフィールフォームのスキーマ
const profileFormSchema = z.object({
  name: z.string().min(2, '名前は2文字以上で入力してください'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  currentPassword: z.string().min(1, '現在のパスワードを入力してください'),
  newPassword: z.string().min(6, 'パスワードは6文字以上で入力してください').optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && data.newPassword !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: '新しいパスワードと確認用パスワードが一致しません',
  path: ['confirmPassword'],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const ProfileSettings: React.FC = () => {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  
  // プロフィールフォーム
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // ユーザー情報を取得したらフォームに設定
  React.useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [user, form]);

  // プロフィール更新ミューテーション
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const response = await apiRequest('PATCH', '/api/profile', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'プロフィールの更新に失敗しました');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      form.reset({
        ...form.getValues(),
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast({
        title: '更新完了',
        description: 'プロフィール情報が正常に更新されました',
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

  const onSubmit = async (data: ProfileFormValues) => {
    // パスワード変更なしの場合は関連フィールドを削除
    if (!data.newPassword) {
      const { newPassword, confirmPassword, ...profileData } = data;
      updateProfileMutation.mutate(profileData);
    } else {
      updateProfileMutation.mutate(data);
    }
  };

  if (authLoading) {
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
            <User className="h-5 w-5" />
            <span>プロフィール情報</span>
          </CardTitle>
          <CardDescription>
            個人プロフィール情報とパスワードを設定します
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
                    <FormLabel>名前</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メールアドレス</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <hr className="my-6" />
              
              <h3 className="text-lg font-medium mb-4">パスワード変更</h3>

              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>現在のパスワード</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新しいパスワード (変更する場合のみ)</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新しいパスワード (確認)</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    更新中...
                  </>
                ) : (
                  '変更を保存'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSettings;