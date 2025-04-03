import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { USER_ROLES } from '@shared/schema';
import { Loader2 } from 'lucide-react';

// スキーマ定義
const organizationFormSchema = z.object({
  name: z.string().min(2, { message: '組織名は2文字以上で入力してください' }),
  description: z.string().optional(),
});

const addUserFormSchema = z.object({
  name: z.string().min(2, { message: '名前は2文字以上で入力してください' }),
  email: z.string().email({ message: '有効なメールアドレスを入力してください' }),
  password: z.string().min(8, { message: 'パスワードは8文字以上で入力してください' }),
  role: z.enum([USER_ROLES.COMPANY_ADMIN, USER_ROLES.COMPANY_USER]),
});

// 型定義
type Company = {
  id: string;
  name: string;
  description: string | null;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
};

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;
type AddUserFormValues = z.infer<typeof addUserFormSchema>;

export default function OrganizationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedOrg, setSelectedOrg] = useState<Company | null>(null);
  const [isOrgFormOpen, setIsOrgFormOpen] = useState(false);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // 組織フォーム
  const orgForm = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  // ユーザー追加フォーム
  const userForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: USER_ROLES.COMPANY_USER,
    },
  });

  // 組織一覧を取得
  const { 
    data: companies = [], 
    isLoading: isLoadingCompanies 
  } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: user?.role === USER_ROLES.SYSTEM_ADMIN,
  });

  // 組織に所属するユーザー一覧を取得
  const { 
    data: users = [], 
    isLoading: isLoadingUsers 
  } = useQuery<User[]>({
    queryKey: ['/api/companies', selectedOrg?.id, 'users'],
    enabled: !!selectedOrg,
    // 応答データが有効なユーザーデータであることを確認
    select: (data) => data.filter(
      user => typeof user.name === 'string' && typeof user.email === 'string'
    )
  });

  // 組織作成ミューテーション
  const createOrgMutation = useMutation({
    mutationFn: async (data: OrganizationFormValues) => {
      const res = await apiRequest('POST', '/api/companies', data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: '組織を作成しました',
        description: '新しい組織を作成しました。',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setIsOrgFormOpen(false);
      orgForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: '組織の作成に失敗しました',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 組織更新ミューテーション
  const updateOrgMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: OrganizationFormValues }) => {
      const res = await apiRequest('PUT', `/api/companies/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: '組織を更新しました',
        description: '組織情報を更新しました。',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setIsOrgFormOpen(false);
      orgForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: '組織の更新に失敗しました',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 組織削除ミューテーション
  const deleteOrgMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/companies/${id}`);
    },
    onSuccess: () => {
      toast({
        title: '組織を削除しました',
        description: '組織を削除しました。',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      setSelectedOrg(null);
    },
    onError: (error: Error) => {
      toast({
        title: '組織の削除に失敗しました',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // ユーザー追加ミューテーション
  const addUserMutation = useMutation({
    mutationFn: async (data: AddUserFormValues) => {
      if (!selectedOrg) throw new Error('組織が選択されていません');
      const res = await apiRequest('POST', `/api/companies/${selectedOrg.id}/users`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'ユーザーを追加しました',
        description: '新しいユーザーを組織に追加しました。',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', selectedOrg?.id, 'users'] });
      setIsUserFormOpen(false);
      userForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'ユーザーの追加に失敗しました',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 組織作成・更新フォームの送信処理
  const handleCreateOrgSubmit = (data: OrganizationFormValues) => {
    createOrgMutation.mutate(data);
  };

  const handleUpdateOrgSubmit = (data: OrganizationFormValues) => {
    if (!selectedOrg) return;
    updateOrgMutation.mutate({ id: selectedOrg.id, data });
  };

  // 編集ボタンのハンドラ
  const handleEditClick = (org: Company) => {
    setSelectedOrg(org);
    orgForm.reset({
      name: org.name,
      description: org.description || '',
    });
    setIsEditMode(true);
    setIsOrgFormOpen(true);
  };

  // 削除ボタンのハンドラ
  const handleDeleteClick = (org: Company) => {
    if (confirm(`本当に「${org.name}」を削除しますか？`)) {
      deleteOrgMutation.mutate(org.id);
    }
  };

  // 組織選択ハンドラ
  const handleOrgSelect = (org: Company) => {
    setSelectedOrg(org);
  };

  // ユーザー追加フォームの送信処理
  const handleAddUserSubmit = (data: AddUserFormValues) => {
    addUserMutation.mutate(data);
  };

  // 現在のユーザーのロールが表示用に変換
  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case USER_ROLES.SYSTEM_ADMIN:
        return 'システム管理者';
      case USER_ROLES.COMPANY_ADMIN:
        return '組織管理者';
      case USER_ROLES.COMPANY_USER:
        return '組織ユーザー';
      case USER_ROLES.INDIVIDUAL_USER:
        return '個人ユーザー';
      default:
        return role;
    }
  };

  // システム管理者でない場合はアクセス権限がないことを表示
  if (user && user.role !== USER_ROLES.SYSTEM_ADMIN && user.role !== USER_ROLES.COMPANY_ADMIN) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>アクセス権限がありません</CardTitle>
            <CardDescription>
              この機能にアクセスするには、システム管理者または組織管理者の権限が必要です。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">組織管理</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 左側: 組織一覧 */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>組織一覧</CardTitle>
              <CardDescription>
                {user?.role === USER_ROLES.SYSTEM_ADMIN ? 
                  'すべての組織を管理できます' : 
                  'あなたが管理する組織を表示しています'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingCompanies ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {companies.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">組織がありません</p>
                  ) : (
                    companies.map((company) => (
                      <div
                        key={company.id}
                        className={`p-3 rounded-md cursor-pointer ${
                          selectedOrg?.id === company.id
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => handleOrgSelect(company)}
                      >
                        <h3 className="font-medium">{company.name}</h3>
                        {company.description && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">{company.description}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter>
              {user?.role === USER_ROLES.SYSTEM_ADMIN && (
                <Button
                  onClick={() => {
                    setIsEditMode(false);
                    orgForm.reset({ name: '', description: '' });
                    setIsOrgFormOpen(true);
                  }}
                  className="w-full"
                >
                  新しい組織を作成
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* 右側: 選択した組織の詳細とユーザー一覧 */}
        <div className="md:col-span-2">
          {selectedOrg ? (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>{selectedOrg.name}</CardTitle>
                  <CardDescription>{selectedOrg.description}</CardDescription>
                </div>
                {user?.role === USER_ROLES.SYSTEM_ADMIN && (
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={() => handleEditClick(selectedOrg)}>
                      編集
                    </Button>
                    <Button variant="destructive" onClick={() => handleDeleteClick(selectedOrg)}>
                      削除
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="users">
                  <TabsList className="mb-4">
                    <TabsTrigger value="users">ユーザー</TabsTrigger>
                    <TabsTrigger value="settings">設定</TabsTrigger>
                  </TabsList>

                  <TabsContent value="users">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium">ユーザー一覧</h3>
                        <Button
                          onClick={() => {
                            userForm.reset({
                              name: '',
                              email: '',
                              password: '',
                              role: USER_ROLES.COMPANY_USER,
                            });
                            setIsUserFormOpen(true);
                          }}
                        >
                          ユーザーを追加
                        </Button>
                      </div>

                      {isLoadingUsers ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>名前</TableHead>
                                <TableHead>メールアドレス</TableHead>
                                <TableHead>役割</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {users.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    ユーザーがいません
                                  </TableCell>
                                </TableRow>
                              ) : (
                                users.map((user) => (
                                  <TableRow key={user.id}>
                                    <TableCell>{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                      <Badge variant={user.role === USER_ROLES.COMPANY_ADMIN ? 'default' : 'outline'}>
                                        {getRoleDisplayName(user.role)}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="settings">
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">組織設定</h3>
                      <p className="text-muted-foreground">
                        組織の設定と詳細情報を管理します。
                      </p>
                      {/* 将来的に追加設定があればここに */}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>組織を選択してください</CardTitle>
                <CardDescription>
                  左側のリストから組織を選択すると、詳細情報が表示されます。
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>

      {/* 組織作成・編集ダイアログ */}
      <Dialog open={isOrgFormOpen} onOpenChange={setIsOrgFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditMode ? '組織を編集' : '新しい組織を作成'}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? '組織情報を編集してください。'
                : '新しい組織の情報を入力してください。'}
            </DialogDescription>
          </DialogHeader>

          <Form {...orgForm}>
            <form
              onSubmit={orgForm.handleSubmit(isEditMode ? handleUpdateOrgSubmit : handleCreateOrgSubmit)}
              className="space-y-4"
            >
              <FormField
                control={orgForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>組織名</FormLabel>
                    <FormControl>
                      <Input placeholder="例: EVERYS株式会社" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={orgForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>説明</FormLabel>
                    <FormControl>
                      <Input placeholder="組織の説明（任意）" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOrgFormOpen(false)}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={orgForm.formState.isSubmitting || createOrgMutation.isPending || updateOrgMutation.isPending}
                >
                  {(orgForm.formState.isSubmitting || createOrgMutation.isPending || updateOrgMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEditMode ? '更新' : '作成'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ユーザー追加ダイアログ */}
      <Dialog open={isUserFormOpen} onOpenChange={setIsUserFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新しいユーザーを追加</DialogTitle>
            <DialogDescription>
              {selectedOrg?.name}に新しいユーザーを追加します。
            </DialogDescription>
          </DialogHeader>

          <Form {...userForm}>
            <form
              onSubmit={userForm.handleSubmit(handleAddUserSubmit)}
              className="space-y-4"
            >
              <FormField
                control={userForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名前</FormLabel>
                    <FormControl>
                      <Input placeholder="例: 山田太郎" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>メールアドレス</FormLabel>
                    <FormControl>
                      <Input placeholder="例: taro.yamada@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>パスワード</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="8文字以上" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>役割</FormLabel>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="company_admin"
                          value={USER_ROLES.COMPANY_ADMIN}
                          checked={field.value === USER_ROLES.COMPANY_ADMIN}
                          onChange={() => field.onChange(USER_ROLES.COMPANY_ADMIN)}
                          className="accent-primary"
                        />
                        <Label htmlFor="company_admin" className="font-normal">
                          組織管理者
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="company_user"
                          value={USER_ROLES.COMPANY_USER}
                          checked={field.value === USER_ROLES.COMPANY_USER}
                          onChange={() => field.onChange(USER_ROLES.COMPANY_USER)}
                          className="accent-primary"
                        />
                        <Label htmlFor="company_user" className="font-normal">
                          組織ユーザー
                        </Label>
                      </div>
                    </div>
                    <FormDescription>
                      組織管理者はユーザーの追加・管理ができます。
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUserFormOpen(false)}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={userForm.formState.isSubmitting || addUserMutation.isPending}
                >
                  {(userForm.formState.isSubmitting || addUserMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  追加
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}