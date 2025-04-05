import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Building2 } from 'lucide-react';

type Company = {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
};

const OrganizationSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [organizationName, setOrganizationName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');

  // 組織情報の取得
  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ['/api/company', user?.companyId],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/company/${user?.companyId}`);
        return res.json();
      } catch (error) {
        console.error('組織情報取得エラー:', error);
        throw error;
      }
    },
    enabled: !!user?.companyId,
  });
  
  // データ取得成功時に状態を更新
  React.useEffect(() => {
    if (company) {
      setOrganizationName(company.name || '');
      setDescription(company.description || '');
      setWebsite(company.website || '');
    }
  }, [company]);

  // 組織情報更新ミューテーション
  const updateCompanyMutation = useMutation({
    mutationFn: async (companyData: { name: string; description: string; website: string }) => {
      await apiRequest('PUT', `/api/company/${user?.companyId}`, companyData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company', user?.companyId] });
      toast({
        title: '更新完了',
        description: '組織情報が更新されました',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '更新失敗',
        description: error.message || '組織情報の更新に失敗しました',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanyMutation.mutate({
      name: organizationName,
      description,
      website,
    });
  };

  if (!user?.companyId) {
    return (
      <div className="text-center py-6">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
        <h3 className="mt-4 text-lg font-medium">組織が設定されていません</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          現在、あなたは組織に所属していません。<br />
          管理者に連絡して組織への招待を依頼してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">組織設定</h3>
        <p className="text-sm text-muted-foreground">
          組織の基本情報を更新します
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="organization-name">組織名</Label>
                <Input
                  id="organization-name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  disabled={updateCompanyMutation.isPending}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="organization-description">組織の説明</Label>
                <Textarea
                  id="organization-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={updateCompanyMutation.isPending}
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="organization-website">ウェブサイト</Label>
                <Input
                  id="organization-website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={updateCompanyMutation.isPending}
                  placeholder="https://example.com"
                />
              </div>
            </div>
          </Card>
          
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={updateCompanyMutation.isPending || !organizationName}
            >
              {updateCompanyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更新中...
                </>
              ) : '保存'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

export default OrganizationSettings;