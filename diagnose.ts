import { sendProgressUpdate, sendAgentThoughts } from './server/websocket/ws-server';

// 単純なテスト
function testMessages() {
  console.log('WebSocketメッセージテスト開始');
  const roleModelId = 'test-role-model-123';
  
  // 進捗更新のテスト
  try {
    // 進捗更新メッセージ
    sendProgressUpdate({
      message: 'テスト進捗メッセージ',
      percent: 50,
      roleModelId
    });
    console.log('進捗更新メッセージを送信しました');
    
    // エージェント思考テスト
    const agents = [
      'Domain Analyst',
      'Trend Researcher', 
      'Context Mapper',
      'Plan Strategist',
      'Critical Thinker'
    ];
    
    agents.forEach((agentName, index) => {
      setTimeout(() => {
        console.log(`${agentName}のテスト思考を送信します...`);
        sendAgentThoughts(
          agentName, 
          `これは${agentName}からのテスト思考です。エージェントはデータを分析し、情報を処理しています。`, 
          roleModelId,
          {
            agentType: index % 2 === 0 ? 'thinking' : 'info',
            step: `step-${index + 1}`
          }
        );
      }, index * 1000); // 1秒ごとに送信
    });
  } catch (error) {
    console.error('WebSocketメッセージテストエラー:', error);
  }
}

// 実行
console.log('診断スクリプト開始');
testMessages();
console.log('診断スクリプト完了 - 各メッセージは非同期で送信されます');