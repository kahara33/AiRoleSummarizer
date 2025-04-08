/**
 * WebSocketテスト用ヘルパー
 * AIエージェント間通信のテストとデバッグ用のユーティリティ関数
 */

import { sendAgentThoughts, sendProgressUpdate, getWebSocketServer } from './ws-server';

/**
 * テスト用のエージェントシミュレーション関数
 * 指定されたロールモデルIDに対して複数のエージェントからの思考を順番に送信し、実際のAIエージェント処理をシミュレートする
 */
export async function simulateAgentProcess(roleModelId: string, industry: string = '人工知能'): Promise<void> {
  if (!roleModelId) {
    console.error('roleModelIdが指定されていません');
    return;
  }

  console.log(`エージェントプロセスのシミュレーションを開始: roleModelId=${roleModelId}`);

  // 順番に実行するエージェント思考プロセス
  const agentThoughts = [
    {
      agentName: 'オーケストレーター',
      thought: 'AIエージェントチーム全体のタスクフローを設計し、エージェント間の連携を管理します。まず業界分析から始め、段階的にナレッジグラフと情報収集プランを構築していきます。',
      type: 'info',
      delay: 1000
    },
    {
      agentName: 'ドメイン分析者',
      thought: `${industry}業界の主要概念と関係性を分析しています。キーワードを抽出し、階層的な関係を構築します。市場セグメント、主要プレイヤー、技術トレンドを特定します。`,
      type: 'domain_analysis',
      delay: 2000
    },
    {
      agentName: 'トレンドリサーチャー',
      thought: `${industry}業界における最新トレンドと情報源を評価しています。信頼性の高い情報源を特定し、トレンド予測を行っています。`,
      type: 'trend_research',
      delay: 3000
    },
    {
      agentName: 'コンテキストマッパー',
      thought: 'ドメイン分析とトレンド情報に基づいて、効果的なナレッジグラフ構造を設計しています。ノード間の関連性を最適化し、情報の文脈を保持する構造を作成します。',
      type: 'context_mapping', 
      delay: 3000
    },
    {
      agentName: 'プランストラテジスト',
      thought: '情報収集の優先順位とリソース配分を最適化しています。収集すべき情報の種類、方法、スケジュールを計画しています。',
      type: 'plan_strategy',
      delay: 3000
    },
    {
      agentName: 'クリティカルシンカー',
      thought: 'ナレッジグラフと情報収集プランの品質を評価しています。論理的一貫性、完全性、原始要件との適合性を検証します。',
      type: 'critical_thinking',
      delay: 3000
    },
    {
      agentName: 'クリティカルシンカー',
      thought: '初回の評価結果に基づいて、ナレッジグラフと情報収集プランの改善ポイントを詳細に分析します。盲点や不足している視点を特定し、改善提案を行います。',
      type: 'critical_thinking',
      delay: 2000
    },
    {
      agentName: 'オーケストレーター',
      thought: 'すべてのエージェントの作業が完了しました。ナレッジグラフと情報収集プランが正常に生成されました。',
      type: 'success',
      delay: 2000
    }
  ];

  // 進捗状況の更新
  const progressUpdates = [
    { message: '開始: ナレッジグラフ生成プロセスを開始します', percent: 0, delay: 500 },
    { message: '業界分析: ドメインアナリストが業界分析を実行中...', percent: 5, delay: 2000 },
    { message: '業界分析が完了しました', percent: 15, delay: 3000 },
    { message: '情報源評価: トレンドリサーチャーが情報源評価を実行中...', percent: 20, delay: 3000 },
    { message: '情報源評価が完了しました', percent: 30, delay: 3000 },
    { message: 'グラフ構造設計: コンテキストマッパーがグラフ構造を設計中...', percent: 35, delay: 3000 },
    { message: 'グラフ構造設計が完了しました', percent: 45, delay: 3000 },
    { message: 'プラン策定: プランストラテジストが情報収集プランを策定中...', percent: 50, delay: 3000 },
    { message: '情報収集プラン策定が完了しました', percent: 60, delay: 3000 },
    { message: '品質評価: クリティカルシンカーが品質評価を実行中...', percent: 65, delay: 3000 },
    { message: '品質評価が完了しました', percent: 75, delay: 3000 },
    { message: '最終統合: 最終的なナレッジグラフと情報収集プランを統合中...', percent: 80, delay: 3000 },
    { message: '改善プロセス: フィードバックに基づいた改善プロセスを開始しています...', percent: 85, delay: 3000 },
    { message: 'ナレッジグラフ生成と情報収集プラン作成プロセスが完了しました', percent: 100, delay: 2000 }
  ];

  // WebSocket接続を確認
  const wsServer = getWebSocketServer();
  if (!wsServer) {
    console.error('WebSocketサーバーが初期化されていません');
    return;
  }

  console.log('WebSocketサーバーに接続して通信を開始します');

  // 進捗状況を順番に送信
  for (const progress of progressUpdates) {
    await new Promise(resolve => setTimeout(resolve, progress.delay));
    try {
      sendProgressUpdate({
        message: progress.message,
        percent: progress.percent,
        roleModelId
      });
      console.log(`進捗状況を送信: ${progress.percent}% - ${progress.message}`);
    } catch (error) {
      console.error('進捗状況送信エラー:', error);
    }
  }

  // エージェント思考を順番に送信
  for (const thought of agentThoughts) {
    await new Promise(resolve => setTimeout(resolve, thought.delay));
    try {
      sendAgentThoughts(
        thought.agentName,
        thought.thought,
        roleModelId,
        {
          type: thought.type,
          timestamp: new Date().toISOString(),
          id: Math.random().toString(36).substring(2, 15)
        }
      );
      console.log(`エージェント思考を送信: ${thought.agentName} - ${thought.thought.substring(0, 30)}...`);
    } catch (error) {
      console.error('エージェント思考送信エラー:', error);
    }
  }

  console.log('エージェントプロセスのシミュレーションが完了しました');
}

/**
 * 単一のテスト思考を送信する関数
 */
export function sendTestThought(
  agentName: string,
  thought: string,
  roleModelId: string,
  type: string = 'debug'
): void {
  try {
    sendAgentThoughts(
      agentName,
      thought,
      roleModelId,
      {
        type,
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substring(2, 15)
      }
    );
    console.log(`テスト思考を送信: ${agentName} - ${thought.substring(0, 30)}...`);
  } catch (error) {
    console.error('テスト思考送信エラー:', error);
    throw error;
  }
}