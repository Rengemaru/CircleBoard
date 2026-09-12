import { apiFetch } from "./client";
import type { Profile } from "../types/user";

// プロフィール(docs/api-spec.md §4.5)。ログイン必須で、未ログインには
// 401 が返る(session と違い null は返らない)。
export async function fetchMyProfile(): Promise<Profile> {
  return apiFetch<Profile>("/api/users/me");
}

// 他人のプロフィール。email はサーバーがキーごと落とすので、
// 同じ Profile 型で受けられる(docs/spec-my-page.md §5)
export async function fetchProfile(id: number): Promise<Profile> {
  return apiFetch<Profile>(`/api/users/${id}`);
}

// 更新できるのは自分のプロフィールだけ。パスに id を取らないのは
// サーバー側の設計と対になっている(docs/spec-my-page.md §6.3)。
//
// 送らなかったキーには触らない。学科と自己紹介だけを直したいときに、
// スキルとリンクを毎回送り直さずに済む
export type ProfileInput = {
  department?: string;
  pronouns?: string;
  bio?: string;
  // 送った配列でまるごと置き換わる。空配列は「全部消す」
  tag_names?: string[];
  // id は送らない。サーバーが作り直すので、送っても使われない
  links?: { label: string; url: string }[];
};

// パスワードはプロフィールと別の入口。現在のパスワードを必ず送る。
// ログイン中であることは「本人である」ことの証明にならない
export async function changeMyPassword(currentPassword: string, password: string): Promise<void> {
  await apiFetch<void>("/api/users/me/password", {
    method: "PATCH",
    body: JSON.stringify({ current_password: currentPassword, password }),
  });
}

export async function updateMyProfile(input: ProfileInput): Promise<Profile> {
  return apiFetch<Profile>("/api/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
