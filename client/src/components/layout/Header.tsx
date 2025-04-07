import React from 'react';
import { Link, useLocation } from 'wouter';
import { Settings } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const Header: React.FC = () => {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  // ユーザーのイニシャルを取得
  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  return (
    <header className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* ロゴ */}
          <div className="flex items-center">
            <Link to="/">
              <div className="flex items-center cursor-pointer">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-white text-xl font-bold">E</span>
                </div>
                <span className="ml-2 font-bold text-xl">EVERYS</span>
              </div>
            </Link>
          </div>

          {/* 右側 - 設定 & ユーザー */}
          <div className="flex items-center space-x-4">
            {/* 設定ボタン */}
            <Link to="/settings">
              <Button variant="ghost" size="icon" className="text-gray-600 hover:text-gray-900">
                <Settings size={20} />
              </Button>
            </Link>

            {/* ユーザープロフィール */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <div className="h-8 w-8 rounded-full bg-primary-200 dark:bg-primary-700 flex items-center justify-center text-primary-700 dark:text-primary-200 font-medium">
                    {getInitials(user.name)}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem className="font-medium">{user.name}</DropdownMenuItem>
                <DropdownMenuItem>
                  <Button variant="ghost" className="w-full justify-start p-0" onClick={() => logoutMutation.mutate()}>
                    ログアウト
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;