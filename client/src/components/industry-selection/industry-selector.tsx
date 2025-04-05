import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IndustrySelectorProps {
  selectedIndustries: string[];
  onSelectIndustry: (industryId: string, selected: boolean) => void;
  maxHeight?: string;
  title?: string;
}

type IndustrySubCategory = {
  id: string;
  name: string;
  parentCategory: string;
};

type IndustryCategory = {
  id: string;
  name: string;
  subCategories: IndustrySubCategory[];
};

// 固定の業界カテゴリーとサブカテゴリー
const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  {
    id: "auto-machine",
    name: "自動車・機械",
    subCategories: [
      { id: "auto-domestic", name: "自動車(国内)", parentCategory: "auto-machine" },
      { id: "auto-overseas", name: "自動車(海外)", parentCategory: "auto-machine" },
      { id: "next-gen-auto", name: "次世代自動車", parentCategory: "auto-machine" },
      { id: "auto-parts", name: "自動車部品", parentCategory: "auto-machine" },
      { id: "motorcycle", name: "2輪車", parentCategory: "auto-machine" },
      { id: "truck", name: "トラック", parentCategory: "auto-machine" },
      { id: "tire", name: "タイヤ", parentCategory: "auto-machine" },
      { id: "maas", name: "MaaS・ライドシェア", parentCategory: "auto-machine" },
      { id: "used-car", name: "中古車", parentCategory: "auto-machine" },
      { id: "aircraft", name: "航空機", parentCategory: "auto-machine" },
      { id: "construction-machine", name: "建設機械", parentCategory: "auto-machine" },
      { id: "machine-tool", name: "工作機械", parentCategory: "auto-machine" },
      { id: "robot", name: "ロボット", parentCategory: "auto-machine" },
      { id: "shipbuilding", name: "造船", parentCategory: "auto-machine" },
      { id: "car-parts", name: "カー用品", parentCategory: "auto-machine" },
      { id: "bicycle", name: "自転車", parentCategory: "auto-machine" },
      { id: "map-navi", name: "地図・ナビ", parentCategory: "auto-machine" },
      { id: "industrial-machine", name: "産業機械", parentCategory: "auto-machine" },
      { id: "air-cooling", name: "空調・冷却", parentCategory: "auto-machine" },
      { id: "battery", name: "電池", parentCategory: "auto-machine" }
    ]
  },
  {
    id: "electronics",
    name: "エレクトロニクス機器",
    subCategories: [
      { id: "appliance", name: "白物・家電製品", parentCategory: "electronics" },
      { id: "tv", name: "テレビ", parentCategory: "electronics" },
      { id: "pc-tablet", name: "パソコン・タブレット", parentCategory: "electronics" },
      { id: "smartphone", name: "スマートフォン", parentCategory: "electronics" },
      { id: "digital-camera", name: "デジタルカメラ", parentCategory: "electronics" },
      { id: "ac", name: "エアコン", parentCategory: "electronics" },
      { id: "printer", name: "複合機・プリンター", parentCategory: "electronics" },
      { id: "medical-device", name: "医療機器・用品", parentCategory: "electronics" },
      { id: "electronic-parts", name: "電子部品", parentCategory: "electronics" },
      { id: "semiconductor", name: "半導体", parentCategory: "electronics" },
      { id: "lithium-battery", name: "リチウムイオン・全固体電池", parentCategory: "electronics" },
      { id: "semiconductor-equipment", name: "半導体製造装置", parentCategory: "electronics" },
      { id: "semiconductor-material", name: "半導体材", parentCategory: "electronics" },
      { id: "semiconductor-material2", name: "半導体材料", parentCategory: "electronics" },
      { id: "power-semiconductor", name: "パワー半導体", parentCategory: "electronics" }
    ]
  },
  {
    id: "it-internet",
    name: "情報通信・インターネット",
    subCategories: [
      { id: "ai", name: "AI", parentCategory: "it-internet" },
      { id: "cloud", name: "クラウド", parentCategory: "it-internet" },
      { id: "ecommerce", name: "eコマース", parentCategory: "it-internet" },
      { id: "system-dev", name: "システム開発", parentCategory: "it-internet" },
      { id: "saas", name: "ソフトウェア(SaaS)", parentCategory: "it-internet" },
      { id: "mobile-carrier", name: "携帯電話事業者", parentCategory: "it-internet" },
      { id: "internet-line", name: "インターネット回線", parentCategory: "it-internet" },
      { id: "cybersecurity", name: "サイバーセキュリティー", parentCategory: "it-internet" },
      { id: "web-app", name: "Webアプリ", parentCategory: "it-internet" },
      { id: "quantum-computer", name: "量子コンピューター", parentCategory: "it-internet" },
      { id: "dx", name: "DX", parentCategory: "it-internet" },
      { id: "youtuber", name: "ユーチューバー(YouTuber)", parentCategory: "it-internet" },
      { id: "mobile-sales", name: "携帯電話販売代理店", parentCategory: "it-internet" },
      { id: "metaverse", name: "メタバース", parentCategory: "it-internet" },
      { id: "nft", name: "NFT", parentCategory: "it-internet" },
      { id: "programming", name: "プログラミング", parentCategory: "it-internet" },
      { id: "medical-tech", name: "医療テック", parentCategory: "it-internet" },
      { id: "web3", name: "Web3", parentCategory: "it-internet" }
    ]
  },
  {
    id: "resource-energy",
    name: "資源・エネルギー・素材",
    subCategories: [
      { id: "electric-gas", name: "電力・ガス", parentCategory: "resource-energy" },
      { id: "oil-resource", name: "石油・資源(海外)", parentCategory: "resource-energy" },
      { id: "mining-rare", name: "鉱・レアル", parentCategory: "resource-energy" },
      { id: "steel", name: "鉄鋼", parentCategory: "resource-energy" },
      { id: "oil-domestic", name: "石油(国内)", parentCategory: "resource-energy" },
      { id: "chemical", name: "化学", parentCategory: "resource-energy" },
      { id: "textile", name: "繊維", parentCategory: "resource-energy" },
      { id: "glass", name: "ガラス", parentCategory: "resource-energy" },
      { id: "cement", name: "セメント", parentCategory: "resource-energy" },
      { id: "paint", name: "塗料", parentCategory: "resource-energy" },
      { id: "nonferrous-metal", name: "非鉄金属", parentCategory: "resource-energy" },
      { id: "electric-cable", name: "電線・ケーブル", parentCategory: "resource-energy" },
      { id: "carbon", name: "原炭素", parentCategory: "resource-energy" },
      { id: "energy-geopolitics", name: "エネルギー地政学", parentCategory: "resource-energy" }
    ]
  },
  {
    id: "finance-corporate",
    name: "金融・法人サービス",
    subCategories: [
      { id: "megabank", name: "メガバンク", parentCategory: "finance-corporate" },
      { id: "regional-bank", name: "地方銀行", parentCategory: "finance-corporate" },
      { id: "credit-union", name: "信用金庫・信用組合", parentCategory: "finance-corporate" },
      { id: "credit-card", name: "クレジットカード・決済", parentCategory: "finance-corporate" },
      { id: "global-finance", name: "グローバル金融", parentCategory: "finance-corporate" },
      { id: "net-bank", name: "ネット銀行", parentCategory: "finance-corporate" },
      { id: "investment-fund", name: "投資ファンド", parentCategory: "finance-corporate" },
      { id: "securities", name: "証券", parentCategory: "finance-corporate" },
      { id: "credit-finance", name: "信用金融", parentCategory: "finance-corporate" },
      { id: "lease", name: "リース", parentCategory: "finance-corporate" },
      { id: "life-insurance", name: "生命保険", parentCategory: "finance-corporate" },
      { id: "general-insurance", name: "損害保険", parentCategory: "finance-corporate" },
      { id: "consulting", name: "コンサルティング", parentCategory: "finance-corporate" },
      { id: "law-firm", name: "弁護士事務所", parentCategory: "finance-corporate" },
      { id: "audit-firm", name: "監査法人", parentCategory: "finance-corporate" },
      { id: "hr-service", name: "人材サービス", parentCategory: "finance-corporate" },
      { id: "cashless", name: "キャッシュレス", parentCategory: "finance-corporate" },
      { id: "crypto", name: "仮想通貨・ブロックチェーン", parentCategory: "finance-corporate" },
      { id: "venture-vc", name: "ベンチャーVC", parentCategory: "finance-corporate" },
      { id: "activist", name: "アクティビスト", parentCategory: "finance-corporate" },
      { id: "ma-merger", name: "M&A仲介・合併", parentCategory: "finance-corporate" },
      { id: "nonprofit", name: "公益法人・NPO", parentCategory: "finance-corporate" },
      { id: "pr-ir", name: "PR・IR", parentCategory: "finance-corporate" },
      { id: "esg", name: "ESG", parentCategory: "finance-corporate" },
      { id: "stock-exchange", name: "証券取引所", parentCategory: "finance-corporate" },
      { id: "research-company", name: "調査会社", parentCategory: "finance-corporate" },
      { id: "investment", name: "投資(株式・FX・不動産)", parentCategory: "finance-corporate" },
      { id: "spot-work", name: "スポットワーク", parentCategory: "finance-corporate" }
    ]
  },
  {
    id: "food-agriculture",
    name: "食品・農業",
    subCategories: [
      { id: "processed-food", name: "加工食品", parentCategory: "food-agriculture" },
      { id: "flour", name: "製粉", parentCategory: "food-agriculture" },
      { id: "beverage-food", name: "飲料・食品", parentCategory: "food-agriculture" },
      { id: "alcohol", name: "酒類", parentCategory: "food-agriculture" },
      { id: "confectionery", name: "菓子", parentCategory: "food-agriculture" },
      { id: "agri-fishery", name: "農業・水産", parentCategory: "food-agriculture" },
      { id: "meat", name: "食肉", parentCategory: "food-agriculture" },
      { id: "tobacco", name: "たばこ", parentCategory: "food-agriculture" },
      { id: "smart-agriculture", name: "スマート農業", parentCategory: "food-agriculture" },
      { id: "fertilizer", name: "肥料・農薬流通", parentCategory: "food-agriculture" },
      { id: "alt-food", name: "代替食", parentCategory: "food-agriculture" },
      { id: "livestock", name: "畜産", parentCategory: "food-agriculture" }
    ]
  },
  {
    id: "living-goods",
    name: "生活用品・嗜好品・薬",
    subCategories: [
      { id: "pharmaceutical", name: "医薬品", parentCategory: "living-goods" },
      { id: "advanced-medical", name: "先端医療ベンチャー", parentCategory: "living-goods" },
      { id: "cosmetics", name: "化粧品", parentCategory: "living-goods" },
      { id: "toiletry", name: "トイレタリー(日用品)", parentCategory: "living-goods" },
      { id: "stationery", name: "文具品・事務用品", parentCategory: "living-goods" },
      { id: "toys", name: "玩具", parentCategory: "living-goods" },
      { id: "jewelry", name: "時計・宝飾品", parentCategory: "living-goods" },
      { id: "luxury", name: "ラグジュアリーブランド", parentCategory: "living-goods" },
      { id: "cro-pharma", name: "CRO・臨床検査・薬", parentCategory: "living-goods" },
      { id: "glasses", name: "眼鏡", parentCategory: "living-goods" },
      { id: "hearing-aid", name: "補聴器・コンタクトレンズ", parentCategory: "living-goods" },
      { id: "bags", name: "かばん", parentCategory: "living-goods" }
    ]
  },
  {
    id: "entertainment-media",
    name: "娯楽・エンタメ・メディア",
    subCategories: [
      { id: "leisure-themepark", name: "レジャー・テーマパーク", parentCategory: "entertainment-media" },
      { id: "travel", name: "旅行", parentCategory: "entertainment-media" },
      { id: "hotel", name: "ホテル", parentCategory: "entertainment-media" },
      { id: "movie-anime", name: "映画・アニメ", parentCategory: "entertainment-media" },
      { id: "music-production", name: "音楽プロダクション", parentCategory: "entertainment-media" },
      { id: "pro-sports", name: "プロスポーツ", parentCategory: "entertainment-media" },
      { id: "sports-fitness", name: "スポーツ・フィットネス", parentCategory: "entertainment-media" },
      { id: "music", name: "音楽", parentCategory: "entertainment-media" },
      { id: "pachinko", name: "パチンコ・パチスロ", parentCategory: "entertainment-media" },
      { id: "game", name: "ゲーム", parentCategory: "entertainment-media" },
      { id: "video-streaming", name: "動画配信", parentCategory: "entertainment-media" },
      { id: "broadcaster", name: "放送局", parentCategory: "entertainment-media" },
      { id: "advertising", name: "広告", parentCategory: "entertainment-media" },
      { id: "event", name: "イベント", parentCategory: "entertainment-media" },
      { id: "global-media", name: "グローバルメディア", parentCategory: "entertainment-media" },
      { id: "expo-ir", name: "万博・統合型リゾート(IR)", parentCategory: "entertainment-media" },
      { id: "entertainment-business", name: "興業関係", parentCategory: "entertainment-media" },
      { id: "esports", name: "eスポーツ", parentCategory: "entertainment-media" },
      { id: "movie", name: "映画", parentCategory: "entertainment-media" },
      { id: "internet-media", name: "ネットメディア", parentCategory: "entertainment-media" },
      { id: "newspaper", name: "新聞社", parentCategory: "entertainment-media" },
      { id: "publishing", name: "出版", parentCategory: "entertainment-media" },
      { id: "bookstore", name: "書店・電気", parentCategory: "entertainment-media" }
    ]
  },
  {
    id: "construction-realestate",
    name: "建設・不動産",
    subCategories: [
      { id: "plant-engineering", name: "プラント・エンジニアリング", parentCategory: "construction-realestate" },
      { id: "construction", name: "建設", parentCategory: "construction-realestate" },
      { id: "realestate", name: "不動産", parentCategory: "construction-realestate" },
      { id: "detached-house", name: "戸建て住宅", parentCategory: "construction-realestate" },
      { id: "apartment", name: "マンション", parentCategory: "construction-realestate" },
      { id: "realestate-broker", name: "不動産仲介", parentCategory: "construction-realestate" },
      { id: "apartment-management", name: "マンション管理", parentCategory: "construction-realestate" },
      { id: "renovation", name: "リフォーム・リノベーション", parentCategory: "construction-realestate" },
      { id: "home-equipment", name: "住宅設備", parentCategory: "construction-realestate" },
      { id: "shared-office", name: "シェアオフィス", parentCategory: "construction-realestate" },
      { id: "design", name: "設計", parentCategory: "construction-realestate" },
      { id: "wood", name: "木材", parentCategory: "construction-realestate" },
      { id: "specialist-construction", name: "専門工事", parentCategory: "construction-realestate" },
      { id: "water-plant", name: "水処理プラント", parentCategory: "construction-realestate" }
    ]
  },
  {
    id: "transport-logistics",
    name: "運輸・物流",
    subCategories: [
      { id: "rail-vehicle", name: "鉄道車両", parentCategory: "transport-logistics" },
      { id: "air-transport", name: "空運", parentCategory: "transport-logistics" },
      { id: "marine-transport", name: "海運", parentCategory: "transport-logistics" },
      { id: "land-transport", name: "陸運", parentCategory: "transport-logistics" },
      { id: "logistics-3pl", name: "物流(3PL)", parentCategory: "transport-logistics" },
      { id: "logistics-sagawa", name: "物流(佐川)", parentCategory: "transport-logistics" },
      { id: "warehouse", name: "倉庫・物流倉庫", parentCategory: "transport-logistics" },
      { id: "bus-taxi", name: "バス・タクシー", parentCategory: "transport-logistics" },
      { id: "linear-shinkansen", name: "リニア新幹線", parentCategory: "transport-logistics" }
    ]
  },
  {
    id: "retail-food",
    name: "流通・外食",
    subCategories: [
      { id: "convenience-store", name: "コンビニエンスストア", parentCategory: "retail-food" },
      { id: "supermarket", name: "スーパー", parentCategory: "retail-food" },
      { id: "department-mall", name: "百貨店・ショッピングセンター", parentCategory: "retail-food" },
      { id: "furniture-interior", name: "家具・インテリア", parentCategory: "retail-food" },
      { id: "home-center", name: "ホームセンター", parentCategory: "retail-food" },
      { id: "drugstore", name: "ドラッグストア", parentCategory: "retail-food" },
      { id: "electronics-retailer", name: "家電量販店", parentCategory: "retail-food" },
      { id: "apparel", name: "アパレル", parentCategory: "retail-food" },
      { id: "general-trading", name: "総合商社", parentCategory: "retail-food" },
      { id: "specialty-trading", name: "専門商社", parentCategory: "retail-food" },
      { id: "catalog-tv", name: "カタログ・テレビ通販", parentCategory: "retail-food" },
      { id: "cafe", name: "カフェ", parentCategory: "retail-food" },
      { id: "dining", name: "外食(ファミレス、すし、居酒屋)", parentCategory: "retail-food" },
      { id: "tv-rebroadcast", name: "テレビ局・再放", parentCategory: "retail-food" },
      { id: "fast-food", name: "外食(ファストフード、惣菜)", parentCategory: "retail-food" },
      { id: "used-clothes", name: "リユース(古着)", parentCategory: "retail-food" },
      { id: "outdoor-goods", name: "アウトドア商品", parentCategory: "retail-food" },
      { id: "used-shipping", name: "古着・宅配", parentCategory: "retail-food" },
      { id: "household-goods", name: "生活雑貨", parentCategory: "retail-food" },
      { id: "discount-store", name: "ディスカウント店・100円ショップ", parentCategory: "retail-food" },
      { id: "food-delivery", name: "配食", parentCategory: "retail-food" }
    ]
  },
  {
    id: "living-public",
    name: "生活・公共サービス",
    subCategories: [
      { id: "municipality", name: "市区町村", parentCategory: "living-public" },
      { id: "infant", name: "幼児", parentCategory: "living-public" },
      { id: "ceremony", name: "冠婚", parentCategory: "living-public" },
      { id: "funeral", name: "葬儀", parentCategory: "living-public" },
      { id: "education-cram", name: "教育・学習塾", parentCategory: "living-public" },
      { id: "wedding", name: "ウエディング", parentCategory: "living-public" },
      { id: "nursing-care", name: "介護", parentCategory: "living-public" },
      { id: "hospital-group", name: "病院グループ", parentCategory: "living-public" },
      { id: "ministry", name: "国内各省庁(省庁名)", parentCategory: "living-public" },
      { id: "reskilling", name: "リスキリング", parentCategory: "living-public" },
      { id: "pet", name: "ペット", parentCategory: "living-public" },
      { id: "childcare", name: "育児・保育", parentCategory: "living-public" },
      { id: "life-service", name: "生活サービス", parentCategory: "living-public" },
      { id: "beauty-salon", name: "理美容サロン", parentCategory: "living-public" },
      { id: "english-learning", name: "英会話学習", parentCategory: "living-public" },
      { id: "university", name: "大学", parentCategory: "living-public" },
      { id: "sharing-economy", name: "シェアリングエコノミー", parentCategory: "living-public" }
    ]
  },
  {
    id: "region",
    name: "地域",
    subCategories: [
      { id: "tokyo-it", name: "東京(GAFAM・IT)", parentCategory: "region" },
      { id: "tokyo-manufacture", name: "東京(製造・運輸)", parentCategory: "region" },
      { id: "tokyo-retail", name: "東京(流通・消費)", parentCategory: "region" },
      { id: "china", name: "中国", parentCategory: "region" },
      { id: "hokkaido-tohoku", name: "北海道・東北地方", parentCategory: "region" },
      { id: "kanto", name: "関東地方", parentCategory: "region" },
      { id: "chubu", name: "中部地方", parentCategory: "region" },
      { id: "kinki", name: "近畿地方", parentCategory: "region" },
      { id: "chugoku-shikoku", name: "中国・四国地方", parentCategory: "region" },
      { id: "kyushu-okinawa", name: "九州・沖縄", parentCategory: "region" }
    ]
  }
];

