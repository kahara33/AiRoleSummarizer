/**
 * CrewAIタスクの定義
 * 各エージェントが実行するタスクとその流れを定義
 */
import { Task } from 'crewai-js';

// エージェント定義のインポート
import {
  DomainAnalystAgent,
  TrendResearcherAgent,
  ContextMapperAgent,
  PlanStrategistAgent,
  CriticalThinkerAgent
} from '../agents/agent-definitions';

/**
 * 業界分析と主要キーワード特定タスク
 * ドメインアナリストが担当
 */
export const AnalyzeIndustryTask = new Task({
  description: `
    指定された業界を徹底的に分析し、その業界の主要な概念、トレンド、用語を特定してください。
    特に以下の点に注目してください：
    
    1. 業界の主要セグメントと構造
    2. 中心的な概念や専門用語
    3. 主要プレーヤーや影響力のある組織
    4. 業界特有の関係性やダイナミクス
    
    提供されたキーワードをさらに拡張し、階層的に整理してください。
    最終的な出力はナレッジグラフの基盤として使用されます。
    
    入力：
    - 業界名: {{industry}}
    - 初期キーワード: {{initial_keywords}}
    
    出力：
    - 拡張されたキーワードリスト（関連度スコア付き）
    - 階層的に整理されたキーワード構造
    - 主要概念間の関連性の説明
  `,
  agent: DomainAnalystAgent as any // 型の互換性問題を一時的に回避
});

/**
 * 情報源評価とトレンド予測タスク
 * トレンドリサーチャーが担当
 */
export const EvaluateSourcesTask = new Task({
  description: `
    業界の情報収集に最適な情報源を特定・評価し、今後のトレンドを予測してください。
    以下の点を考慮してください：
    
    1. 最も信頼性が高く、専門性のある情報源の特定
    2. 各情報源の更新頻度、深さ、網羅性の評価
    3. 情報源からのデータ抽出方法の提案
    4. 短期・中期・長期のトレンド予測
    
    入力：
    - 業界名: {{industry}}
    - 主要キーワード: {{key_keywords}}
    - 情報源候補: {{potential_sources}}
    
    出力：
    - 評価済み情報源リスト（品質スコア付き）
    - 推奨データ収集方法
    - トレンド予測レポート
  `,
  agent: TrendResearcherAgent as any // 型の互換性問題を一時的に回避
});

/**
 * ナレッジグラフ構造設計タスク
 * コンテキストマッパーが担当
 */
export const DesignGraphStructureTask = new Task({
  description: `
    収集された概念と関係性に基づいて、最適なナレッジグラフ構造を設計してください。
    以下の点を考慮してください：
    
    1. ノードとエッジの最適な配置
    2. 関連性の強さに基づく視覚化の提案
    3. 中心的概念とクラスター構造の特定
    4. 冗長性の排除と簡潔化
    
    入力：
    - 拡張キーワード: {{expanded_keywords}}
    - キーワード階層: {{keyword_hierarchy}}
    - 主要関係性: {{key_relationships}}
    
    出力：
    - グラフノード定義（属性付き）
    - エッジ定義（関係タイプと強度付き）
    - クラスター構造の提案
    - 視覚化のための最適化推奨事項
  `,
  agent: ContextMapperAgent as any // 型の互換性問題を一時的に回避
});

/**
 * 情報収集プラン策定タスク
 * プランストラテジストが担当
 */
export const DevelopCollectionPlanTask = new Task({
  description: `
    効果的な情報収集プランを策定し、リソースの割り当てと優先順位付けを最適化してください。
    以下の点を考慮してください：
    
    1. 各情報源とキーワードの優先順位付け
    2. 収集頻度とスケジュールの最適化
    3. 情報の価値評価メトリクスの設定
    4. リソース制約下での最大効果を得るための戦略
    
    入力：
    - 評価済み情報源: {{evaluated_sources}}
    - 優先キーワード: {{priority_keywords}}
    - リソース制約: {{resource_constraints}}
    - トレンド予測: {{trend_predictions}}
    
    出力：
    - 詳細な情報収集プラン
    - 優先順位付けロジック
    - 実装スケジュール
    - 成功指標と評価基準
  `,
  agent: PlanStrategistAgent as any // 型の互換性問題を一時的に回避
});

/**
 * 品質評価と改善提案タスク
 * クリティカルシンカーが担当
 */
export const EvaluateQualityTask = new Task({
  description: `
    提案されたナレッジグラフ構造と情報収集プランを批判的に評価し、
    改善点や盲点を指摘してください。以下の点を考慮してください：
    
    1. 論理的一貫性と完全性の評価
    2. 見落としている重要概念や関係性の特定
    3. 情報収集における潜在的なバイアスや盲点
    4. 改善のための具体的な提案
    
    入力：
    - グラフ構造設計: {{graph_structure}}
    - 情報収集プラン: {{collection_plan}}
    - 業界分析結果: {{industry_analysis}}
    - 元々の要件: {{original_requirements}}
    
    出力：
    - 品質評価レポート
    - 特定された問題点と改善提案
    - 対処すべき盲点のリスト
    - 改訂版のグラフ構造と収集プラン
  `,
  agent: CriticalThinkerAgent as any // 型の互換性問題を一時的に回避
});

/**
 * 最終統合と文書化タスク
 * 全エージェントの入力を統合
 */
export const IntegrateAndDocumentTask = new Task({
  description: `
    すべてのエージェントからの入力を統合し、最終的なナレッジグラフと情報収集プランを
    文書化してください。以下の点を考慮してください：
    
    1. すべての分析と評価結果の統合
    2. クリティカルシンカーの提案に基づく改善
    3. 明確で実行可能な最終プランの作成
    4. 視覚的に魅力的なナレッジグラフの定義
    
    入力：
    - 業界分析: {{industry_analysis}}
    - 情報源評価: {{source_evaluation}}
    - グラフ構造設計: {{graph_structure}}
    - 収集プラン: {{collection_plan}}
    - 品質評価: {{quality_assessment}}
    
    出力：
    - 完全な最終ナレッジグラフ定義
    - 詳細な情報収集プラン
    - 実装ガイダンス
    - エグゼクティブサマリー
  `,
  agent: CriticalThinkerAgent as any // 型の互換性問題を一時的に回避
});