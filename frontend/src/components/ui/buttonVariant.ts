import type { ComponentProps } from "react";
import type { Button } from "smarthr-ui";

// CircleBoard 側の呼び出し語を smarthr-ui の Button の語に翻訳する。
//
// 呼び出し側（35箇所）を書き換えず、対応表をここ1箇所に置いている。
// どの意味をどう見せるかは今後動く可能性が高く、そのたびに全画面を
// 触るのは避けたいため(docs/instructions.md Phase 8-3)。
//
// コンポーネントと同じファイルに置くと react-refresh の警告が出るので
// 別ファイルにしている(Issue #54)。
export type ButtonVariant = "default" | "primary" | "danger" | "dangerFill" | "success" | "ghost";
export type ButtonSize = "md" | "sm" | "xs";

// tertiary を除くのは AnchorButton が受け付けないため。Button と LinkButton で
// 同じ対応表を使う以上、両方が受け取れる範囲に閉じておく
type ShrVariant = Exclude<NonNullable<ComponentProps<typeof Button>["variant"]>, "tertiary">;
type ShrSize = NonNullable<ComponentProps<typeof Button>["size"]>;

// danger（枠線）は一覧に並ぶ引き金のボタン、dangerFill（塗り）は確認ダイアログの
// 確定ボタン、という使い分けだった。smarthr-ui の danger は塗り1種類しか無いので、
// 塗りを確定ボタンだけに残し、引き金は secondary にする。
// SmartHR も「Danger は主に削除ダイアログで使用する」としている。
// 一覧の各行に塗りの danger が2つ並ぶと、どちらが取り返しのつかない操作なのかが
// かえって分からない（実際に /admin/users で「停止」と「完全に削除」が並んで見えた）。
//
// success（緑の枠線）も無い。「復旧」「停止解除」を緑で表していたが、
// 色を落としてもラベルで何が起きるかは分かる。SmartHR のガイドラインも
// 色だけで状態を表さないことを求めている。
//
// ghost は text が近いが、「単独で使うならアイコンを付ける」が必須。
// アイコンの選定は別の判断なので、ここでは secondary に倒す。
const VARIANT: Record<ButtonVariant, ShrVariant> = {
  default: "secondary",
  primary: "primary",
  danger: "secondary",
  dangerFill: "danger",
  success: "secondary",
  ghost: "secondary",
};

// smarthr-ui のサイズは M と S の2つだけ。xs は S に寄せる
const SIZE: Record<ButtonSize, ShrSize> = {
  md: "M",
  sm: "S",
  xs: "S",
};

export function shrVariant(variant: ButtonVariant = "default"): ShrVariant {
  return VARIANT[variant];
}

export function shrSize(size: ButtonSize = "md"): ShrSize {
  return SIZE[size];
}
