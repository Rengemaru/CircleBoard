// マイページのリンク行(docs/spec-my-page.md §4.2)。
//
// 画面の状態とAPIに送る形が違うので、その橋渡しをここに置く。
// 画面は「空の行」を持てるが、APIには空の行を送らない。
export type LinkRow = {
  label: string;
  url: string;
};

export const MAX_LINKS = 3;

// サーバー側の UserLink::ALLOWED_URL_SCHEME と同じ条件。
// **こちらは正ではない。** フロントだけの検証は curl で回避できるので、
// サーバー側を正とする(docs/spec-my-page.md §6.1)。
// ここで見るのは、送ってから断られるまで待たせないため
const ALLOWED_URL_SCHEME = /^https?:\/\//;

export function emptyRow(): LinkRow {
  return { label: "", url: "" };
}

// 両方とも空の行は「まだ書いていない行」として捨てる。
// 3行分の入力欄を出しておいて、1行だけ書いて保存できるようにするため
function isBlank(row: LinkRow): boolean {
  return row.label.trim() === "" && row.url.trim() === "";
}

export function toPayload(rows: LinkRow[]): { label: string; url: string }[] {
  return rows
    .filter((row) => !isBlank(row))
    .map((row) => ({ label: row.label.trim(), url: row.url.trim() }));
}

// 保存前に画面で伝える内容。1つ目だけを返す。全部並べると、
// どれを直せばよいのか分からなくなる
export function validateLinks(rows: LinkRow[]): string | null {
  for (const row of rows) {
    if (isBlank(row)) continue;

    // 片方だけ書かれている行は、書きかけなのか消し忘れなのか分からない
    if (row.label.trim() === "") return "リンクのラベルを入力してください。";
    if (row.url.trim() === "") return "リンクのURLを入力してください。";
    if (!ALLOWED_URL_SCHEME.test(row.url.trim())) {
      return "リンクのURLは http:// または https:// で始めてください。";
    }
  }

  return null;
}
