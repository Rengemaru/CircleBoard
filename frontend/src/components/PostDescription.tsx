import { Markdown } from "./Markdown";
import { Panel } from "./ui/Panel";
import { splitSections } from "../lib/markdownSections";

// 企画の概要（Issue #303）。
//
// `# 見出し` ごとにパネルへ分ける。**見出しは枠の外、中身は枠の中**で、
// 節と節の間に余白が入る（参考: SmartHR の採用ページ）。
//
// もとは1枚の `<Panel title="概要">` に全文を流し込んでいた。長い説明が
// のっぺり続くので、読む側が必要な所だけ拾えなかった。
//
// 見出しが1つも無いときは今までどおり「概要」1枚にする。**既存の概要は
// ほとんどが素の文章**なので、そちらが壊れないことを優先する。
export function PostDescription({ source }: { source: string }) {
  const sections = splitSections(source);

  // 空の概要は保存できない（presence の検証がある）ので、ここには来ない。
  // 来たとしても空のパネルを出さない
  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section, index) => (
        <Panel
          // 見出しは重複しうる（同じ名前の節を2つ書ける）ので、位置も混ぜる
          key={`${index}-${section.title ?? ""}`}
          title={section.title ?? "概要"}
        >
          <Markdown source={section.body} />
        </Panel>
      ))}
    </>
  );
}
