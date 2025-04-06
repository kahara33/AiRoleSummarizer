import { sendProgressUpdate } from './server/websocket';

// 単純なテスト
function testProgressUpdate() {
  console.log('進捗更新のテスト開始');
  
  try {
    sendProgressUpdate(
      'テストメッセージ',
      50,
      'test-role-model-id',
      {
        message: 'テストメッセージ',
        progress: 50,
        stage: 'テスト',
        subStage: 'ステージ1'
      }
    );
    console.log('進捗更新メッセージを送信しました');
  } catch (error) {
    console.error('進捗更新テストエラー:', error);
  }
}

// 実行
console.log('診断スクリプト開始');
testProgressUpdate();
console.log('診断スクリプト完了');