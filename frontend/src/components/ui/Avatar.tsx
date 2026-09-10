// 名前の1文字を丸で囲んだ印。
//
// 画像はアップロードしない(CLAUDE.md §10)。それでもプロフィールの先頭に
// 手がかりが何も無いと、名前だけが並んで誰の画面か掴みにくい。
// connpass もプロフィールの先頭にアイコンを置いていて、そこだけを写す。
//
// 色は id から決める。同じ人はいつも同じ色になるので、一覧で見分けが付く。
// 名前から決めると、同姓の人が同じ色になる。
//
// すべて白文字とのコントラストが 4.5:1 以上になる濃さを選んでいる。
// 意味は持たせない。色でしか区別できない情報はここに載せない
const COLORS = [
  "bg-blue-700",
  "bg-emerald-700",
  "bg-violet-700",
  "bg-rose-700",
  "bg-amber-700",
  "bg-cyan-800",
];

const SIZE = {
  md: "size-8 text-sm",
  lg: "size-14 text-xl",
} as const;

export function Avatar({
  id,
  name,
  size = "md",
}: {
  id: number;
  name: string;
  size?: keyof typeof SIZE;
}) {
  return (
    // 名前は隣に必ず出るので、支援技術には読ませない。
    // 読ませると「山 山田太郎」のように1文字目が二重に聞こえる
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${COLORS[id % COLORS.length]} ${SIZE[size]}`}
    >
      {initial(name)}
    </span>
  );
}

// サロゲートペアを1文字として数える。絵文字を名前に入れる人がいても割れない
function initial(name: string): string {
  return [...name.trim()][0] ?? "?";
}
