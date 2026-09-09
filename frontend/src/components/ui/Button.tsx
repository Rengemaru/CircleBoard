import { Button as ShrButton } from "smarthr-ui";
import { shrSize, shrVariant, type ButtonSize, type ButtonVariant } from "./buttonVariant";

// smarthr-ui の Button に、このリポジトリの呼び出し語をかぶせたもの
// (docs/instructions.md Phase 8-3)。
//
// 直接 smarthr-ui の Button を呼ばないのは、variant / size の対応表を
// buttonVariant.ts の1箇所に集めておくため。busy の扱いもここに閉じる。

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
  children,
  ...rest
}: Props) {
  return (
    <ShrButton
      // type を明示しないと、フォームの中では submit になる。
      // 呼び出し側で type="submit" を渡せば rest が上書きする
      type="button"
      variant={shrVariant(variant)}
      size={shrSize(size)}
      loading={busy}
      // loading はスピナーを出すだけなので、押せない状態は自分で作る。
      // 呼び出し側の disabled とどちらかが真なら無効
      disabled={disabled === true || busy}
      // false を渡すと aria-busy="false" が出てしまうので、そのときは属性ごと落とす
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy && busyLabel !== undefined ? busyLabel : children}
    </ShrButton>
  );
}
