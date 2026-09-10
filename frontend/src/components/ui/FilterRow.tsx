import { Button, Cluster, Text } from "smarthr-ui";

// 一覧の絞り込み。イベントとプロジェクトで別々の部品を使っていて、
// 見た目も選択状態の伝え方も違っていた(Issue #60)。1つに揃える。
//
// 選択中を色だけで示さない。SmartHR の基準は「状態を色だけで表さず、
// テキストやラベルを併記する」(guidelines/sensory-characteristics.mdx)。
// ✓ を前に付けて、色が見えなくても選択が分かるようにする。
export function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      size="S"
      variant={active ? "primary" : "secondary"}
      // 押した状態を持つボタンであることを支援技術に伝える
      aria-pressed={active}
      prefix={active ? <span aria-hidden="true">✓</span> : undefined}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

// 何で絞り込んでいるのかを示すラベル。プロジェクトは「状態」と「タグ」の
// 2軸があり、ラベルが無いとどちらの行を触っているのか分からない。
// イベントは1軸だが、両画面で形を揃えるために同じ形にする。
export function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Cluster align="center" gap="XS" className="border-b border-gray-200 p-3">
      <Text size="S" color="TEXT_GREY" className="w-14 shrink-0">
        {label}
      </Text>
      {children}
    </Cluster>
  );
}
