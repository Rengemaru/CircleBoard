// プロフィール(docs/api-spec.md §4.5)。JSONキーは snake_case のまま扱う
// (CLAUDE.md §4)。
import type { Tag } from "./event";

export type ProfileLink = {
  id: number;
  label: string;
  url: string;
};

export type Profile = {
  id: number;
  name: string;
  // 未入力は null。空文字ではない
  department: string | null;
  bio: string | null;
  enrollment_year: number;
  graduation_year: number;
  // スキルは企画のタグと同じ語彙を使う(docs/spec-my-page.md §2)
  tags: Tag[];
  links: ProfileLink[];
  // email は本人にだけサーバーが返す。他人のプロフィールではキーごと存在しない
  // (docs/spec-my-page.md §5)。省略可能であることを型でも表す
  email?: string;
};
