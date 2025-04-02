import { useState } from "react";
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
import { ChevronDown, Bell, Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  if (!user) return null;

  const navLinks = [
    { path: "/", label: "ダッシュボード" },
    { path: "/role-models", label: "ロールモデル" },
    { path: "/tags", label: "タグ管理" },
    { path: "/summaries", label: "要約一覧" },
  ];

  const desktopNavbar = (
    <nav className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/">
              <a className="flex-shrink-0 flex items-center">
                <LightningIcon className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold font-heading">EVERYS</span>
              </a>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navLinks.map((link) => (
                <Link key={link.path} href={link.path}>
                  <a
                    className={`${
                      location === link.path
                        ? "border-primary-500 text-gray-900 dark:text-gray-100"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-300"
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    {link.label}
                  </a>
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center">
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
            <Link href="/">
              <a className="flex-shrink-0 flex items-center">
                <LightningIcon className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold font-heading">EVERYS</span>
              </a>
            </Link>
          </div>
          <div className="flex items-center">
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
                      <a
                        className={`${
                          location === link.path
                            ? "bg-primary-50 dark:bg-primary-900 border-primary-500 text-primary-700 dark:text-primary-200"
                            : "border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300"
                        } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        {link.label}
                      </a>
                    </Link>
                  ))}
                  <hr className="border-gray-200 dark:border-gray-700" />
                  <div className="pl-3 pr-4 py-2 text-base font-medium">
                    {user.name}
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
