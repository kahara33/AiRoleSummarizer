import { Link } from "wouter";
import { Settings, LifeBuoy } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} EVERYS 自律型情報収集サービス
          </div>
          <div className="flex space-x-6">
            <Link href="#support">
              <a className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300">
                <span className="sr-only">サポート</span>
                <LifeBuoy className="h-5 w-5" />
              </a>
            </Link>
            <Link href="#settings">
              <a className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300">
                <span className="sr-only">設定</span>
                <Settings className="h-5 w-5" />
              </a>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
