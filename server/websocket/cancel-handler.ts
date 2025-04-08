import { sendProgressUpdate, sendAgentThoughts } from './ws-server';

// キャンセル処理の実装
export async function handleCancelOperation(roleModelId: string, payload: any): Promise<void> {
  try {
    const { operationType } = payload;
    
    console.log(`操作キャンセルリクエスト: roleModelId=${roleModelId}, operationType=${operationType}`);
    
    // 現状ではUIのリセットが主な処理（将来的にはサーバー側の処理も中断）
    // サーバー側でも保留中の処理があれば中断するロジックを追加予定
    
    // キャンセル通知を送信
    sendProgressUpdate({
      message: '処理がキャンセルされました',
      percent: 0,
      roleModelId
    });
    
    // キャンセル理由を記録
    sendAgentThoughts(
      'システム',
      `ユーザーからの要求により処理がキャンセルされました。operationType: ${operationType}`,
      roleModelId,
      { 
        step: 'cancel', 
        type: 'system',
        cancel: true
      }
    );
    
    console.log(`処理キャンセル通知を送信: roleModelId=${roleModelId}`);
    
  } catch (error) {
    console.error('キャンセル処理エラー:', error);
    
    // エラーメッセージを送信
    sendProgressUpdate({
      message: 'キャンセル処理中にエラーが発生しました',
      percent: 0,
      roleModelId
    });
  }
}