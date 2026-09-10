import { Cluster, Heading, Panel as ShrPanel, Section } from "smarthr-ui";

// 白い枠で1つの塊を囲む箱(docs/instructions.md Phase 8-4)。
//
// 中身は smarthr-ui の Panel（＝Base に余白と角丸を付けたもの）。
// 見出しを Section で囲んでいるのは、smarthr-ui が Heading を
// SectioningContent の中に置くことを求めているため。見出しレベルを
// 自分で h2 / h3 と決めずに、入れ子の深さから決まる形にできる。
export function Panel({
  title,
  action,
  className = "",
  children,
}: {
  title?: string;
  // タイトル行の右端に置くボタン（例: ⑥「ピン留めを解除」）
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // セクション間は 32px。SmartHR の「余白とレイアウト」の基準
    // (16px を 1 として、セクション間 2)。16px だと、パネルの中の
    // 余白(20px)より外の余白の方が狭くなり、区切りに見えない
    <Section className={`mb-8 block ${className}`}>
      <ShrPanel padding={1.25}>
        {title !== undefined && (
          <Cluster
            align="center"
            justify="space-between"
            className="mb-3.5 border-b border-gray-200 pb-2.5"
          >
            <Heading type="blockTitle">{title}</Heading>
            {action}
          </Cluster>
        )}
        {children}
      </ShrPanel>
    </Section>
  );
}
