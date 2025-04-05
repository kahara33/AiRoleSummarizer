import React from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Network, Users, Brain, Settings, LogOut } from 'lucide-react';

interface NavbarProps {
  username?: string;
  orgName?: string;
}

const Navbar: React.FC<NavbarProps> = ({ username = '管理者', orgName = 'EVERYS' }) => {
  const [location] = useLocation();
  
  // 現在のルートがアクティブかどうかをチェック
  const isActive = (path: string): boolean => {
    if (path === '/') {
      return location === path;
    }
    return location.startsWith(path);
  };
  
  return (
    <div className="bg-white border-b flex flex-col h-full">
      {/* ロゴ */}
      <div className="p-4 border-b">
        <Link to="/">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white text-xl font-bold">E</span>
            </div>
            <span className="ml-2 font-bold text-xl">EVERYS</span>
          </div>
        </Link>
        <div className="text-sm text-gray-500 mt-1">自律型情報収集サービス</div>
      </div>
      
      {/* メインナビゲーション */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          <li>
            <Link to="/">
              <a className={`flex items-center px-4 py-2 rounded-lg ${isActive('/') ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>
                <Home size={20} className="mr-3" />
                <span>ホーム</span>
              </a>
            </Link>
          </li>
          <li>
            <Link to="/knowledge-graph/default">
              <a className={`flex items-center px-4 py-2 rounded-lg ${isActive('/knowledge-graph') ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>
                <Network size={20} className="mr-3" />
                <span>知識グラフ</span>
              </a>
            </Link>
          </li>
          <li>
            <Link to="/role-models">
              <a className={`flex items-center px-4 py-2 rounded-lg ${isActive('/role-models') ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>
                <Users size={20} className="mr-3" />
                <span>ロールモデル</span>
              </a>
            </Link>
          </li>
          <li>
            <Link to="/agents">
              <a className={`flex items-center px-4 py-2 rounded-lg ${isActive('/agents') ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>
                <Brain size={20} className="mr-3" />
                <span>AIエージェント</span>
              </a>
            </Link>
          </li>
        </ul>
        
        <div className="border-t my-4"></div>
        
        <ul className="space-y-1">
          <li>
            <Link to="/settings">
              <a className={`flex items-center px-4 py-2 rounded-lg ${isActive('/settings') ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}>
                <Settings size={20} className="mr-3" />
                <span>設定</span>
              </a>
            </Link>
          </li>
        </ul>
      </nav>
      
      {/* ユーザー情報 */}
      <div className="p-4 border-t">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-gray-600 font-medium">{username.charAt(0)}</span>
          </div>
          <div className="ml-3">
            <div className="font-medium">{username}</div>
            <div className="text-sm text-gray-500">{orgName}</div>
          </div>
          <button className="ml-auto text-gray-400 hover:text-gray-600">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;