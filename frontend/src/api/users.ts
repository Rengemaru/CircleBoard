import { apiFetch } from "./client";
import type { Profile } from "../types/user";

// プロフィール(docs/api-spec.md §4.5)。ログイン必須で、未ログインには
// 401 が返る(session と違い null は返らない)。
//
// 他人のプロフィール(GET /api/users/:id)を読む関数は M-7 で足す。
// 使う画面と一緒に入れないと、消し忘れたのか未実装なのか分からなくなる
export async function fetchMyProfile(): Promise<Profile> {
  return apiFetch<Profile>("/api/users/me");
}

// 更新できるのは自分のプロフィールだけ。パスに id を取らないのは
// サーバー側の設計と対になっている(docs/spec-my-page.md §6.3)。
//
// 送らなかったキーには触らない。学科と自己紹介だけを直したいときに、
// スキルとリンクを毎回送り直さずに済む
export type ProfileInput = {
  department?: string;
  bio?: string;
  // 送った配列でまるごと置き換わる。空配列は「全部消す」
  tag_ids?: number[];
  // id は送らない。サーバーが作り直すので、送っても使われない
  links?: { label: string; url: string }[];
};

export async function updateMyProfile(input: ProfileInput): Promise<Profile> {
  return apiFetch<Profile>("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
