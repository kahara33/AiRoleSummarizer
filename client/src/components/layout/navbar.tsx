import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LightningIcon } from "@/components/ui/svg-icons";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ChevronDown, Bell, Menu, Building } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { USER_ROLES } from "@shared/schema";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  
  // システム管理者の場合は組織一覧を取得
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['/api/companies'],
    enabled: user?.role === USER_ROLES.SYSTEM_ADMIN,
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };
  
  // ロール名を日本語に変換
  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case USER_ROLES.SYSTEM_ADMIN:
        return 'システム管理者';
      case USER_ROLES.COMPANY_ADMIN:
        return '組織管理者';
      case USER_ROLES.COMPANY_USER:
        return '組織ユーザー';
      case USER_ROLES.INDIVIDUAL_USER:
        return '個人ユーザー';
      default:
        return role;
    }
  };

  if (!user) return null;

  const navLinks = [
    { path: "/", label: "ダッシュボード" },
    { path: "/role-models", label: "ロールモデル" },
    { path: "/knowledge-graph", label: "知識グラフ" },
    { path: "/information-collection", label: "情報収集設定" },
    { path: "/tags", label: "タグ管理" },
    { path: "/summaries", label: "要約一覧" },
  ];
  
  // システム管理者と組織管理者のみ組織管理メニューを表示
  if (user.role === "system_admin" || user.role === "company_admin") {
    navLinks.push({ path: "/organizations", label: "組織管理" });
  }

  const desktopNavbar = (
    <nav className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <div className="flex items-center cursor-pointer">
                  <LightningIcon className="h-8 w-8 text-primary-600" />
                  <span className="ml-2 text-xl font-bold font-heading">EVERYS</span>
                </div>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navLinks.map((link) => (
                <Link key={link.path} href={link.path}>
                  <div
                    className={`${
                      location === link.path
                        ? "border-primary-500 text-gray-900 dark:text-gray-100"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-300"
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium cursor-pointer`}
                  >
                    {link.label}
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            {/* システム管理者の場合、組織切り替えドロップダウンを表示 */}
            {user.role === USER_ROLES.SYSTEM_ADMIN && companies.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="mr-2">
                    <Building className="h-4 w-4 mr-1" />
                    {selectedOrgId 
                      ? companies.find((org: any) => org.id === selectedOrgId)?.name || '組織を選択'
                      : '組織を選択'}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setSelectedOrgId(null)}>
                    すべての組織
                  </DropdownMenuItem>
                  {companies.map((company: any) => (
                    <DropdownMenuItem 
                      key={company.id}
                      onClick={() => setSelectedOrgId(company.id)}
                    >
                      {company.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="mr-2"
              aria-label="通知"
            >
              <Bell className="h-5 w-5" />
            </Button>

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
                <DropdownMenuItem className="font-medium text-xs text-muted-foreground">
                  {getRoleDisplayName(user.role)}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Button variant="ghost" className="w-full justify-start p-0" onClick={handleLogout}>
                    ログアウト
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );

  const mobileNavbar = (
    <nav className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <div className="flex items-center cursor-pointer">
                  <LightningIcon className="h-8 w-8 text-primary-600" />
                  <span className="ml-2 text-xl font-bold font-heading">EVERYS</span>
                </div>
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            {/* システム管理者の場合、組織切り替えドロップダウンを表示 */}
            {user.role === USER_ROLES.SYSTEM_ADMIN && companies.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="mr-2">
                    <Building className="h-4 w-4 mr-1" />
                    {selectedOrgId 
                      ? companies.find((org: any) => org.id === selectedOrgId)?.name || '組織'
                      : '組織'}
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setSelectedOrgId(null)}>
                    すべての組織
                  </DropdownMenuItem>
                  {companies.map((company: any) => (
                    <DropdownMenuItem 
                      key={company.id}
                      onClick={() => setSelectedOrgId(company.id)}
                    >
                      {company.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <Button
              variant="ghost"
              size="icon"
              className="mr-2"
              aria-label="通知"
            >
              <Bell className="h-5 w-5" />
            </Button>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col space-y-4 mt-6">
                  {navLinks.map((link) => (
                    <Link key={link.path} href={link.path}>
                      <div
                        className={`${
                          location === link.path
                            ? "bg-primary-50 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-200"
                            : "border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300"
                        } block pl-3 pr-4 py-2 border-l-4 text-base font-medium cursor-pointer`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {link.label}
                      </div>
                    </Link>
                  ))}
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div className="pl-3 pr-4 py-2 text-base font-medium">
                    {user.name}
                  </div>
                  <div className="pl-3 pr-4 py-1 text-sm text-muted-foreground">
                    {getRoleDisplayName(user.role)}
                  </div>
                  <Button 
                    variant="ghost" 
                    className="justify-start pl-3" 
                    onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}
                  >
                    ログアウト
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );

  return isMobile ? mobileNavbar : desktopNavbar;
}
