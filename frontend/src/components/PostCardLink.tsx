import { Link } from "react-router-dom";
import { postPath } from "../lib/postPath";

// カード/行の枠全体を、その企画の詳細画面へのリンクにする(Issue #323)。
//
// もとはタイトルの文字だけがリンクで、当たり判定が狭く押しにくかった。
// 枠ごと1つの <a> にして、どこを押しても開けるようにする。
//
// **枠の中に別のリンクやボタンを置かないこと。** <a> の入れ子は不正なHTMLになる。
// 一覧のカードに載るのは表示専用の要素(日付・タグの Chip・StatusLabel)だけなので
// これで成立する。タイトルも TextLink をやめ、ただの見出し/テキストに戻す。
//
// 色と下線: Tailwind の preflight が a の color と text-decoration を inherit に
// 倒すので、中の文字はリンクにしても青くならず下線も付かない(見た目は元のまま)。
//
// パスの組み立ては PostLink と同じ postPath に寄せる。2箇所に書くと
// 種別が増えたときに直し漏れる。
export function PostCardLink({
  kind,
  id,
  className,
  children,
}: {
  kind: "event" | "project";
  id: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={postPath(kind, id)}
      // block: 枠全体をクリック対象にする。hover: 押せることを色でも示す。
      // focus-visible: キーボードで今どこに居るかを枠の内側に出す。offset を負に
      // するのは、Base/ListPanel の overflow:hidden や隣の枠に切られないため。
      className={`block transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}
