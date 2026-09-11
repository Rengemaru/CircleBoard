import { useMemo } from "react";
import { MultiCombobox } from "smarthr-ui";
import type { Tag } from "../types/event";

// 一覧の絞り込み用のタグ選択(docs/spec-tags.md §3.6)。
//
// **creatable は付けない。** 絞り込みの場で新しいタグを作る意味がない。
// 作れるのは企画かプロフィールに付けるときだけ(§3.5)。
//
// TagPicker と分けているのは、こちらが**IDを主キーにできる**ため。
// URL の ?tag_ids= を据え置いているので(§3.7)、名前に直す必要がない。
// 逆に TagPicker は「まだ存在しないタグ」を扱うので名前しか使えない。
type Props = {
  candidates: Tag[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

export function TagFilter({ candidates, selectedIds, onChange }: Props) {
  const toItem = (tag: Tag) => ({ value: String(tag.id), label: tag.name });

  // 選択済みは候補から外す。残すと「もう絞り込んでいるタグ」を再度選べてしまう
  const items = useMemo(
    () => candidates.filter((tag) => !selectedIds.includes(tag.id)).map(toItem),
    [candidates, selectedIds],
  );

  const selectedItems = useMemo(
    () => candidates.filter((tag) => selectedIds.includes(tag.id)).map(toItem),
    [candidates, selectedIds],
  );

  // FilterRow は Cluster(flex) なので、幅を持たせないとラベルの横に並ばず
  // 下へ折り返す。min-w-0 が無いと、長いタグ名で行ごと押し広げられる
  return (
    <div className="min-w-0 flex-1">
      <MultiCombobox
        items={items}
        selectedItems={selectedItems}
        selectedItemEllipsis
        width="100%"
        dropdownHelpMessage="選んだタグのどれかが付いた企画を出します"
        onSelect={(item) => onChange([...selectedIds, Number(item.value)])}
        onDelete={(item) => onChange(selectedIds.filter((id) => id !== Number(item.value)))}
      />
    </div>
  );
}
