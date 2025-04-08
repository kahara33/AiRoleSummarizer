import React, { ReactNode } from 'react';
import Header from './Header';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';

interface MainLayoutProps {
  children: ReactNode;
  hideHeader?: boolean; // ヘッダーを非表示にするためのオプションプロパティ
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, hideHeader = false }) => {
  const { user } = useAuth();
  const [location] = useLocation();
  
  // ログイン画面ではヘッダーを表示しない
  const isAuthPage = location === '/auth';
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 認証済みかつログイン画面でなく、hideHeaderがfalseの場合のみヘッダーを表示 */}
      {user && !isAuthPage && !hideHeader && <Header />}
      
      <div className={`flex-1 overflow-auto ${!user && !isAuthPage ? 'hidden' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default MainLayout;