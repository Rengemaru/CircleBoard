import { Link } from "react-router-dom";
import { TextLink } from "smarthr-ui";

// 部員の名前から、その人のプロフィールへ行く導線(docs/spec-my-page.md §4.4)。
//
// Chip では出さない。SmartHR は「Chip 内のテキストの一部または全部に
// リンクを含めず、リンクを使用したい場合は TextLink を使う」を [must] と
// している。参加者一覧はもともと Chip で並べていたが、押せる要素に変える
// ならタグの見た目のままにはできない。
//
// この部品を出すかどうかは呼び出し側が決める。未ログインでは
// サーバーが participants も owner もキーごと落としているので、
// そもそも名前が無い(CLAUDE.md §3-2)。
export function UserLink({ id, name }: { id: number; name: string }) {
  return (
    <TextLink elementAs={Link} to={`/users/${id}`} size="S">
      {name}
    </TextLink>
  );
}
