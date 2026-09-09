import { NotificationBar } from "smarthr-ui";
import type { ComponentProps } from "react";

// 画面の中に置く1行の知らせ(docs/instructions.md Phase 8-4)。
//
// 操作の結果（成功・失敗）と、その画面で知っておいてほしいこと（注意書き）の
// 両方に使う。SmartHR は画面全体に出す NotificationBar をフィードバック専用と
// しているが、base="base" を付けて画面の中に置く形は注意書きにも使ってよい。
type Tone = "info" | "success" | "warning" | "danger";

type BarType = ComponentProps<typeof NotificationBar>["type"];

// danger だけ名前が違う。CircleBoard 側は「赤で出す」という見た目の語で、
// smarthr-ui 側は「エラーである」という意味の語を使っている
const TONE: Record<Tone, BarType> = {
  info: "info",
  success: "success",
  warning: "warning",
  danger: "error",
};

export function Note({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    // 下の余白は外側の div に付ける。NotificationBar の className は
    // base="base" が被せる Panel の「内側」に付き、その Panel は
    // overflow: hidden なので margin が中に取り込まれて余白にならない
    <div className="mb-4">
      <NotificationBar type={TONE[tone]} base="base">
        {children}
      </NotificationBar>
    </div>
  );
}
