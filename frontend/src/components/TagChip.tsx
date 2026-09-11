import { Chip } from "./ui/Chip";

// 付いているタグを1つ表示する。企画の一覧・詳細とプロフィールで同じものを使う。
//
// 見た目は ui/Chip に任せる。ここで smarthr-ui の Chip を直に呼ぶと、
// タグだけ別の大きさで出る道が2本できる。
//
// 入力は20文字まで通す(docs/spec-tags.md §3.2)ので、そのまま出すと
// Substance Painter のような長い名前で行が押し広げられる。
//
// **文字数ではなく幅で切る(§3.3)。** em は「フォントサイズ1文字ぶんの幅」なので
// 8em が全角8文字ぶんにあたり、半角文字は自動的に狭く数えられる。
// 日本語か英語かを判定する必要がなく、Web開発 のような混在タグでも迷わない。
// 省略記号もブラウザが … を1文字で入れるので、... の3文字ぶんを使わない。
//
// Ruby と TypeScript に同じ文字数計算を2本置かずに済むのも、この方式にした理由
// (user.rb の graduated? で戒めているのと同じ問題)。
//
// title を付けるのは、切られた名前を読む手段をどこかに残すため。
// 候補リスト(TagPicker / TagFilter)では切らない。選ぶときに読めないと選べない。
export function TagChip({ name }: { name: string }) {
  return (
    <Chip className="max-w-[8em] truncate" title={name}>
      {name}
    </Chip>
  );
}
