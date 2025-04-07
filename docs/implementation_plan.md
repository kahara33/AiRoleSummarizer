# 情報収集プラン機能実装計画

## 実装フェーズ

### フェーズ1: データモデルの設計・実装（推定工数: 3日）
- [ ] 情報収集プランのデータモデル設計
- [ ] 情報ソースのデータモデル設計
- [ ] 要約結果のデータモデル設計
- [ ] Drizzle ORMスキーマの更新
- [ ] マイグレーションスクリプトの作成・実行
- [ ] APIエンドポイントの設計
- [ ] APIコントローラーの実装

### フェーズ2: NotebookLM風UI実装（推定工数: 5日）
- [ ] 2段構成レイアウトの実装
- [ ] 上段情報収集プラン管理コンポーネントの実装
  - [ ] プラン作成・編集フォーム
  - [ ] プランリスト表示
  - [ ] プラン有効化・無効化コントロール
- [ ] 下段タブ切り替えレイアウトの実装
  - [ ] ソース一覧タブ
  - [ ] 要約結果一覧タブ
- [ ] ソース一覧表示コンポーネントの実装
- [ ] 要約結果一覧表示コンポーネントの実装
- [ ] 要約詳細表示コンポーネントの実装

### フェーズ3: バックエンド機能実装（推定工数: 7日）
- [ ] 情報収集プラン管理APIの実装
  - [ ] プラン作成・更新・削除API
  - [ ] プラン有効化・無効化API
  - [ ] プラン即時実行API
- [ ] 情報収集エージェントの強化
  - [ ] Google検索ツールの実装
  - [ ] RSSフィード取得ツールの実装
  - [ ] ユーザー指定サイト・RSS処理の実装
- [ ] 要約エージェントの実装
  - [ ] 収集情報の構造化処理
  - [ ] サマリー生成処理
- [ ] 配信機能の実装
  - [ ] メール配信機能
  - [ ] Webhook送信機能（Slack/Teams）

### フェーズ4: インテグレーション・テスト（推定工数: 5日）
- [ ] フロントエンド・バックエンド連携テスト
- [ ] エージェント連携テスト
- [ ] WebSocket更新通知テスト
- [ ] 情報収集実行テスト
- [ ] 要約生成テスト
- [ ] 配信機能テスト
- [ ] ユーザビリティテスト

## 詳細タスク

### データモデル設計・実装

#### 情報収集プランモデル
```typescript
// shared/schema.ts に追加
export const collectionPlans = pgTable('collection_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  roleModelId: uuid('role_model_id').references(() => roleModels.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  frequency: text('frequency').default('daily'),
  toolsConfig: jsonb('tools_config').default({}),
  deliveryConfig: jsonb('delivery_config').default({}),
});

// toolsConfig の型定義（JSON）
type ToolsConfig = {
  enabledTools: string[]; // ['google_search', 'rss_feed']
  customSites?: string[];
  customRssUrls?: string[];
  searchDepth?: number;
  maxResults?: number;
};

// deliveryConfig の型定義（JSON）
type DeliveryConfig = {
  emailEnabled?: boolean;
  emailAddresses?: string[];
  webhookEnabled?: boolean;
  webhookUrls?: string[];
  webhookType?: 'slack' | 'teams';
};
```

#### 情報ソースモデル
```typescript
export const collectionSources = pgTable('collection_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  collectionPlanId: uuid('collection_plan_id').references(() => collectionPlans.id, { onDelete: 'cascade' }),
  executionId: uuid('execution_id').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  category: text('category'),
  relevanceScore: decimal('relevance_score', { precision: 5, scale: 2 }),
  collectedAt: timestamp('collected_at').defaultNow(),
  content: text('content'),
  contentType: text('content_type'), // 'text', 'html', 'json', etc.
  toolUsed: text('tool_used'), // 'google_search', 'rss_feed', etc.
  metadata: jsonb('metadata').default({}),
});
```

#### 要約結果モデル
```typescript
export const collectionSummaries = pgTable('collection_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  collectionPlanId: uuid('collection_plan_id').references(() => collectionPlans.id, { onDelete: 'cascade' }),
  executionId: uuid('execution_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  keyTopics: jsonb('key_topics').default([]),
  sourceIds: jsonb('source_ids').default([]), // collectionSources の ID 配列
  generatedAt: timestamp('generated_at').defaultNow(),
  aiProcessLog: text('ai_process_log'),
  deliveryStatus: jsonb('delivery_status').default({}),
});
```

### API エンドポイント設計

