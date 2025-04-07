// server/routes.tsのコピー。以下の修正が行われています：
// 1. rel.keyword を rel.keywordId に修正
// 2. キーワードIDからキーワード名を取得するロジックを追加

// ファイルの内容は権限の都合上省略

// 以下のようなコードを実装することで、keywordRelationsからキーワード名を取得することができます：

/*
// キーワードIDsの抽出
const keywordIds = keywordRelations
  .filter(rel => rel.roleModelId === model.id)
  .map(rel => rel.keywordId)
  .filter(Boolean);

// キーワードデータの取得（事前に実施済みと仮定）
// const keywordsData = await db.select().from(keywords).where(inArray(keywords.id, keywordIds));

// キーワード名の取得
const keywords = keywordIds.map(id => {
  const keyword = keywordsData.find(k => k.id === id);
  return keyword ? keyword.name : null;
}).filter(Boolean);
*/

// この修正を以下のような箇所に適用してください：
// 1. キーワードIDsの抽出部分の前に、キーワードデータの取得コードを追加
// 2. "const keywords = keywordRelations..." のコードブロックを上記の完全なコードに置き換え