import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef, useMemo } from 'react';
import { useAuth } from './use-auth';
import { useToast } from '@/hooks/use-toast';

// WebSocketメッセージの型定義
interface WSMessage {
  type: string;
  payload: any;
  timestamp?: string;
}

// WebSocketコンテキストの状態の型定義
interface MultiAgentWebSocketContextState {
  isConnected: boolean;
  connect: (roleModelId: string) => void;
  disconnect: () => void;
  sendMessage: (type: string, payload: any) => void;
  sendCreateKnowledgeGraphRequest: (params: CreateKnowledgeGraphParams) => void;
  sendCancelOperationRequest: (operationType: string) => void;
  cancelOperation: () => boolean;
  isProcessing: boolean;
  messages: WSMessage[];
  agentThoughts: AgentThought[];
  progressUpdates: ProgressUpdate[];
  clearMessages: () => void;
}

// ナレッジグラフ生成リクエストパラメータの型定義
interface CreateKnowledgeGraphParams {
  industry: string;
  keywords: string[];
  sources?: string[];
  constraints?: string[];
  requirements?: string[];
}

// エージェント思考の型定義
interface AgentThought {
  id?: string;
  agentName: string;
  thought: string;
  message?: string;
  timestamp: string;
  roleModelId: string;
  step?: string;
  type?: string;
  agentType?: string;
}

// 進捗更新の型定義
interface ProgressUpdate {
  message: string;
  percent: number;
  timestamp: string;
  roleModelId?: string;
}

// デフォルト値を持つコンテキスト作成
const MultiAgentWebSocketContext = createContext<MultiAgentWebSocketContextState>({
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
  sendMessage: () => {},
  sendCreateKnowledgeGraphRequest: () => {},
  sendCancelOperationRequest: () => {},
  cancelOperation: () => false,
  isProcessing: false,
  messages: [],
  agentThoughts: [],
  progressUpdates: [],
  clearMessages: () => {}
});

