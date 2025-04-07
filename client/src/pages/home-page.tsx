import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { RoleModelWithIndustriesAndKeywords, Industry } from '@shared/schema';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Plus, User, Settings } from 'lucide-react';

const HomePage: React.FC = () => {
  const { user } = useAuth();

  // Role Models データの取得
  const { 
    data: roleModels = [], 
    isLoading: isLoadingModels,
    error: roleModelsError
  } = useQuery<RoleModelWithIndustriesAndKeywords[]>({
    queryKey: ["/api/role-models"],
    enabled: !!user,
    queryFn: async ({ queryKey }) => {
      try {
        console.log("ロールモデルデータ取得開始:", queryKey[0]);
        const res = await fetch(queryKey[0] as string, {
          credentials: "include",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });
        
        if (!res.ok) {
          console.error("ロールモデル取得エラー:", res.status, res.statusText);
          throw new Error(`ロールの取得に失敗しました: ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log("ロールモデルデータ取得成功:", data);
        return data;
      } catch (error) {
        console.error("ロールモデルデータ取得エラー:", error);
        throw error;
      }
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-6 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            EVERYS自律型情報収集サービス
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            AIエージェントによる情報収集と知識グラフ生成プラットフォーム
          </p>
        </div>

        {/* ロールモデル一覧と追加ボタン */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">ロールモデル一覧</h2>
            <Button asChild>
              <Link to="/role-models">
                <Plus className="h-4 w-4 mr-1" />
                新規作成
              </Link>
            </Button>
          </div>

          {/* ロールモデル一覧 */}
          {isLoadingModels ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : roleModelsError ? (
            <div className="text-center py-8 bg-red-50 rounded-lg p-4">
              <p className="text-red-500 mb-2">ロールの読み込みに失敗しました</p>
              <p className="text-gray-600 text-sm">
                {roleModelsError.message.includes("401") 
                  ? "認証が必要です。ログインしてから再度お試しください。" 
                  : roleModelsError.message}
              </p>
              {roleModelsError.message.includes("401") && (
                <Button 
                  className="mt-4" 
                  variant="outline" 
                  onClick={() => window.location.href = "/auth"}
                >
                  ログイン画面へ
                </Button>
              )}
            </div>
          ) : roleModels.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">ロールが作成されていません</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                「新規作成」ボタンをクリックして、最初のロールを作成しましょう
              </p>
              <Button asChild>
                <Link to="/role-models">
                  <Plus className="h-4 w-4 mr-1" />
                  ロールを作成する
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {roleModels.map((roleModel) => (
                <Card key={roleModel.id} className="h-full relative border border-gray-200">
                  {/* 歯車アイコン（設定） */}
                  <div className="absolute top-2 right-2 z-10">
                    <Link to={`/role-model/${roleModel.id}`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-200/80">
                        <Settings className="h-4 w-4 text-gray-500" />
                      </Button>
                    </Link>
                  </div>
                  
                  {/* カードコンテンツ（クリック可能） */}
                  <Link to={`/knowledge-graph/${roleModel.id}`}>
                    <div className="p-6 cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-center h-14 w-14 bg-primary-100 rounded-lg mb-4">
                        <User className="h-8 w-8 text-primary-700" />
                      </div>
                      <h3 className="text-lg font-bold mb-3">
                        {roleModel.name}
                      </h3>
                      <p className="text-gray-600 mb-4 line-clamp-3">
                        {roleModel.description || "ここに説明文が入ります"}
                      </p>

                      {/* インダストリー/キーワードタグ */}
                      <div className="mt-4 space-y-3">
                        {roleModel.industries && roleModel.industries.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {roleModel.industries.slice(0, 3).map((industry: Industry) => (
                              <span key={industry.id} className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                                {industry.name}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {roleModel.keywords && roleModel.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {roleModel.keywords.slice(0, 3).map((keyword: string, index: number) => (
                              <span key={index} className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 機能紹介 - モバイルでは非表示 */}
        <div className="mt-12 hidden md:block">
          <h2 className="text-2xl font-semibold text-center mb-8">EVERYS自律型情報収集サービスの特徴</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="bg-blue-100 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">情報収集</h3>
              <p className="text-gray-600">
                AIエージェントが自律的に情報を収集し、関連データを効率的に抽出します。
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="bg-purple-100 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">知識グラフ生成</h3>
              <p className="text-gray-600">
                収集情報から知識グラフを自動生成し、情報の関連性を可視化します。
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="bg-green-100 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">レポート生成</h3>
              <p className="text-gray-600">
                収集・分析された情報から自動的にレポートやサマリーを生成します。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;