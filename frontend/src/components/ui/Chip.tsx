import { Button, Chip as ShrChip } from "smarthr-ui";

// タグを出す小さな枠と、選択に使う押せる版(docs/instructions.md Phase 8-4)。
//
// Badge と分けているのは役割が違うため。Badge（StatusLabel）は企画や
// アカウントの状態を示すもので、1オブジェクトに1つしか付けない。
// こちらはタグ・カテゴリ・権限のような「属性」で、いくつ付いてもよい。
// SmartHR も Chip を「オブジェクトのプロパティ」向けとしている。
// className と title を通すのは、タグを幅で切る必要があるため
// (TagChip。docs/spec-tags.md §3.3)。呼び出し側から指定できないと、
// タグだけ別の見た目を作る道ができてしまう
export function Chip({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <ShrChip size="S" className={className} title={title}>
      {children}
    </ShrChip>
  );
}

// 企画作成のタグ選択。押せる要素なので Chip では作らない。
// SmartHR は Chip にアクションを持たせないことを求めている。
//
// 見た目と選択の伝え方は一覧の絞り込み(FilterRow の FilterButton)と同じにする。
// 「選ぶ」という操作は同じなのに、画面ごとに形が違うと覚え直しになる。
export function FilterChip({
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
      // 選択中を色だけで示さない(guidelines/sensory-characteristics.mdx)
      prefix={active ? <span aria-hidden="true">✓</span> : undefined}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
