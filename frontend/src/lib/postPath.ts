// 企画の種別から詳細画面のパスを組み立てる。
//
// 行き先が種別で変わるので、組み立てをここ1箇所に置く。各画面で組み立てると
// 種別が増えたときに直し漏れる。PostLink と PostCardLink の両方がこれを使う。
export function postPath(kind: "event" | "project", id: number): string {
  return `/${kind === "event" ? "events" : "projects"}/${id}`;
}
