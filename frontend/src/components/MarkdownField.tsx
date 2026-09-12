import { useId, useState } from "react";
import { TabBar, TabItem, Text, Textarea } from "smarthr-ui";
import { Markdown } from "./Markdown";

type Mode = "edit" | "preview";

// Markdown で書く入力欄（Issue #303）。編集とプレビューをタブで切り替える。
//
// **テキストエリアは切り替えても残す。** 外すと undo の履歴とカーソル位置が
// 消えるので、プレビューを一度見ただけで Ctrl+Z が効かなくなる。
// 代わりに `hidden` で隠し、隠している間は `required` を外す。付けたままだと
// 「フォーカスできない必須項目がある」で送信が**黙って**止まる。
//
// プレビューは `Markdown` をそのまま使う。企画の概要は実際には
// `PostDescription` が `# 見出し` ごとにパネルへ割るが、フォームの中で
// パネルを入れ子にすると枠が二重になる。文字の見え方は同じ。
export function MarkdownField({
  value,
  onChange,
  rows,
  maxLetters,
  placeholder,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  rows: number;
  maxLetters: number;
  placeholder?: string;
  required?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("edit");
  // 1画面に2つ置いても id がぶつからないようにする
  const id = useId();

  return (
    <>
      <TabBar>
        <TabItem id={`${id}-edit`} selected={mode === "edit"} onClick={() => setMode("edit")}>
          編集
        </TabItem>
        <TabItem
          id={`${id}-preview`}
          selected={mode === "preview"}
          onClick={() => setMode("preview")}
        >
          プレビュー
        </TabItem>
      </TabBar>

      <div hidden={mode === "preview"} className="mt-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLetters={maxLetters}
          placeholder={placeholder}
          required={required && mode === "edit"}
          width="100%"
        />
      </div>

      {mode === "preview" && (
        // 高さを行数に合わせる。切り替えるたびにページが伸び縮みすると、
        // 下にある項目の位置が動いて押し間違える
        <div
          className="mt-2 rounded border border-gray-300 p-3"
          style={{ minHeight: `${rows * 1.7}em` }}
        >
          {value === "" ? (
            <Text size="S" color="TEXT_GREY">
              まだ何も書かれていません。
            </Text>
          ) : (
            <Markdown source={value} />
          )}
        </div>
      )}
    </>
  );
}
