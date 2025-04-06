import { callAzureOpenAI } from '../azure-openai';
import { sendProgressUpdate } from '../websocket';
import { db } from '../db';
import { keywords } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class KeywordExpansionAgent {
  private roleModelId: string;

  constructor(roleModelId: string) {
    this.roleModelId = roleModelId;
  }

  /**
   * キーワードの拡張と関連付けを行う
   * @param keywordIds キーワードID配列
   * @param industryAnalysis 業界分析結果
   * @returns 拡張キーワード
   */
  async expandKeywords(keywordIds: string[], industryAnalysis: any[]): Promise<any[]> {
    try {
      // 進捗状況を更新
      sendProgressUpdate(
        'キーワード拡張を開始',
        20,
        this.roleModelId,
        {
          message: 'キーワードデータの取得中',
          progress: 20,
          stage: 'planning',
          subStage: 'キーワード拡張'
        }
      );

      // キーワードデータの取得
      const keywordData = await Promise.all(
        keywordIds.map(async (id) => {
          const keyword = await db.query.keywords.findFirst({
            where: eq(keywords.id, id)
          });
          return keyword;
        })
      );

      // 有効なキーワードデータをフィルタリング
      const validKeywordData = keywordData.filter(Boolean);
      
      if (validKeywordData.length === 0) {
        // 有効なキーワードデータがない場合はデフォルト分析を返す
        return this.getDefaultKeywords();
      }
      
      // 進捗状況を更新
      sendProgressUpdate(
        'キーワード拡張分析中',
        25,
        this.roleModelId,
        {
          message: '収集したキーワードの拡張と関連付けを実行中',
          progress: 25,
          stage: 'planning',
          subStage: 'キーワード拡張'
        }
      );

      // キーワード拡張用のプロンプト作成
      const prompt = `
以下のキーワードと業界分析に基づいて、情報収集に役立つ関連キーワードを拡張してください。
また、それぞれのキーワードの関連性、優先度を評価し、検索に役立つ追加キーワードも提案してください。
結果はJSON形式で返してください。

キーワードデータ:
${JSON.stringify(validKeywordData.map(kw => ({
  name: kw.name,
  category: kw.category
})))}

業界分析:
${JSON.stringify(industryAnalysis)}

必要な出力フォーマット:
[
  {
    "original": "元のキーワード名",
    "expanded": ["関連キーワード1", "関連キーワード2", ...],
    "context": "キーワードのコンテキスト説明",
    "priority": "高/中/低",
    "search_combinations": ["検索組み合わせ1", "検索組み合わせ2", ...]
  },
  ...
]
`;

      // Azure OpenAIを使用して分析
      const response = await callAzureOpenAI([
        {
          role: 'system',
          content: 'あなたはキーワード分析の専門家です。効果的な情報収集のためのキーワード拡張と関連付けを提供してください。'
        },
        {
          role: 'user',
          content: prompt
        }
      ], 0.7, 1500);
      
      // JSONフォーマットから分析結果を抽出
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                       response.match(/```\n([\s\S]*?)\n```/) || 
                       response.match(/({[\s\S]*})/);
      
      if (jsonMatch && jsonMatch[1]) {
        try {
          const expandedKeywords = JSON.parse(jsonMatch[1]);
          
          // 進捗状況を更新
          sendProgressUpdate(
            'キーワード拡張完了',
            30,
            this.roleModelId,
            {
              message: 'キーワードの拡張と関連付けが完了しました',
              progress: 30,
              stage: 'planning',
              subStage: 'キーワード拡張'
            }
          );
          
          return expandedKeywords;
        } catch (e) {
          console.error('JSON解析エラー:', e);
          return this.getDefaultKeywords();
        }
      } else {
        console.error('JSON形式のレスポンスを抽出できませんでした');
        return this.getDefaultKeywords();
      }
    } catch (error) {
      console.error('キーワード拡張エラー:', error);
      return this.getDefaultKeywords();
    }
  }

  /**
   * デフォルトのキーワード拡張を返す
   * @returns デフォルトキーワード拡張結果
   */
  private getDefaultKeywords(): any[] {
    return [
      {
        original: "人工知能",
        expanded: ["機械学習", "深層学習", "自然言語処理", "コンピュータビジョン"],
        context: "人工知能技術の各分野とアプリケーション",
        priority: "高",
        search_combinations: ["人工知能 最新技術", "AI ビジネス活用 事例", "機械学習 導入効果"]
      },
      {
        original: "デジタルトランスフォーメーション",
        expanded: ["DX推進", "業務効率化", "レガシーシステム刷新", "クラウド移行"],
        context: "企業におけるデジタル変革の取り組みと課題",
        priority: "中",
        search_combinations: ["DX 成功事例", "デジタル変革 業界別", "DX 推進体制"]
      }
    ];
  }
}