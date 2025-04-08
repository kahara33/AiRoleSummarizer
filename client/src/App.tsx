import React from 'react';
import { Switch, Route, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/lib/protected-route';
import MainLayout from '@/components/layout/MainLayout';
import HomePage from '@/pages/home-page';
import KnowledgeGraphPage from '@/pages/knowledge-graph-page';
import InformationDashboard from '@/pages/information-dashboard';
import AuthPage from '@/pages/auth-page';
import NotFoundPage from '@/pages/not-found';
import OrganizationsPage from '@/pages/organizations';
import RoleModelsPage from '@/pages/role-models';
import RoleModelDetailPage from '@/pages/role-model-detail';
import SettingsPage from '@/pages/settings';
import NotebookPage from '@/pages/notebook-page';
import { ComponentProps } from '@/lib/types';
import { MultiAgentWebSocketProvider } from '@/hooks/use-multi-agent-websocket-fixed';

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

// 情報整理ダッシュボードコンポーネント
const InformationDashboardComponent = (props: ComponentProps) => (
  <InformationDashboard id={props.params?.id} />
);

// ノートブックページコンポーネント
const NotebookPageComponent = (props: ComponentProps) => (
  <NotebookPage roleModelId={props.params?.id || ''} />
);

const AppRoutes: React.FC = () => {
  const [location] = useLocation();
  const isAuthPage = location === '/auth';
  
  return (
    <>
      {/* 認証ページの場合はMainLayoutを使わない */}
      {isAuthPage ? (
        <Switch>
          <Route path="/auth" component={AuthPage} />
        </Switch>
      ) : (
        <MainLayout>
          <Switch>
            <ProtectedRoute path="/" component={HomePageComponent} />
            <ProtectedRoute path="/organizations" component={OrganizationsPageComponent} />
            <ProtectedRoute path="/role-models" component={RoleModelsPageComponent} />
            <ProtectedRoute path="/role-models/new" component={RoleModelsPageComponent} />
            <ProtectedRoute path="/role-model/:id" component={RoleModelDetailPageComponent} />
            <ProtectedRoute path="/knowledge-graph/:id" component={KnowledgeGraphPageComponent} />
            <ProtectedRoute path="/information-dashboard/:id" component={InformationDashboardComponent} />
            <ProtectedRoute path="/notebook/:id" component={NotebookPageComponent} />
            <ProtectedRoute path="/settings" component={() => <SettingsPage />} />
            <Route component={NotFoundPage} />
          </Switch>
        </MainLayout>
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MultiAgentWebSocketProvider>
          <AppRoutes />
          <Toaster />
        </MultiAgentWebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;