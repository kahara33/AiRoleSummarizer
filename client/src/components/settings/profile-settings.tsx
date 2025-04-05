import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

const ProfileSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: { name: string; email: string }) => {
      await apiRequest('PUT', `/api/users/${user?.id}`, profileData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: '更新完了',
        description: 'プロフィール情報が更新されました',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '更新失敗',
        description: error.message || 'プロフィール情報の更新に失敗しました',
        variant: 'destructive',
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (passwordData: { currentPassword: string; newPassword: string }) => {
      await apiRequest('PUT', `/api/users/${user?.id}/password`, passwordData);
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: '更新完了',
        description: 'パスワードが更新されました',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '更新失敗',
        description: error.message || 'パスワードの更新に失敗しました',
        variant: 'destructive',
      });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({ name, email });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: '確認エラー',
        description: '新しいパスワードと確認用パスワードが一致しません',
        variant: 'destructive',
      });
      return;
    }
    
    updatePasswordMutation.mutate({ currentPassword, newPassword });
  };

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium">アカウント情報</h3>
        <p className="text-sm text-muted-foreground">
          基本的なプロフィール情報を更新します
        </p>
        
        <form onSubmit={handleProfileSubmit} className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">名前</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={updateProfileMutation.isPending}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={updateProfileMutation.isPending}
            />
          </div>
          
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更新中...
                </>
              ) : '保存'}
            </Button>
          </div>
        </form>
      </div>
      
      <div className="pt-4 border-t">
        <h3 className="text-lg font-medium">パスワード変更</h3>
        <p className="text-sm text-muted-foreground">
          アカウントのパスワードを変更します
        </p>
        
        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="current-password">現在のパスワード</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={updatePasswordMutation.isPending}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-password">新しいパスワード</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={updatePasswordMutation.isPending}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-password">パスワード（確認）</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={updatePasswordMutation.isPending}
            />
          </div>
          
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={updatePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            >
              {updatePasswordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更新中...
                </>
              ) : 'パスワード変更'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;