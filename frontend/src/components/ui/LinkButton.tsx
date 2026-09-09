import { Link } from "react-router-dom";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./buttonStyle";

// ボタンの見た目をした画面内リンク。
//
// <Link><Button>…</Button></Link> と書くと <a><button></button></a> という
// 不正な入れ子になる。スクリーンリーダーの読み上げが崩れ、ボタンに見えるのに
// Space キーで反応しない(Issue #54)。
//
// 遷移するものはリンク、処理を実行するものはボタン。見た目は同じでよいが、
// 要素は分ける。見た目は Button と同じ関数から作るので、片方だけずれない。
export function LinkButton({
  to,
  variant,
  size,
  className = "",
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} className={`inline-block ${buttonClassName(variant, size)} ${className}`}>
      {children}
    </Link>
  );
}