#### 情報収集プラン管理API
- `GET /api/collection-plans` - プラン一覧取得
- `GET /api/collection-plans/:id` - プラン詳細取得
- `POST /api/collection-plans` - プラン作成
- `PATCH /api/collection-plans/:id` - プラン更新
- `DELETE /api/collection-plans/:id` - プラン削除
- `PATCH /api/collection-plans/:id/activate` - プラン有効化
- `PATCH /api/collection-plans/:id/deactivate` - プラン無効化
- `POST /api/collection-plans/:id/execute` - プラン即時実行

#### 情報ソース管理API
- `GET /api/collection-plans/:planId/sources` - ソース一覧取得
- `GET /api/collection-plans/:planId/sources/:executionId` - 実行回ごとのソース取得

#### 要約結果管理API
- `GET /api/collection-plans/:planId/summaries` - 要約一覧取得
- `GET /api/collection-plans/:planId/summaries/:id` - 要約詳細取得

## フロントエンドコンポーネント設計

### NotebookLM風2段構成レイアウト
```tsx
// client/src/pages/information-collection-page.tsx
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CollectionPlanPanel } from '@/components/collection-plan/collection-plan-panel';
import { SourcesList } from '@/components/collection-plan/sources-list';
import { SummariesList } from '@/components/collection-plan/summaries-list';
import { SummaryDetail } from '@/components/collection-plan/summary-detail';

export default function InformationCollectionPage() {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen">
      {/* 上段: 情報収集プラン管理エリア（約1/5の高さ） */}
      <div className="h-1/5 min-h-[200px] border-b">
        <CollectionPlanPanel 
          onSelectPlan={setSelectedPlanId} 
          selectedPlanId={selectedPlanId} 
        />
      </div>
      
      {/* 下段: ソース一覧・要約結果表示エリア（約4/5の高さ） */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="summaries" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-2">
            <TabsTrigger value="summaries">要約結果一覧</TabsTrigger>
            <TabsTrigger value="sources">ソース一覧</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summaries" className="flex-1 overflow-hidden p-4">
            <div className="grid grid-cols-12 gap-4 h-full">
              <div className="col-span-4 overflow-auto border rounded-md">
                <SummariesList 
                  planId={selectedPlanId} 
                  onSelectSummary={setSelectedSummaryId}
                  selectedSummaryId={selectedSummaryId}
                />
              </div>
              <div className="col-span-8 overflow-auto border rounded-md">
                <SummaryDetail summaryId={selectedSummaryId} />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="sources" className="flex-1 overflow-auto p-4">
            <SourcesList planId={selectedPlanId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

### 情報収集プラン管理コンポーネント
```tsx
// client/src/components/collection-plan/collection-plan-panel.tsx
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CollectionPlanDialog } from './collection-plan-dialog';
import { CollectionPlanCard } from './collection-plan-card';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface CollectionPlanPanelProps {
  onSelectPlan: (planId: string | null) => void;
  selectedPlanId: string | null;
}

