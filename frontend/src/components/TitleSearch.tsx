import { useEffect, useState } from "react";
import { SearchInput } from "smarthr-ui";

// 企画名の部分一致検索。イベント一覧とプロジェクト一覧で共有する。
//
// 絞り込みは URL を唯一の状態にしているので(?tag_ids= と同じ)、
// 検索語も ?q= に置いて共有できるようにする。
//
// **1文字ごとにサーバーへ投げない。** 打ち終わるのを待ってから送る。
// 入力中の文字はこの中だけで持ち、落ち着いたところで親に渡す。
const DELAY_MS = 300;

export function TitleSearch({
  value,
  onChange,
  label,
}: {
  // URL に入っている語。この部品の外が持つ
  value: string;
  onChange: (query: string) => void;
  label: string;
}) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);

  // 戻る操作や共有リンクを開いたときに、URL 側の変化へ追従する。
  // これが無いと、入力欄だけが前の語のまま取り残される。
  //
  // useEffect ではなくレンダー中に直している。React の「prop が変わったら
  // state を調整する」やり方で、描き直しを1回余分に挟まずに済む
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  useEffect(() => {
    // 追従した直後は送り返さない。同じ語で往復し続けることになる
    if (text === value) return;

    const timer = setTimeout(() => onChange(text), DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    // SearchInput の width は中の input にしか効かず、外側の幅は決まらない。
    // 伸ばす役目は包む div に持たせる(AdminUsersPage と同じ)
    <div className="min-w-[200px] flex-1">
      <SearchInput
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={label}
        tooltipMessage={label}
        width="100%"
      />
    </div>
  );
}
