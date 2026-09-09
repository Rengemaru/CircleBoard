import { Link } from "react-router-dom";
import { Cluster, Heading, TextLink } from "smarthr-ui";

// 画面の中の1区切りに付ける見出し(docs/instructions.md Phase 8-4)。
//
// link を渡すと右端に「すべて見る →」が出る。トップページのように
// 一覧の一部だけを見せている場所で、続きの在り処を示すために使う。
//
// 見出しレベルは書かない。smarthr-ui の Heading は Section の入れ子の
// 深さからレベルを決めるので、呼び出し側は Section で囲むこと。
export function SectionHeading({
  children,
  link,
  linkLabel = "すべて見る →",
}: {
  children: React.ReactNode;
  link?: string;
  linkLabel?: string;
}) {
  return (
    <Cluster
      align="baseline"
      justify="space-between"
      className="mb-3 border-b-2 border-gray-200 pb-1.5"
    >
      <Heading type="blockTitle">{children}</Heading>
      {link !== undefined && (
        <TextLink elementAs={Link} to={link} className="text-xs">
          {linkLabel}
        </TextLink>
      )}
    </Cluster>
  );
}
