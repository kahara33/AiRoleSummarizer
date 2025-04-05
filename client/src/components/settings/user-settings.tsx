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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, PlusCircle, Pencil, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { USER_ROLES } from '@shared/schema';

// ユーザーフォームのスキーマ定義
const userFormSchema = z.object({
  name: z.string().min(2, { message: '名前は2文字以上で入力してください' }),
  email: z.string().email({ message: '有効なメールアドレスを入力してください' }),
  password: z.string().min(6, { message: 'パスワードは6文字以上で入力してください' }),
  role: z.string(),
  companyId: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  company?: {
    id: string;
    name: string;
  } | null;
};

type Company = {
  id: string;
  name: string;
};

const UserSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // フォーム定義
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'user',
      companyId: user?.companyId || '',
    },
  });

  // ユーザー一覧取得クエリ
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      if (!res.ok) {
        throw new Error('ユーザー情報の取得に失敗しました');
      }
      return res.json();
    },
  });

  // 会社一覧取得クエリ (システム管理者のみ)
  const { data: companies } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/companies');
      if (!res.ok) {
        throw new Error('組織情報の取得に失敗しました');
      }
      return res.json();
    },
    enabled: user?.role === USER_ROLES.ADMIN,
  });

  // ユーザー作成/更新ミューテーション
  const userMutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      let res;
      
      if (editingUser) {
        // 更新
        res = await apiRequest('PUT', `/api/users/${editingUser.id}`, data);
      } else {
        // 新規作成
        res = await apiRequest('POST', '/api/users', data);
      }
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'ユーザーの保存に失敗しました');
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      setEditingUser(null);
      form.reset();
      
      toast({
        title: '保存完了',
        description: `ユーザー情報を${editingUser ? '更新' : '作成'}しました`,
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

  // ユーザー削除ミューテーション
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest('DELETE', `/api/users/${userId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'ユーザーの削除に失敗しました');
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      
      toast({
        title: '削除完了',
        description: 'ユーザーを削除しました',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '削除エラー',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 編集ダイアログを開く
  const openEditDialog = (user: User) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      email: user.email,
      password: '', // 更新時はパスワードフィールドをクリア
      role: user.role,
      companyId: user.company?.id || '',
    });
    setIsDialogOpen(true);
  };

  // 新規作成ダイアログを開く
  const openCreateDialog = () => {
    setEditingUser(null);
    form.reset({
      name: '',
      email: '',
      password: '',
      role: 'user',
      companyId: user?.companyId || '',
    });
    setIsDialogOpen(true);
  };

  // 削除ダイアログを開く
  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  // ユーザー削除を実行
  const confirmDelete = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  // フォーム送信
  const onSubmit = (data: UserFormValues) => {
    userMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold mb-4">ユーザー一覧</h2>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              新規ユーザー
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'ユーザー情報編集' : '新規ユーザー作成'}</DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? 'ユーザー情報を編集します。' 
                  : '新しいユーザーを作成します。'}
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>名前</FormLabel>
                      <FormControl>
                        <Input placeholder="名前" {...field} />
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
                        <Input placeholder="email@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {editingUser
                          ? 'パスワード（変更する場合のみ入力）'
                          : 'パスワード'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="パスワード"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>役割</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="役割を選択" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">一般ユーザー</SelectItem>
                          <SelectItem value="company_admin">組織管理者</SelectItem>
                          {user?.role === USER_ROLES.ADMIN && (
                            <SelectItem value="admin">システム管理者</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {user?.role === USER_ROLES.ADMIN && (
                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>所属組織</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="所属組織を選択" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">なし</SelectItem>
                            {companies?.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <DialogFooter>
                  <Button type="submit" disabled={userMutation.isPending}>
                    {userMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingUser ? '更新' : '作成'}
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
      ) : !users || users.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          ユーザーが登録されていません
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>役割</TableHead>
              <TableHead>所属組織</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((userItem) => (
              <TableRow key={userItem.id}>
                <TableCell className="font-medium">{userItem.name}</TableCell>
                <TableCell>{userItem.email}</TableCell>
                <TableCell>
                  {userItem.role === USER_ROLES.ADMIN
                    ? 'システム管理者'
                    : userItem.role === USER_ROLES.COMPANY_ADMIN
                    ? '組織管理者'
                    : '一般ユーザー'}
                </TableCell>
                <TableCell>{userItem.company?.name || '-'}</TableCell>
                <TableCell className="flex space-x-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openEditDialog(userItem)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">編集</span>
                  </Button>
                  
                  {userItem.id !== user?.id && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openDeleteDialog(userItem)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">削除</span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      
      {/* 削除確認ダイアログ */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ユーザーを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete?.name} を削除します。この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserSettings;