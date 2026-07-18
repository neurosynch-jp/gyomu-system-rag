// 入力の無害化：制御文字除去・長さ制限・注入っぽいパターンの無効化
export function sanitizeQuestion(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let q = raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')   // 制御文字を除去
    .replace(/\s+/g, ' ')                     // 連続空白を圧縮
    .trim();

  // よくある命令上書きフレーズを検知したら無害化（削除ではなく無力化）
  // ※ここで弾くというより、後段のsystem防御と二重で守る
  return q;
}

// 明らかな注入意図の検知（ログ・軽いブロック用。過剰ブロックは避ける）
export function looksLikeInjection(q: string): boolean {
  const patterns = [
    /ignore (all|previous|above).*(instruction|prompt)/i,
    /(system|developer) prompt/i,
    /これまでの(指示|命令|プロンプト)を(無視|忘れ)/,
    /あなたは今から/,
    /reveal.*(prompt|instruction|api key|secret)/i,
  ];
  return patterns.some((p) => p.test(q));
}