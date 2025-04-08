/**
 * デバッグ用のエージェントメッセージ送信ヘルパー
 * ナレッジグラフの自動生成およびエージェント思考可視化のためのメッセージを生成します
 */

import { v4 as uuidv4 } from 'uuid';
import { sendAgentThoughts, sendProgressUpdate } from '../websocket/ws-server';

/**
 * 役割名から適切なエージェント名のリストを取得
 */
function getAgentNamesForRole(roleName: string): string[] {
  return [
    'ドメイン分析者',
    'トレンド調査者',
    'コンテキストマッパー',
    'プランストラテジスト',
    'クリティカルシンカー'
  ];
}

/**
 * 役割モデルに関するデモ思考プロセスを生成
 */
export function sendRoleModelDemoThoughts(roleModelId: string, roleName: string): void {
  const agents = getAgentNamesForRole(roleName);
  const thoughts = [
    // ドメイン分析者
    `役割モデル "${roleName}" のドメイン分析を開始します。\n\n` +
    `この役割に関連する主要な領域、必要なスキル、および業界の文脈を分析しています...\n` +
    `分析が完了しました。主要な専門知識領域を特定しました。`,
    
    // トレンド調査者
    `"${roleName}" に関連するトレンドを調査しています。\n\n` +
    `最新の業界動向、技術変化、および市場の要求を評価中...\n` +
    `関連するキーワードと、それらがどのように相互接続されているかを特定しました。`,
    
    // コンテキストマッパー
    `収集された情報を構造化しています。\n\n` +
    `主要カテゴリの特定:\n` +
    `1. 情報収集目的\n2. 情報源と技術リソース\n3. 業界専門知識\n4. トレンド分析\n5. 実践応用分野\n\n` +
    `階層構造を構築し、各カテゴリの関連性と重要度を評価しました。`,
    
    // プランストラテジスト
    `構造化された情報に基づき、最適な知識グラフ構造を設計しています。\n\n` +
    `各ノード間の関係性を定義し、効果的な情報アクセスパスを作成しました。\n` +
    `ノードとエッジの構成が完了しました。`,
    
    // クリティカルシンカー
    `最終的な知識グラフを検証しています。\n\n` +
    `ノード数: 10+\nエッジ数: 10+\n\n` +
    `ルートノード: "${roleName}"\n` +
    `一次レベルノード: "情報収集目的", "情報源と技術リソース", "業界専門知識", "トレンド分析", "実践応用分野"\n\n` +
    `知識グラフが正常に生成されました。`
  ];
  
  // 時間差で各エージェントの思考を送信
  thoughts.forEach((thought, index) => {
    setTimeout(() => {
      sendAgentThoughts(
        agents[index],
        thought,
        roleModelId,
        {
          id: uuidv4(),
          step: `demo_thought_${index + 1}`,
          timestamp: new Date().toISOString()
        }
      );
    }, index * 1000); // 1秒ごとに送信
  });
}

/**
 * 単一のデバッグメッセージを送信
 */
export function sendDebugAgentThought(
  roleModelId: string, 
  message: string = "デバッグメッセージ：WebSocket通信が正常に機能しています。"
): void {
  sendAgentThoughts(
    'デバッグエージェント',
    message,
    roleModelId,
    {
      id: uuidv4(),
      step: 'debug',
      timestamp: new Date().toISOString()
    }
  );
}