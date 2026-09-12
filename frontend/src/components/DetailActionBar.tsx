import { FloatArea } from "smarthr-ui";

// 企画詳細の操作を、画面下端に固定してまとめる（Issue #302）。
//
// もとは「編集」が見出しと開催日時の間に挟まっていて、情報 → 操作 → 情報 と
// 切り替わっていた。利用者から「イベント情報と同列であるのか UX としてどうなの」
// という指摘を受けた形。
//
// **`FloatArea` は `position: sticky`。** スクロール中は下端に貼り付き、
// ページ末尾の定位置まで来るとそこに収まる。本文が隠れたままにならない。
// 追加のCSSは要らない（実装を読んで確認済み）。
//
// **本文幅に合わせる。** `MemberPage` の `Container` の中に置くだけでよく、
// 画面幅いっぱいにすると `Container` の外へ出すことになり、
// `MemberPage` の受け口を増やすことになる。
//
// **`primaryButton` は必須**なので、主操作が無い状態（owner など）では
// 編集を primary にする。呼び出し側でそこまで決めて渡す。
//
// 狭い幅（〜400px）では、`FloatArea` が内部で使う `Cluster` が
// `flex-wrap: wrap` なのでボタンが折り返す。横にはみ出さない。
export function DetailActionBar({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  if (primary === null) return null;

  return <FloatArea primaryButton={primary} secondaryButton={secondary} />;
}
