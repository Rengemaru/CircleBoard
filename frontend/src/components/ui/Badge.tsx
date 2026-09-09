import { StatusLabel } from "smarthr-ui";
import type { ComponentProps } from "react";

// 企画やアカウントの「状態」を出すラベル(docs/instructions.md Phase 8-4)。
//
// 状態の名前をそのまま型にしている。色を呼び出し側から渡せるようにすると、
// 同じ「募集中」が画面ごとに違う色になる。
//
// ピン留めや権限のような「状態ではない属性」はここに入れない。
// SmartHR は1つのオブジェクトに StatusLabel を複数付けないことを求めており、
// 並べ替えや絞り込みの基準になる状態にだけ使う。属性は Chip で出す。
type Tone = "recruiting" | "inprogress" | "completed" | "active" | "suspended" | "grad" | "trashed";

type StatusType = NonNullable<ComponentProps<typeof StatusLabel>["type"]>;

// error / warning は「異常が起きている」ことを表す色。停止も削除も
// 管理者が意図してやった操作なので、そこまで強い色は当てない
const TONE: Record<Tone, StatusType> = {
  recruiting: "blue",
  inprogress: "green",
  completed: "grey",
  active: "green",
  suspended: "red",
  grad: "grey",
  trashed: "red",
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <StatusLabel type={TONE[tone]}>{children}</StatusLabel>;
}