export function CollectionPlanPanel({
  onSelectPlan,
  selectedPlanId
}: CollectionPlanPanelProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  
  const { data: plans, isLoading } = useQuery({
    queryKey: ['/api/collection-plans'],
    enabled: true,
  });
  
  const activateMutation = useMutation({
    mutationFn: async (planId: string) => {
      await apiRequest('PATCH', `/api/collection-plans/${planId}/activate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collection-plans'] });
    },
  });
  
  const executeMutation = useMutation({
    mutationFn: async (planId: string) => {
      await apiRequest('POST', `/api/collection-plans/${planId}/execute`);
    },
  });
  
  const handleCreatePlan = () => {
    setEditingPlanId(null);
    setIsDialogOpen(true);
  };
  
  const handleEditPlan = (planId: string) => {
    setEditingPlanId(planId);
    setIsDialogOpen(true);
  };
  
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">情報収集プラン</h2>
        <Button onClick={handleCreatePlan} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          プラン作成
        </Button>
      </div>
      
      {isLoading ? (
        <div>読み込み中...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {plans?.map(plan => (
            <CollectionPlanCard
              key={plan.id}
              plan={plan}
              isSelected={plan.id === selectedPlanId}
              onSelect={() => onSelectPlan(plan.id)}
              onEdit={() => handleEditPlan(plan.id)}
              onActivate={() => activateMutation.mutate(plan.id)}
              onExecute={() => executeMutation.mutate(plan.id)}
            />
          ))}
        </div>
      )}
      
      <CollectionPlanDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        planId={editingPlanId}
      />
    </div>
  );
}
```

## バックエンド実装計画

### 情報収集エージェント拡張
```typescript
// server/agents/information-collection-agent.ts

import { GoogleSearch } from '../tools/google-search';
import { RssFeedReader } from '../tools/rss-feed-reader';
import { WebScraper } from '../tools/web-scraper';
import { storage } from '../storage';
import { sendProgressUpdate } from '../websocket';

export class InformationCollectionAgent {
  // 属性定義
  private planId: string;
  private executionId: string;
  private toolsConfig: ToolsConfig;
  
  constructor(planId: string) {
    this.planId = planId;
    this.executionId = crypto.randomUUID();
  }
  
  async initialize() {
    // プラン設定の読み込み
    const plan = await storage.getCollectionPlanById(this.planId);
    if (!plan) throw new Error('Collection plan not found');
    
    this.toolsConfig = plan.toolsConfig;
  }
  
  async execute() {
    try {
      sendProgressUpdate('情報収集を開始しています...', 0, this.planId);
      
      // ツールの初期化
      const tools = this.initializeTools();
      
      // 各ツールでの情報収集を実行
      const sources = [];
      let progress = 10;
      
      for (const tool of tools) {
        sendProgressUpdate(`${tool.name}で情報収集中...`, progress, this.planId);
        const results = await tool.collect();
        
        // 結果をデータベースに保存
        for (const result of results) {
          const sourceData = {
            collectionPlanId: this.planId,
            executionId: this.executionId,
            title: result.title,
            url: result.url,
            category: result.category,
            relevanceScore: result.relevanceScore,
            content: result.content,
            contentType: result.contentType,
            toolUsed: tool.name,
            metadata: result.metadata,
          };
          
          const source = await storage.createCollectionSource(sourceData);
          sources.push(source);
        }
        
        progress += 30 / tools.length;
        sendProgressUpdate(`${tool.name}での情報収集が完了しました`, progress, this.planId);
      }
      
      sendProgressUpdate('情報の構造化と要約を開始しています...', 50, this.planId);
      
      // 要約エージェントによる処理
      const summaryAgent = new SummaryAgent(this.planId, this.executionId, sources);
      const summary = await summaryAgent.generateSummary();
      
      sendProgressUpdate('要約が完了しました', 90, this.planId);
      
      // 要約結果の配信
      await this.deliverSummary(summary);
      
      sendProgressUpdate('情報収集プロセスが完了しました', 100, this.planId);
      
      return {
        executionId: this.executionId,
        sourcesCount: sources.length,
        summaryId: summary.id
      };
      
    } catch (error) {
      console.error('Information collection failed:', error);
      sendProgressUpdate(`情報収集中にエラーが発生しました: ${error.message}`, 100, this.planId);
      throw error;
    }
  }
  
  private initializeTools() {
    const tools = [];
    
    if (this.toolsConfig.enabledTools.includes('google_search')) {
      tools.push(new GoogleSearch(this.toolsConfig));
    }
    
    if (this.toolsConfig.enabledTools.includes('rss_feed')) {
      tools.push(new RssFeedReader(this.toolsConfig));
    }
    
    // カスタム指定サイトのスクレイピング
    if (this.toolsConfig.customSites?.length > 0) {
      tools.push(new WebScraper(this.toolsConfig));
    }
    
    return tools;
  }
  
  private async deliverSummary(summary) {
    // プラン設定の読み込み
    const plan = await storage.getCollectionPlanById(this.planId);
    if (!plan) return;
    
    const deliveryConfig = plan.deliveryConfig;
    
    // メール配信
    if (deliveryConfig.emailEnabled && deliveryConfig.emailAddresses?.length > 0) {
      await this.sendEmailSummary(summary, deliveryConfig.emailAddresses);
    }
    
    // Webhook配信（Slack/Teams）
    if (deliveryConfig.webhookEnabled && deliveryConfig.webhookUrls?.length > 0) {
      await this.sendWebhookSummary(summary, deliveryConfig);
    }
  }
  
  private async sendEmailSummary(summary, emailAddresses) {
    // メール送信処理の実装
  }
  
  private async sendWebhookSummary(summary, deliveryConfig) {
    // Webhook送信処理の実装（Slack/Teams）
  }
}
```

## 実装スケジュール

| 週 | フェーズ | 主なタスク |
|----|---------|-----------|
| 1週目 | 1: データモデル設計・実装 | スキーマ設計、マイグレーション、API設計 |
| 2週目 | 2: NotebookLM風UI実装 | レイアウト実装、プラン管理UI、ソース・要約一覧UI |
| 3-4週目 | 3: バックエンド機能実装 | API実装、エージェント強化、配信機能 |
| 5週目 | 4: インテグレーション・テスト | 連携テスト、バグ修正、機能検証 |

## リスクと対策

1. **リスク**: WebSocketでの更新通知が安定しない
   **対策**: ポーリングによるフォールバック実装

2. **リスク**: 情報収集の外部APIの制限
   **対策**: レート制限対応とキャッシュ実装

3. **リスク**: Azure OpenAI処理のタイムアウト
   **対策**: 段階的処理とチャンク分割

4. **リスク**: UIの複雑化によるパフォーマンス低下
   **対策**: 仮想スクロールと遅延読み込み