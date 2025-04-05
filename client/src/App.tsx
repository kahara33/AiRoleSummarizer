import React from 'react';
import { Switch, Route } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import MainLayout from '@/components/layout/MainLayout';
import HomePage from '@/pages/home-page';
import KnowledgeGraphPage from '@/pages/knowledge-graph-page';

// エラーが発生した場合のフォールバックページ
const NotFoundPage = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center p-8 bg-white rounded-lg shadow-md">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">404</h1>
      <p className="text-xl text-gray-600 mb-4">ページが見つかりません</p>
      <a
        href="/"
        className="text-blue-500 hover:text-blue-700 transition-colors"
      >
        ホームに戻る
      </a>
    </div>
  </div>
);

// QueryClientの設定
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <MainLayout>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/knowledge-graph/:id">
            {(params) => <KnowledgeGraphPage />}
          </Route>
          <Route component={NotFoundPage} />
        </Switch>
      </MainLayout>
      <Toaster />
    </QueryClientProvider>
  );
};

export default App;