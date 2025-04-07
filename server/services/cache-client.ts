/**
 * キャッシュクライアント
 * AI/LLMサービスの呼び出し結果をキャッシュするための実装
 */

export class CacheClient {
  private cache: Map<string, { value: string, timestamp: number }>;
  private ttlMs: number; // Time to live in milliseconds

  constructor(ttlMs: number = 3600000) { // Default TTL: 1 hour
    this.cache = new Map();
    this.ttlMs = ttlMs;
  }

  /**
   * キャッシュからデータを取得
   * @param key キャッシュキー
   * @returns キャッシュされた値、またはnull
   */
  async get(key: string): Promise<string | null> {
    const hash = this.hashKey(key);
    const item = this.cache.get(hash);
    
    if (!item) {
      return null;
    }
    
    // 有効期限切れの場合
    if (Date.now() > item.timestamp + this.ttlMs) {
      this.cache.delete(hash);
      return null;
    }
    
    return item.value;
  }

  /**
   * データをキャッシュに保存
   * @param key キャッシュキー
   * @param value 保存する値
   */
  async set(key: string, value: string): Promise<void> {
    const hash = this.hashKey(key);
    this.cache.set(hash, {
      value,
      timestamp: Date.now()
    });
    
    // キャッシュサイズを管理（1000エントリーを超えたら古いものから削除）
    if (this.cache.size > 1000) {
      let oldestKey = null;
      let oldestTime = Infinity;
      
      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * キャッシュをクリア
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * キーの文字列ハッシュを生成
   * @param key 元のキー
   * @returns ハッシュ値
   */
  private hashKey(key: string): string {
    // 単純な文字列ハッシュ関数
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }
}