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
import KnowledgeLibrary from '@/pages/knowledge-library';
import AuthPage from '@/pages/auth-page';
import NotFoundPage from '@/pages/not-found';
import OrganizationsPage from '@/pages/organizations';
import RoleModelsPage from '@/pages/role-models';
import RoleModelDetailPage from '@/pages/role-model-detail';
import SettingsPage from '@/pages/settings';
import NotebookPage from '@/pages/notebook-page';
import { ComponentProps } from '@/lib/types';
import { MultiAgentWebSocketProvider } from '@/hooks/use-multi-agent-websocket';
import { UnifiedWebSocketProvider } from '@/hooks/use-unified-websocket';

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

// ナレッジライブラリコンポーネント
const KnowledgeLibraryComponent = (props: ComponentProps) => (
  <KnowledgeLibrary id={props.params?.id} />
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
            <ProtectedRoute path="/knowledge-library/:id" component={KnowledgeLibraryComponent} />
            <ProtectedRoute path="/notebook/:id" component={NotebookPageComponent} />
            <ProtectedRoute path="/settings" component={() => <SettingsPage />} />
            {/* デバッグページはProtectedRouteではなく一般的なRouteとして表示 */}
            <Route path="/debug" component={() => {
              const DebugPage = React.lazy(() => import('./pages/debug'));
              return (
                <React.Suspense fallback={<div>Loading...</div>}>
                  <DebugPage />
                </React.Suspense>
              );
            }} />
            <Route path="/debug/websocket" component={() => {
              const WebsocketDebug = React.lazy(() => import('./pages/debug/WebsocketDebug'));
              return (
                <React.Suspense fallback={<div>Loading...</div>}>
                  <WebsocketDebug />
                </React.Suspense>
              );
            }} />
            <Route path="/debug/websocket-tool" component={() => {
              const WebSocketDebugToolImport = React.lazy(() => import('./pages/debug/WebSocketDebugTool').then(module => ({default: module.default})));
              return (
                <React.Suspense fallback={<div>Loading...</div>}>
                  <WebSocketDebugToolImport />
                </React.Suspense>
              );
            }} />
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
          <UnifiedWebSocketProvider>
            <AppRoutes />
            <Toaster />
          </UnifiedWebSocketProvider>
        </MultiAgentWebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;