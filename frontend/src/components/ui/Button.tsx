import { buttonClassName, type ButtonSize, type ButtonVariant } from "./buttonStyle";

// wireframe-admin-ver2.html の .wf-btn に対応する。
//
// 新WFは <style> に生CSSを持っているが、そのまま持ち込まない。
// Tailwind のユーティリティを直接書く(CLAUDE.md §4)。
// wf-btn primary sm  →  <Button variant="primary" size="sm">

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // 処理中かどうか。disabled による薄さだけだと、押せなかったのか
  // 処理中なのかが分からず連打を誘発する(Issue #46)
  busy?: boolean;
  // 処理中に出すラベル。busy と対で渡す。省略すると表示は変わらない
  busyLabel?: React.ReactNode;
};

export function Button({
  variant = "default",
  size = "md",
  busy = false,
  busyLabel,
  disabled,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      // type を明示しないと、フォームの中では submit になる。
      // 呼び出し側で type="submit" を渡せば上書きされる
      type="button"
      // false を渡すと aria-busy="false" が出てしまうので、そのときは属性ごと落とす
      aria-busy={busy || undefined}
      // 処理中は二重送信させない。呼び出し側の disabled とどちらかが真なら無効
      disabled={disabled === true || busy}
      className={`${buttonClassName(variant, size)} ${className}`}
      {...rest}
    >
      {busy && busyLabel !== undefined ? busyLabel : children}
    </button>
  );
}
