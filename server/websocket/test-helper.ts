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

  // 速い表示と対話性を持つエージェント思考プロセス
  const agentThoughts = [
    {
      agentName: 'オーケストレーター',
      thought: `チームの皆さん、${industry}業界の分析と知識構造化を進めていきましょう。ドメイン分析から始め、段階的にナレッジグラフを構築します。ドメイン分析者、まずは基本的な業界構造の分析をお願いします。`,
      type: 'info',
      delay: 300
    },
    {
      agentName: 'ドメイン分析者',
      thought: `了解しました。${industry}業界の主要概念と関係性を分析していきます。市場セグメントは主に「A」「B」「C」に分類され、主要プレイヤーとしては「X社」「Y社」が支配的です。技術トレンドとしては...`,
      type: 'domain_analysis',
      delay: 500
    },
    {
      agentName: 'オーケストレーター',
      thought: `ありがとう、ドメイン分析者。トレンドリサーチャー、この業界の最新動向と信頼できる情報源について調査をお願いします。`,
      type: 'info',
      delay: 300
    },
    {
      agentName: 'トレンドリサーチャー',
      thought: `調査を始めます。${industry}業界では、最近「D技術」が急速に普及し始めており、今後2年間で市場の30%を占めると予測されています。信頼性の高い情報源としては、「E研究所」の報告書が最も詳細なデータを提供しています。`,
      type: 'trend_research',
      delay: 500
    },
    {
      agentName: 'オーケストレーター',
      thought: `素晴らしい情報です。コンテキストマッパー、これらの分析結果を基にナレッジグラフの基本構造を設計できますか？`,
      type: 'info',
      delay: 300
    },
    {
      agentName: 'コンテキストマッパー',
      thought: 'ドメイン分析とトレンド情報を統合します。中心ノードを「業界コア技術」とし、そこから市場セグメント、プレイヤー、技術トレンドへと放射状に展開する構造が最適でしょう。各ノード間の関連性を強化するため、「影響度」と「依存度」の2軸で関係を定義します。',
      type: 'context_mapping', 
      delay: 500
    },
    {
      agentName: 'プランストラテジスト',
      thought: '構造案を拝見しました。この構造に基づき、情報収集の優先順位を提案します。まずは「E研究所」の最新レポートから「D技術」の詳細データを収集し、次に主要プレイヤーの戦略分析、最後に市場セグメントの成長予測データを集めるべきです。',
      type: 'plan_strategy',
      delay: 500
    },
    {
      agentName: 'クリティカルシンカー',
      thought: '現在の計画では、新興企業の動向分析が不足しています。また、国際市場と国内市場の比較視点も弱いと感じます。これらの要素も取り入れることで、より包括的な分析が可能になるでしょう。',
      type: 'critical_thinking',
      delay: 500
    },
    {
      agentName: 'オーケストレーター',
      thought: '重要な指摘ありがとうございます。プランストラテジスト、新興企業の動向と国際市場の比較分析も優先度に組み込んでいただけますか？',
      type: 'info',
      delay: 300
    },
    {
      agentName: 'プランストラテジスト',
      thought: '承知しました。計画を修正します。新興企業については「スタートアップデータベース」から情報を収集し、国際市場比較については「グローバルマーケットレポート」を主要情報源とします。収集スケジュールも1週間前倒しで調整します。',
      type: 'plan_strategy',
      delay: 500
    },
    {
      agentName: 'クリティカルシンカー',
      thought: '修正された計画は非常に良好です。追加する視点は「技術採用サイクル」の分析がさらに深みを加えるでしょう。全体として、このナレッジグラフと情報収集プランは包括的で実行可能性が高いと評価します。',
      type: 'critical_thinking',
      delay: 500
    },
    {
      agentName: 'オーケストレーター',
      thought: 'チーム全員の協力に感謝します。最終的なナレッジグラフ構造と情報収集プランが完成しました。全ての視点が組み込まれ、実行可能な優れた計画が出来上がりました。これより実行フェーズに移行します。',
      type: 'success',
      delay: 500
    }
  ];

  // 速い進捗状況の更新
  const progressUpdates = [
    { message: '開始: ナレッジグラフ生成プロセスを開始します', percent: 0, delay: 100 },
    { message: '業界分析: ドメインアナリストが業界分析を実行中...', percent: 10, delay: 300 },
    { message: '業界分析が完了しました', percent: 20, delay: 300 },
    { message: '情報源評価: トレンドリサーチャーが情報源評価を実行中...', percent: 30, delay: 300 },
    { message: '情報源評価が完了しました', percent: 40, delay: 300 },
    { message: 'グラフ構造設計: コンテキストマッパーがグラフ構造を設計中...', percent: 50, delay: 300 },
    { message: 'グラフ構造設計が完了しました', percent: 60, delay: 300 },
    { message: 'プラン策定: プランストラテジストが情報収集プランを策定中...', percent: 70, delay: 300 },
    { message: '情報収集プラン策定が完了しました', percent: 80, delay: 300 },
    { message: '品質評価: クリティカルシンカーが品質評価を実行中...', percent: 90, delay: 300 },
    { message: 'ナレッジグラフ生成と情報収集プラン作成プロセスが完了しました', percent: 100, delay: 300 }
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