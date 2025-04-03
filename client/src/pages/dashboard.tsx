import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { RoleModel } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Loader2, 
  Plus, 
  Grid2X2, 
  List,
  MoreVertical,
  BookOpen,
  FilePlus2
} from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Fetch role models
  const { 
    data: roleModels = [], 
    isLoading: isLoadingModels,
    error: roleModelsError
  } = useQuery<RoleModel[]>({
    queryKey: ["/api/role-models"],
    enabled: !!user,
  });

  return (
    <AppLayout>
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col space-y-2 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
            EVERYSへようこそ
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300">
            マイロール
          </p>
        </div>

        {/* View Options & Create Button */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 px-2"
            >
              <Grid2X2 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-2"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          <Button size="sm" asChild>
            <Link href="/role-models/new">
              <Plus className="h-4 w-4 mr-1" />
              新規作成
            </Link>
          </Button>
        </div>

        {/* Role Models Display */}
        {isLoadingModels ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : roleModelsError ? (
          <div className="text-center py-10">
            <p className="text-red-500">ロールの読み込みに失敗しました</p>
          </div>
        ) : roleModels.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <FilePlus2 className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold mb-2">ロールが作成されていません</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              「新規作成」ボタンをクリックして、最初のロールを作成しましょう
            </p>
            <Button asChild>
              <Link href="/role-models/new">
                <Plus className="h-4 w-4 mr-1" />
                ロールを作成する
              </Link>
            </Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" 
            : "flex flex-col space-y-3"
          }>
            {roleModels.map((roleModel) => (
              <Link key={roleModel.id} href={`/role-models/${roleModel.id}`}>
                <Card className={`
                  cursor-pointer transition-all duration-200 
                  hover:shadow-md border border-gray-200 dark:border-gray-700
                  ${viewMode === 'grid' ? 'h-64' : 'h-24'}
                `}>
                  <div className={`
                    h-full p-4 flex
                    ${viewMode === 'grid' 
                      ? 'flex-col' 
                      : 'flex-row items-center justify-between'
                    }
                  `}>
                    <div className={viewMode === 'grid' ? 'mb-auto' : ''}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <BookOpen className="h-8 w-8 text-primary" />
                          <h3 className="font-semibold text-lg truncate">
                            {roleModel.name}
                          </h3>
                        </div>
                        
                        {viewMode === 'grid' && (
                          <div className="flex items-center space-x-1">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0" 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.location.href = `/role-models/${roleModel.id}/knowledge-graph`;
                              }}
                              title="知識グラフ"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                              </svg>
                            </Button>
                            <MoreVertical className="h-5 w-5 text-gray-500" />
                          </div>
                        )}
                      </div>
                      
                      {viewMode === 'grid' && (
                        <p className="mt-4 text-gray-600 dark:text-gray-300 line-clamp-4">
                          {roleModel.description}
                        </p>
                      )}
                    </div>
                    
                    {viewMode === 'grid' && (
                      <div className="mt-4 text-sm text-gray-500 border-t pt-2 dark:border-gray-700">
                        作成日: {new Date().toLocaleDateString('ja-JP')}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}