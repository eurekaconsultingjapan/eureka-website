/* サイトの計測設定（ここだけ書き換えれば全ページに効く）
   ga4Id        : Google アナリティクス4 の測定ID（例 "G-XXXXXXXXXX"）。空なら GA は読み込まない
   collectorUrl : 訪問者ごとの記録を受け取る Google Apps Script のウェブアプリURL（…/exec）。空なら送らない
   formEntries  : Googleフォームの「受付ID」欄の entry 番号。フォームに訪問者IDを自動で入れて、閲覧履歴と問い合わせをつなぐ */
window.EU_CONFIG = {
  ga4Id: "G-SRS2X0QDPZ",
  collectorUrl: "https://script.google.com/macros/s/AKfycbyQVKYDGyx4Clp0M6wkJjkqkr514BpuNYauA52XTdPTMQf5--wPf3934bQNuLnhooGR3w/exec",
  formEntries: {
    contact: "entry.972146878",   // お問い合わせフォームの「受付ID」
    document: "entry.2312459"   // 資料請求フォームの「受付ID」
  }
};
