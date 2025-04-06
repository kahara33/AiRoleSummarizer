import { callAzureOpenAI } from '../azure-openai';
import { sendProgressUpdate } from '../websocket';
import { db } from '../db';
import { industries } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class IndustryAnalysisAgent {
  private roleModelId: string;

  constructor(roleModelId: string) {
    this.roleModelId = roleModelId;
  }

  /**
   * 業界の分析を行う
   * @param industryIds 業界ID配列
   * @returns 業界分析結果
   */
  async analyzeIndustries(industryIds: string[]): Promise<any[]> {
    try {
      // 進捗状況を更新
      sendProgressUpdate(
        '業界分析を開始',
        5,
        this.roleModelId,
        {
          message: '業界データの取得中',
          progress: 5,
          stage: 'planning',
          subStage: '業界分析'
        }
      );

      // 業界データの取得
      const industryData = await Promise.all(
        industryIds.map(async (id) => {
          const industry = await db.query.industries.findFirst({
            where: eq(industries.id, id)
          });
          return industry;
        })
      );

      // 有効な業界データをフィルタリング
      const validIndustryData = industryData.filter(Boolean);
      
      if (validIndustryData.length === 0) {
        // 有効な業界データがない場合はデフォルト分析を返す
        return this.getDefaultAnalysis();
      }
      
      // 進捗状況を更新
      sendProgressUpdate(
        '業界データ分析中',
        15,
        this.roleModelId,
        {
          message: '収集した業界データの分析を実行中',
          progress: 15,
          stage: 'planning',
          subStage: '業界分析'
        }
      );

      // 業界分析用のプロンプト作成
      const prompt = `
以下の業界について、情報収集計画に役立つ分析を行ってください。
それぞれの業界について、主要トレンド、重要な情報源、注目すべきサブセクターを特定してください。
結果はJSON形式で返してください。

業界データ:
${JSON.stringify(validIndustryData.map(ind => ({
  name: ind.name,
  category: ind.category
})))}

必要な出力フォーマット:
[
  {
    "name": "業界名",
    "category": "カテゴリ",
    "trends": ["トレンド1", "トレンド2", ...],
    "sources": ["情報源1", "情報源2", ...],
    "subsectors": ["サブセクター1", "サブセクター2", ...],
    "relevance": "高/中/低"
  },
  ...
]
`;

      // Azure OpenAIを使用して分析
      const response = await callAzureOpenAI([
        {
          role: 'system',
          content: 'あなたは業界分析の専門家です。正確で詳細な業界の分析情報を提供してください。'
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
          const analysisResult = JSON.parse(jsonMatch[1]);
          
          // 進捗状況を更新
          sendProgressUpdate(
            '業界分析完了',
            20,
            this.roleModelId,
            {
              message: '業界分析が完了しました',
              progress: 20,
              stage: 'planning',
              subStage: '業界分析'
            }
          );
          
          return analysisResult;
        } catch (e) {
          console.error('JSON解析エラー:', e);
          return this.getDefaultAnalysis();
        }
      } else {
        console.error('JSON形式のレスポンスを抽出できませんでした');
        return this.getDefaultAnalysis();
      }
    } catch (error) {
      console.error('業界分析エラー:', error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * デフォルトの業界分析を返す
   * @returns デフォルト分析結果
   */
  private getDefaultAnalysis(): any[] {
    return [
      {
        name: "テクノロジー",
        category: "IT",
        trends: ["人工知能の発展", "クラウドコンピューティングの普及", "サイバーセキュリティの重要性"],
        sources: ["Tech Crunch", "Wired", "MIT Technology Review"],
        subsectors: ["ソフトウェア開発", "ハードウェア製造", "ITサービス"],
        relevance: "高"
      },
      {
        name: "ビジネスサービス",
        category: "サービス",
        trends: ["リモートワークの継続", "デジタルトランスフォーメーション", "サブスクリプションモデル"],
        sources: ["Harvard Business Review", "Forbes", "Bloomberg"],
        subsectors: ["コンサルティング", "アウトソーシング", "人材サービス"],
        relevance: "中"
      }
    ];
  }
}