// ボタンの見た目。Button と LinkButton が共有する。
//
// コンポーネントと同じファイルに置くと react-refresh の警告が出るため、
// 関数だけを別ファイルにしている(Issue #54)。
export type ButtonVariant = "default" | "primary" | "danger" | "dangerFill" | "success" | "ghost";
export type ButtonSize = "md" | "sm" | "xs";

const VARIANT: Record<ButtonVariant, string> = {
  default: "border-gray-900 bg-white text-gray-900",
  primary: "border-gray-900 bg-gray-900 text-white",
  danger: "border-red-600 bg-white text-red-600",
  dangerFill: "border-red-600 bg-red-600 text-white",
  success: "border-green-600 bg-white text-green-600",
  ghost: "border-gray-300 bg-white text-gray-500",
};

const SIZE: Record<ButtonSize, string> = {
  md: "px-4 py-[7px] text-[13px]",
  sm: "px-[10px] py-1 text-xs",
  xs: "px-2 py-[3px] text-[11px]",
};

export function buttonClassName(
  variant: ButtonVariant = "default",
  size: ButtonSize = "md",
): string {
  // フォーカスの指定が無く、キーボードでどこにいるか分からなかった(Issue #57)。
  // ring-offset で要素の外側に出すので、隣の要素と重なっても四辺が見える
  const focus =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1";

  return `rounded border-[1.5px] font-semibold disabled:opacity-40 ${focus} ${VARIANT[variant]} ${SIZE[size]}`;
}
