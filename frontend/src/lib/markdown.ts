// 概要と自己紹介の Markdown を扱う道具（Issue #303）。
//
// コンポーネントから切り離して純関数にしてある。react-refresh の警告を避ける
// ためと、Vitest を入れたときにそのままテストを書けるようにするため。

// 行頭が「コードフェンスの開始/終了」かどうか。
//
// CommonMark のフェンスは ``` と ~~~ の両方で、3個以上、行頭に0〜3個の
// スペースを許す。**この判定を雑にすると、コード例の中の # を書き換えてしまう。**
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

// 見出し1だけを見出しとして扱う（オーナー決定 2026-09-13）。
// `##` 以降は**そのまま文字として出す**ので、先頭の # をエスケープしておく。
//
// ATX 見出しになるのは「# のあとに空白か行末が続く」ときだけ。
// `##あああ` は元々見出しではないので触らない（触ると \## と表示されてしまう）。
const SUB_HEADING = /^( {0,3})(#{2,})(\s|$)/;

/**
 * `##` 以降の見出しを、ただの文字に変える。
 *
 * コードブロックの中は書き換えない。中に `## コメント` があったら、それは
 * コードとして書かれたものなので、そのまま残す必要がある。
 */
export function escapeSubHeadings(source: string): string {
  let inFence = false;
  let fenceMarker = "";

  return source
    .split("\n")
    .map((line) => {
      const fence = line.match(FENCE);
      if (fence) {
        const marker = fence[1][0];
        if (!inFence) {
          inFence = true;
          fenceMarker = marker;
          return line;
        }
        // 閉じるのは同じ種類の記号だけ。``` の中の ~~~ では閉じない
        if (marker === fenceMarker) inFence = false;
        return line;
      }
      if (inFence) return line;

      return line.replace(
        SUB_HEADING,
        (_m, indent, hashes, after) => indent + "\\" + hashes + after,
      );
    })
    .join("\n");
}

// 一覧で2行に切って出すときに使う。記法の記号が見えないようにするだけで、
// 完全な変換ではない（切られるので、そこまでの精度は要らない）。
const PLAIN_RULES: Array<[RegExp, string]> = [
  [/^ {0,3}(`{3,}|~{3,}).*$/gm, ""], // コードフェンスの行
  [/^ {0,3}#{1,6}\s+/gm, ""], // 見出しの #
  [/^ {0,3}>\s?/gm, ""], // 引用
  [/^ {0,3}([-*+]|\d+\.)\s+/gm, ""], // 箇条書き・番号付き
  [/^ {0,3}\|.*\|\s*$/gm, ""], // 表の行
  [/!\[([^\]]*)\]\([^)]*\)/g, "$1"], // 画像 → alt だけ
  [/\[([^\]]*)\]\([^)]*\)/g, "$1"], // リンク → 文字だけ
  [/(\*\*|__)(.*?)\1/g, "$2"], // 太字
  [/(\*|_)(.*?)\1/g, "$2"], // 斜体
  [/~~(.*?)~~/g, "$1"], // 打ち消し
  [/`([^`]*)`/g, "$1"], // インラインコード
];

/**
 * Markdown から記法を落として、素のテキストにする。
 *
 * 一覧の2行表示に渡すためのもの。**改行は空白に畳む。** smarthr-ui の Text は
 * `-webkit-line-clamp` で切るので、ブロック要素や改行が混ざると
 * 「2行」の意味が変わる。
 */
export function toPlainText(source: string): string {
  const stripped = PLAIN_RULES.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    source,
  );
  return stripped.replace(/\s+/g, " ").trim();
}
