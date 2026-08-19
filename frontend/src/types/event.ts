// APIレスポンスの型。JSONキーは snake_case のまま扱う(CLAUDE.md §4)。
// フロントで camelCase に変換しない。変換層を挟むと、APIの実物と
// 画面のコードを突き合わせるときに毎回頭の中で読み替えが要る。

export type Tag = {
  id: number;
  name: string;
};

// 型名を Event にすると DOM の組み込み型 Event を隠してしまうため避けている。
export type EventSummary = {
  id: number;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  capacity: number | null;
  participants_count: number;
  status: "recruiting" | "completed";
  external_url: string | null;
  tags: Tag[];
  // owner はログイン時のみサーバーが返す。未ログインではキーごと存在しない
  // (docs/spec-v2.2.md §4.2)。省略可能であることを型でも表す
  owner?: { id: number; name: string };
};