export default function IndustrySelector({
  selectedIndustries,
  onSelectIndustry,
  maxHeight = "400px",
  title = "業界カテゴリー選択"
}: IndustrySelectorProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // カテゴリーの展開状態をトグルする
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // 選択済みの業界数
  const selectedCount = selectedIndustries.length;

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        {selectedCount > 0 && (
          <div className="flex items-center mt-2">
            <Badge variant="outline" className="mr-2">
              {selectedCount}件選択中
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea style={{ height: maxHeight }}>
          <Accordion
            type="multiple"
            value={expandedCategories}
            className="w-full"
          >
            {INDUSTRY_CATEGORIES.map((category) => (
              <AccordionItem 
                key={category.id} 
                value={category.id}
                className="border-b"
              >
                <AccordionTrigger 
                  onClick={() => toggleCategory(category.id)}
                  className="hover:no-underline py-2 px-1"
                >
                  <span className="font-medium">{category.name}</span>
                  <Badge variant="outline" className="ml-2 font-normal">
                    {category.subCategories.length}
                  </Badge>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 gap-2 py-2">
                    {category.subCategories.map((subcategory) => (
                      <div 
                        key={subcategory.id}
                        className="flex items-center space-x-2 px-2 py-1 rounded-md hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          id={`industry-${subcategory.id}`}
                          checked={selectedIndustries.includes(subcategory.id)}
                          onCheckedChange={(checked) => {
                            onSelectIndustry(subcategory.id, checked === true);
                          }}
                        />
                        <label
                          htmlFor={`industry-${subcategory.id}`}
                          className="text-sm cursor-pointer flex-grow"
                        >
                          {subcategory.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}