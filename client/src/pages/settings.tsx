import React, { Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Building2, User, UserCog } from 'lucide-react';

// 設定コンポーネントを動的インポートして遅延ロードする
const ProfileSettings = React.lazy(() => import('@/components/settings/profile-settings'));
const UserSettings = React.lazy(() => import('@/components/settings/user-settings'));
const OrganizationSettings = React.lazy(() => import('@/components/settings/organization-settings'));
import { USER_ROLES } from '@shared/schema';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === USER_ROLES.ADMIN;

  return (
      <div className="container mx-auto py-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">設定</h1>
          <p className="text-muted-foreground mt-1">
            アカウント、組織、システムの設定を管理します
          </p>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>プロフィール</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" className="flex items-center gap-2">
                <UserCog className="h-4 w-4" />
                <span>ユーザー管理</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="organization" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>組織管理</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>プロフィール設定</CardTitle>
                <CardDescription>
                  あなたのアカウント情報を管理します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                  <ProfileSettings />
                </Suspense>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>ユーザー管理</CardTitle>
                  <CardDescription>
                    組織内のユーザーを管理します。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                    <UserSettings />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="organization">
              <Card>
                <CardHeader>
                  <CardTitle>組織設定</CardTitle>
                  <CardDescription>
                    組織情報や権限設定を管理します。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<div className="flex justify-center py-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
                    <OrganizationSettings />
                  </Suspense>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
  );
};

export default SettingsPage;