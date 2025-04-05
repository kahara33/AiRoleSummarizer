import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, PlusCircle, Trash2, UserCog, User as UserIcon } from 'lucide-react';
import { USER_ROLES } from '@shared/schema';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  companyId: string | null;
};

const UserSettings: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  // ユーザーロール型を明示的に定義
  type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
  
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: USER_ROLES.USER as UserRole,
  });

  // ユーザー一覧の取得
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/users');
      return res.json();
    },
  });

  // ユーザー作成ミューテーション
  const createUserMutation = useMutation({
    mutationFn: async (userData: Omit<typeof newUser, 'confirmPassword'>) => {
      const { confirmPassword, ...data } = userData as any;
      await apiRequest('POST', '/api/users', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      setNewUser({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: USER_ROLES.USER as UserRole,
      });
      toast({
        title: 'ユーザー作成完了',
        description: 'ユーザーが作成されました',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'ユーザー作成失敗',
        description: error.message || 'ユーザーの作成に失敗しました',
        variant: 'destructive',
      });
    },
  });

  // ユーザー削除ミューテーション
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('DELETE', `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: 'ユーザー削除完了',
        description: 'ユーザーが削除されました',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'ユーザー削除失敗',
        description: error.message || 'ユーザーの削除に失敗しました',
        variant: 'destructive',
      });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newUser.password !== newUser.confirmPassword) {
      toast({
        title: '確認エラー',
        description: 'パスワードと確認用パスワードが一致しません',
        variant: 'destructive',
      });
      return;
    }
    
    // パスワードの長さチェック
    if (newUser.password.length < 8) {
      toast({
        title: 'パスワードエラー',
        description: 'パスワードは8文字以上で入力してください',
        variant: 'destructive',
      });
      return;
    }
    
    createUserMutation.mutate(newUser);
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case USER_ROLES.ADMIN:
        return '管理者';
      case USER_ROLES.USER:
        return '一般ユーザー';
      default:
        return role;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">ユーザー管理</h3>
          <p className="text-sm text-muted-foreground">
            組織内のユーザーアカウントを管理します
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          ユーザー追加
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>名前</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>権限</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users && users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      {user.role === USER_ROLES.ADMIN ? (
                        <UserCog className="h-4 w-4 text-primary" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleName(user.role)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(user)}
                        disabled={user.id === currentUser?.id}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    ユーザーが見つかりません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ユーザー作成ダイアログ */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規ユーザー作成</DialogTitle>
            <DialogDescription>
              組織に新しいユーザーを追加します。メールアドレスとパスワードが必要です。
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">名前</Label>
              <Input
                id="user-name"
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                disabled={createUserMutation.isPending}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="user-email">メールアドレス</Label>
              <Input
                id="user-email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                disabled={createUserMutation.isPending}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="user-password">パスワード</Label>
              <Input
                id="user-password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                disabled={createUserMutation.isPending}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="user-confirm-password">パスワード（確認）</Label>
              <Input
                id="user-confirm-password"
                type="password"
                value={newUser.confirmPassword}
                onChange={(e) => setNewUser({...newUser, confirmPassword: e.target.value})}
                disabled={createUserMutation.isPending}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="user-role">権限</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: UserRole) => setNewUser({...newUser, role: value})}
                disabled={createUserMutation.isPending}
              >
                <SelectTrigger id="user-role">
                  <SelectValue placeholder="権限を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={USER_ROLES.ADMIN as UserRole}>管理者</SelectItem>
                  <SelectItem value={USER_ROLES.USER as UserRole}>一般ユーザー</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <DialogFooter className="pt-4">
              <Button
                type="submit"
                disabled={createUserMutation.isPending || !newUser.name || !newUser.email || !newUser.password || !newUser.confirmPassword}
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    作成中...
                  </>
                ) : '作成'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ユーザー削除確認ダイアログ */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ユーザー削除の確認</DialogTitle>
            <DialogDescription>
              {selectedUser?.name} を削除します。この操作は元に戻せません。
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteUserMutation.isPending}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  削除中...
                </>
              ) : '削除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserSettings;