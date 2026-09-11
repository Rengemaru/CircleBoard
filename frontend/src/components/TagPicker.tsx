import { useMemo } from "react";
import { MultiCombobox, Text } from "smarthr-ui";
import type { Tag } from "../types/event";

// タグの選択欄。企画の作成/編集とプロフィール編集で同じものを使う
// (docs/spec-tags.md §3.6)。
//
// 選んだ値を**名前**で持つ。まだ存在しないタグはIDを持てないので、IDを
// 主キーにすると「その場で足したタグ」を表せない(§3.7)。
//
// 6個以上の選択肢から検索しながら複数選ぶ画面なので MultiCombobox を使う
// (SmartHR デザインシステムの使い分け。5個以下なら Checkbox)。
type Props = {
  candidates: Tag[];
  selected: string[];
  onChange: (names: string[]) => void;
  max: number;
  loadFailed: boolean;
};

type Item = { value: string; label: string };

const toItem = (name: string): Item => ({ value: name, label: name });

export function TagPicker({ candidates, selected, onChange, max, loadFailed }: Props) {
  const reachedMax = selected.length >= max;

  // 選択済みは候補から外す。MultiCombobox は選択済みも一覧に残すので、
  // 外さないと「もう付いているタグ」を何度も選べてしまう
  const items = useMemo(
    () => candidates.filter((tag) => !selected.includes(tag.name)).map((tag) => toItem(tag.name)),
    [candidates, selected],
  );

  const selectedItems = useMemo(() => selected.map(toItem), [selected]);

  // 候補が取れなくても、打って足すことはできる。入力欄ごと消すと
  // 「タグを付けられない画面」になってしまう
  return (
    <>
      {loadFailed && (
        <Text size="S" color="TEXT_GREY">
          候補を読み込めませんでした。打ち込んで足すことはできます。
        </Text>
      )}
      <MultiCombobox
        items={items}
        selectedItems={selectedItems}
        // 上限に達したら足せなくする。打ててから弾かれるより、打てない方が早く伝わる
        creatable={!reachedMax}
        selectedItemEllipsis
        width="100%"
        dropdownHelpMessage={
          reachedMax ? `${max}件まで選べます。外してから足してください。` : undefined
        }
        onSelect={(item) => {
          if (reachedMax) return;
          onChange([...selected, String(item.value)]);
        }}
        onAdd={(label) => {
          const name = label.trim();
          // 同じ名前を2回足させない。サーバー側でも弾けるが、
          // 押した直後に消える方が理由が分かる
          if (name === "" || selected.includes(name) || reachedMax) return;
          onChange([...selected, name]);
        }}
        onDelete={(item) => onChange(selected.filter((name) => name !== item.value))}
      />
    </>
  );
}
