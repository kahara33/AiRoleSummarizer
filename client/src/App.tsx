import React from 'react';
import { Switch, Route } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/lib/protected-route';
import MainLayout from '@/components/layout/MainLayout';
import HomePage from '@/pages/home-page';
import KnowledgeGraphPage from '@/pages/knowledge-graph-page';
import AuthPage from '@/pages/auth-page';
import NotFoundPage from '@/pages/not-found';
import OrganizationsPage from '@/pages/organizations';
import RoleModelsPage from '@/pages/role-models';
import RoleModelDetailPage from '@/pages/role-model-detail';
import { ComponentProps } from '@/lib/types';

// QueryClientの設定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ホームページコンポーネント
const HomePageComponent = () => <HomePage />;

// 組織ページコンポーネント
const OrganizationsPageComponent = () => <OrganizationsPage />;

// ロールモデル一覧ページコンポーネント
const RoleModelsPageComponent = () => <RoleModelsPage />;

// ロールモデル詳細ページコンポーネント
const RoleModelDetailPageComponent = (props: ComponentProps) => (
  <RoleModelDetailPage id={props.params?.id} />
);

// 知識グラフページコンポーネント
const KnowledgeGraphPageComponent = (props: ComponentProps) => (
  <KnowledgeGraphPage id={props.params?.id} />
);

const AppRoutes: React.FC = () => (
  <MainLayout>
    <Switch>
      <ProtectedRoute path="/" component={HomePageComponent} />
      <ProtectedRoute path="/organizations" component={OrganizationsPageComponent} />
      <ProtectedRoute path="/role-models" component={RoleModelsPageComponent} />
      <ProtectedRoute path="/role-model/:id" component={RoleModelDetailPageComponent} />
      <ProtectedRoute path="/knowledge-graph/:id" component={KnowledgeGraphPageComponent} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFoundPage} />
    </Switch>
  </MainLayout>
);

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;