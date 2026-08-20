// wireframe-admin-ver2.html の .wf-btn に対応する。
//
// 新WFは <style> に生CSSを持っているが、そのまま持ち込まない。
// Tailwind のユーティリティを直接書く(CLAUDE.md §4)。
// wf-btn primary sm  →  <Button variant="primary" size="sm">
type Variant = "default" | "primary" | "danger" | "dangerFill" | "success" | "ghost";
type Size = "md" | "sm" | "xs";

const VARIANT: Record<Variant, string> = {
  default: "border-gray-900 bg-white text-gray-900",
  primary: "border-gray-900 bg-gray-900 text-white",
  danger: "border-red-600 bg-white text-red-600",
  dangerFill: "border-red-600 bg-red-600 text-white",
  success: "border-green-600 bg-white text-green-600",
  ghost: "border-gray-300 bg-white text-gray-500",
};

const SIZE: Record<Size, string> = {
  md: "px-4 py-[7px] text-[13px]",
  sm: "px-[10px] py-1 text-xs",
  xs: "px-2 py-[3px] text-[11px]",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = "default", size = "md", className = "", ...rest }: Props) {
  return (
    <button
      // type を明示しないと、フォームの中では submit になる。
      // 呼び出し側で type="submit" を渡せば上書きされる
      type="button"
      className={`rounded-sm border-[1.5px] font-semibold disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    />
  );
}
