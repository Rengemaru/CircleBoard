// 開催までの日数と、その表示文字列。
//
// トップ・一覧・詳細・サイネージの4画面が同じ文字列を出す必要があるのに、
// 書式化が各ページにコピーされていて、トップだけ「本日開催 / 開催済み」の
// 分岐が抜けていた（過去日に「あと-16日」と出る）。同じ表示は1か所にまとめる。

// 時刻を無視して日付だけで引くのは、サーバー側の計算(spec-v2.2.md §3.4)と
// 揃えるため
export function daysUntil(startsAt: string): number {
  const start = new Date(startsAt);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((startDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

// サイネージAPIだけはサーバーが days_until を返す(api-spec.md §5)ので、
// 日数から書式化する入口も要る
export function formatCountdownDays(days: number): string {
  if (days > 0) return `あと${days}日`;
  if (days === 0) return "本日開催";
  return "開催済み";
}

export function formatCountdown(startsAt: string): string {
  return formatCountdownDays(daysUntil(startsAt));
}
