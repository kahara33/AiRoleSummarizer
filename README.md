# EVERYS自律型情報収集サービス

このプロジェクトは、Azure AIを活用して、ユーザー定義の役割モデルと階層的な知識グラフに基づいて情報を収集・要約するシステムです。複数のAIエージェントが協調して動作し、インテリジェントな情報収集と分析を行います。

## 主な機能

1. **ロールモデル管理**
   - 対話型のダイアログを用いた定義
   - 組織ベースのロール共有機能

2. **階層型マインドマップ可視化**
   - React Flowを用いた知識グラフのインタラクティブな可視化
   - Neo4jを用いたグラフ構造の永続化

3. **AI支援情報収集**
   - Azure OpenAIを活用した情報分析
   - CrewAI、LangChain、LlamaIndexを活用したマルチAIエージェントアーキテクチャ

4. **日次ダイジェスト生成**
   - ユーザーの関心に合わせたパーソナライズされた情報要約
   - フィードバックループによる継続的な改善

## 技術スタック

- **フロントエンド**: React、TypeScript、React Flow
- **バックエンド**: Node.js、Express
- **データベース**: PostgreSQL、Neo4j
- **AIサービス**: Azure OpenAI
- **通信**: WebSocket、Socket.IO
- **認証**: Passport.js、express-session

## エージェント構成

- **IndustryAnalysisAgent**: 業界分析と産業構造の理解
- **KeywordExpansionAgent**: キーワードの拡張と関連語の生成
- **StructuringAgent**: 情報の構造化と整理
- **KnowledgeGraphAgent**: 知識グラフの生成と更新
- **OrchestratorAgent**: 全体の調整とエージェント間の連携

## 開発者向け情報

### 環境変数

- `AZURE_OPENAI_KEY`: Azure OpenAIのAPIキー
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAIのエンドポイント（例: https://everys-openai.openai.azure.com/）
- `AZURE_OPENAI_DEPLOYMENT`: デプロイメント名（例: gpt-4o）

### 管理者アカウント

- メール: k.harada@everys.jp
- 組織: EVERYS

### 構築方法

1. 依存関係のインストール
   ```
   npm install
   ```

2. 開発サーバーの起動
   ```
   npm run dev
   ```

3. データベースの初期化
   ```
   npm run db:push
   ```

© 2025 EVERYS