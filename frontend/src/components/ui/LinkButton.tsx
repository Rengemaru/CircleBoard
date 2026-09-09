import { Link } from "react-router-dom";
import { AnchorButton } from "smarthr-ui";
import { shrSize, shrVariant, type ButtonSize, type ButtonVariant } from "./buttonVariant";

// ボタンの見た目をした画面内リンク。
//
// <Link><Button>…</Button></Link> と書くと <a><button></button></a> という
// 不正な入れ子になる。スクリーンリーダーの読み上げが崩れ、ボタンに見えるのに
// Space キーで反応しない(Issue #54)。
//
// 遷移するものはリンク、処理を実行するものはボタン。要素は分けるが、
// 見た目は Button と同じ対応表から作るので片方だけずれない。
// smarthr-ui 側も AnchorButton を「リンクをボタンに見せる」用に分けている。
export function LinkButton({
  to,
  variant,
  size,
  className,
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <AnchorButton
      elementAs={Link}
      to={to}
      variant={shrVariant(variant)}
      size={shrSize(size)}
      className={className}
    >
      {children}
    </AnchorButton>
  );
}
