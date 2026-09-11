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
  // 呼ばれ方。名前の横に出す短い自由入力(spec-v2.2.md §2.1)
  pronouns: string | null;
  bio: string | null;
  enrollment_year: number;
  graduation_year: number;
  // 学年(B1 / M1 / D2 …)。年度の切り替わりを跨ぐ規則なのでサーバーが出す。
  // 卒業後と算出できないときは null(backend の User#grade)
  grade: string | null;
  // 卒業したかどうか。grade が null のとき、卒業なのか算出できないだけなのかを
  // 区別するために要る。年度の規則を画面側に持たない(backend の User#graduated?)
  graduated: boolean;
  // スキルは企画のタグと同じ語彙を使う(docs/spec-my-page.md §2)
  tags: Tag[];
  links: ProfileLink[];
  // email は本人にだけサーバーが返す。他人のプロフィールではキーごと存在しない
  // (docs/spec-my-page.md §5)。省略可能であることを型でも表す
  email?: string;
};