// WebSocketプロバイダーコンポーネント
export function MultiAgentWebSocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [agentThoughts, setAgentThoughts] = useState<AgentThought[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [currentRoleModelId, setCurrentRoleModelId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // WebSocketへのメッセージ送信
  const sendMessage = useCallback((type: string, payload: any) => {
    console.log('送信メッセージ準備:', type, payload);
    
    // 1. ソケットが存在し、接続状態であることを確認
    if (!socket) {
      console.error('WebSocketインスタンスが存在しません');
      toast({
        title: '接続エラー',
        description: 'サーバーへの接続が確立されていません。ページを更新してください。',
        variant: 'destructive'
      });
      return;
    }
    
    // 2. 接続状態の追加チェック
    if (socket.readyState !== WebSocket.OPEN) {
      console.error(`WebSocketが開いていません。現在の状態: ${socket.readyState}`);
      setIsConnected(false);
      
      toast({
        title: '接続エラー',
        description: 'サーバーとの接続が切断されています。再接続しています...',
        variant: 'destructive'
      });
      
      // 自動再接続を試みる
      if (currentRoleModelId) {
        console.log('自動再接続を試みます...');
        connect(currentRoleModelId);
        
        // 再接続後、少し待ってからメッセージを再送信
        setTimeout(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            try {
              const message = {
                type,
                payload,
                timestamp: new Date().toISOString()
              };
              console.log('再接続後のメッセージ送信:', message);
              socket.send(JSON.stringify(message));
            } catch (e) {
              console.error('再送信エラー:', e);
            }
          }
        }, 1000);
      }
      
      return;
    }
    
    // 3. すべての条件を満たしている場合、メッセージを送信
    try {
      const message = {
        type,
        payload,
        timestamp: new Date().toISOString()
      };
      console.log('WebSocketメッセージ送信:', message);
      socket.send(JSON.stringify(message));
    } catch (error) {
      console.error('WebSocketメッセージ送信エラー:', error);
      toast({
        title: 'エラー',
        description: 'サーバーとの通信中にエラーが発生しました。',
        variant: 'destructive'
      });
    }
  }, [socket, isConnected, toast]);

  // ナレッジグラフ生成リクエスト
  const sendCreateKnowledgeGraphRequest = useCallback((params: CreateKnowledgeGraphParams) => {
    sendMessage('create_knowledge_graph', params);
  }, [sendMessage]);
  
  // 操作キャンセルリクエスト
  const sendCancelOperationRequest = useCallback((operationType: string) => {
    sendMessage('cancel_operation', { operationType });
  }, [sendMessage]);

  // 前回の接続試行時間を記録
  const lastConnectAttemptRef = useRef<number>(0);
  
  // 接続状態をモニタリングする変数
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 10; // 最大再接続試行回数を10回に増加
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 定期的なping送信のインターバルを管理
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // WebSocket接続関数（デバウンス処理付き）
  const connect = useCallback((roleModelId: string) => {
    if (!user) {
      console.warn('ユーザーがログインしていないため、WebSocket接続を確立できません');
      return;
    }
    
    // 短時間に複数の接続要求が発生するのを防ぐ（1秒以内の再接続を防止）
    const now = Date.now();
    if (now - lastConnectAttemptRef.current < 1000) {
      console.log('短時間での再接続を防止します。前回の接続からの経過時間:', now - lastConnectAttemptRef.current, 'ms');
      return;
    }
    lastConnectAttemptRef.current = now;
    
    // 既に同じロールモデルに接続済みの場合は接続しない
    if (socket && isConnected && currentRoleModelId === roleModelId) {
      console.log(`既に ${roleModelId} に接続済みです。再接続をスキップします。`);
      // 念のため接続状態を確認
      if (socket.readyState !== WebSocket.OPEN) {
        console.warn('WebSocketが接続済みと認識されていますが、実際には開いていません。状態:', socket.readyState);
        // 再接続を試みる
        setIsConnected(false);
      } else {
        return; // 本当に接続されている場合は何もしない
      }
    }

    // 再接続タイムアウトがある場合はクリア
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // 既存の接続を閉じる
    if (socket) {
      console.log('既存のWebSocket接続を閉じます');
      socket.close();
    }

    // 接続先URLの構築 - パスとクエリパラメータの設定
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // WebSocketの接続安定性のために、より堅牢な接続URLを生成
    // タイムスタンプとランダム値を追加してキャッシュ問題を防止
    const timestamp = Date.now();
    const randomValue = Math.random().toString(36).substring(2, 8);
    const wsUrl = `${protocol}//${host}/api/ws?userId=${user.id}&roleModelId=${roleModelId}&t=${timestamp}&r=${randomValue}`;
    console.log('WebSocket接続URL:', wsUrl);

    try {
      console.log('WebSocket接続を試みています...');
      const newSocket = new WebSocket(wsUrl);
      setCurrentRoleModelId(roleModelId);
      
      // 接続開始の即時ログ
      console.log('WebSocketオブジェクトが作成されました。状態:', newSocket.readyState);

      // WebSocketイベントハンドラ設定
      newSocket.onopen = () => {
        console.log('WebSocket接続が確立されました');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // 接続成功したら再接続試行回数をリセット
        toast({
          title: '接続成功',
          description: 'リアルタイム更新が有効になりました',
          variant: 'default'
        });
        
        // 接続後すぐに最初のping送信
        setTimeout(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            try {
              newSocket.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
              console.log('最初のping送信');
            } catch (e) {
              console.error('ping送信エラー:', e);
            }
          }
        }, 1000);
        
        // pingIntervalを設定する前に既存のものがあればクリア
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // 定期的なpingを15秒間隔で送信（接続をアクティブに保つため）
        const pingInterval = setInterval(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            try {
              newSocket.send(JSON.stringify({ 
                type: 'ping', 
                payload: { roleModelId },
                timestamp: new Date().toISOString() 
              }));
              // ログは出力しない（コンソールを占有しないため）
            } catch (e) {
              console.error('定期的なping送信エラー:', e);
            }
          } else if (newSocket.readyState === WebSocket.CLOSED || newSocket.readyState === WebSocket.CLOSING) {
            // ソケットが閉じられている場合はインターバルをクリア
            clearInterval(pingInterval);
            pingIntervalRef.current = null;
          }
        }, 15000); // 15秒間隔
        
        pingIntervalRef.current = pingInterval;
      };

      newSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          handleMessage(message);
        } catch (error) {
          console.error('WebSocketメッセージの解析エラー:', error);
        }
      };

      newSocket.onclose = (event) => {
        console.log('WebSocket接続が閉じられました', event.code, event.reason);
        setIsConnected(false);

        // コードが1000以外でも再接続を試みる（ブラウザのネットワーク状態変更による自動切断など対応）
        // 再接続試行回数をインクリメント
        reconnectAttemptsRef.current++;
        
        // 最初の2回は短い間隔、その後は指数バックオフで再接続
        let reconnectDelay = 500; // 初回は0.5秒
        if (reconnectAttemptsRef.current === 2) {
          reconnectDelay = 1000; // 2回目は1秒
        } else if (reconnectAttemptsRef.current > 2) {
          // 3回目以降は指数バックオフ（2秒、4秒、8秒...最大30秒）
          reconnectDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 2), 30000);
        }
        
        console.log(`${reconnectDelay / 1000}秒後に再接続を試みます... (試行: ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
        
        // 最大再接続回数に達していない場合のみ再接続を試みる
        if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
          // 再接続のインジケーターを表示（オプション）
          if (reconnectAttemptsRef.current > 2) {
            toast({
              title: '接続の再確立中',
              description: `サーバーとの接続を再確立しています... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
              duration: reconnectDelay - 100, // 少し短めに設定
            });
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (currentRoleModelId) {
              connect(currentRoleModelId);
            }
          }, reconnectDelay);
        } else {
          console.error('最大再接続試行回数に達しました。手動での再接続が必要です。');
          toast({
            title: '接続エラー',
            description: 'サーバーへの接続に失敗しました。ページを再読み込みするか、しばらく経ってから再試行してください。',
            variant: 'destructive'
          });
        }
      };

      newSocket.onerror = (error) => {
        console.error('WebSocketエラー:', error);
        toast({
          title: '接続エラー',
          description: 'サーバーへの接続中にエラーが発生しました。しばらくしてから再試行してください。',
          variant: 'destructive'
        });
      };

      setSocket(newSocket);
    } catch (error) {
      console.error('WebSocket接続エラー:', error);
      toast({
        title: '接続エラー',
        description: 'サーバーへの接続に失敗しました',
        variant: 'destructive'
      });
    }
  }, [user, socket, toast, currentRoleModelId]);

  // WebSocket切断関数
  const disconnect = useCallback(() => {
    // 再接続タイムアウトがある場合はクリア
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Ping間隔も必ずクリア
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    if (socket) {
      socket.close(1000, 'クライアントからの切断');
      setSocket(null);
      setIsConnected(false);
      setCurrentRoleModelId(null);
      reconnectAttemptsRef.current = 0; // 再接続カウンターをリセット
      console.log('WebSocket接続を切断しました');
    }
  }, [socket]);

  // メッセージクリア関数
  const clearMessages = useCallback(() => {
    setMessages([]);
    setAgentThoughts([]);
    setProgressUpdates([]);
  }, []);

  // コンポーネントのアンマウント時に接続をクリーンアップ
  useEffect(() => {
    return () => {
      // 再接続タイムアウトがある場合はクリア
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // ping間隔があればクリア
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      if (socket) {
        socket.close(1000, 'コンポーネントがアンマウントされました');
        console.log('コンポーネントのアンマウントによりWebSocket接続を閉じました');
      }
    };
  }, [socket]);
  
  // 定期的に接続状態をチェックする
  useEffect(() => {
    const checkConnectionInterval = setInterval(() => {
      if (socket && socket.readyState !== WebSocket.OPEN && currentRoleModelId) {
        console.warn('WebSocketが切断されています。再接続を試みます...');
        setIsConnected(false);
        connect(currentRoleModelId);
      } else if (socket && socket.readyState === WebSocket.OPEN) {
        // 接続中の場合はpingを送信（ハートビート）
        try {
          socket.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
          console.log('Ping送信（接続確認）');
        } catch (e) {
          console.error('Ping送信エラー:', e);
          setIsConnected(false);
        }
      }
    }, 30000); // 30秒ごとにチェック
    
    return () => clearInterval(checkConnectionInterval);
  }, [socket, currentRoleModelId, connect]);
  
  // メッセージタイプに応じた処理関数を定義（整理のため）
  const handleMessage = useCallback((message: WSMessage) => {
    console.log('WebSocketメッセージを受信:', message);
    
    // デバッグブロードキャストを検出して対処
    if (message.payload && message.payload._debug_broadcast) {
      console.log('デバッグブロードキャストメッセージを受信しました。通常のメッセージ処理をスキップします:', message.type);
      return;
    }
    
    // pongメッセージの場合は接続確認のみで特別な処理はしない
    if (message.type === 'pong') {
      console.log('Pong受信（接続確認OK）');
      return;
    }
    
    switch (message.type) {
      case 'agent_thought':
      case 'agent_thoughts': // agent_thoughtsもサポート
        if (message.payload) {
          console.log(`エージェント思考を受信 (${message.type})`, message);
          
          // データからエージェント名と思考内容を安全に取得
          const agentName = message.payload.agentName || message.payload.agent || '未知のエージェント';
          
          // 思考内容をさまざまなフィールドから可能な限り取得
          let thought = '';
          if (typeof message.payload.thought === 'string') {
            thought = message.payload.thought;
          } else if (typeof message.payload.message === 'string') {
            thought = message.payload.message;
          } else if (typeof message.payload.content === 'string') {
            thought = message.payload.content;
          } else if (typeof message.payload === 'string') {
            thought = message.payload;
          } else {
            // オブジェクトの場合は文字列化して適切なエラーメッセージを表示
            try {
              thought = typeof message.payload === 'object' ? 
                JSON.stringify(message.payload, null, 2) : 
                '不明なデータ形式';
            } catch (e) {
              thought = '不明なデータ形式';
            }
          }
          
          const agentThought: AgentThought = {
            id: message.payload.id || crypto.randomUUID().toString(),
            agentName,
            thought,
            message: thought, // 互換性のため両方のフィールドにセット
            type: message.payload.type || 'generic',
            roleModelId: message.payload.roleModelId || currentRoleModelId || '',
            timestamp: message.timestamp || new Date().toISOString(),
            step: message.payload.step
          };
          
          console.log('エージェント思考を追加:', agentThought);
          setAgentThoughts(prev => [...prev, agentThought]);
          
          // エージェント思考が来たときに進捗更新も送信（10%刻み）
          // これにより、エージェント思考があればプログレスバーも更新される
          if (currentRoleModelId) {
            const stepToProgress: Record<string, number> = {
              'domain_analysis_start': 10,
              'trend_research_preparation': 20,
              'context_mapping_preparation': 30,
              'plan_strategist_preparation': 40,
              'processing': 50,
              'result_compilation': 70,
              'finalization': 90
            };
            
            // ステップに基づいてプログレスを決定
            const percent = message.payload.step && stepToProgress[message.payload.step] 
              ? stepToProgress[message.payload.step] 
              : (Math.floor(Math.random() * 5) + 5) * 10; // ステップ不明なら10〜50%のランダム値
            
            // エラーの場合は0%に設定
            const isError = message.payload.error === true || message.payload.step === 'error';
            
            const progressUpdate: ProgressUpdate = {
              message: isError 
                ? `エラーが発生しました: ${message.payload.message || '不明なエラー'}` 
                : `${agentName}が処理中: ${thought.substring(0, 30)}...`,
              percent: isError ? 0 : percent,
              timestamp: new Date().toISOString(),
              roleModelId: currentRoleModelId
            };
            
            setProgressUpdates(prev => [...prev, progressUpdate]);
          }
        } else {
          console.warn('エージェント思考メッセージにペイロードがありません:', message);
        }
        break;

      case 'progress-update':
        if (message.payload) {
          console.log('進捗更新を受信:', message.payload);
          const update: ProgressUpdate = {
            message: message.payload.message,
            percent: message.payload.percent,
            timestamp: message.timestamp || new Date().toISOString(),
            roleModelId: message.payload.roleModelId || currentRoleModelId || undefined
          };
          setProgressUpdates(prev => [...prev, update]);
          
          // 完了通知（100%）の場合はトースト表示
          if (update.percent === 100) {
            toast({
              title: '処理完了',
              description: update.message || 'ナレッジグラフと情報収集プランの生成が完了しました',
              variant: 'default'
            });
          }
          
          // エラー通知（0%）の場合はトースト表示
          if (update.percent === 0) {
            toast({
              title: 'エラー',
              description: update.message || '処理中にエラーが発生しました',
              variant: 'destructive'
            });
          }
        }
        break;

      case 'chat_message':
        setMessages(prev => [...prev, message]);
        break;

      case 'crewai_error':
        toast({
          title: 'エラー',
          description: message.payload.message || 'ナレッジグラフの生成中にエラーが発生しました',
          variant: 'destructive'
        });
        break;

      default:
        // その他のメッセージはそのまま保存
        setMessages(prev => [...prev, message]);
        break;
    }
  }, [currentRoleModelId, toast]);


  
  // 処理中かどうかの状態を計算
  // 処理中の状態をより明確に判定
  const isProcessing = useMemo(() => {
    // 進捗が存在し、かつそのうち1つでも100%未満のものがあれば処理中と判断
    if (progressUpdates.length === 0) {
      return false;
    }
    
    // 最新の進捗が100%未満なら処理中と判断
    const latestUpdate = progressUpdates[progressUpdates.length - 1];
    if (latestUpdate && latestUpdate.percent < 100) {
      return true;
    }

    // 過去20秒以内に更新された進捗で100%未満のものがあれば処理中と判断
    const twentySecondsAgo = new Date(Date.now() - 20000).toISOString();
    return progressUpdates.some(update => 
      update.percent < 100 && 
      update.timestamp > twentySecondsAgo
    );
  }, [progressUpdates]);

  // キャンセル操作の実行関数
  const cancelOperation = useCallback(() => {
    if (!isConnected) {
      console.error('WebSocketが接続されていないため、操作をキャンセルできません');
      return false;
    }
    
    try {
      console.log('操作のキャンセルを要求します');
      sendMessage('cancel_operation', { timestamp: Date.now() });
      return true;
    } catch (error) {
      console.error('操作のキャンセル中にエラーが発生しました:', error);
      return false;
    }
  }, [isConnected, sendMessage]);
  
  // コンテキスト値の構築
  const value = {
    isConnected,
    connect,
    disconnect,
    sendMessage,
    sendCreateKnowledgeGraphRequest,
    sendCancelOperationRequest,
    cancelOperation,
    isProcessing,
    messages,
    agentThoughts,
    progressUpdates,
    clearMessages
  };

  return (
    <MultiAgentWebSocketContext.Provider value={value}>
      {children}
    </MultiAgentWebSocketContext.Provider>
  );
}

// カスタムフック
export function useMultiAgentWebSocket() {
  const context = useContext(MultiAgentWebSocketContext);
  if (context === undefined) {
    throw new Error('useMultiAgentWebSocketはMultiAgentWebSocketProviderの中で使用する必要があります');
  }
  
  // 最新の進捗状況を計算するロジックを追加
  const progressStatus = useMemo(() => {
    const progressMsgs = context.messages.filter(msg => 
      (msg.type === 'progress' || msg.type === 'progress-update' || msg.type === 'crewai_progress') && 
      msg.payload && 
      typeof msg.payload.progress === 'number'
    );
    
    if (progressMsgs.length === 0) return null;
    
    const latestMsg = progressMsgs[progressMsgs.length - 1];
    return {
      progress: typeof latestMsg.payload.progress === 'number' ? latestMsg.payload.progress : 0,
      message: typeof latestMsg.payload.message === 'string' ? latestMsg.payload.message : 
               typeof latestMsg.payload.stage === 'string' ? latestMsg.payload.stage : '処理中...'
    };
  }, [context.messages]);
  
  // コンテキストを拡張して返す
  return {
    ...context,
    progressStatus
  };
}