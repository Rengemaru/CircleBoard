import { Cluster, PageHeading as ShrPageHeading } from "smarthr-ui";

// 画面の先頭に置く「画面名 + その画面で何ができるか」(docs/instructions.md Phase 8-4)。
//
// smarthr-ui の PageHeading は h1 を出すと同時に、autoPageTitle で
// document.title も書き換える。ブラウザのタブと履歴に画面名が残るので、
// 自前の h1 に戻すとタブが全部「CircleBoard」になる。
//
// suffix をここに固定しているのは、画面ごとに書くと1つだけ書き忘れても
// 誰も気づかないため。実際 /create と /legal は suffix 無しだった。
const PAGE_TITLE_SUFFIX = "CircleBoard";

export function PageHeading({
  title,
  subtitle,
  action,
  // 下の余白。管理画面のようにトップバーの中へ置くときは "" で消す
  className = "mb-5",
  // 画面名の大きさ。smarthr-ui は太さではなく大きさで階層を作るので、
  // 同じ画面に太字の情報が並ぶところ（イベント詳細のカウントダウン）では
  // 一段大きくしないとタイトルが埋もれる
  size = "L",
  // 見出しを画面に出さずに置く。トップのように、ヘッダーのロゴが
  // 実質の画面名になっていて見出しを重ねると冗長な場所で使う(Issue #58)
  visuallyHidden = false,
}: {
  title: string;
  subtitle?: string;
  // 見出し行の右端に置く主操作（例: 「＋ イベントを作成」）
  action?: React.ReactNode;
  className?: string;
  size?: "L" | "XL";
  visuallyHidden?: boolean;
}) {
  return (
    <Cluster align="center" justify="space-between" className={className}>
      <div>
        <ShrPageHeading
          size={size}
          visuallyHidden={visuallyHidden}
          pageTitleSuffix={PAGE_TITLE_SUFFIX}
        >
          {title}
        </ShrPageHeading>
        {subtitle !== undefined && <p className="mt-px text-xs text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </Cluster>
  );
}
