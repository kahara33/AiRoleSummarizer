import React from 'react';
import Navbar from './Navbar';
import { useAuth } from '@/hooks/use-auth';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  
  // ユーザー情報がまだロードされていない場合はnullを返す
  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar username={user.name} orgName={'EVERYS'} />
      
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};

export default AppLayout;