import React, { ReactNode } from 'react';
import Navbar from './Navbar';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const [location] = useLocation();
  
  // ログイン画面ではナビゲーションを表示しない
  const isAuthPage = location === '/auth';
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* 認証済みかつログイン画面でない場合のみナビゲーションを表示 */}
      {user && !isAuthPage && (
        <div className="w-64 hidden md:block">
          <Navbar />
        </div>
      )}
      
      <div className={`flex-1 overflow-auto ${!user && !isAuthPage ? 'hidden' : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default MainLayout;